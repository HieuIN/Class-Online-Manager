<template>
  <div>
    <ClassPicker @change="reload" />
    <span class="section-title">Bài tập – {{ classStore.selected?.name }}</span>

    <el-card v-for="a in assignments" :key="a.id" class="mb-3">
      <div class="ar-header">
        <div>
          <div class="ar-title">{{ a.title }}</div>
          <div class="ar-desc">{{ a.description }}</div>
        </div>
        <div class="ar-right">
          <span :class="['badge', a.is_required ? 'badge-red' : 'badge-gray']">{{ a.is_required ? 'Bắt buộc' : 'Tùy chọn' }}</span>
          <div class="ar-due">Hạn: {{ fmtDateTime(a.due_date) }}</div>
        </div>
      </div>
      <el-divider />
      <div class="ar-status">
        <div>
          <div>Trạng thái: <span :class="['badge', submissionBadge(getSub(a.id)?.status || 'NOT_SUBMITTED').cls]">
            {{ submissionBadge(getSub(a.id)?.status || 'NOT_SUBMITTED').label }}
          </span></div>
          <div v-if="getSub(a.id)?.score != null" style="margin-top:6px">Điểm: <b>{{ getSub(a.id).score }}</b>/10</div>
          <div v-if="getSub(a.id)?.teacher_comment" style="margin-top:4px;font-size:12px;color:#666">
            GV: "{{ getSub(a.id).teacher_comment }}"
          </div>
          <el-alert v-if="getSub(a.id)?.status === 'REVISION_REQUIRED'" type="warning"
            :title="`Yêu cầu sửa và nộp lại`" show-icon :closable="false" style="margin-top:8px" />
        </div>
        <div>
          <el-button
            v-if="!getSub(a.id) || getSub(a.id).status === 'NOT_SUBMITTED' || getSub(a.id).status === 'REVISION_REQUIRED'"
            type="primary" @click="openSubmit(a)">
            ↑ Nộp bài
          </el-button>
          <span v-else-if="getSub(a.id).status === 'GRADED'" class="badge badge-green" style="font-size:13px">✓ Hoàn thành</span>
        </div>
      </div>
    </el-card>

    <el-card v-if="assignments.length === 0"><div class="empty">Chưa có bài tập nào</div></el-card>

    <el-dialog v-model="showSubmit" title="Nộp bài tập" width="460px">
      <p v-if="submitAssign"><b>{{ submitAssign.title }}</b></p>
      <el-form label-position="top">
        <el-form-item label="File">
          <el-upload :auto-upload="false" :on-change="onFileChange" :limit="1" :file-list="fileList">
            <el-button>Chọn file</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item label="Hoặc nội dung text">
          <el-input v-model="submitContent" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSubmit = false">Hủy</el-button>
        <el-button type="primary" @click="doSubmit" :loading="submitting">Nộp bài</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useClassStore } from '@/stores/class';
import { ElMessage } from 'element-plus';
import ClassPicker from '@/components/ClassPicker.vue';
import { assignmentsApi, submissionsApi } from '@/api';
import { submissionBadge, fmtDateTime } from '@/utils/format';

const auth = useAuthStore();
const classStore = useClassStore();
const assignments = ref([]);
const submissions = ref([]);
const showSubmit = ref(false);
const submitAssign = ref(null);
const submitContent = ref('');
const fileToUpload = ref(null);
const fileList = ref([]);
const submitting = ref(false);

const getSub = (aid) => submissions.value.find(s => s.assignment_id === aid);

const reload = async () => {
  const cid = classStore.selectedId;
  if (!cid || !auth.user) return;
  assignments.value = await assignmentsApi.list(cid);
  submissions.value = await submissionsApi.byStudent(auth.user.id, cid);
};

const onFileChange = (f) => { fileToUpload.value = f.raw; fileList.value = [f]; };

const openSubmit = (a) => {
  submitAssign.value = a;
  submitContent.value = '';
  fileToUpload.value = null;
  fileList.value = [];
  showSubmit.value = true;
};

const doSubmit = async () => {
  if (!fileToUpload.value && !submitContent.value) { ElMessage.warning('Chọn file hoặc nhập nội dung'); return; }
  submitting.value = true;
  try {
    if (fileToUpload.value) {
      const fd = new FormData();
      fd.append('file', fileToUpload.value);
      fd.append('assignmentId', submitAssign.value.id);
      await submissionsApi.upload(fd);
    }
    ElMessage.success('Đã nộp bài');
    showSubmit.value = false;
    reload();
  } finally { submitting.value = false; }
};

watch(() => classStore.selectedId, reload);
onMounted(reload);
</script>

<style scoped>
.mb-3 { margin-bottom: 12px; }
.ar-header { display:flex; justify-content:space-between; }
.ar-title { font-weight: 600; font-size: 14px; }
.ar-desc { font-size: 12px; color: #666; margin-top: 3px; }
.ar-right { text-align: right; }
.ar-due { font-size: 11px; color: #888; margin-top: 5px; }
.ar-status { display:flex; justify-content:space-between; align-items:flex-start; gap: 12px; }
.empty { padding: 30px; text-align: center; color: #aaa; }
</style>
