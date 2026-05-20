<template>
  <div>
    <ClassPicker @change="reload" />
    <div class="action-bar">
      <el-button type="primary" @click="openCreate">+ Thêm cột điểm</el-button>
      <el-button @click="exportCsv">↓ Xuất Excel</el-button>
    </div>

    <el-card>
      <div class="table-wrap">
        <table class="grade-table">
          <thead>
            <tr>
              <th class="left">Học viên</th>
              <th v-for="i in items" :key="i.id" class="center">
                <div class="head-cell">
                  <span>{{ i.name }}</span>
                  <span class="weight">HT {{ i.weight }}% / {{ i.maxScore }}đ</span>
                  <el-button text size="small" style="padding:0;font-size:10px" @click="openEdit(i)">Sửa</el-button>
                </div>
              </th>
              <th class="center">Điểm TB</th>
              <th class="center">Xếp loại</th>
              <th class="center">Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="st in students" :key="st.id">
              <td>
                <div class="student-cell">
                  <el-avatar :size="26" :style="{ background:'#E6F1FB', color:'#185FA5', fontSize:'10px', fontWeight:600 }">
                    {{ initials(st.fullName) }}
                  </el-avatar>
                  <span>{{ st.fullName }}</span>
                </div>
              </td>
              <td v-for="i in items" :key="i.id" class="center">
                <el-input-number
                  :model-value="getScore(st.id, i.id)"
                  @change="(v) => saveScore(st.id, i.id, v)"
                  :min="0" :max="i.maxScore" :precision="1" :step="0.5"
                  size="small" controls-position="right" style="width: 88px;"
                />
              </td>
              <td class="center fw-600">{{ avgFor(st.id) ?? '—' }}</td>
              <td class="center">
                <span :class="['badge', gradeClassify(avgFor(st.id)).cls]">
                  {{ gradeClassify(avgFor(st.id)).label }}
                </span>
              </td>
              <td class="center">
                <el-button size="small" @click="openFeedback(st)">Nhận xét</el-button>
              </td>
            </tr>
            <tr v-if="students.length === 0">
              <td :colspan="items.length + 4" class="empty">Chưa có học viên nào trong lớp</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="items.length === 0" class="empty">Chưa có cột điểm nào. Tạo cột điểm đầu tiên!</div>
    </el-card>

    <!-- Create/Edit grade item -->
    <el-dialog v-model="showDialog" :title="editMode ? 'Sửa cột điểm' : 'Thêm cột điểm'" width="380px">
      <el-form label-position="top">
        <el-form-item label="Tên cột điểm"><el-input v-model="form.name" placeholder="VD: Giữa kỳ" /></el-form-item>
        <el-form-item label="Hệ số (%)">
          <el-input-number v-model="form.weight" :min="0" :max="100" />
          <span class="hint">Tổng hệ số các cột điểm = 100%</span>
        </el-form-item>
        <el-form-item label="Điểm tối đa"><el-input-number v-model="form.maxScore" :min="1" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button v-if="editMode" type="danger" plain @click="deleteItem" style="float:left">Xóa cột</el-button>
        <el-button @click="showDialog = false">Hủy</el-button>
        <el-button type="primary" @click="save">{{ editMode ? 'Lưu' : 'Tạo' }}</el-button>
      </template>
    </el-dialog>

    <!-- Feedback dialog -->
    <el-dialog v-model="showFeedback" title="Nhận xét tổng quát học viên" width="500px">
      <div v-if="feedbackStudent">
        <p><b>{{ feedbackStudent.fullName }}</b></p>
        <p style="font-size:12px;color:#888;margin-bottom:14px">Điểm TB: {{ avgFor(feedbackStudent.id) ?? '—' }}</p>
        <el-table :data="studentGrades" size="small">
          <el-table-column label="Cột điểm" prop="itemName" />
          <el-table-column label="Điểm" width="80">
            <template #default="{ row }">{{ row.score ?? '—' }}</template>
          </el-table-column>
          <el-table-column label="Nhận xét">
            <template #default="{ row }">
              <el-input v-model="row.feedback" size="small" placeholder="Nhận xét..." @change="updateFeedback(row)" />
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <el-button @click="showFeedback = false">Đóng</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue';
import { useClassStore } from '@/stores/class';
import { ElMessage, ElMessageBox } from 'element-plus';
import ClassPicker from '@/components/ClassPicker.vue';
import { classesApi, gradeItemsApi, gradesApi } from '@/api';
import { initials, gradeClassify } from '@/utils/format';

const classStore = useClassStore();
const students = ref([]);
const items = ref([]);
const grades = ref([]); // [{ studentId, gradeItemId, score, feedback }]
const showDialog = ref(false);
const showFeedback = ref(false);
const editMode = ref(false);
const editId = ref(null);
const feedbackStudent = ref(null);
const studentGrades = ref([]);
const form = reactive({ name: '', weight: 10, maxScore: 10 });

