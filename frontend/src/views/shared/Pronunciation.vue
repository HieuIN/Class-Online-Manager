<template>
  <div :class="['pronunciation-page', { 'child-pronunciation': childMode }]">
    <div class="topbar">
      <ClassPicker @change="reload" />
      <el-button v-if="canManage" type="primary" @click="openCreate">+ Tạo bài phát âm</el-button>
    </div>

    <section v-if="!canManage" class="pronunciation-journey" aria-labelledby="pronunciation-journey-title">
      <div>
        <span class="eyebrow">Luyện từng thanh điệu</span>
        <h1 id="pronunciation-journey-title">Nghe kỹ, đọc chậm, tự tin hơn mỗi ngày.</h1>
        <p>Chọn một bài, nghe audio mẫu, ghi lại giọng đọc của bạn rồi gửi cho giáo viên nhận xét.</p>
      </div>
      <ol class="journey-steps">
        <li><span><el-icon><Headset /></el-icon></span><div><b>1. Nghe mẫu</b><small>Bắt nhịp câu đọc</small></div></li>
        <li><span><el-icon><Microphone /></el-icon></span><div><b>2. Ghi âm</b><small>Đọc rõ từng âm</small></div></li>
        <li><span><el-icon><CircleCheck /></el-icon></span><div><b>3. Nhận xét</b><small>Cải thiện ở lần sau</small></div></li>
      </ol>
    </section>

    <el-row :gutter="14">
      <el-col :span="8">
        <el-card class="side-panel">
          <template #header>
            <div class="panel-head">
              <span class="section-title">Bài luyện phát âm</span>
              <el-tag size="small">{{ exercises.length }}</el-tag>
            </div>
          </template>
          <div
            v-for="ex in exercises"
            :key="ex.id"
            :class="['exercise-row', activeExercise?.id === ex.id ? 'active' : '']"
            @click="selectExercise(ex)"
          >
            <div class="exercise-title">{{ ex.title }}</div>
            <div class="exercise-meta">
              {{ ex.submissionCount || 0 }} bài nộp
              <span v-if="ex.dueDate"> · hạn {{ fmtDateTime(ex.dueDate) }}</span>
            </div>
            <span v-if="!canManage && ex.mySubmissionId" :class="['badge', ex.myStatus === 'GRADED' ? 'badge-green' : 'badge-blue']">
              {{ ex.myStatus === 'GRADED' ? `Đã chấm ${ex.myScore ?? ''}` : 'Đã nộp' }}
            </span>
          </div>
          <div v-if="!exercises.length" class="empty">Chưa có bài phát âm</div>
        </el-card>
      </el-col>

      <el-col :span="16">
        <el-card v-if="activeExercise" class="main-panel">
          <template #header>
            <div class="panel-head">
              <div>
                <div class="detail-title">{{ activeExercise.title }}</div>
                <div class="exercise-meta">Luyện nghe mẫu, đọc theo và nộp bản ghi âm</div>
              </div>
              <div v-if="canManage" class="head-actions">
                <el-button size="small" @click="openEdit(activeExercise)">Sửa</el-button>
                <el-button size="small" type="danger" plain @click="deleteExercise(activeExercise)">Xóa</el-button>
              </div>
            </div>
          </template>

          <div class="prompt-card">
            <div class="prompt-label">Nội dung cần đọc</div>
            <div class="prompt-text">{{ activeExercise.promptText }}</div>
            <div v-if="activeExercise.pinyin" class="pinyin">{{ activeExercise.pinyin }}</div>
            <div v-if="activeExercise.meaning" class="meaning">{{ activeExercise.meaning }}</div>
          </div>

          <div v-if="activeExercise.sampleAudioUrl" class="audio-block">
            <div class="audio-label">Audio mẫu</div>
            <audio :src="activeExercise.sampleAudioUrl" controls />
          </div>

          <template v-if="canManage">
            <el-divider />
            <div class="panel-head submissions-head">
              <span class="section-title">Bài nộp của học viên</span>
              <el-button size="small" @click="loadSubmissions">↻ Refresh</el-button>
            </div>
            <el-table :data="submissions" size="small">
              <el-table-column label="Học viên" prop="studentName" min-width="150" />
              <el-table-column label="Trạng thái" width="110">
                <template #default="{ row }">
                  <span :class="['badge', row.status === 'GRADED' ? 'badge-green' : row.submissionId ? 'badge-blue' : 'badge-gray']">
                    {{ row.status === 'GRADED' ? 'Đã chấm' : row.submissionId ? 'Đã nộp' : 'Chưa nộp' }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="Audio" min-width="210">
                <template #default="{ row }">
                  <audio v-if="row.audioUrl" :src="row.audioUrl" controls class="table-audio" />
                  <span v-else class="muted">—</span>
                </template>
              </el-table-column>
              <el-table-column label="Điểm" width="110">
                <template #default="{ row }">
                  <el-input-number v-if="row.submissionId" v-model="row.score" :min="0" :max="10" :step="0.5" size="small" />
                  <span v-else>—</span>
                </template>
              </el-table-column>
              <el-table-column label="Nhận xét" min-width="180">
                <template #default="{ row }">
                  <el-input v-if="row.submissionId" v-model="row.teacherComment" size="small" placeholder="VD: thanh 3 cần xuống rõ hơn" />
                  <span v-else>—</span>
                </template>
              </el-table-column>
              <el-table-column label="" width="90">
                <template #default="{ row }">
                  <el-button v-if="row.submissionId" size="small" type="primary" @click="grade(row)">Lưu</el-button>
                </template>
              </el-table-column>
            </el-table>
          </template>

          <template v-else>
            <el-divider />
            <div class="recorder">
              <div class="recorder-status">
                <div>
                  <div class="recorder-title">Bản ghi của bạn</div>
                  <div class="exercise-meta">{{ recorderStatus }}</div>
                </div>
                <div class="timer">{{ recordSeconds }}s</div>
              </div>
              <div class="record-actions">
                <el-button v-if="!isRecording" type="danger" plain @click="startRecording">
                  <el-icon><Microphone /></el-icon> Ghi âm
                </el-button>
                <el-button v-else type="warning" @click="stopRecording">Dừng ghi</el-button>
                <el-button :disabled="!recordedUrl" @click="clearRecording">Ghi lại</el-button>
                <el-button type="primary" :disabled="!recordedBlob" :loading="submitting" @click="submitRecording">Nộp bài</el-button>
              </div>
              <audio v-if="recordedUrl" :src="recordedUrl" controls class="preview-audio" />
              <el-alert
                v-if="activeExercise.myTeacherComment"
                type="success"
                :closable="false"
                show-icon
                :title="`Nhận xét giáo viên: ${activeExercise.myTeacherComment}`"
              />
            </div>
          </template>
        </el-card>
        <el-card v-else class="main-panel"><div class="empty">Chọn một bài để bắt đầu luyện phát âm</div></el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="showEditor" :title="editingId ? 'Sửa bài phát âm' : 'Tạo bài phát âm'" width="620px">
      <el-form label-position="top">
        <el-form-item label="Tiêu đề"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="Chữ / câu cần đọc">
          <el-input v-model="form.promptText" type="textarea" :rows="3" placeholder="VD: 你好，我叫安娜。" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="Pinyin"><el-input v-model="form.pinyin" placeholder="nǐ hǎo, wǒ jiào ān nà" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="Nghĩa"><el-input v-model="form.meaning" placeholder="Xin chào, tôi tên là Anna" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="Hạn nộp">
          <el-date-picker v-model="form.dueDate" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width:100%" />
        </el-form-item>
        <el-form-item label="Audio mẫu">
          <el-upload :auto-upload="false" :limit="1" :on-change="onSampleAudio" :file-list="sampleFileList" accept="audio/*">
            <el-button>Chọn audio mẫu</el-button>
          </el-upload>
          <audio v-if="form.sampleAudioUrl && !sampleFile" :src="form.sampleAudioUrl" controls class="sample-preview" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditor = false">Hủy</el-button>
        <el-button type="primary" :loading="saving" @click="saveExercise">Lưu</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch, onUnmounted, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { CircleCheck, Headset, Microphone } from '@element-plus/icons-vue';
import ClassPicker from '@/components/ClassPicker.vue';
import { pronunciationApi } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useClassStore } from '@/stores/class';
import { fmtDateTime } from '@/utils/format';
import { isChildLearner } from '@/utils/learner';

