<template>
  <div class="student-assignments">
    <ClassPicker @change="reload" />
    <div class="page-heading">
      <div><p class="eyebrow">HỌC TẬP</p><h2>Bài tập của lớp</h2><p class="subtle">Xem hướng dẫn, tài liệu đi kèm và nộp bài ngay tại đây.</p></div>
      <span v-if="assignments.length" class="assignment-count">{{ assignments.length }} bài tập</span>
    </div>

    <el-card v-for="assignment in assignments" :key="assignment.id" class="assignment-card">
      <div class="assignment-header">
        <div class="title-group">
          <h3>{{ assignment.title }}</h3>
          <p v-if="assignment.description">{{ assignment.description }}</p>
          <p v-else class="subtle">Giáo viên chưa thêm hướng dẫn chi tiết.</p>
        </div>
        <div class="due-group"><span :class="['badge', isRequired(assignment) ? 'badge-red' : 'badge-gray']">{{ isRequired(assignment) ? 'Bắt buộc' : 'Tự chọn' }}</span><span class="due">Hạn nộp: {{ fmtDateTime(dueDate(assignment)) }}</span></div>
      </div>

      <div class="requirement-strip">
        <span>Thang điểm <b>{{ maxScore(assignment) }}</b></span>
        <span>Hình thức <b>{{ submissionTypeLabel(assignment) }}</b></span>
        <span v-if="estimatedMinutes(assignment)">Dự kiến <b>{{ estimatedMinutes(assignment) }} phút</b></span>
        <span :class="allowLate(assignment) ? 'late-allowed' : 'late-locked'">{{ allowLate(assignment) ? 'Có thể nộp trễ' : 'Không nhận nộp trễ' }}</span>
      </div>

      <div v-if="attachments(assignment).length" class="attachments">
        <p>Tài liệu của giáo viên</p>
        <div v-for="file in attachments(assignment)" :key="file.id" class="attachment-row">
          <span class="file-name">{{ file.fileName }}</span>
          <div><el-button link type="primary" @click="openFile(file.fileUrl)">Xem trực tiếp</el-button><el-button link @click="downloadFile(file.fileUrl, file.fileName)">Tải</el-button></div>
        </div>
      </div>

      <el-divider />
      <div class="submission-summary">
        <div>
          <span>Trạng thái</span>
          <span :class="['badge', submissionBadge(getSubmission(assignment.id)?.status || 'NOT_SUBMITTED').cls]">{{ submissionBadge(getSubmission(assignment.id)?.status || 'NOT_SUBMITTED').label }}</span>
        </div>
        <div v-if="getSubmission(assignment.id)?.score != null" class="score"><span>Điểm</span><b>{{ getSubmission(assignment.id).score }}/{{ maxScore(assignment) }}</b></div>
        <el-button v-if="canSubmit(assignment)" type="primary" @click="openSubmit(assignment)">{{ getSubmission(assignment.id)?.status === 'REVISION_REQUIRED' ? 'Sửa và nộp lại' : 'Nộp bài' }}</el-button>
        <span v-else-if="getSubmission(assignment.id)?.status === 'GRADED'" class="completed">Đã hoàn thành</span>
      </div>

      <div v-if="getSubmission(assignment.id)" class="submission-detail">
        <p v-if="submissionContent(getSubmission(assignment.id))" class="submitted-text">{{ submissionContent(getSubmission(assignment.id)) }}</p>
        <div v-if="submissionAttachments(getSubmission(assignment.id)).length">
          <p class="submitted-label">Bài đã nộp</p>
          <div v-for="file in submissionAttachments(getSubmission(assignment.id))" :key="file.id" class="attachment-row">
            <span class="file-name">{{ file.fileName }}</span>
            <div><el-button link type="primary" @click="openFile(file.fileUrl)">Xem</el-button><el-button link @click="downloadFile(file.fileUrl, file.fileName)">Tải</el-button></div>
          </div>
        </div>
        <el-alert v-if="getSubmission(assignment.id)?.teacherComment || getSubmission(assignment.id)?.teacher_comment" type="success" :closable="false" show-icon class="feedback"><template #title><b>Nhận xét của giáo viên</b><p>{{ getSubmission(assignment.id).teacherComment || getSubmission(assignment.id).teacher_comment }}</p></template></el-alert>
        <el-alert v-if="getSubmission(assignment.id)?.status === 'REVISION_REQUIRED'" type="warning" :closable="false" show-icon title="Giáo viên yêu cầu chỉnh sửa và nộp lại bài." class="feedback" />
      </div>
    </el-card>

    <el-card v-if="!assignments.length" class="empty-card"><el-empty description="Lớp này chưa có bài tập" /></el-card>

    <el-dialog v-model="showSubmit" title="Nộp bài tập" width="min(680px, 94vw)" destroy-on-close>
      <template v-if="submitAssignment">
        <div class="submit-heading"><h3>{{ submitAssignment.title }}</h3><p v-if="submitAssignment.description">{{ submitAssignment.description }}</p></div>
        <el-alert v-if="getSubmission(submitAssignment.id)?.status === 'REVISION_REQUIRED'" type="warning" :closable="false" title="Hãy xem nhận xét của giáo viên, chỉnh sửa bài và nộp lại phiên bản mới." show-icon />
        <el-form label-position="top" class="submit-form">
          <el-form-item v-if="allowsText(submitAssignment)" :label="allowsFiles(submitAssignment) ? 'Nội dung bài làm (không bắt buộc nếu có tệp)' : 'Nội dung bài làm *'"><el-input v-model="submitContent" type="textarea" :rows="6" placeholder="Viết câu trả lời, đường dẫn tham khảo hoặc phần giải thích của bạn." /></el-form-item>
          <el-form-item v-if="allowsFiles(submitAssignment)" :label="allowsText(submitAssignment) ? 'Tệp bài làm (không bắt buộc nếu đã nhập nội dung)' : 'Tệp bài làm *'">
            <el-upload v-model:file-list="submissionFiles" drag multiple :auto-upload="false" :limit="5" :accept="acceptedTypes" :on-change="validateSubmissionFile" :on-exceed="onSubmissionFileExceed">
              <div class="upload-copy"><b>Kéo thả hoặc chọn tối đa 5 tệp</b><span>PDF, Office, ảnh, âm thanh, video, văn bản hoặc tệp nén. Mỗi tệp tối đa 100 MB.</span></div>
            </el-upload>
          </el-form-item>
        </el-form>
      </template>
      <template #footer><el-button @click="showSubmit = false">Hủy</el-button><el-button type="primary" :loading="submitting" @click="doSubmit">Nộp bài</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import ClassPicker from '@/components/ClassPicker.vue';
