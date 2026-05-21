<template>
  <div>
    <ClassPicker @change="reload" />
    <div class="action-bar">
      <el-input v-model="studentSearch" placeholder="Tìm học viên..." clearable class="search-input" />
      <el-select v-model="gradeSort" placeholder="Sắp xếp" style="width:150px">
        <el-option label="Tên A-Z" value="name" />
        <el-option label="Điểm TB cao" value="avg-desc" />
        <el-option label="Điểm TB thấp" value="avg-asc" />
      </el-select>
      <el-button type="primary" @click="openCreate">+ Thêm cột điểm</el-button>
      <el-button @click="exportCsv">↓ Xuất Excel</el-button>
      <el-button @click="printGrades">In bảng điểm</el-button>
    </div>

    <el-card class="print-area">
      <div class="print-title">
        <h2>Bảng điểm {{ classStore.selected?.name || '' }}</h2>
        <p>Ngày in: {{ new Date().toLocaleDateString('vi-VN') }}</p>
      </div>
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
              <th class="center no-print">Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="st in displayedStudents" :key="st.id">
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
              <td class="center no-print">
                <el-button size="small" @click="openFeedback(st)">Nhận xét</el-button>
                <el-button size="small" plain @click="downloadFinalReport(st)">PDF</el-button>
              </td>
            </tr>
            <tr v-if="displayedStudents.length === 0">
              <td :colspan="items.length + 4" class="empty">Chưa có học viên nào trong lớp</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="items.length === 0" class="empty">Chưa có cột điểm nào. Tạo cột điểm đầu tiên!</div>
    </el-card>

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

    <el-dialog v-model="showFeedback" title="Nhận xét tổng quát học viên" width="500px">
      <div v-if="feedbackStudent">
        <p><b>{{ feedbackStudent.fullName }}</b></p>
        <p style="font-size:12px;color:#888;margin-bottom:14px">Điểm TB: {{ avgFor(feedbackStudent.id) ?? '—' }}</p>
        <div class="ai-feedback-box">
          <div class="ai-feedback-actions">
            <el-button size="small" type="primary" plain :loading="aiLoading" @click="suggestFeedback">
              ✨ AI gợi ý
            </el-button>
          </div>
          <el-input v-model="feedbackDraft" type="textarea" :rows="3" placeholder="Nhận xét tổng quát..." />
          <div class="quick-feedback">
            <el-button v-for="preset in feedbackPresets" :key="preset.text" size="small" plain @click="insertFeedbackPreset(preset.text)">
              {{ preset.icon }} {{ preset.label }}
            </el-button>
          </div>
        </div>
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
        <el-button type="primary" :disabled="!feedbackDraft.trim()" @click="saveFeedbackDraft">Lưu nhận xét</el-button>
        <el-button @click="showFeedback = false">Đóng</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, computed } from 'vue';
import { useClassStore } from '@/stores/class';
import { ElMessage, ElMessageBox } from 'element-plus';
import ClassPicker from '@/components/ClassPicker.vue';
import { aiSuggestionsApi, classesApi, gradeItemsApi, gradesApi, reportsApi } from '@/api';
import { initials, gradeClassify } from '@/utils/format';

const classStore = useClassStore();
const students = ref([]);
const items = ref([]);
const grades = ref([]);
const showDialog = ref(false);
const showFeedback = ref(false);
const editMode = ref(false);
const editId = ref(null);
const feedbackStudent = ref(null);
const studentGrades = ref([]);
const feedbackDraft = ref('');
const aiLoading = ref(false);
const studentSearch = ref('');
const gradeSort = ref('name');
const form = reactive({ name: '', weight: 10, maxScore: 10 });
const feedbackPresets = [
  { icon: '🎉', label: 'Tiến bộ', text: 'Em có tiến bộ tốt, tiếp tục duy trì tinh thần học tập này.' },
  { icon: '👏', label: 'Chăm chỉ', text: 'Em học tập chăm chỉ và có thái độ tích cực trong lớp.' },
  { icon: '⭐', label: 'Luyện thêm', text: 'Em cần luyện thêm phần còn yếu và chủ động hoàn thành bài tập đều hơn.' },
];

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
const displayedStudents = computed(() => {
  const q = studentSearch.value.toLowerCase().trim();
  let rows = q ? students.value.filter(st => st.fullName.toLowerCase().includes(q) || String(st.email || '').toLowerCase().includes(q)) : [...students.value];
  if (gradeSort.value === 'avg-desc') rows.sort((a, b) => (avgFor(b.id) ?? -1) - (avgFor(a.id) ?? -1));
  else if (gradeSort.value === 'avg-asc') rows.sort((a, b) => (avgFor(a.id) ?? 999) - (avgFor(b.id) ?? 999));
  else rows.sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
  return rows;
});