const auth = useAuthStore();
const classStore = useClassStore();
const exercises = ref([]);
const activeExercise = ref(null);
const submissions = ref([]);
const showEditor = ref(false);
const editingId = ref(null);
const saving = ref(false);
const submitting = ref(false);
const sampleFile = ref(null);
const sampleFileList = ref([]);
const form = reactive({ title: '', promptText: '', pinyin: '', meaning: '', dueDate: '', sampleAudioUrl: '' });

const isRecording = ref(false);
const recordedBlob = ref(null);
const recordedUrl = ref('');
const recordSeconds = ref(0);
let recorder = null;
let mediaStream = null;
let timer = null;
let chunks = [];

const canManage = computed(() => auth.isTeacher || auth.isAdmin);
const childMode = computed(() => isChildLearner(auth.user));
const recorderStatus = computed(() => {
  if (isRecording.value) return 'Đang ghi âm, đọc rõ từng âm và thanh điệu.';
  if (recordedBlob.value) return 'Bạn có thể nghe lại trước khi nộp.';
  return 'Bấm ghi âm để luyện đọc theo audio mẫu.';
});

const resetForm = () => {
  Object.assign(form, { title: '', promptText: '', pinyin: '', meaning: '', dueDate: '', sampleAudioUrl: '' });
  sampleFile.value = null;
  sampleFileList.value = [];
};

