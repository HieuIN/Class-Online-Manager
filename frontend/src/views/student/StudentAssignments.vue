<template>
  <div class="student-assignments">
    <ClassPicker @change="reload" />

    <div class="page-heading">
      <div>
        <p class="eyebrow">HỌC TẬP</p>
        <h2>Bài tập của lớp</h2>
        <p class="subtle">Xem yêu cầu, tiêu chí chấm và toàn bộ phản hồi trước khi nộp bài.</p>
      </div>
      <span v-if="assignments.length" class="assignment-count">{{ assignments.length }} bài tập</span>
    </div>

    <el-card v-for="assignment in assignments" :key="assignment.id" class="assignment-card">
      <div class="assignment-header">
        <div class="title-group">
          <div class="title-line">
            <h3>{{ assignment.title }}</h3>
            <span v-if="isGroupAssignment(assignment)" class="badge badge-purple">Bài tập nhóm</span>
          </div>
          <p v-if="assignment.description">{{ assignment.description }}</p>
          <p v-else class="subtle">Giáo viên chưa thêm hướng dẫn chi tiết.</p>
        </div>
        <div class="due-group">
          <span :class="['badge', isRequired(assignment) ? 'badge-red' : 'badge-gray']">{{ isRequired(assignment) ? 'Bắt buộc' : 'Tự chọn' }}</span>
          <span class="due">Hạn nộp: {{ fmtDateTime(dueDate(assignment)) }}</span>
        </div>
      </div>

      <div class="requirement-strip">
        <span>Thang điểm <b>{{ maxScore(assignment) }}</b></span>
        <span>Hình thức <b>{{ submissionTypeLabel(assignment) }}</b></span>
        <span v-if="estimatedMinutes(assignment)">Dự kiến <b>{{ estimatedMinutes(assignment) }} phút</b></span>
        <span :class="allowLate(assignment) ? 'late-allowed' : 'late-locked'">{{ allowLate(assignment) ? 'Có thể nộp trễ' : 'Không nhận nộp trễ' }}</span>
      </div>

      <el-alert v-if="isGroupAssignment(assignment)" :type="assignment.myGroup ? 'info' : 'warning'" :closable="false" show-icon class="group-alert">
        <template #title>
          <b v-if="assignment.myGroup">Nhóm của bạn: {{ assignment.myGroup.name }}</b>
          <b v-else>Bạn chưa được phân nhóm</b>
          <span v-if="assignment.myGroup">. Mỗi thành viên đều có thể nộp, bài nộp sẽ được dùng chung cho cả nhóm.</span>
          <span v-else>. Hãy liên hệ giáo viên để được phân nhóm trước khi nộp bài.</span>
        </template>
      </el-alert>

      <div v-if="rubrics(assignment).length" class="rubric-panel">
        <p>Tiêu chí chấm điểm</p>
        <div v-for="rubric in rubrics(assignment)" :key="rubric.id" class="rubric-row">
          <div><b>{{ rubric.criterion }}</b><span v-if="rubric.description">{{ rubric.description }}</span></div>
          <strong>{{ rubricMax(rubric) }} điểm</strong>
        </div>
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
          <span :class="['badge', submissionBadge(submissionFor(assignment)?.status || 'NOT_SUBMITTED').cls]">{{ submissionBadge(submissionFor(assignment)?.status || 'NOT_SUBMITTED').label }}</span>
        </div>
        <div v-if="submissionFor(assignment)?.score != null" class="score"><span>Điểm</span><b>{{ submissionFor(assignment).score }}/{{ maxScore(assignment) }}</b></div>
        <el-button plain @click="openDiscussion(assignment)">Thảo luận</el-button>
        <el-button v-if="canSubmit(assignment)" type="primary" :disabled="isGroupAssignment(assignment) && !assignment.myGroup" @click="openSubmit(assignment)">{{ submissionFor(assignment)?.status === 'REVISION_REQUIRED' ? 'Sửa và nộp lại' : 'Nộp bài' }}</el-button>
        <span v-else-if="submissionFor(assignment)?.status === 'GRADED'" class="completed">Đã hoàn thành</span>
      </div>

      <div v-if="submissionFor(assignment)" class="submission-detail">
        <div class="submitted-heading">
          <p class="submitted-label">{{ submissionFor(assignment).groupName ? `Bài nộp của ${submissionFor(assignment).groupName}` : 'Bài đã nộp' }}</p>
          <div class="submission-actions">
            <el-button v-if="submissionFor(assignment).versionCount" link @click="openHistory(submissionFor(assignment))">Lịch sử nộp ({{ submissionFor(assignment).versionCount }})</el-button>
            <el-button v-if="submissionAttachments(submissionFor(assignment)).length" link type="primary" @click="openAnnotations(submissionFor(assignment))">Nhận xét trên tệp</el-button>
          </div>
        </div>

        <p v-if="submissionContent(submissionFor(assignment))" class="submitted-text">{{ submissionContent(submissionFor(assignment)) }}</p>
        <div v-if="submissionAttachments(submissionFor(assignment)).length">
          <div v-for="file in submissionAttachments(submissionFor(assignment))" :key="file.id" class="attachment-row">
            <span class="file-name">{{ file.fileName }}</span>
            <div><el-button link type="primary" @click="openFile(file.fileUrl)">Xem</el-button><el-button link @click="downloadFile(file.fileUrl, file.fileName)">Tải</el-button></div>
          </div>
        </div>

        <div v-if="rubricScores(submissionFor(assignment)).length" class="rubric-results">
          <p>Kết quả theo tiêu chí</p>
          <div v-for="item in rubricScores(submissionFor(assignment))" :key="item.rubricId || item.rubric_id" class="rubric-score-row">
            <div><b>{{ item.criterion }}</b><span v-if="item.feedback">{{ item.feedback }}</span></div>
            <strong>{{ item.score }}/{{ item.maxPoints }}</strong>
          </div>
        </div>

        <el-alert v-if="submissionFor(assignment)?.teacherComment || submissionFor(assignment)?.teacher_comment" type="success" :closable="false" show-icon class="feedback">
          <template #title><b>Nhận xét của giáo viên</b><p>{{ submissionFor(assignment).teacherComment || submissionFor(assignment).teacher_comment }}</p></template>
        </el-alert>
        <el-alert v-if="submissionFor(assignment)?.status === 'REVISION_REQUIRED'" type="warning" :closable="false" show-icon title="Giáo viên yêu cầu chỉnh sửa và nộp lại bài." class="feedback" />
      </div>
    </el-card>

    <el-card v-if="!assignments.length" class="empty-card"><el-empty description="Lớp này chưa có bài tập đang phát hành" /></el-card>

    <el-dialog v-model="showSubmit" title="Nộp bài tập" width="min(680px, 94vw)" destroy-on-close>
      <template v-if="submitAssignment">
        <div class="submit-heading"><h3>{{ submitAssignment.title }}</h3><p v-if="submitAssignment.description">{{ submitAssignment.description }}</p></div>
        <el-alert v-if="isGroupAssignment(submitAssignment)" type="info" :closable="false" show-icon :title="`Bạn đang nộp bài cho ${submitAssignment.myGroup?.name || 'nhóm'}; các thành viên cùng xem được bài nộp này.`" />
        <el-alert v-if="submissionFor(submitAssignment)?.status === 'REVISION_REQUIRED'" type="warning" :closable="false" title="Hãy xem nhận xét của giáo viên, chỉnh sửa bài và nộp lại phiên bản mới." show-icon />
        <el-form label-position="top" class="submit-form">
          <el-form-item v-if="allowsText(submitAssignment)" :label="allowsFiles(submitAssignment) ? 'Nội dung bài làm (không bắt buộc nếu có tệp)' : 'Nội dung bài làm *'"><el-input v-model="submitContent" type="textarea" :rows="6" placeholder="Viết câu trả lời, đường dẫn tham khảo hoặc phần giải thích của bạn." /></el-form-item>
          <el-form-item v-if="allowsFiles(submitAssignment)" :label="allowsText(submitAssignment) ? 'Tệp bài làm (không bắt buộc nếu đã nhập nội dung)' : 'Tệp bài làm *'">
            <el-upload v-model:file-list="submissionFiles" drag multiple :auto-upload="false" :limit="5" :accept="acceptedTypes" :on-change="validateSubmissionFile" :on-exceed="onSubmissionFileExceed">
              <div class="upload-copy"><b>Kéo thả hoặc chọn tối đa 5 tệp</b><span>Hỗ trợ tài liệu, ảnh, tệp âm thanh và video từ máy tính, Android, iPhone hoặc iPad. Mỗi tệp tối đa 100 MB.</span></div>
            </el-upload>
          </el-form-item>
        </el-form>
      </template>
      <template #footer><el-button @click="showSubmit = false">Hủy</el-button><el-button type="primary" :loading="submitting" @click="doSubmit">Nộp bài</el-button></template>
    </el-dialog>

    <el-dialog v-model="showDiscussion" :title="`Thảo luận: ${discussionAssignment?.title || 'Bài tập'}`" width="min(720px, 94vw)">
      <div v-if="discussionAssignment" class="discussion-context">
        <h3>{{ discussionAssignment.title }}</h3>
        <p>{{ discussionAssignment.description || 'Giáo viên chưa thêm yêu cầu chi tiết.' }}</p>
        <div class="discussion-meta"><span>Hạn nộp: <b>{{ fmtDateTime(dueDate(discussionAssignment)) }}</b></span><span>Hình thức: <b>{{ submissionTypeLabel(discussionAssignment) }}</b></span><span>Thang điểm: <b>{{ maxScore(discussionAssignment) }}</b></span></div>
        <div v-if="attachments(discussionAssignment).length" class="discussion-files"><b>Tài liệu bài tập</b><el-button v-for="file in attachments(discussionAssignment)" :key="file.id" link type="primary" @click="openFile(file.fileUrl)">{{ file.fileName }}</el-button></div>
      </div>
      <div class="discussion-heading">Trao đổi của lớp</div>
      <div class="comments-box"><div v-for="comment in discussionComments" :key="comment.id" class="comment-row"><b>{{ comment.authorName || 'Người dùng' }}</b><span>{{ fmtDateTime(comment.createdAt) }}</span><p>{{ comment.content }}</p></div><el-empty v-if="!discussionComments.length" description="Chưa có bình luận. Hãy đặt câu hỏi đầu tiên." /></div>
      <el-input v-model="discussionText" type="textarea" :rows="3" placeholder="Nhập câu hỏi hoặc phản hồi về bài tập..." />
      <template #footer><el-button @click="showDiscussion = false">Đóng</el-button><el-button type="primary" @click="addDiscussionComment">Gửi</el-button></template>
    </el-dialog>

    <el-dialog v-model="showHistory" title="Lịch sử nộp bài" width="min(720px, 94vw)">
      <el-empty v-if="!versions.length" description="Chưa có phiên bản cũ" />
      <div v-for="version in versions" :key="version.id" class="history-row">
        <div><b>Phiên bản {{ version.versionNo }}</b><span>{{ fmtDateTime(version.createdAt) }}</span></div>
        <div v-if="version.score != null" class="history-score">Điểm cũ: {{ version.score }}</div>
        <p v-if="version.contentText">{{ version.contentText }}</p>
        <div v-if="version.attachments?.length" class="history-files"><el-button v-for="file in version.attachments" :key="file.fileUrl" link type="primary" @click="openFile(file.fileUrl)">{{ file.fileName }}</el-button></div>
      </div>
    </el-dialog>

    <el-dialog v-model="showAnnotation" title="Nhận xét trên bài nộp" width="min(900px, 96vw)" destroy-on-close>
      <div v-if="annotationFile" class="annotation-layout">
        <div class="annotation-preview">
          <img v-if="isImage(annotationFile.fileUrl)" :src="mediaUrl(annotationFile.fileUrl)" :alt="annotationFile.fileName" />
          <iframe v-else-if="isPdf(annotationFile.fileUrl)" :src="mediaUrl(annotationFile.fileUrl)" :title="annotationFile.fileName" />
          <div v-else class="no-inline-preview">Tệp này không hỗ trợ xem trực tiếp. Hãy mở tệp để xem nội dung.</div>
        </div>
        <div class="annotation-list">
          <p>Nhận xét của giáo viên</p>
          <el-empty v-if="!annotations.length" description="Chưa có nhận xét trên tệp này" :image-size="72" />
          <div v-for="annotation in annotations" :key="annotation.id" class="annotation-item">
            <b>{{ annotation.authorName }}</b><span v-if="annotation.pageNo">Trang {{ annotation.pageNo }}</span><p>{{ annotation.content }}</p>
          </div>
        </div>
      </div>
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

