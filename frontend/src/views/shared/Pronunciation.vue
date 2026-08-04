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
            <audio :src="mediaUrl(activeExercise.sampleAudioUrl)" controls />
          </div>

          <template v-if="canManage">
            <el-divider />
            <div class="panel-head submissions-head">
              <span class="section-title">Bài nộp của học viên</span>
              <el-button size="small" @click="loadSubmissions">↻ Refresh</el-button>
            </div>
            <el-table :data="submissions" size="small">
              <el-table-column type="expand">
                <template #default="{ row }"><div v-if="row.submissionId" class="ai-review-box"><b>AI đánh giá sơ bộ</b><p><strong>{{ row.aiScore ?? '—' }}/10</strong> · {{ row.aiFeedback || 'Chưa có nhận xét tự động' }}</p><p v-if="row.transcript"><b>Nhận diện:</b> {{ row.transcript }}</p><div v-if="row.aiBreakdown" class="score-chips"><span>Phát âm {{ row.aiBreakdown.pronunciation }}%</span><span>Thanh điệu {{ row.aiBreakdown.tone }}%</span><span>Trôi chảy {{ row.aiBreakdown.fluency }}%</span><span>Đọc đủ {{ row.aiBreakdown.completeness }}%</span></div><small>Điểm AI chỉ tham khảo; giáo viên nghe lại và chốt điểm cuối.</small></div></template>
              </el-table-column>
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
                  <audio v-if="row.audioUrl" :src="mediaUrl(row.audioUrl)" controls class="table-audio" />
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
                <el-button v-if="!isRecording" type="danger" plain :disabled="attemptLimitReached" @click="startRecording">
                  <el-icon><Microphone /></el-icon> Ghi âm
                </el-button>
                <el-button v-else type="warning" @click="stopRecording">Dừng ghi</el-button>
                <el-button :disabled="!recordedUrl" @click="clearRecording">Ghi lại</el-button>
                <el-button type="primary" :disabled="!recordedBlob" :loading="submitting" @click="submitRecording">Nộp bài</el-button>
              </div>
              <audio v-if="recordedUrl" :src="recordedUrl" controls class="preview-audio" />
              <p class="review-note">Số lần đã nộp: {{ activeExercise.myAttemptCount || 0 }}/{{ activeExercise.maxAttempts || 3 }}<span v-if="attemptLimitReached"> · Đã hết lượt thu</span></p>
              <el-alert v-if="speechSupported" type="info" :closable="false" show-icon :title="liveTranscript ? `AI đang nhận diện: ${liveTranscript}` : 'Khi ghi âm, AI sẽ nhận diện tiếng Trung và đưa ra đánh giá sơ bộ.'" />
              <el-alert v-else type="warning" :closable="false" show-icon title="Trình duyệt này chưa hỗ trợ nhận diện trực tiếp. Audio vẫn được gửi để giáo viên nghe và chấm." />
              <section v-if="activeExercise.mySubmissionId" class="submission-review">
                <div class="review-head">
                  <div>
                    <div class="review-title">Bản đã nộp</div>
                    <div class="exercise-meta">
                      {{ activeExercise.mySubmittedAt ? `Nộp lúc ${fmtDateTime(activeExercise.mySubmittedAt)}` : 'Đã gửi cho giáo viên' }}
                    </div>
                  </div>
                  <span :class="['badge', activeExercise.myStatus === 'GRADED' ? 'badge-green' : 'badge-blue']">
                    {{ activeExercise.myStatus === 'GRADED' ? 'Đã chấm' : 'Chờ chấm' }}
                  </span>
                </div>
                <audio v-if="activeExercise.myAudioUrl" :src="mediaUrl(activeExercise.myAudioUrl)" controls class="preview-audio" />
                <div v-if="activeExercise.myAiScore != null" class="ai-review-box"><b>AI đánh giá sơ bộ: {{ activeExercise.myAiScore }}/10</b><p>{{ activeExercise.myAiFeedback }}</p><p v-if="activeExercise.myTranscript"><b>AI nghe được:</b> {{ activeExercise.myTranscript }}</p><div v-if="activeExercise.myAiBreakdown" class="score-chips"><span>Phát âm {{ activeExercise.myAiBreakdown.pronunciation }}%</span><span>Thanh điệu {{ activeExercise.myAiBreakdown.tone }}%</span><span>Trôi chảy {{ activeExercise.myAiBreakdown.fluency }}%</span><span>Đọc đủ {{ activeExercise.myAiBreakdown.completeness }}%</span></div><small>Đây là kết quả tham khảo. Giáo viên sẽ nghe và xác nhận điểm cuối.</small></div>
                <div v-if="activeExercise.myStatus === 'GRADED'" class="review-score">
                  <span>Điểm phát âm</span>
                  <strong>{{ hasScore ? activeExercise.myScore : 'Chưa có điểm' }}</strong>
                </div>
                <el-alert
                  v-if="activeExercise.myTeacherComment"
                  type="success"
                  :closable="false"
                  show-icon
                  :title="`Nhận xét giáo viên: ${activeExercise.myTeacherComment}`"
                />
                <p class="review-note">Nộp lại sẽ thay thế bản ghi này và chuyển về trạng thái chờ chấm.</p>
              </section>
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
        <el-form-item label="Chấm sơ bộ bằng AI"><el-switch v-model="form.aiEnabled" active-text="Bật" inactive-text="Tắt" /></el-form-item>
        <el-row :gutter="12" v-if="form.aiEnabled">
          <el-col :span="8"><el-form-item label="Giọng chuẩn"><el-select v-model="form.accent"><el-option label="Trung Quốc đại lục" value="zh-CN"/><el-option label="Đài Loan" value="zh-TW"/></el-select></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="Số lần được thu"><el-input-number v-model="form.maxAttempts" :min="1" :max="20" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="Ngưỡng đạt"><el-input-number v-model="form.passScore" :min="0" :max="10" :step="0.5" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="Audio mẫu">
          <el-upload :auto-upload="false" :limit="1" :on-change="onSampleAudio" :file-list="sampleFileList" accept="audio/*">
            <el-button>Chọn audio mẫu</el-button>
          </el-upload>
          <audio v-if="form.sampleAudioUrl && !sampleFile" :src="mediaUrl(form.sampleAudioUrl)" controls class="sample-preview" />
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
import { mediaUrl } from '@/utils/media';

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
const form = reactive({ title: '', promptText: '', pinyin: '', meaning: '', dueDate: '', sampleAudioUrl: '', aiEnabled:true, accent:'zh-CN', maxAttempts:3, passScore:7 });