const getScore = (sid, iid) => {
  const g = grades.value.find(g => g.studentId === sid && g.gradeItemId === iid);
  return g?.score != null ? +g.score : undefined;
};
const avgFor = (sid) => {
  let tw = 0, ws = 0;
  for (const it of items.value) {
    const s = getScore(sid, it.id);
    if (s != null) { tw += +it.weight; ws += s * +it.weight; }
  }
  return tw ? +(ws / tw).toFixed(1) : null;
};

const reload = async () => {
  const cid = classStore.selectedId;
  if (!cid) return;
  const [stu, gi] = await Promise.all([classesApi.students(cid), gradeItemsApi.list(cid)]);
  students.value = stu; items.value = gi;
  grades.value = [];
  for (const st of students.value) {
    const rows = await gradesApi.byStudent(st.id, cid);
    rows.forEach(r => grades.value.push({
      studentId: st.id, gradeItemId: r.grade_item_id, score: r.score, feedback: r.feedback,
    }));
  }
};

const saveScore = async (sid, iid, v) => {
  if (v == null) return;
  await gradesApi.upsert({ gradeItemId: iid, studentId: sid, score: v });
  const idx = grades.value.findIndex(g => g.studentId === sid && g.gradeItemId === iid);
  if (idx >= 0) grades.value[idx].score = v;
  else grades.value.push({ studentId: sid, gradeItemId: iid, score: v });
  ElMessage.success('Đã lưu điểm');
};

const openCreate = () => {
  editMode.value = false;
  Object.assign(form, { name: '', weight: 10, maxScore: 10 });
  showDialog.value = true;
};

const openEdit = (item) => {
  editMode.value = true; editId.value = item.id;
  Object.assign(form, { name: item.name, weight: +item.weight, maxScore: +item.maxScore });
  showDialog.value = true;
};

const save = async () => {
  if (!form.name) { ElMessage.warning('Nhập tên cột điểm'); return; }
  try {
    if (editMode.value) {
      await gradeItemsApi.update(editId.value, form);
      ElMessage.success('Đã cập nhật');
    } else {
      await gradeItemsApi.create({ classId: classStore.selectedId, ...form });
      ElMessage.success('Đã tạo cột điểm');
    }
    showDialog.value = false;
    reload();
  } catch {}
};

const deleteItem = async () => {
  try {
    await ElMessageBox.confirm('Xóa cột điểm này? Mọi điểm số trong cột sẽ bị xóa.', 'Xác nhận', { type: 'warning' });
    await gradeItemsApi.delete(editId.value);
    ElMessage.success('Đã xóa');
    showDialog.value = false;
    reload();
  } catch {}
};

const openFeedback = async (st) => {
  feedbackStudent.value = st;
  studentGrades.value = items.value.map(item => {
    const g = grades.value.find(g => g.studentId === st.id && g.gradeItemId === item.id);
    return {
      itemId: item.id, itemName: item.name,
      score: g?.score, feedback: g?.feedback || '',
    };
  });
  showFeedback.value = true;
};

const updateFeedback = async (row) => {
  if (row.score == null) {
    ElMessage.warning('Cần nhập điểm trước khi nhận xét');
    return;
  }
  await gradesApi.upsert({
    gradeItemId: row.itemId, studentId: feedbackStudent.value.id,
    score: +row.score, feedback: row.feedback,
  });
  ElMessage.success('Đã lưu nhận xét');
};

const exportCsv = () => {
  const rows = [];
  rows.push(['Học viên', ...items.value.map(i => `${i.name} (${i.weight}%)`), 'Điểm TB', 'Xếp loại']);
  for (const st of students.value) {
    const avg = avgFor(st.id);
    const gc = gradeClassify(avg);
    rows.push([
      st.fullName,
      ...items.value.map(i => getScore(st.id, i.id) ?? ''),
      avg ?? '',
      gc.label,
    ]);
  }
  const csv = '\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `bang-diem-${classStore.selected?.name || 'lop'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

watch(() => classStore.selectedId, reload);
onMounted(reload);
</script>

<style scoped>
.action-bar { display:flex; gap: 8px; justify-content:flex-end; margin-bottom: 14px; }
.table-wrap { overflow-x: auto; }
.grade-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.grade-table th, .grade-table td { padding: 8px 10px; border-bottom: 1px solid #f0f0ee; }
.grade-table th { background: #fafaf8; font-weight: 600; color: #888; font-size: 11px; padding: 6px 10px; }
.grade-table th.center, .grade-table td.center { text-align: center; }
.grade-table th.left { text-align: left; }
.head-cell { display:flex; flex-direction:column; align-items:center; gap:2px; }
.weight { font-size: 9px; color: #aaa; font-weight: 400; }
.fw-600 { font-weight: 600; font-size: 14px; }
.student-cell { display:flex; align-items:center; gap: 8px; }
.hint { font-size: 11px; color: #888; margin-left: 8px; }
.empty { padding: 20px; text-align: center; color: #aaa; }
</style>