const reload = async () => {
  if (!classStore.classes.length) await classStore.fetchClasses();
  if (!classStore.selectedId) return;
  exercises.value = await pronunciationApi.list(classStore.selectedId);
  const current = activeExercise.value ? exercises.value.find(e => e.id === activeExercise.value.id) : null;
  if (current) await selectExercise(current);
  else if (exercises.value.length) await selectExercise(exercises.value[0]);
  else {
    activeExercise.value = null;
    submissions.value = [];
  }
};

const selectExercise = async (ex) => {
  activeExercise.value = ex;
  clearRecording();
  if (canManage.value) await loadSubmissions();
};

const loadSubmissions = async () => {
  if (!activeExercise.value) return;
  submissions.value = await pronunciationApi.submissions(activeExercise.value.id);
};

const openCreate = () => {
  editingId.value = null;
  resetForm();
  showEditor.value = true;
};

const openEdit = (ex) => {
  editingId.value = ex.id;
  Object.assign(form, {
    title: ex.title,
    promptText: ex.promptText,
    pinyin: ex.pinyin || '',
    meaning: ex.meaning || '',
    dueDate: ex.dueDate || '',
    sampleAudioUrl: ex.sampleAudioUrl || '',
  });
  sampleFile.value = null;
  sampleFileList.value = [];
  showEditor.value = true;
};

const onSampleAudio = (file) => {
  sampleFile.value = file.raw;
  sampleFileList.value = [file];
};

