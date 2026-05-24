<template>
  <div>
    <ClassPicker @change="reload" />
    <div class="action-bar">
      <el-input v-model="submissionSearch" placeholder="Tìm học viên..." clearable class="search-input" />
      <el-select v-model="submissionStatusFilter" placeholder="Trạng thái" style="width:170px">
        <el-option label="Tất cả" value="ALL" />
        <el-option label="Chưa nộp" value="NOT_SUBMITTED" />
        <el-option label="Đã nộp" value="SUBMITTED" />
        <el-option label="Đã chấm" value="GRADED" />
        <el-option label="Cần sửa" value="REVISION_REQUIRED" />
      </el-select>
      <el-button type="primary" @click="showCreate = true">+ Tạo bài tập</el-button>
    </div>

    <el-tabs v-if="assignments.length" v-model="activeId" @tab-change="loadMatrix">
      <el-tab-pane v-for="a in assignments" :key="a.id" :name="a.id" :label="a.title">
        <el-row :gutter="14">
          <el-col :span="10">
            <el-card>
              <template #header>
                <div class="header-line">
                  <span class="section-title">Thông tin bài tập</span>
                  <div>
                    <el-button size="small" @click="openComments(a)">Thảo luận</el-button>
                    <el-button size="small" @click="openEdit(a)">Sửa</el-button>
                    <el-button size="small" type="danger" plain @click="deleteAssign(a)">Xóa</el-button>
                  </div>
                </div>
              </template>
              <div class="info-row"><span class="label">Tên:</span> <b>{{ a.title }}</b></div>
              <div class="info-row"><span class="label">Mô tả:</span> {{ a.description || '—' }}</div>
              <div class="info-row"><span class="label">Hạn nộp:</span> {{ fmtDateTime(a.due_date) }}</div>
              <div class="info-row"><span class="label">Loại:</span>
                <span :class="['badge', a.is_required ? 'badge-red' : 'badge-gray']">
                  {{ a.is_required ? 'Bắt buộc' : 'Tùy chọn' }}
                </span>
              </div>
              <el-divider />
              <el-row :gutter="10">
                <el-col :span="8">
                  <div class="stat-mini">
                    <div class="stat-label">Đã nộp</div>
                    <div class="stat-value" style="color:#3B6D11">{{ statCount('SUBMITTED') + statCount('GRADED') + statCount('REVISION_REQUIRED') }}</div>
                  </div>
                </el-col>
                <el-col :span="8">
                  <div class="stat-mini">
                    <div class="stat-label">Chưa nộp</div>
                    <div class="stat-value" style="color:#A32D2D">{{ statCount(null) }}</div>
                  </div>
                </el-col>
                <el-col :span="8">
                  <div class="stat-mini">
                    <div class="stat-label">Đã chấm</div>
                    <div class="stat-value" style="color:#185FA5">{{ statCount('GRADED') }}</div>
                  </div>
                </el-col>
              </el-row>
            </el-card>
          </el-col>
          <el-col :span="14">
            <el-card>
              <template #header>
                <div class="header-line">
                  <span class="section-title">Trạng thái nộp bài</span>
                  <el-button size="small" @click="reloadMatrix">↻ Refresh</el-button>
                </div>
              </template>
              <el-table :data="filteredMatrix" size="small">
                <el-table-column label="Học viên" prop="studentName" min-width="140" />
                <el-table-column label="Trạng thái" width="120">
                  <template #default="{ row }">
                    <span :class="['badge', submissionBadge(row.status || 'NOT_SUBMITTED').cls]">
                      {{ submissionBadge(row.status || 'NOT_SUBMITTED').label }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="Nộp lúc" width="120">
                  <template #default="{ row }">
                    <span class="text-xs">{{ row.submittedAt ? fmtDateTime(row.submittedAt) : '—' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="Điểm" width="60">
                  <template #default="{ row }">{{ row.score ?? '—' }}</template>
                </el-table-column>
                <el-table-column label="Hành động" width="180">
                  <template #default="{ row }">
                    <el-button v-if="row.submissionId" size="small" @click="viewSubmission(row)">Xem</el-button>
                    <el-button v-if="row.submissionId" size="small" type="primary" @click="openGrade(row)">
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

    <el-card v-else><div class="empty">Chưa có bài tập nào. Tạo bài tập đầu tiên!</div></el-card>

    <!-- Create/Edit assignment dialog -->
    <el-dialog v-model="showCreate" :title="editMode ? 'Sửa bài tập' : 'Tạo bài tập mới'" width="480px">
      <el-form label-position="top">
        <el-form-item label="Tên bài tập"><el-input v-model="formAssign.title" /></el-form-item>
        <el-form-item label="Mô tả"><el-input v-model="formAssign.description" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="Hạn nộp">
          <el-date-picker v-model="formAssign.dueDate" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="Chọn hạn nộp" />
        </el-form-item>
        <el-form-item><el-checkbox v-model="formAssign.isRequired">Bắt buộc</el-checkbox></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeCreate">Hủy</el-button>
        <el-button type="primary" @click="saveAssign">{{ editMode ? 'Cập nhật' : 'Tạo' }}</el-button>
      </template>
    </el-dialog>

    <!-- Grade dialog -->
    <el-dialog v-model="showGrade" title="Chấm bài" width="500px">
      <el-form v-if="gradeRow" label-position="top">
        <el-form-item label="Học viên"><b>{{ gradeRow.studentName }}</b></el-form-item>
        <el-form-item v-if="gradeRow.fileUrl" label="File đã nộp">
          <el-button size="small" @click="downloadFile(gradeRow.fileUrl)"><el-icon><Download /></el-icon> Tải file</el-button>
          <el-button size="small" @click="openFile(gradeRow.fileUrl)"><el-icon><View /></el-icon> Xem</el-button>
        </el-form-item>
        <el-form-item label="Điểm">
          <el-input-number v-model="gradeForm.score" :min="0" :max="10" :precision="1" :step="0.5" />
        </el-form-item>
        <el-form-item label="Nhận xét cho học viên">
          <el-input v-model="gradeForm.teacherComment" type="textarea" :rows="3" placeholder="VD: Bài làm tốt, cần cải thiện phần..." />
        </el-form-item>
        <el-form-item label="Trạng thái">
          <el-select v-model="gradeForm.status">
            <el-option label="Đã chấm" value="GRADED" />
            <el-option label="Cần sửa và nộp lại" value="REVISION_REQUIRED" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showGrade = false">Hủy</el-button>
        <el-button type="primary" @click="saveGrade">Lưu</el-button>
      </template>
    </el-dialog>

    <!-- View submission dialog -->
    <el-dialog v-model="showView" title="Xem bài đã nộp" width="600px">
      <div v-if="viewRow">
        <div class="info-row"><b>Học viên:</b> {{ viewRow.studentName }}</div>
        <div class="info-row"><b>Trạng thái:</b>
          <span :class="['badge', submissionBadge(viewRow.status).cls]">{{ submissionBadge(viewRow.status).label }}</span>
        </div>
        <div v-if="viewRow.submittedAt" class="info-row"><b>Thời gian nộp:</b> {{ fmtDateTime(viewRow.submittedAt) }}</div>
        <el-divider />

        <div v-if="viewRow.fileUrl" class="file-area">
          <p><b>📎 File đã nộp</b></p>
          <p style="font-size:12px;color:#888;margin:4px 0">{{ viewRow.fileUrl.split('/').pop() }}</p>
          <div>
            <el-button type="primary" @click="downloadFile(viewRow.fileUrl)">
              <el-icon><Download /></el-icon> Tải về
            </el-button>
            <el-button @click="openFile(viewRow.fileUrl)">
              <el-icon><View /></el-icon> Mở tab mới
            </el-button>
          </div>
          <!-- Inline preview for images -->
          <div v-if="isImage(viewRow.fileUrl)" class="preview-img">
            <img :src="viewRow.fileUrl" alt="Bài nộp" />
          </div>
        </div>
        <el-empty v-else description="Học viên không nộp file đính kèm" />

        <div v-if="viewRow.score != null" class="result-box">
          <div><b>Điểm:</b> <span style="font-size:18px;color:#1D9E75">{{ viewRow.score }}/10</span></div>
          <div v-if="viewRow.teacherComment" style="margin-top:6px"><b>Nhận xét:</b> {{ viewRow.teacherComment }}</div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showView = false">Đóng</el-button>
        <el-button type="primary" @click="gradeFromView">Chấm bài này</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showComments" title="Thread bài tập" width="560px">
      <div class="comments-box">
        <div v-for="c in comments" :key="c.id" class="comment-row">
          <b>{{ c.authorName || 'Người dùng' }}</b>
          <span class="text-xs">{{ fmtDateTime(c.createdAt) }}</span>
          <p>{{ c.content }}</p>
        </div>
        <div v-if="!comments.length" class="empty">Chưa có bình luận</div>
      </div>
      <el-input v-model="commentText" type="textarea" :rows="3" placeholder="Nhập bình luận..." />
      <template #footer>
        <el-button @click="showComments = false">Đóng</el-button>
        <el-button type="primary" @click="addComment">Gửi</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, computed } from 'vue';
import { useClassStore } from '@/stores/class';
import { ElMessage, ElMessageBox } from 'element-plus';
import ClassPicker from '@/components/ClassPicker.vue';
import { assignmentsApi, submissionsApi } from '@/api';
import { submissionBadge, fmtDateTime } from '@/utils/format';

const classStore = useClassStore();
const assignments = ref([]);
const activeId = ref(null);
const matrix = ref([]);
const submissionSearch = ref('');
const submissionStatusFilter = ref('ALL');
const showCreate = ref(false);
const showGrade = ref(false);
const showView = ref(false);
const editMode = ref(false);
const editId = ref(null);
const gradeRow = ref(null);
const viewRow = ref(null);
const showComments = ref(false);
const commentAssignment = ref(null);
const comments = ref([]);
const commentText = ref('');
const gradeForm = reactive({ score: 0, teacherComment: '', status: 'GRADED' });
const formAssign = reactive({ title: '', description: '', dueDate: '', isRequired: true });
const filteredMatrix = computed(() => {
  const q = submissionSearch.value.toLowerCase().trim();
  return matrix.value.filter(row => {
    const status = row.status || 'NOT_SUBMITTED';
    const matchesStatus = submissionStatusFilter.value === 'ALL' || status === submissionStatusFilter.value;
    const matchesSearch = !q || row.studentName.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });
});

const reload = async () => {
  const cid = classStore.selectedId;
  if (!cid) return;
  assignments.value = await assignmentsApi.list(cid);
  if (assignments.value.length) {
    activeId.value = assignments.value[0].id;
    await loadMatrix();
  } else { matrix.value = []; }
};

const loadMatrix = async () => {
  if (!activeId.value) return;
  matrix.value = await submissionsApi.matrix(activeId.value);
};
const reloadMatrix = loadMatrix;

const statCount = (status) => {
  if (status === null) return matrix.value.filter(m => !m.status || m.status === 'NOT_SUBMITTED').length;
  return matrix.value.filter(m => m.status === status).length;
};

const closeCreate = () => {
  showCreate.value = false;
  editMode.value = false;
  editId.value = null;
  Object.assign(formAssign, { title: '', description: '', dueDate: '', isRequired: true });
};

const saveAssign = async () => {
  if (!formAssign.title || !formAssign.dueDate) { ElMessage.warning('Nhập tên + hạn nộp'); return; }
  try {
    if (editMode.value) {
      await assignmentsApi.update(editId.value, formAssign);
      ElMessage.success('Đã cập nhật bài tập');
    } else {
      await assignmentsApi.create({ classId: classStore.selectedId, ...formAssign });
      ElMessage.success('Đã tạo bài tập');
    }
    closeCreate();
    reload();
  } catch (e) {}
};

const openEdit = (a) => {
  editMode.value = true;
  editId.value = a.id;
  Object.assign(formAssign, {
    title: a.title,
    description: a.description || '',
    dueDate: a.due_date,
    isRequired: a.is_required,
  });
  showCreate.value = true;
};

const deleteAssign = async (a) => {
  try {
    await ElMessageBox.confirm(`Xóa bài tập "${a.title}"? Tất cả bài nộp sẽ bị xóa.`, 'Xác nhận', { type: 'warning' });
    await assignmentsApi.delete(a.id);
    ElMessage.success('Đã xóa');
    reload();
  } catch {}
};

const openComments = async (assignment) => {
  commentAssignment.value = assignment;
  comments.value = await assignmentsApi.comments(assignment.id);
  showComments.value = true;
};

const addComment = async () => {
  if (!commentAssignment.value || !commentText.value.trim()) return;
  await assignmentsApi.addComment(commentAssignment.value.id, commentText.value.trim());
  commentText.value = '';
  comments.value = await assignmentsApi.comments(commentAssignment.value.id);
};

const openGrade = (row) => {
  gradeRow.value = row;
  gradeForm.score = row.score || 0;
  gradeForm.teacherComment = row.teacherComment || '';
  gradeForm.status = row.status === 'REVISION_REQUIRED' ? 'REVISION_REQUIRED' : 'GRADED';
  showGrade.value = true;
};

const saveGrade = async () => {
  await submissionsApi.grade(gradeRow.value.submissionId, { ...gradeForm });
  ElMessage.success('Đã chấm bài');
  showGrade.value = false;
  loadMatrix();
};

const viewSubmission = (row) => { viewRow.value = row; showView.value = true; };

const gradeFromView = () => {
  showView.value = false;
  openGrade(viewRow.value);
};

const downloadFile = (url) => {
  const link = document.createElement('a');
  link.href = url; link.download = url.split('/').pop(); link.click();
};
const openFile = (url) => window.open(url, '_blank');
const isImage = (url) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);

watch(() => classStore.selectedId, reload);
onMounted(reload);
</script>

<style scoped>
.action-bar { display:flex; justify-content:flex-end; gap: 8px; margin-bottom: 14px; flex-wrap:wrap; }
.search-input { width: 220px; margin-right:auto; }
.header-line { display:flex; justify-content:space-between; align-items:center; }
.info-row { font-size: 13px; margin-bottom: 8px; }
.info-row .label { color: #888; margin-right: 6px; }
.stat-mini { background: #f5f4f0; padding: 10px; border-radius: 8px; text-align: center; }
.stat-label { font-size: 11px; color: #888; }
.stat-value { font-size: 22px; font-weight: 600; }
.empty { padding: 30px; text-align: center; color: #aaa; }
.text-xs { font-size: 11px; color: #888; }
.file-area { background: #f9f9f7; padding: 14px; border-radius: 8px; margin-top: 10px; }
.preview-img { margin-top: 12px; }
.preview-img img { max-width: 100%; max-height: 300px; border-radius: 6px; border: 1px solid #eee; }
.result-box { background: #E1F5EE; padding: 12px; border-radius: 8px; margin-top: 14px; font-size: 13px; }
.comments-box { max-height: 320px; overflow:auto; margin-bottom: 12px; }
.comment-row { padding: 8px 0; border-bottom: 1px solid #eee; }
.comment-row p { margin: 4px 0 0; }
@media (max-width: 768px) {
  .search-input { width: 100%; margin-right:0; }
  .action-bar { justify-content:flex-start; }
}
</style>