import { assignmentsApi, submissionsApi } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useClassStore } from '@/stores/class';
import { submissionBadge, fmtDateTime } from '@/utils/format';
import { mediaUrl } from '@/utils/media';

const acceptedTypes = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.jpg,.jpeg,.png,.webp,.gif,.mp3,.wav,.ogg,.m4a,.mp4,.webm,.mov,.zip,.rar,.7z';
const acceptedExtensions = new Set(acceptedTypes.split(',').map(type => type.slice(1)));
const auth = useAuthStore();
const classStore = useClassStore();
const assignments = ref([]);
const submissions = ref([]);
const showSubmit = ref(false);
const submitAssignment = ref(null);
const submitContent = ref('');
const submissionFiles = ref([]);
const submitting = ref(false);

const dueDate = assignment => assignment.dueDate ?? assignment.due_date;
const maxScore = assignment => Number(assignment.maxScore ?? assignment.max_score ?? 10);
const isRequired = assignment => Boolean(assignment.isRequired ?? assignment.is_required);
const allowLate = assignment => Boolean(assignment.allowLateSubmission ?? assignment.allow_late_submission ?? true);
const estimatedMinutes = assignment => assignment.estimatedMinutes ?? assignment.estimated_minutes;
const attachments = assignment => assignment.attachments || [];
const typeOf = assignment => String(assignment.submissionType ?? assignment.submission_type ?? 'BOTH').toUpperCase();
const allowsFiles = assignment => ['FILE', 'BOTH'].includes(typeOf(assignment));
const allowsText = assignment => ['TEXT', 'BOTH'].includes(typeOf(assignment));
const submissionTypeLabel = assignment => ({ FILE: 'Tệp đính kèm', TEXT: 'Nội dung viết', BOTH: 'Tệp hoặc nội dung viết' })[typeOf(assignment)];
const getSubmission = assignmentId => submissions.value.find(item => Number(item.assignmentId ?? item.assignment_id) === Number(assignmentId));
const submissionContent = submission => submission?.contentText ?? submission?.content_text;
const submissionAttachments = submission => submission?.attachments || (submission?.fileUrl || submission?.file_url ? [{ id: `legacy-${submission.id}`, fileUrl: submission.fileUrl ?? submission.file_url, fileName: submission.fileName ?? submission.file_name ?? 'Tệp đính kèm' }] : []);
const canSubmit = assignment => { const status = getSubmission(assignment.id)?.status; return !status || status === 'NOT_SUBMITTED' || status === 'REVISION_REQUIRED'; };