const saveExercise = async () => {
  if (!form.title.trim() || !form.promptText.trim()) return ElMessage.warning('Nhập tiêu đề và nội dung cần đọc');
  saving.value = true;
  try {
    const fd = new FormData();
    fd.append('classId', classStore.selectedId);
    fd.append('title', form.title);
    fd.append('promptText', form.promptText);
    fd.append('pinyin', form.pinyin || '');
    fd.append('meaning', form.meaning || '');
    fd.append('dueDate', form.dueDate || '');
    if (form.sampleAudioUrl) fd.append('sampleAudioUrl', form.sampleAudioUrl);
    if (sampleFile.value) fd.append('file', sampleFile.value);
    if (editingId.value) await pronunciationApi.update(editingId.value, fd);
    else await pronunciationApi.create(fd);
    ElMessage.success('Đã lưu bài phát âm');
    showEditor.value = false;
    await reload();
  } finally {
    saving.value = false;
  }
};

const deleteExercise = async (ex) => {
  try {
    await ElMessageBox.confirm(`Xóa bài "${ex.title}" và toàn bộ bài nộp?`, 'Xác nhận', { type: 'warning' });
    await pronunciationApi.delete(ex.id);
    ElMessage.success('Đã xóa');
    await reload();
  } catch {}
};

const startRecording = async () => {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    ElMessage.error('Trình duyệt chưa hỗ trợ ghi âm trực tiếp');
    return;
  }
  clearRecording();
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  chunks = [];
  const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
  recorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
  recorder.ondataavailable = (event) => {
    if (event.data?.size) chunks.push(event.data);
  };
  recorder.onstop = () => {
    recordedBlob.value = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
    recordedUrl.value = URL.createObjectURL(recordedBlob.value);
    stopStream();
  };
  recordSeconds.value = 0;
  timer = setInterval(() => { recordSeconds.value += 1; }, 1000);
  recorder.start();
  isRecording.value = true;
};

const stopRecording = () => {
  if (timer) clearInterval(timer);
  timer = null;
  isRecording.value = false;
  if (recorder && recorder.state !== 'inactive') recorder.stop();
};

const stopStream = () => {
  mediaStream?.getTracks?.().forEach(track => track.stop());
  mediaStream = null;
};

const clearRecording = () => {
  if (isRecording.value) stopRecording();
  if (recordedUrl.value) URL.revokeObjectURL(recordedUrl.value);
  recordedBlob.value = null;
  recordedUrl.value = '';
  recordSeconds.value = 0;
};

const submitRecording = async () => {
  if (!activeExercise.value || !recordedBlob.value) return;
  submitting.value = true;
  try {
    const fd = new FormData();
    fd.append('durationSeconds', recordSeconds.value);
    fd.append('file', new File([recordedBlob.value], `pronunciation-${activeExercise.value.id}.webm`, { type: recordedBlob.value.type || 'audio/webm' }));
    await pronunciationApi.submit(activeExercise.value.id, fd);
    ElMessage.success('Đã nộp bài phát âm');
    await reload();
  } finally {
    submitting.value = false;
  }
};

const grade = async (row) => {
  if (row.score == null) return ElMessage.warning('Nhập điểm trước khi lưu');
  await pronunciationApi.grade(row.submissionId, { score: row.score, teacherComment: row.teacherComment });
  ElMessage.success('Đã lưu điểm phát âm');
  await loadSubmissions();
};

watch(() => classStore.selectedId, reload);
onMounted(reload);
onUnmounted(() => {
  clearRecording();
  stopStream();
});
</script>

