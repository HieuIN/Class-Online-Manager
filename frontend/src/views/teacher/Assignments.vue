<template>
  <div class="assignment-page">
    <ClassPicker @change="reload" />

    <div class="action-bar">
      <div>
        <p class="eyebrow">ĐÁNH GIÁ HỌC TẬP</p>
        <h2>Quản lý bài tập</h2>
        <p class="subtle">Tạo đề bài, tài liệu kèm theo và theo dõi tiến độ nộp bài của cả lớp.</p>
      </div>
      <el-button type="primary" size="large" @click="openCreate">+ Tạo bài tập</el-button>
    </div>

    <el-card v-if="!assignments.length" class="empty-card">
      <el-empty description="Lớp này chưa có bài tập">
        <el-button type="primary" @click="openCreate">Tạo bài tập đầu tiên</el-button>
      </el-empty>
    </el-card>

    <el-tabs v-else v-model="activeId" class="assignment-tabs" @tab-change="loadMatrix">
      <el-tab-pane v-for="assignment in assignments" :key="assignment.id" :name="assignment.id" :label="assignment.title">
        <div class="assignment-toolbar">
          <el-input v-model="submissionSearch" placeholder="Tìm học viên" clearable class="search-input" />
          <el-select v-model="submissionStatusFilter" class="status-select">
            <el-option label="Tất cả trạng thái" value="ALL" />
            <el-option label="Chưa nộp" value="NOT_SUBMITTED" />
            <el-option label="Đã nộp" value="SUBMITTED" />
            <el-option label="Đã chấm" value="GRADED" />
            <el-option label="Cần nộp lại" value="REVISION_REQUIRED" />
          </el-select>
          <el-button @click="reloadMatrix">Làm mới</el-button>
        </div>

        <el-row :gutter="18">
          <el-col :xs="24" :lg="9">
            <el-card class="detail-card">
              <template #header>
                <div class="card-header">
                  <span>Thông tin bài tập</span>
                  <div class="card-actions">
                    <el-button link type="primary" @click="openComments(assignment)">Thảo luận</el-button>
                    <el-button link type="primary" @click="openEdit(assignment)">Sửa</el-button>
                    <el-button link type="danger" @click="deleteAssign(assignment)">Xóa</el-button>
                  </div>
                </div>
              </template>

              <h3>{{ assignment.title }}</h3>
              <p v-if="assignment.description" class="description">{{ assignment.description }}</p>
              <p v-else class="subtle">Chưa có hướng dẫn chi tiết.</p>

              <div class="detail-grid">
                <div><span>Hạn nộp</span><strong>{{ fmtDateTime(dueDate(assignment)) }}</strong></div>
                <div><span>Thang điểm</span><strong>{{ maxScore(assignment) }} điểm</strong></div>
                <div><span>Hình thức</span><strong>{{ submissionTypeLabel(assignment) }}</strong></div>
                <div><span>Thời lượng</span><strong>{{ estimatedMinutes(assignment) ? `${estimatedMinutes(assignment)} phút` : 'Không ước tính' }}</strong></div>
              </div>

              <div class="tag-row">
                <span :class="['badge', isRequired(assignment) ? 'badge-red' : 'badge-gray']">
                  {{ isRequired(assignment) ? 'Bắt buộc' : 'Tự chọn' }}
                </span>
                <span :class="['badge', allowLate(assignment) ? 'badge-green' : 'badge-orange']">
                  {{ allowLate(assignment) ? 'Cho phép nộp trễ' : 'Không nhận nộp trễ' }}
                </span>
              </div>

              <div v-if="attachments(assignment).length" class="attachment-section">
                <p class="section-label">Tài liệu đính kèm ({{ attachments(assignment).length }})</p>
                <button v-for="file in attachments(assignment)" :key="file.id" class="attachment-link" @click="openFile(file.fileUrl)">
                  <span class="file-name">{{ file.fileName }}</span>
                  <span>Mở</span>
                </button>
              </div>

              <el-divider />
              <div class="stat-grid">
                <div><span>Đã nộp</span><b class="green">{{ submittedCount }}</b></div>
                <div><span>Chưa nộp</span><b class="red">{{ notSubmittedCount }}</b></div>
                <div><span>Đã chấm</span><b class="blue">{{ gradedCount }}</b></div>
              </div>
            </el-card>
          </el-col>

          <el-col :xs="24" :lg="15" class="submission-column">
            <el-card>
              <template #header>
                <div class="card-header"><span>Tiến độ nộp bài</span><span class="subtle">{{ filteredMatrix.length }} học viên</span></div>
              </template>
              <el-table :data="filteredMatrix" :empty-text="'Chưa có học viên trong lớp'" class="submission-table">
                <el-table-column label="Học viên" prop="studentName" min-width="155" />
                <el-table-column label="Trạng thái" width="130">
                  <template #default="{ row }">
                    <span :class="['badge', submissionBadge(row.status || 'NOT_SUBMITTED').cls]">
                      {{ submissionBadge(row.status || 'NOT_SUBMITTED').label }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="Nộp lúc" min-width="132">
                  <template #default="{ row }"><span class="table-muted">{{ row.submittedAt ? fmtDateTime(row.submittedAt) : '—' }}</span></template>
                </el-table-column>
                <el-table-column label="Điểm" width="72"><template #default="{ row }">{{ row.score ?? '—' }}</template></el-table-column>
                <el-table-column label="" width="138" fixed="right">
                  <template #default="{ row }">
                    <el-button v-if="row.submissionId" link type="primary" @click="viewSubmission(row)">Xem</el-button>
                    <el-button v-if="row.submissionId" link type="primary" @click="openGrade(row)">
                      {{ row.status === 'GRADED' ? 'Sửa điểm' : 'Chấm' }}
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="showEditor" :title="editMode ? 'Cập nhật bài tập' : 'Tạo bài tập mới'" width="min(860px, 94vw)" destroy-on-close>
      <el-form label-position="top" class="assignment-form">
        <el-row :gutter="16">
          <el-col :xs="24" :md="14"><el-form-item label="Tên bài tập *"><el-input v-model="formAssign.title" maxlength="255" show-word-limit placeholder="Ví dụ: Luyện viết chữ Hán bài 5" /></el-form-item></el-col>
          <el-col :xs="24" :md="10"><el-form-item label="Hạn nộp *"><el-date-picker v-model="formAssign.dueDate" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="Chọn ngày, giờ" class="full-width" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="Yêu cầu và hướng dẫn"><el-input v-model="formAssign.description" type="textarea" :rows="5" placeholder="Mô tả đầu bài, tiêu chí hoàn thành, cách nộp và lưu ý cho học viên." /></el-form-item>
        <el-row :gutter="16">
          <el-col :xs="24" :sm="8"><el-form-item label="Thang điểm"><el-input-number v-model="formAssign.maxScore" :min="0.5" :max="100" :step="0.5" class="full-width" /></el-form-item></el-col>
          <el-col :xs="24" :sm="8"><el-form-item label="Thời lượng dự kiến"><el-input-number v-model="formAssign.estimatedMinutes" :min="1" :max="1440" :step="5" class="full-width" placeholder="Phút" /></el-form-item></el-col>
          <el-col :xs="24" :sm="8"><el-form-item label="Hình thức nộp"><el-select v-model="formAssign.submissionType" class="full-width"><el-option label="Tệp và nội dung viết" value="BOTH" /><el-option label="Chỉ tệp đính kèm" value="FILE" /><el-option label="Chỉ nội dung viết" value="TEXT" /></el-select></el-form-item></el-col>
        </el-row>
        <div class="switch-row">
          <el-switch v-model="formAssign.isRequired" active-text="Bài tập bắt buộc" />
          <el-switch v-model="formAssign.allowLateSubmission" active-text="Cho phép nộp trễ" />
        </div>

        <el-form-item label="Tài liệu đính kèm">
          <el-upload v-model:file-list="pendingFiles" drag multiple :auto-upload="false" :limit="8" :accept="acceptedTypes" :on-change="validatePendingFile" :on-exceed="onAssignmentFileExceed">
            <div class="upload-copy"><b>Kéo thả hoặc chọn tối đa 8 tệp</b><span>PDF, Word, Excel, PowerPoint, ảnh, âm thanh, video, TXT/CSV/MD, ZIP/RAR/7Z. Mỗi tệp tối đa 100 MB.</span></div>
          </el-upload>
        </el-form-item>
        <div v-if="editMode && existingAttachments.length" class="existing-files">
          <p class="section-label">Tệp đang có</p>
          <div v-for="file in existingAttachments" :key="file.id" class="existing-file">
            <button @click="openFile(file.fileUrl)">{{ file.fileName }}</button>
            <el-button link type="danger" @click="removeExistingAttachment(file)">Gỡ</el-button>
          </div>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="closeEditor">Hủy</el-button>
        <el-button type="primary" :loading="saving" @click="saveAssign">{{ editMode ? 'Lưu thay đổi' : 'Tạo bài tập' }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showView" title="Bài làm của học viên" width="min(680px, 94vw)">
      <div v-if="viewRow" class="submission-view">
        <div class="view-meta"><b>{{ viewRow.studentName }}</b><span>{{ viewRow.submittedAt ? fmtDateTime(viewRow.submittedAt) : '' }}</span></div>
        <span :class="['badge', submissionBadge(viewRow.status).cls]">{{ submissionBadge(viewRow.status).label }}</span>
        <div v-if="viewRow.contentText" class="text-submission">{{ viewRow.contentText }}</div>
        <div v-if="submissionAttachments(viewRow).length" class="submission-files">
          <p class="section-label">Tệp đã nộp</p>
          <div v-for="file in submissionAttachments(viewRow)" :key="file.id" class="file-row">
            <span>{{ file.fileName }}</span>
            <div><el-button link type="primary" @click="openFile(file.fileUrl)">Xem</el-button><el-button link @click="downloadFile(file.fileUrl, file.fileName)">Tải</el-button></div>
          </div>
        </div>
        <el-empty v-if="!viewRow.contentText && !submissionAttachments(viewRow).length" description="Học viên chưa nộp nội dung" />
        <div v-if="viewRow.score != null" class="result-box"><b>Điểm: {{ viewRow.score }}/{{ activeAssignment ? maxScore(activeAssignment) : 10 }}</b><p v-if="viewRow.teacherComment">{{ viewRow.teacherComment }}</p></div>
      </div>
      <template #footer><el-button @click="showView = false">Đóng</el-button><el-button type="primary" @click="gradeFromView">Chấm bài</el-button></template>
    </el-dialog>

    <el-dialog v-model="showGrade" title="Chấm bài" width="min(520px, 94vw)">
      <el-form v-if="gradeRow" label-position="top">
        <el-form-item label="Học viên"><b>{{ gradeRow.studentName }}</b></el-form-item>
        <el-form-item :label="`Điểm (tối đa ${gradeMax})`"><el-input-number v-model="gradeForm.score" :min="0" :max="gradeMax" :precision="1" :step="0.5" /></el-form-item>
        <el-form-item label="Nhận xét cho học viên"><el-input v-model="gradeForm.teacherComment" type="textarea" :rows="4" placeholder="Nêu điểm tốt, phần cần cải thiện và hướng dẫn chỉnh sửa." /></el-form-item>
        <el-form-item label="Kết quả"><el-radio-group v-model="gradeForm.status"><el-radio value="GRADED">Hoàn thành</el-radio><el-radio value="REVISION_REQUIRED">Yêu cầu nộp lại</el-radio></el-radio-group></el-form-item>
      </el-form>
      <template #footer><el-button @click="showGrade = false">Hủy</el-button><el-button type="primary" :loading="grading" @click="saveGrade">Lưu đánh giá</el-button></template>
    </el-dialog>

    <el-dialog v-model="showComments" title="Thảo luận bài tập" width="min(600px, 94vw)">
      <div class="comments-box"><div v-for="comment in comments" :key="comment.id" class="comment-row"><b>{{ comment.authorName || 'Người dùng' }}</b><span>{{ fmtDateTime(comment.createdAt) }}</span><p>{{ comment.content }}</p></div><el-empty v-if="!comments.length" description="Chưa có bình luận" /></div>
      <el-input v-model="commentText" type="textarea" :rows="3" placeholder="Nhập câu hỏi hoặc phản hồi..." />
      <template #footer><el-button @click="showComments = false">Đóng</el-button><el-button type="primary" @click="addComment">Gửi</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import ClassPicker from '@/components/ClassPicker.vue';
import { assignmentsApi, submissionsApi } from '@/api';
import { useClassStore } from '@/stores/class';
import { submissionBadge, fmtDateTime } from '@/utils/format';
import { mediaUrl } from '@/utils/media';

const acceptedTypes = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.jpg,.jpeg,.png,.webp,.gif,.mp3,.wav,.ogg,.m4a,.mp4,.webm,.mov,.zip,.rar,.7z';
const acceptedExtensions = new Set(acceptedTypes.split(',').map(type => type.slice(1)));
const classStore = useClassStore();
const assignments = ref([]);
const activeId = ref(null);
const matrix = ref([]);
const submissionSearch = ref('');
const submissionStatusFilter = ref('ALL');
const showEditor = ref(false);
const showGrade = ref(false);
const showView = ref(false);
const showComments = ref(false);
const saving = ref(false);
const grading = ref(false);
const editMode = ref(false);
const editId = ref(null);
const pendingFiles = ref([]);
const existingAttachments = ref([]);
const gradeRow = ref(null);
const viewRow = ref(null);
const commentAssignment = ref(null);
const comments = ref([]);
const commentText = ref('');
const formAssign = reactive({ title: '', description: '', dueDate: '', maxScore: 10, estimatedMinutes: null, isRequired: true, allowLateSubmission: true, submissionType: 'BOTH' });
const gradeForm = reactive({ score: 0, teacherComment: '', status: 'GRADED' });

const activeAssignment = computed(() => assignments.value.find(item => item.id === activeId.value));
const gradeMax = computed(() => Number(activeAssignment.value ? maxScore(activeAssignment.value) : 10));
const filteredMatrix = computed(() => {
  const query = submissionSearch.value.trim().toLocaleLowerCase();
  return matrix.value.filter(row => {
    const status = row.status || 'NOT_SUBMITTED';
    return (submissionStatusFilter.value === 'ALL' || status === submissionStatusFilter.value)
      && (!query || String(row.studentName || '').toLocaleLowerCase().includes(query));
  });
});
const submittedCount = computed(() => matrix.value.filter(row => ['SUBMITTED', 'GRADED', 'REVISION_REQUIRED'].includes(row.status)).length);
const notSubmittedCount = computed(() => matrix.value.filter(row => !row.status || row.status === 'NOT_SUBMITTED').length);
const gradedCount = computed(() => matrix.value.filter(row => row.status === 'GRADED').length);

const dueDate = assignment => assignment.dueDate ?? assignment.due_date;
const maxScore = assignment => Number(assignment.maxScore ?? assignment.max_score ?? 10);
const isRequired = assignment => Boolean(assignment.isRequired ?? assignment.is_required);
const allowLate = assignment => Boolean(assignment.allowLateSubmission ?? assignment.allow_late_submission ?? true);
const estimatedMinutes = assignment => assignment.estimatedMinutes ?? assignment.estimated_minutes;
const attachments = assignment => assignment.attachments || [];
const submissionAttachments = submission => submission.attachments || (submission.fileUrl ? [{ id: `legacy-${submission.submissionId}`, fileUrl: submission.fileUrl, fileName: submission.fileName || 'Tệp đính kèm' }] : []);
const submissionTypeLabel = assignment => ({ FILE: 'Tệp đính kèm', TEXT: 'Nội dung viết', BOTH: 'Tệp hoặc nội dung viết' })[assignment.submissionType ?? assignment.submission_type] || 'Tệp hoặc nội dung viết';

async function reload() {
  if (!classStore.selectedId) return;
  try {
    assignments.value = await assignmentsApi.list(classStore.selectedId);
    activeId.value = assignments.value[0]?.id ?? null;
    matrix.value = activeId.value ? await submissionsApi.matrix(activeId.value) : [];
  } catch (_) { assignments.value = []; matrix.value = []; }
}
async function loadMatrix() { if (activeId.value) matrix.value = await submissionsApi.matrix(activeId.value); }
const reloadMatrix = loadMatrix;

function resetForm() { Object.assign(formAssign, { title: '', description: '', dueDate: '', maxScore: 10, estimatedMinutes: null, isRequired: true, allowLateSubmission: true, submissionType: 'BOTH' }); pendingFiles.value = []; existingAttachments.value = []; }
function openCreate() { editMode.value = false; editId.value = null; resetForm(); showEditor.value = true; }
function closeEditor() { showEditor.value = false; editMode.value = false; editId.value = null; resetForm(); }
function openEdit(assignment) {
  editMode.value = true; editId.value = assignment.id;
  Object.assign(formAssign, { title: assignment.title, description: assignment.description || '', dueDate: dueDate(assignment), maxScore: maxScore(assignment), estimatedMinutes: estimatedMinutes(assignment), isRequired: isRequired(assignment), allowLateSubmission: allowLate(assignment), submissionType: assignment.submissionType ?? assignment.submission_type ?? 'BOTH' });
  pendingFiles.value = []; existingAttachments.value = [...attachments(assignment)]; showEditor.value = true;
}
function validatePendingFile(file) {
  const extension = String(file.name || '').split('.').pop().toLowerCase();
  if (!acceptedExtensions.has(extension)) { ElMessage.error('Định dạng tệp này chưa được hỗ trợ'); pendingFiles.value = pendingFiles.value.filter(item => item.uid !== file.uid); return false; }
  if (file.size > 100 * 1024 * 1024) { ElMessage.error('Mỗi tệp tối đa 100 MB'); pendingFiles.value = pendingFiles.value.filter(item => item.uid !== file.uid); return false; }
  return true;
}
function onAssignmentFileExceed() { ElMessage.warning('Mỗi bài tập chỉ đính kèm tối đa 8 tệp'); }
async function saveAssign() {
  if (!formAssign.title.trim() || !formAssign.dueDate) { ElMessage.warning('Nhập tên bài tập và hạn nộp'); return; }
  const formData = new FormData();
  Object.entries({ ...formAssign, classId: classStore.selectedId }).forEach(([key, value]) => { if (value !== null && value !== undefined) formData.append(key, value); });
  pendingFiles.value.forEach(file => { if (file.raw) formData.append('files', file.raw); });
  saving.value = true;
  try {
    if (editMode.value) await assignmentsApi.update(editId.value, formData); else await assignmentsApi.create(formData);
    ElMessage.success(editMode.value ? 'Đã cập nhật bài tập' : 'Đã tạo bài tập'); closeEditor(); await reload();
  } finally { saving.value = false; }
}
async function removeExistingAttachment(file) {
  try { await ElMessageBox.confirm(`Gỡ tệp "${file.fileName}"?`, 'Xác nhận', { type: 'warning' }); await assignmentsApi.deleteAttachment(editId.value, file.id); existingAttachments.value = existingAttachments.value.filter(item => item.id !== file.id); const current = assignments.value.find(item => item.id === editId.value); if (current) current.attachments = existingAttachments.value; ElMessage.success('Đã gỡ tệp'); } catch (_) {}
}
async function deleteAssign(assignment) {
  try { await ElMessageBox.confirm(`Xóa bài tập "${assignment.title}"? Toàn bộ bài nộp cũng sẽ bị xóa.`, 'Xác nhận xóa', { type: 'warning', confirmButtonText: 'Xóa bài tập' }); await assignmentsApi.delete(assignment.id); ElMessage.success('Đã xóa bài tập'); await reload(); } catch (_) {}
}
async function openComments(assignment) { commentAssignment.value = assignment; comments.value = await assignmentsApi.comments(assignment.id); showComments.value = true; }
async function addComment() { if (!commentAssignment.value || !commentText.value.trim()) return; await assignmentsApi.addComment(commentAssignment.value.id, commentText.value.trim()); commentText.value = ''; comments.value = await assignmentsApi.comments(commentAssignment.value.id); }
function viewSubmission(row) { viewRow.value = row; showView.value = true; }
function openGrade(row) { gradeRow.value = row; gradeForm.score = Number(row.score ?? 0); gradeForm.teacherComment = row.teacherComment || ''; gradeForm.status = row.status === 'REVISION_REQUIRED' ? 'REVISION_REQUIRED' : 'GRADED'; showGrade.value = true; }
function gradeFromView() { showView.value = false; if (viewRow.value) openGrade(viewRow.value); }
async function saveGrade() { grading.value = true; try { await submissionsApi.grade(gradeRow.value.submissionId, { ...gradeForm }); ElMessage.success('Đã lưu đánh giá'); showGrade.value = false; await loadMatrix(); } finally { grading.value = false; } }
function openFile(url) { window.open(mediaUrl(url), '_blank', 'noopener'); }
function downloadFile(url, name) { const link = document.createElement('a'); link.href = mediaUrl(url); link.download = name || String(url).split('/').pop(); link.click(); }

watch(() => classStore.selectedId, reload);
onMounted(reload);
</script>

<style scoped>
.assignment-page { max-width: 1440px; }
.action-bar,.assignment-toolbar,.card-header,.switch-row,.file-row,.existing-file,.view-meta { display:flex; align-items:center; }
.action-bar { justify-content:space-between; gap:20px; margin:12px 0 20px; }
.action-bar h2 { margin:2px 0; font-size:26px; }
.eyebrow,.section-label { color:var(--el-color-primary); font-size:12px; font-weight:700; letter-spacing:.08em; margin:0 0 5px; }
.subtle,.table-muted { color:var(--el-text-color-secondary); font-size:13px; }
.empty-card { margin-top:16px; }.assignment-tabs { margin-top:12px; }
.assignment-toolbar { justify-content:flex-end; gap:8px; margin:0 0 14px; }.search-input { width:230px; margin-right:auto; }.status-select { width:175px; }
.detail-card h3 { margin:0 0 8px; font-size:18px; }.description { white-space:pre-wrap; color:var(--el-text-color-regular); line-height:1.55; }
.detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:18px 0; }.detail-grid div { border-left:3px solid var(--el-color-primary-light-5); padding-left:9px; }.detail-grid span,.stat-grid span { display:block; color:var(--el-text-color-secondary); font-size:12px; }.detail-grid strong { display:block; margin-top:3px; font-size:13px; }
.tag-row { display:flex; flex-wrap:wrap; gap:6px; }.attachment-section { margin-top:18px; }.attachment-link,.existing-file button { background:transparent; border:0; cursor:pointer; padding:0; color:var(--el-color-primary); text-align:left; }.attachment-link { align-items:center; border:1px solid var(--el-border-color-lighter); border-radius:7px; display:flex; justify-content:space-between; margin:6px 0; padding:8px 10px; width:100%; }.file-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-right:10px; }
.stat-grid { display:grid; grid-template-columns:repeat(3, 1fr); text-align:center; }.stat-grid b { display:block; font-size:24px; margin-top:3px; }.green { color:#1d9e75; }.red { color:#d64545; }.blue { color:#2f76c2; }.submission-column { margin-top:0; }
.full-width { width:100%; }.switch-row { gap:24px; margin:0 0 22px; flex-wrap:wrap; }.upload-copy { display:flex; flex-direction:column; gap:5px; padding:8px; }.upload-copy span { color:var(--el-text-color-secondary); font-size:12px; line-height:1.45; }.existing-files { margin-top:-10px; }.existing-file { justify-content:space-between; gap:12px; border-bottom:1px solid var(--el-border-color-lighter); padding:8px 0; }
.submission-view { display:flex; flex-direction:column; gap:14px; }.view-meta { justify-content:space-between; }.view-meta span { color:var(--el-text-color-secondary); font-size:12px; }.text-submission,.result-box { background:var(--el-fill-color-light); border-radius:8px; padding:14px; white-space:pre-wrap; }.submission-files { border-top:1px solid var(--el-border-color-lighter); padding-top:12px; }.file-row { justify-content:space-between; gap:12px; padding:9px 0; border-bottom:1px solid var(--el-border-color-lighter); }.comments-box { max-height:320px; overflow:auto; margin-bottom:14px; }.comment-row { padding:10px 0; border-bottom:1px solid var(--el-border-color-lighter); }.comment-row span { margin-left:8px; color:var(--el-text-color-secondary); font-size:12px; }.comment-row p { margin:5px 0 0; white-space:pre-wrap; }
@media (max-width: 768px) { .action-bar { align-items:flex-start; flex-direction:column; }.assignment-toolbar { align-items:stretch; flex-direction:column; }.search-input,.status-select { width:100%; margin-right:0; }.detail-grid { grid-template-columns:1fr; }.submission-column { margin-top:18px; } }
</style>
