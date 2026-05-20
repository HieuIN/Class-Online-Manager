<template>
  <div>
    <ClassPicker @change="reload" />

    <el-row :gutter="14" class="mb-4">
      <el-col :span="8"><div class="metric-card"><div class="metric-label">Tổng buổi kế hoạch</div><div class="metric-value">{{ progress.total || 0 }}</div></div></el-col>
      <el-col :span="8"><div class="metric-card"><div class="metric-label">Đã dạy xong</div><div class="metric-value" style="color:#639922">{{ progress.done || 0 }}</div></div></el-col>
      <el-col :span="8"><div class="metric-card"><div class="metric-label">Buổi delay</div><div class="metric-value" style="color:#EF9F27">{{ progress.delayed || 0 }}</div></div></el-col>
    </el-row>

    <el-card class="mb-4">
      <template #header><span class="section-title">Tiến độ tổng thể</span></template>
      <el-progress :percentage="progress.percent || 0" :stroke-width="14" color="#1D9E75" />
      <div class="progress-meta">
        <span>{{ progress.percent || 0 }}% hoàn thành</span>
        <span>{{ progress.done || 0 }}/{{ progress.total || 0 }} buổi</span>
      </div>
      <el-alert v-if="progress.delayed" type="warning" :title="`Có ${progress.delayed} buổi bị delay so với kế hoạch`" show-icon :closable="false" style="margin-top:14px"/>
    </el-card>

    <el-card>
      <template #header><span class="section-title">Kế hoạch vs Thực tế</span></template>
      <el-table :data="progress.sessions || []" size="small" stripe>
        <el-table-column label="#" width="60">
          <template #default="{ row }">{{ sessionNo(row) }}</template>
        </el-table-column>
        <el-table-column label="Chủ đề" prop="topic" />
        <el-table-column label="Ngày KH" width="120">
          <template #default="{ row }">{{ fmtDate(plannedDate(row)) }}</template>
        </el-table-column>
        <el-table-column label="Ngày thực tế" width="130">
          <template #default="{ row }">{{ fmtDate(actualDate(row)) }}</template>
        </el-table-column>
        <el-table-column label="Trạng thái" width="120">
          <template #default="{ row }">
            <span :class="['badge', row.status === 'DONE' ? 'badge-green' : 'badge-gray']">
              {{ row.status === 'DONE' ? 'Đã dạy' : 'Kế hoạch' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="Ghi chú" prop="note" />
        <el-table-column label="" width="90" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="editSession(row)">Sửa</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showEdit" title="Cập nhật buổi học" width="480px">
      <el-form label-position="top">
        <el-form-item label="Buổi số">
          <el-input-number v-model="editForm.sessionNo" :min="1" />
        </el-form-item>
        <el-form-item label="Chủ đề">
          <el-input v-model="editForm.topic" />
        </el-form-item>
        <el-form-item label="Ngày kế hoạch">
          <el-date-picker v-model="editForm.plannedDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-form-item label="Ngày thực tế">
          <el-date-picker v-model="editForm.actualDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-form-item label="Trạng thái">
          <el-select v-model="editForm.status" style="width:100%">
            <el-option label="Kế hoạch" value="PLANNED" />
            <el-option label="Đã dạy" value="DONE" />
            <el-option label="Delay" value="DELAYED" />
            <el-option label="Bị hủy" value="CANCELLED" />
          </el-select>
        </el-form-item>
        <el-form-item label="Link Zoom / Google Meet">
          <el-input v-model="editForm.meetingUrl" placeholder="https://zoom.us/j/..." />
        </el-form-item>
        <el-form-item label="Ghi chú">
          <el-input v-model="editForm.note" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEdit = false">Hủy</el-button>
        <el-button type="primary" @click="saveSession" :loading="saving">Lưu</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, watch, onMounted } from 'vue';
import { useClassStore } from '@/stores/class';
import { ElMessage } from 'element-plus';
import ClassPicker from '@/components/ClassPicker.vue';
import { sessionsApi } from '@/api';
import { fmtDate } from '@/utils/format';

const classStore = useClassStore();
const progress = ref({});
const showEdit = ref(false);
const saving = ref(false);
const editId = ref(null);
const editForm = reactive({
  sessionNo: 1,
  plannedDate: '',
  actualDate: '',
  topic: '',
  status: 'PLANNED',
  note: '',
  meetingUrl: '',
});

const sessionNo = (s) => s.session_no || s.sessionNo;
const plannedDate = (s) => s.planned_date || s.plannedDate;
const actualDate = (s) => s.actual_date || s.actualDate;
const meetingUrl = (s) => s.meeting_url || s.meetingUrl || '';

const reload = async () => {
  const cid = classStore.selectedId;
  if (!cid) return;
  progress.value = await sessionsApi.progress(cid);
};

const editSession = (s) => {
  editId.value = s.id;
  Object.assign(editForm, {
    sessionNo: sessionNo(s),
    plannedDate: plannedDate(s),
    actualDate: actualDate(s) || '',
    topic: s.topic || '',
    status: s.status || 'PLANNED',
    note: s.note || '',
    meetingUrl: meetingUrl(s),
  });
  showEdit.value = true;
};

const saveSession = async () => {
  if (!editForm.plannedDate || !editForm.topic) {
    ElMessage.warning('Nhập đủ ngày kế hoạch và chủ đề');
    return;
  }
  saving.value = true;
  try {
    await sessionsApi.update(editId.value, {
      sessionNo: editForm.sessionNo,
      plannedDate: editForm.plannedDate,
      actualDate: editForm.actualDate || null,
      topic: editForm.topic,
      status: editForm.status,
      note: editForm.note,
      meetingUrl: editForm.meetingUrl || null,
    });
    ElMessage.success('Đã cập nhật tiến độ');
    showEdit.value = false;
    reload();
  } finally {
    saving.value = false;
  }
};

watch(() => classStore.selectedId, reload);
onMounted(reload);
</script>

<style scoped>
.mb-4 { margin-bottom: 14px; }
.progress-meta { display:flex; justify-content:space-between; font-size: 12px; color: #888; margin-top: 8px; }
</style>