const isRecording = ref(false);
const recordedBlob = ref(null);
const recordedUrl = ref('');
const recordSeconds = ref(0);
let recorder = null;
let mediaStream = null;
let timer = null;
let chunks = [];
let speechRecognition = null;
const liveTranscript = ref('');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const speechSupported = computed(() => !!SpeechRecognition);

const canManage = computed(() => auth.isTeacher || auth.isAdmin);
const childMode = computed(() => isChildLearner(auth.user));
const hasScore = computed(() => activeExercise.value?.myScore !== null && activeExercise.value?.myScore !== undefined);
const attemptLimitReached = computed(() => Number(activeExercise.value?.myAttemptCount || 0) >= Number(activeExercise.value?.maxAttempts || 3));
const recorderStatus = computed(() => {
  if (isRecording.value) return 'Đang ghi âm, đọc rõ từng âm và thanh điệu.';
  if (recordedBlob.value) return 'Bạn có thể nghe lại trước khi nộp.';
  return 'Bấm ghi âm để luyện đọc theo audio mẫu.';
});

const resetForm = () => {
  Object.assign(form, { title: '', promptText: '', pinyin: '', meaning: '', dueDate: '', sampleAudioUrl: '', aiEnabled:true, accent:'zh-CN', maxAttempts:3, passScore:7 });
  sampleFile.value = null;
  sampleFileList.value = [];
};