const acceptedTypes = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.jpg,.jpeg,.png,.webp,.gif,.mp3,.wav,.ogg,.m4a,.aac,.flac,.wma,.amr,.caf,.mp4,.webm,.mov,.m4v,.3gp,.3gpp,.mpeg,.mpg,.avi,.mkv,.zip,.rar,.7z,audio/*,video/*';
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
const showHistory = ref(false);
const versions = ref([]);
const showAnnotation = ref(false);
const annotations = ref([]);
const annotationFile = ref(null);
const showDiscussion = ref(false);
const discussionAssignment = ref(null);
const discussionComments = ref([]);
const discussionText = ref('');

const dueDate = assignment => assignment.dueDate ?? assignment.due_date;
const maxScore = assignment => Number(assignment.maxScore ?? assignment.max_score ?? 10);
const isRequired = assignment => Boolean(assignment.isRequired ?? assignment.is_required);
const allowLate = assignment => Boolean(assignment.allowLateSubmission ?? assignment.allow_late_submission ?? true);
const estimatedMinutes = assignment => assignment.estimatedMinutes ?? assignment.estimated_minutes;
const attachments = assignment => assignment.attachments || [];
const rubrics = assignment => assignment.rubrics || [];
const rubricMax = rubric => Number(rubric.maxPoints ?? rubric.max_points ?? 0);
const isGroupAssignment = assignment => Boolean(assignment.isGroupAssignment ?? assignment.is_group_assignment);
const typeOf = assignment => String(assignment.submissionType ?? assignment.submission_type ?? 'BOTH').toUpperCase();
const allowsFiles = assignment => ['FILE', 'BOTH'].includes(typeOf(assignment));
const allowsText = assignment => ['TEXT', 'BOTH'].includes(typeOf(assignment));
const submissionTypeLabel = assignment => ({ FILE: 'Tệp đính kèm', TEXT: 'Nội dung viết', BOTH: 'Tệp hoặc nội dung viết' })[typeOf(assignment)];
const submissionFor = assignment => submissions.value.find(item => Number(item.assignmentId ?? item.assignment_id) === Number(assignment.id));
const submissionContent = submission => submission?.contentText ?? submission?.content_text;
const submissionAttachments = submission => submission?.attachments || (submission?.fileUrl || submission?.file_url ? [{ id: `legacy-${submission.id}`, fileUrl: submission.fileUrl ?? submission.file_url, fileName: submission.fileName ?? submission.file_name ?? 'Tệp đính kèm' }] : []);
const rubricScores = submission => submission?.rubricScores || submission?.rubric_scores || [];
const canSubmit = assignment => { const status = submissionFor(assignment)?.status; return !status || status === 'NOT_SUBMITTED' || status === 'REVISION_REQUIRED'; };
const isImage = url => /\.(jpg|jpeg|png|gif|webp)(?:$|\?)/i.test(url || '');
const isPdf = url => /\.pdf(?:$|\?)/i.test(url || '');

async function reload() {
  if (!classStore.selectedId || !auth.user) return;
  try {
    [assignments.value, submissions.value] = await Promise.all([
      assignmentsApi.list(classStore.selectedId),
      submissionsApi.byStudent(auth.user.id, classStore.selectedId),
    ]);
  } catch (error) {
    assignments.value = [];
    submissions.value = [];
    ElMessage.error(error?.response?.data?.message || 'Không thể tải bài tập');
  }
}

function openSubmit(assignment) {
  submitAssignment.value = assignment;
  submitContent.value = '';
  submissionFiles.value = [];
  showSubmit.value = true;
}

async function openDiscussion(assignment) {
  discussionAssignment.value = assignment;
  discussionText.value = '';
  discussionComments.value = await assignmentsApi.comments(assignment.id);
  showDiscussion.value = true;
}

async function addDiscussionComment() {
  if (!discussionAssignment.value || !discussionText.value.trim()) return;
  await assignmentsApi.addComment(discussionAssignment.value.id, discussionText.value.trim());
  discussionText.value = '';
  discussionComments.value = await assignmentsApi.comments(discussionAssignment.value.id);
}

function validateSubmissionFile(file) {
  const extension = String(file.name || '').split('.').pop().toLowerCase();
  if (!acceptedExtensions.has(extension)) {
    ElMessage.error('Định dạng tệp này chưa được hỗ trợ');
    submissionFiles.value = submissionFiles.value.filter(item => item.uid !== file.uid);
    return false;
  }
  if (file.size > 100 * 1024 * 1024) {
    ElMessage.error('Mỗi tệp tối đa 100 MB');
    submissionFiles.value = submissionFiles.value.filter(item => item.uid !== file.uid);
    return false;
  }
  return true;
}

function onSubmissionFileExceed() { ElMessage.warning('Mỗi bài nộp chỉ gửi tối đa 5 tệp'); }

async function doSubmit() {
  const hasText = submitContent.value.trim().length > 0;
  const hasFiles = submissionFiles.value.some(file => file.raw);
  if (!submitAssignment.value || (!hasText && !hasFiles)) {
    ElMessage.warning('Nhập nội dung hoặc chọn ít nhất một tệp');
    return;
  }
  if (!allowsText(submitAssignment.value) && hasText) { ElMessage.warning('Bài tập này chỉ nhận tệp đính kèm'); return; }
  if (!allowsFiles(submitAssignment.value) && hasFiles) { ElMessage.warning('Bài tập này chỉ nhận nội dung viết'); return; }
  submitting.value = true;
  try {
    const formData = new FormData();
    formData.append('assignmentId', submitAssignment.value.id);
    if (hasText) formData.append('contentText', submitContent.value.trim());
    submissionFiles.value.forEach(file => { if (file.raw) formData.append('files', file.raw); });
    await submissionsApi.submit(formData);
    ElMessage.success('Đã nộp bài thành công');
    showSubmit.value = false;
    await reload();
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || 'Không thể nộp bài');
  } finally {
    submitting.value = false;
  }
}

async function openHistory(submission) {
  try {
    versions.value = await submissionsApi.versions(submission.id);
    showHistory.value = true;
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || 'Không thể tải lịch sử nộp bài');
  }
}

async function openAnnotations(submission) {
  const [file] = submissionAttachments(submission);
  if (!file) return;
  annotationFile.value = file;
  try {
    annotations.value = await submissionsApi.annotations(submission.id, file.id);
    showAnnotation.value = true;
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || 'Không thể tải nhận xét trên tệp');
  }
}

function openFile(url) {
  const source = mediaUrl(url);
  const preview = /\.(doc|docx|xls|xlsx|ppt|pptx)(?:$|\?)/i.test(source) && /^https?:\/\//i.test(source)
    ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(source)}`
    : source;
  window.open(preview, '_blank', 'noopener');
}

function downloadFile(url, name) {
  const link = document.createElement('a');
  link.href = mediaUrl(url);
  link.download = name || String(url).split('/').pop();
  link.click();
}

watch(() => classStore.selectedId, reload);
onMounted(reload);
</script>

<style scoped>
.student-assignments { max-width: 1100px; }
.page-heading, .assignment-header, .requirement-strip, .submission-summary, .attachment-row, .title-line, .submitted-heading { display: flex; }
.page-heading { align-items: flex-end; justify-content: space-between; gap: 20px; margin: 12px 0 20px; }
.eyebrow { color: var(--el-color-primary); font-size: 12px; font-weight: 700; letter-spacing: .08em; margin: 0 0 5px; }
.page-heading h2 { margin: 0; font-size: 26px; }
.subtle { color: var(--el-text-color-secondary); }
.assignment-count { background: var(--el-color-primary-light-9); color: var(--el-color-primary); border-radius: 99px; padding: 7px 11px; font-weight: 600; font-size: 13px; }
.assignment-card { margin-bottom: 16px; }
.assignment-header { justify-content: space-between; gap: 20px; }
.title-line { align-items: center; flex-wrap: wrap; gap: 9px; }
.title-group h3 { font-size: 18px; margin: 0 0 7px; }
.title-group p { color: var(--el-text-color-regular); line-height: 1.55; margin: 0; white-space: pre-wrap; }
.due-group { align-items: flex-end; display: flex; flex-direction: column; gap: 8px; min-width: 180px; }
.due { color: var(--el-text-color-secondary); font-size: 12px; text-align: right; }
.requirement-strip { background: var(--el-fill-color-light); border-radius: 8px; flex-wrap: wrap; gap: 10px 20px; margin-top: 18px; padding: 10px 12px; font-size: 13px; }
.requirement-strip span { color: var(--el-text-color-secondary); }
.requirement-strip b { color: var(--el-text-color-regular); margin-left: 4px; }
.late-allowed { color: #16835f !important; }.late-locked { color: #bf6b00 !important; }
.group-alert { margin-top: 14px; }.group-alert :deep(.el-alert__title) { line-height: 1.55; }
.rubric-panel, .attachments, .rubric-results { margin-top: 17px; }
.rubric-panel > p, .attachments > p, .rubric-results > p, .submitted-label { color: var(--el-text-color-secondary); font-size: 13px; font-weight: 600; margin: 0 0 6px; }
.rubric-row, .rubric-score-row { align-items: flex-start; border-top: 1px solid var(--el-border-color-lighter); display: flex; gap: 15px; justify-content: space-between; padding: 9px 0; }
.rubric-row div, .rubric-score-row div { display: flex; flex-direction: column; gap: 3px; }.rubric-row span, .rubric-score-row span { color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.45; }
.rubric-row strong { color: var(--el-text-color-primary); white-space: nowrap; }.rubric-score-row strong { color: var(--el-color-primary); white-space: nowrap; }
.attachment-row { align-items: center; border-bottom: 1px solid var(--el-border-color-lighter); gap: 12px; justify-content: space-between; padding: 8px 0; }
.file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.submission-summary { align-items: center; gap: 22px; justify-content: flex-end; }
.submission-summary > div:first-child { margin-right: auto; display: flex; align-items: center; gap: 8px; font-size: 13px; }
.score { display: flex; flex-direction: column; }.score span { color: var(--el-text-color-secondary); font-size: 12px; }.score b { color: var(--el-color-primary); font-size: 18px; }
.completed { color: #1d9e75; font-size: 13px; font-weight: 600; }
.submission-detail { border-top: 1px solid var(--el-border-color-lighter); margin-top: 16px; padding-top: 12px; }
.submitted-heading { align-items: center; justify-content: space-between; gap: 12px; }.submitted-label { margin: 0; }.submission-actions { display: flex; gap: 5px; }
.submitted-text { background: var(--el-fill-color-light); border-radius: 8px; line-height: 1.55; margin: 10px 0 12px; padding: 11px; white-space: pre-wrap; }
.feedback { margin-top: 12px; }.feedback p { margin: 5px 0 0; white-space: pre-wrap; }.empty-card { margin-top: 16px; }
.submit-heading { border-bottom: 1px solid var(--el-border-color-lighter); margin-bottom: 15px; padding-bottom: 11px; }.submit-heading h3 { margin: 0 0 5px; }.submit-heading p { color: var(--el-text-color-secondary); line-height: 1.5; margin: 0; white-space: pre-wrap; }.submit-form { margin-top: 16px; }
.upload-copy { display: flex; flex-direction: column; gap: 5px; padding: 8px; }.upload-copy span { color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.45; }
.history-row { border-bottom: 1px solid var(--el-border-color-lighter); padding: 13px 0; }.history-row > div:first-child { display: flex; gap: 12px; justify-content: space-between; }.history-row span { color: var(--el-text-color-secondary); font-size: 13px; }.history-row p { background: var(--el-fill-color-light); border-radius: 6px; line-height: 1.5; margin: 8px 0; padding: 8px; white-space: pre-wrap; }.history-score { color: var(--el-color-primary); font-size: 13px; margin-top: 5px; }.history-files { display: flex; flex-wrap: wrap; gap: 8px; }
.annotation-layout { display: grid; grid-template-columns: minmax(0, 1fr) 270px; gap: 18px; }.annotation-preview { align-items: center; background: var(--el-fill-color-light); display: flex; justify-content: center; min-height: 420px; }.annotation-preview img { max-height: 620px; max-width: 100%; object-fit: contain; }.annotation-preview iframe { border: 0; height: 620px; width: 100%; }.no-inline-preview { color: var(--el-text-color-secondary); padding: 30px; text-align: center; }.annotation-list { border-left: 1px solid var(--el-border-color-lighter); padding-left: 16px; }.annotation-list > p { font-weight: 700; margin-top: 0; }.annotation-item { border-bottom: 1px solid var(--el-border-color-lighter); padding: 10px 0; }.annotation-item b { font-size: 13px; }.annotation-item span { color: var(--el-text-color-secondary); display: block; font-size: 12px; margin-top: 3px; }.annotation-item p { line-height: 1.5; margin: 6px 0 0; white-space: pre-wrap; }
.discussion-context { background: var(--el-fill-color-light); border-left: 4px solid var(--el-color-primary); border-radius: 8px; margin-bottom: 16px; padding: 14px; }.discussion-context h3 { margin: 0 0 7px; }.discussion-context > p { line-height: 1.55; margin: 0; white-space: pre-wrap; }.discussion-meta { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 12px; }.discussion-meta span { color: var(--el-text-color-secondary); font-size: 12px; }.discussion-files { align-items: center; display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 10px; }.discussion-heading { font-size: 13px; font-weight: 700; margin-bottom: 4px; }.comments-box { max-height: 280px; overflow: auto; margin-bottom: 14px; }.comment-row { border-bottom: 1px solid var(--el-border-color-lighter); padding: 10px 0; }.comment-row span { color: var(--el-text-color-secondary); font-size: 12px; margin-left: 8px; }.comment-row p { line-height: 1.5; margin: 5px 0 0; white-space: pre-wrap; }
@media (max-width: 700px) { .page-heading, .assignment-header, .submission-summary { align-items: flex-start; flex-direction: column; }.due-group { align-items: flex-start; min-width: 0; }.due { text-align: left; }.submission-summary { gap: 12px; }.submission-summary > div:first-child { margin-right: 0; }.attachment-row { align-items: flex-start; flex-direction: column; gap: 2px; }.requirement-strip { flex-direction: column; gap: 7px; }.submitted-heading { align-items: flex-start; flex-direction: column; }.submission-actions { flex-wrap: wrap; }.annotation-layout { display: block; }.annotation-list { border-left: 0; border-top: 1px solid var(--el-border-color-lighter); margin-top: 14px; padding: 14px 0 0; } }
</style>