<style scoped>
.topbar { display:flex; align-items:flex-start; justify-content:space-between; gap: 12px; margin-bottom: 12px; }
.pronunciation-journey { align-items: center; background: #e2f4ec; border: 1px solid #cde6db; border-radius: 8px; display: grid; gap: 22px; grid-template-columns: minmax(0, 1fr) minmax(400px, 0.92fr); margin-bottom: 16px; padding: 25px 28px; }
.pronunciation-journey h1 { color: #173d31; font-size: clamp(23px, 2.4vw, 31px); font-weight: 800; letter-spacing: 0; line-height: 1.2; margin: 8px 0; }
.pronunciation-journey p { color: #477265; font-size: 13px; line-height: 1.6; margin: 0; max-width: 610px; }
.journey-steps { display: grid; gap: 8px; grid-template-columns: repeat(3, minmax(0, 1fr)); list-style: none; margin: 0; padding: 0; }
.journey-steps li { align-items: center; background: rgba(255, 255, 255, 0.68); border: 1px solid rgba(205, 230, 219, 0.9); border-radius: 8px; display: flex; gap: 9px; min-height: 72px; padding: 10px; }
.journey-steps li > span { align-items: center; background: #fff0dc; border-radius: 8px; color: #bf702d; display: inline-flex; flex: 0 0 auto; font-size: 17px; height: 33px; justify-content: center; width: 33px; }
.journey-steps b { color: var(--ink-900); display: block; font-size: 11px; line-height: 1.35; }
.journey-steps small { color: var(--ink-500); display: block; font-size: 10px; line-height: 1.35; margin-top: 2px; }
.side-panel, .main-panel { min-height: 520px; }
.panel-head { display:flex; align-items:center; justify-content:space-between; gap: 12px; }
.head-actions { display:flex; gap: 8px; }
.exercise-row { background: var(--surface); border:1px solid var(--border); border-radius: 8px; cursor:pointer; margin-bottom: 10px; padding: 13px; transition: border-color .15s, box-shadow .15s, transform .15s; }
.exercise-row:hover { border-color: #8fcdb7; box-shadow: var(--shadow-soft); transform: translateY(-1px); }
.exercise-row.active { background:#e8f7f0; border-color:#0f8e6d; box-shadow: inset 3px 0 0 #0f8e6d; }
.exercise-title, .detail-title { color:var(--ink-900); font-weight:800; }
.exercise-meta { color:var(--ink-500); font-size:12px; margin-top:4px; }
.prompt-card { background:#fff7ea; border:1px solid #f3ddbd; border-radius:8px; padding:20px; }
.prompt-label, .audio-label { color:var(--ink-500); font-size:12px; margin-bottom: 8px; }
.prompt-text { color:var(--ink-900); font-size:clamp(24px, 3vw, 31px); font-weight:800; line-height:1.5; }
.pinyin { color:#0f6e56; font-size:18px; margin-top:8px; }
.meaning { color:var(--ink-700); margin-top:5px; }
.audio-block { margin-top: 14px; display:flex; align-items:center; gap: 12px; flex-wrap:wrap; }
.audio-block audio, .preview-audio, .sample-preview { width: 100%; max-width: 520px; }
.submissions-head { margin-bottom: 10px; }
.table-audio { width: 190px; height: 32px; }
.muted { color:#aaa; }
.recorder { display:flex; flex-direction:column; gap:14px; }
.recorder-status { align-items:center; background:#e8f7f0; border:1px solid #cde6db; border-radius:8px; display:flex; justify-content:space-between; padding:14px; }
.recorder-title { color:var(--ink-900); font-weight:800; }
.timer { color:#0f6e56; font-size:24px; font-weight:800; }
.record-actions { display:flex; gap:10px; flex-wrap:wrap; }
.empty { padding: 36px; text-align:center; color:#999; }
.child-pronunciation .pronunciation-journey { border-width: 2px; }
.child-pronunciation .exercise-row { border-left: 3px solid #0f8e6d; }
.child-pronunciation .prompt-card { border-width: 2px; }
.child-pronunciation .record-actions :deep(.el-button) { min-height: 40px; }
@media (max-width: 768px) {
  .topbar { display:block; }
  .pronunciation-journey { align-items: stretch; grid-template-columns: 1fr; padding: 20px; }
  .journey-steps { grid-template-columns: 1fr; }
  :deep(.el-col) { max-width:100%; flex:0 0 100%; margin-bottom:12px; }
  .prompt-text { font-size:22px; }
}
</style>