const reload = async () => {
  if (!classStore.classes.length) await classStore.fetchClasses();
  if (!classStore.selectedId) return;
  try {
    exercises.value = await pronunciationApi.list(classStore.selectedId);
  } catch (error) {
    exercises.value = [];
    activeExercise.value = null;
    if (error.response?.status === 403) {
      ElMessage.error('Bạn chưa được ghi danh vào lớp này. Hãy chọn lớp đang theo học hoặc liên hệ giáo viên.');
    }
    return;
  }
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
    aiEnabled: ex.aiEnabled !== false, accent: ex.accent || 'zh-CN', maxAttempts: ex.maxAttempts || 3, passScore: Number(ex.passScore ?? 7),
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
    fd.append('aiEnabled', String(form.aiEnabled)); fd.append('accent', form.accent); fd.append('maxAttempts', String(form.maxAttempts)); fd.append('passScore', String(form.passScore));
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
  liveTranscript.value='';
  if (form.aiEnabled !== false && SpeechRecognition) { speechRecognition = new SpeechRecognition(); speechRecognition.lang=activeExercise.value?.accent || 'zh-CN'; speechRecognition.continuous=true; speechRecognition.interimResults=true; speechRecognition.onresult=e=>{liveTranscript.value=Array.from(e.results).map(r=>r[0].transcript).join('');}; try{speechRecognition.start();}catch{} }
  isRecording.value = true;
};

const stopRecording = () => {
  if (timer) clearInterval(timer);
  timer = null;
  isRecording.value = false;
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  try{speechRecognition?.stop();}catch{} speechRecognition=null;
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
  liveTranscript.value = '';
};

const submitRecording = async () => {
  if (!activeExercise.value || !recordedBlob.value) return;
  submitting.value = true;
  try {
    const fd = new FormData();
    fd.append('durationSeconds', recordSeconds.value);
    fd.append('transcript', liveTranscript.value || '');
    fd.append('file', new File([recordedBlob.value], `pronunciation-${activeExercise.value.id}.webm`, { type: recordedBlob.value.type || 'audio/webm' }));
    await pronunciationApi.submit(activeExercise.value.id, fd);
    ElMessage.success('Đã nộp bài phát âm');
    await reload();
  } catch (error) {
    if (error.response?.status === 403) {
      ElMessage.error('Bạn chưa được ghi danh vào lớp của bài phát âm này.');
    }
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
.ai-review-box{background:#f0f8f5;border:1px solid #cde6db;border-radius:9px;margin:10px 0;padding:14px}.ai-review-box p{line-height:1.55;margin:7px 0}.ai-review-box small{color:#6a7772}.score-chips{display:flex;flex-wrap:wrap;gap:7px;margin:9px 0}.score-chips span{background:#fff;border:1px solid #cde6db;border-radius:999px;font-size:12px;padding:5px 9px}
.muted { color:#aaa; }
.recorder { display:flex; flex-direction:column; gap:14px; }
.recorder-status { align-items:center; background:#e8f7f0; border:1px solid #cde6db; border-radius:8px; display:flex; justify-content:space-between; padding:14px; }
.recorder-title { color:var(--ink-900); font-weight:800; }
.timer { color:#0f6e56; font-size:24px; font-weight:800; }
.record-actions { display:flex; gap:10px; flex-wrap:wrap; }
.submission-review { background:#f7fbf8; border:1px solid #cde6db; border-radius:8px; display:flex; flex-direction:column; gap:12px; padding:14px; }
.review-head { align-items:flex-start; display:flex; gap:12px; justify-content:space-between; }
.review-title { color:var(--ink-900); font-weight:800; }
.review-score { align-items:baseline; background:#fff; border:1px solid #dcebe4; border-radius:7px; display:flex; justify-content:space-between; padding:10px 12px; }
.review-score span { color:var(--ink-500); font-size:12px; }
.review-score strong { color:#0f6e56; font-size:20px; }
.review-note { color:var(--ink-500); font-size:11px; line-height:1.5; margin:0; }
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