async function reload() {
  if (!classStore.selectedId || !auth.user) return;
  try { assignments.value = await assignmentsApi.list(classStore.selectedId); submissions.value = await submissionsApi.byStudent(auth.user.id, classStore.selectedId); } catch (_) { assignments.value = []; submissions.value = []; }
}
function openSubmit(assignment) { submitAssignment.value = assignment; submitContent.value = ''; submissionFiles.value = []; showSubmit.value = true; }
function validateSubmissionFile(file) {
  const extension = String(file.name || '').split('.').pop().toLowerCase();
  if (!acceptedExtensions.has(extension)) { ElMessage.error('Định dạng tệp này chưa được hỗ trợ'); submissionFiles.value = submissionFiles.value.filter(item => item.uid !== file.uid); return false; }
  if (file.size > 100 * 1024 * 1024) { ElMessage.error('Mỗi tệp tối đa 100 MB'); submissionFiles.value = submissionFiles.value.filter(item => item.uid !== file.uid); return false; }
  return true;
}
function onSubmissionFileExceed() { ElMessage.warning('Mỗi bài nộp chỉ gửi tối đa 5 tệp'); }
async function doSubmit() {
  const hasText = submitContent.value.trim().length > 0;
  const hasFiles = submissionFiles.value.some(file => file.raw);
  if (!submitAssignment.value || (!hasText && !hasFiles)) { ElMessage.warning('Nhập nội dung hoặc chọn ít nhất một tệp'); return; }
  if (!allowsText(submitAssignment.value) && hasText) { ElMessage.warning('Bài tập này chỉ nhận tệp đính kèm'); return; }
  if (!allowsFiles(submitAssignment.value) && hasFiles) { ElMessage.warning('Bài tập này chỉ nhận nội dung viết'); return; }
  submitting.value = true;
  try {
    const formData = new FormData();
    formData.append('assignmentId', submitAssignment.value.id);
    if (hasText) formData.append('contentText', submitContent.value.trim());
    submissionFiles.value.forEach(file => { if (file.raw) formData.append('files', file.raw); });
    await submissionsApi.submit(formData);
    ElMessage.success('Đã nộp bài thành công'); showSubmit.value = false; await reload();
  } finally { submitting.value = false; }
}
function openFile(url) {
  const source = mediaUrl(url);
  const preview = /\.(doc|docx|xls|xlsx|ppt|pptx)(?:$|\?)/i.test(source) && /^https?:\/\//i.test(source)
    ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(source)}`
    : source;
  window.open(preview, '_blank', 'noopener');
}
function downloadFile(url, name) { const link = document.createElement('a'); link.href = mediaUrl(url); link.download = name || String(url).split('/').pop(); link.click(); }

watch(() => classStore.selectedId, reload);
onMounted(reload);
</script>

<style scoped>
.student-assignments { max-width:1100px; }.page-heading,.assignment-header,.requirement-strip,.submission-summary,.attachment-row { display:flex; }.page-heading { align-items:flex-end; justify-content:space-between; gap:20px; margin:12px 0 20px; }.eyebrow { color:var(--el-color-primary); font-size:12px; font-weight:700; letter-spacing:.08em; margin:0 0 5px; }.page-heading h2 { margin:0; font-size:26px; }.subtle { color:var(--el-text-color-secondary); }.assignment-count { background:var(--el-color-primary-light-9); color:var(--el-color-primary); border-radius:99px; padding:7px 11px; font-weight:600; font-size:13px; }.assignment-card { margin-bottom:16px; }.assignment-header { justify-content:space-between; gap:20px; }.title-group h3 { font-size:18px; margin:0 0 7px; }.title-group p { color:var(--el-text-color-regular); line-height:1.55; margin:0; white-space:pre-wrap; }.due-group { align-items:flex-end; display:flex; flex-direction:column; gap:8px; min-width:180px; }.due { color:var(--el-text-color-secondary); font-size:12px; text-align:right; }.requirement-strip { background:var(--el-fill-color-light); border-radius:8px; flex-wrap:wrap; gap:10px 20px; margin-top:18px; padding:10px 12px; font-size:13px; }.requirement-strip span { color:var(--el-text-color-secondary); }.requirement-strip b { color:var(--el-text-color-regular); margin-left:4px; }.late-allowed { color:#16835f !important; }.late-locked { color:#bf6b00 !important; }.attachments { margin-top:17px; }.attachments > p,.submitted-label { color:var(--el-text-color-secondary); font-size:13px; font-weight:600; margin:0 0 6px; }.attachment-row { align-items:center; border-bottom:1px solid var(--el-border-color-lighter); gap:12px; justify-content:space-between; padding:8px 0; }.file-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.submission-summary { align-items:center; gap:22px; justify-content:flex-end; }.submission-summary > div:first-child { margin-right:auto; display:flex; align-items:center; gap:8px; font-size:13px; }.score { display:flex; flex-direction:column; }.score span { color:var(--el-text-color-secondary); font-size:12px; }.score b { color:var(--el-color-primary); font-size:18px; }.completed { color:#1d9e75; font-size:13px; font-weight:600; }.submission-detail { border-top:1px solid var(--el-border-color-lighter); margin-top:16px; padding-top:12px; }.submitted-text { background:var(--el-fill-color-light); border-radius:8px; line-height:1.55; margin:0 0 12px; padding:11px; white-space:pre-wrap; }.feedback { margin-top:12px; }.feedback p { margin:5px 0 0; white-space:pre-wrap; }.empty-card { margin-top:16px; }.submit-heading { border-bottom:1px solid var(--el-border-color-lighter); margin-bottom:15px; padding-bottom:11px; }.submit-heading h3 { margin:0 0 5px; }.submit-heading p { color:var(--el-text-color-secondary); line-height:1.5; margin:0; white-space:pre-wrap; }.submit-form { margin-top:16px; }.upload-copy { display:flex; flex-direction:column; gap:5px; padding:8px; }.upload-copy span { color:var(--el-text-color-secondary); font-size:12px; line-height:1.45; }
@media (max-width: 700px) { .page-heading,.assignment-header,.submission-summary { align-items:flex-start; flex-direction:column; }.due-group { align-items:flex-start; min-width:0; }.due { text-align:left; }.submission-summary { gap:12px; }.submission-summary > div:first-child { margin-right:0; }.attachment-row { align-items:flex-start; flex-direction:column; gap:2px; }.requirement-strip { flex-direction:column; gap:7px; } }
</style>