const reload = async () => {
  const cid = classStore.selectedId;
  if (!cid) return;
  const [stu, gi] = await Promise.all([classesApi.students(cid), gradeItemsApi.list(cid)]);
  students.value = stu; items.value = gi;
  grades.value = [];
  for (const st of students.value) {
    const rows = await gradesApi.byStudent(st.id, cid);
    rows.forEach(r => grades.value.push({ studentId: st.id, gradeItemId: r.grade_item_id, score: r.score, feedback: r.feedback }));
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
    return { itemId: item.id, itemName: item.name, score: g?.score, feedback: g?.feedback || '' };
  });
  feedbackDraft.value = studentGrades.value.find(row => row.feedback)?.feedback || '';
  showFeedback.value = true;
};
const syncLocalFeedback = (itemId, studentId, feedback) => {
  const idx = grades.value.findIndex(g => g.studentId === studentId && g.gradeItemId === itemId);
  if (idx >= 0) grades.value[idx].feedback = feedback;
};
const updateFeedback = async (row) => {
  if (row.score == null) { ElMessage.warning('Cần nhập điểm trước khi nhận xét'); return; }
  await gradesApi.upsert({ gradeItemId: row.itemId, studentId: feedbackStudent.value.id, score: +row.score, feedback: row.feedback });
  syncLocalFeedback(row.itemId, feedbackStudent.value.id, row.feedback);
  ElMessage.success('Đã lưu nhận xét');
};
const suggestFeedback = async () => {
  if (!feedbackStudent.value || !classStore.selectedId) return;
  aiLoading.value = true;
  try {
    const res = await aiSuggestionsApi.suggestFeedback(feedbackStudent.value.id, classStore.selectedId);
    feedbackDraft.value = res.suggestion || '';
  } finally {
    aiLoading.value = false;
  }
};
const insertFeedbackPreset = (text) => {
  feedbackDraft.value = feedbackDraft.value ? `${feedbackDraft.value.trim()}\n${text}` : text;
};
const saveFeedbackDraft = async () => {
  if (!feedbackStudent.value || !feedbackDraft.value.trim()) return;
  const rows = studentGrades.value.filter(row => row.score != null);
  if (!rows.length) { ElMessage.warning('Cần nhập điểm trước khi nhận xét'); return; }
  const feedback = feedbackDraft.value.trim();
  await Promise.all(rows.map(row => gradesApi.upsert({ gradeItemId: row.itemId, studentId: feedbackStudent.value.id, score: +row.score, feedback })));
  rows.forEach(row => {
    row.feedback = feedback;
    syncLocalFeedback(row.itemId, feedbackStudent.value.id, feedback);
  });
  ElMessage.success('Đã lưu nhận xét');
};

const exportCsv = () => {
  const rows = [];
  rows.push(['Học viên', ...items.value.map(i => `${i.name} (${i.weight}%)`), 'Điểm TB', 'Xếp loại']);
  for (const st of displayedStudents.value) {
    const avg = avgFor(st.id);
    rows.push([st.fullName, ...items.value.map(i => getScore(st.id, i.id) ?? ''), avg ?? '', gradeClassify(avg).label]);
  }
  const csv = '\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `bang-diem-${classStore.selected?.name || 'lop'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
const printGrades = () => window.print();
const downloadFinalReport = async (st) => {
  const blob = await reportsApi.studentFinal(st.id, classStore.selectedId);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bao-cao-cuoi-khoa-${st.fullName}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};

watch(() => classStore.selectedId, reload);
onMounted(reload);
</script>

<style scoped>
.action-bar { display:flex; gap: 8px; justify-content:flex-end; margin-bottom: 14px; flex-wrap:wrap; }
.search-input { width: 220px; margin-right:auto; }
.print-title { display:none; }
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
.ai-feedback-box { margin-bottom: 14px; }
.ai-feedback-actions { display:flex; justify-content:flex-end; margin-bottom: 8px; }
.quick-feedback { display:flex; gap: 6px; flex-wrap:wrap; margin-top: 8px; }
@media (max-width: 768px) {
  .search-input { width: 100%; margin-right:0; }
  .action-bar { justify-content:flex-start; }
}
@media print {
  :global(.sidebar), :global(.header), .action-bar, .no-print { display:none !important; }
  :global(.main-content) { padding: 0 !important; background: #fff !important; }
  .print-title { display:block; margin-bottom: 12px; }
  .print-title h2 { margin: 0 0 4px; font-size: 18px; }
  .print-title p { margin: 0; font-size: 12px; color: #666; }
  .table-wrap { overflow: visible; }
  .grade-table { font-size: 11px; }
  .grade-table th, .grade-table td { border: 1px solid #ddd; }
}
</style>
