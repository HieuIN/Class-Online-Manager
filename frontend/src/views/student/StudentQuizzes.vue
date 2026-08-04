<template>
  <div :class="['student-quiz', { 'child-quiz': childMode }]">
    <div v-if="mode === 'list'" class="quiz-list-shell">
      <div class="quiz-page-heading">
        <div>
          <span class="eyebrow">Ôn tập chủ động</span>
          <h1>Quiz của lớp</h1>
          <p>Chọn một bài ngắn, tập trung trả lời và xem lại kiến thức ngay sau khi nộp bài.</p>
        </div>
        <ClassPicker @change="reload" />
      </div>

      <div class="quiz-overview-grid">
        <section class="quiz-collection" aria-label="Danh sách quiz">
          <div v-if="!quizzes.length" class="quiz-empty-state">
            <span class="empty-icon"><el-icon><EditPen /></el-icon></span>
            <strong>Lớp này chưa có quiz</strong>
            <p>Giáo viên sẽ thêm bài ôn tập tại đây khi sẵn sàng.</p>
          </div>
          <article v-for="q in quizzes" :key="q.id" class="quiz-card">
            <span class="quiz-card-icon"><el-icon><EditPen /></el-icon></span>
            <div class="quiz-card-content">
              <h2>{{ q.title }}</h2>
              <p>{{ q.description || 'Bài ôn tập ngắn để kiểm tra phần kiến thức đã học.' }}</p>
              <div class="quiz-meta-list">
                <span><el-icon><Reading /></el-icon>{{ q.questionCount || 0 }} câu hỏi</span>
                <span><el-icon><Clock /></el-icon>{{ q.time_limit_minutes || 'Không giới hạn' }}{{ q.time_limit_minutes ? ' phút' : '' }}</span>
              </div>
            </div>
            <el-button type="primary" @click="startQuiz(q)">
              Làm bài <el-icon><ArrowRight /></el-icon>
            </el-button>
          </article>
        </section>

        <aside class="quiz-history" aria-label="Lịch sử làm bài">
          <div class="history-heading">
            <span class="history-icon"><el-icon><Trophy /></el-icon></span>
            <div>
              <h2>Lịch sử làm bài</h2>
              <p>Theo dõi những lần bạn đã hoàn thành.</p>
            </div>
          </div>
          <div v-if="!attempts.length" class="history-empty">Chưa có lượt làm bài.</div>
          <div v-for="a in attempts" :key="a.id" class="attempt-row">
            <div>
              <strong>{{ a.quizTitle }}</strong>
              <span>{{ fmtDateTime(a.submitted_at || a.started_at) }}</span>
            </div>
            <span :class="['attempt-score', { pending: !a.submitted_at }]">{{ a.score ?? '...' }}</span>
          </div>
        </aside>
      </div>
    </div>

    <div v-else-if="mode === 'taking'" class="take-shell">
      <div class="quiz-taking-heading">
        <div>
          <span class="eyebrow">Đang làm quiz</span>
          <h1>{{ quizDetail.title }}</h1>
        </div>
        <div class="timer" :class="{ danger: remainingSeconds > 0 && remainingSeconds <= 60 }">
          <el-icon><Clock /></el-icon>{{ timeText }}
        </div>
      </div>

      <section class="quiz-take-card">
        <div class="take-progress-row">
          <span>Câu {{ currentIndex + 1 }} / {{ quizDetail.questions.length }}</span>
          <span>{{ answeredCount }} đã trả lời</span>
        </div>
        <el-progress :percentage="progressPercent" :show-text="false" :stroke-width="8" />

        <div v-if="currentQuestion" class="question-box">
          <span class="question-kicker">Câu {{ currentIndex + 1 }}</span>
          <div v-if="currentQuestion.config?.passage" class="reading-passage">{{ currentQuestion.config.passage }}</div>
          <h2>{{ currentQuestion.question }}</h2>
          <img v-if="currentQuestion.mediaType==='IMAGE'&&currentQuestion.mediaUrl" :src="mediaUrl(currentQuestion.mediaUrl)" class="question-media" @click="selectHotspot" />
          <audio v-if="currentQuestion.mediaType==='AUDIO'&&currentQuestion.mediaUrl" :src="mediaUrl(currentQuestion.mediaUrl)" controls class="question-audio" />
          <video v-if="currentQuestion.mediaType==='VIDEO'&&currentQuestion.mediaUrl" :src="mediaUrl(currentQuestion.mediaUrl)" controls class="question-media" />

          <el-radio-group v-if="singleChoiceTypes.includes(questionType)" v-model="answers[currentQuestion.id]" class="answer-list">
            <el-radio v-for="letter in letters" :key="letter" :label="letter" border>
              <b>{{ letter }}</b><img v-if="currentQuestion.config?.optionMedia?.[letter]" :src="mediaUrl(currentQuestion.config.optionMedia[letter])" class="option-image" /><span>{{ currentQuestion[`option${letter}`] }}</span>
            </el-radio>
          </el-radio-group>
          <el-checkbox-group v-else-if="questionType==='MULTIPLE_CHOICE'" v-model="answers[currentQuestion.id]" class="answer-list">
            <el-checkbox v-for="letter in letters" :key="letter" :label="letter" border><b>{{ letter }}</b><img v-if="currentQuestion.config?.optionMedia?.[letter]" :src="mediaUrl(currentQuestion.config.optionMedia[letter])" class="option-image"/><span>{{ currentQuestion[`option${letter}`] }}</span></el-checkbox>
          </el-checkbox-group>
          <el-radio-group v-else-if="questionType==='TRUE_FALSE'" v-model="answers[currentQuestion.id]" class="answer-list"><el-radio label="TRUE" border>Đúng</el-radio><el-radio label="FALSE" border>Sai</el-radio></el-radio-group>
          <el-input v-else-if="textTypes.includes(questionType)" v-model="answers[currentQuestion.id]" type="textarea" :rows="3" placeholder="Nhập câu trả lời" />
          <div v-else-if="questionType==='MATCHING'" class="matching-list"><div v-for="item in currentQuestion.config.leftItems" :key="item.id" class="matching-row"><span><img v-if="item.image" :src="mediaUrl(item.image)" class="mini-image"/><em v-if="item.text">{{ item.text }}</em></span><el-select v-model="answers[currentQuestion.id][item.id]" placeholder="Chọn vế nối"><el-option v-for="right in currentQuestion.config.rightOptions" :key="right.id" :label="right.text || 'Hình ảnh'" :value="right.id"><div class="matching-option"><img v-if="right.image" :src="mediaUrl(right.image)" class="mini-image"/><span v-if="right.text">{{ right.text }}</span></div></el-option></el-select></div></div>
          <div v-else-if="questionType==='ORDERING'" class="ordering"><div class="ordered-answer"><span v-for="(item,i) in answers[currentQuestion.id]" :key="i" @click="removeOrdered(i)">{{ i+1 }}. {{ item }}</span></div><p>Chọn lần lượt theo thứ tự đúng:</p><el-button v-for="item in currentQuestion.config.items" :key="item" :disabled="answers[currentQuestion.id].includes(item)" @click="answers[currentQuestion.id].push(item)">{{ item }}</el-button></div>
          <div v-else-if="questionType==='CLASSIFICATION'" class="matching-list"><div v-for="item in currentQuestion.config.classItems" :key="item.text" class="matching-row"><span><img v-if="item.image" :src="mediaUrl(item.image)" class="mini-image"/>{{ item.text }}</span><el-select v-model="answers[currentQuestion.id][item.text]" placeholder="Chọn nhóm"><el-option v-for="group in currentQuestion.config.categories" :key="group" :label="group" :value="group"/></el-select></div></div>
          <div v-else-if="questionType==='IMAGE_HOTSPOT'" class="hotspot-help">Bấm vào vị trí đúng trên ảnh.<span v-if="answers[currentQuestion.id]">Đã chọn: {{ Math.round(answers[currentQuestion.id].x) }}%, {{ Math.round(answers[currentQuestion.id].y) }}%</span></div>
          <div v-else-if="questionType==='HANZI_WRITE'" class="hanzi-quiz"><div ref="hanziTarget" class="hanzi-target"></div><span>{{ hanziFeedback }}</span><el-button @click="startHanziQuestion">Viết lại</el-button></div>
          <div v-else-if="questionType==='RECORDING'" class="record-answer"><el-button type="danger" @click="recording ? stopRecording() : startRecording()">{{ recording?'Dừng ghi âm':'Bắt đầu ghi âm' }}</el-button><audio v-if="recordingPreview" :src="recordingPreview" controls/><span v-if="answers[currentQuestion.id]">Đã lưu bản ghi âm</span></div>
        </div>

        <div class="take-actions">
          <el-button :disabled="currentIndex === 0" @click="currentIndex--">
            <el-icon><ArrowLeft /></el-icon> Trước
          </el-button>
          <div class="question-dots" aria-label="Điều hướng câu hỏi">
            <button
              v-for="(q, idx) in quizDetail.questions"
              :key="q.id"
              :class="['question-dot', currentIndex === idx ? 'active' : '', answers[q.id] ? 'done' : '']"
              type="button"
              :aria-label="`Câu ${idx + 1}`"
              @click="currentIndex = idx"
            >{{ idx + 1 }}</button>
          </div>
          <el-button v-if="currentIndex < quizDetail.questions.length - 1" type="primary" @click="currentIndex++">
            Tiếp <el-icon><ArrowRight /></el-icon>
          </el-button>
          <el-button v-else type="success" @click="submitQuiz">Nộp bài</el-button>
        </div>
      </section>
    </div>

    <div v-else-if="mode === 'result'" class="take-shell">
      <section class="quiz-result-card">
        <div class="result-summary">
          <span class="result-icon"><el-icon><CircleCheck /></el-icon></span>
          <div>
            <span class="eyebrow">Đã hoàn thành</span>
            <h1>{{ result.quizTitle }}</h1>
            <p>Đã nộp lúc {{ fmtDateTime(result.submitted_at) }}</p>
          </div>
          <div class="score"><small>Điểm</small>{{ result.score }}</div>
        </div>
        <div class="review-list">
          <article v-for="(q, idx) in result.questions" :key="q.id" class="review-question">
            <h2>Câu {{ idx + 1 }}. {{ q.question }}</h2>
            <div class="review-options">
              <span
                v-for="letter in letters"
                :key="letter"
                :class="['review-option', reviewClass(q, letter)]"
              >
                <b>{{ letter }}</b>{{ q[`option${letter}`] }}
              </span>
            </div>
          </article>
        </div>
        <el-button type="primary" @click="backToList">Quay lại danh sách</el-button>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import HanziWriter from 'hanzi-writer';
import { ArrowLeft, ArrowRight, CircleCheck, Clock, EditPen, Reading, Trophy } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import ClassPicker from '@/components/ClassPicker.vue';
import { useAuthStore } from '@/stores/auth';
import { useClassStore } from '@/stores/class';
import { quizzesApi } from '@/api';
import { fmtDateTime } from '@/utils/format';
import { isChildLearner } from '@/utils/learner';
import { mediaUrl } from '@/utils/media';

const auth = useAuthStore();
const classStore = useClassStore();
const childMode = computed(() => isChildLearner(auth.user));
const quizzes = ref([]);
const attempts = ref([]);
const mode = ref('list');
const quizDetail = ref({ questions: [] });
const currentAttempt = ref(null);
const currentIndex = ref(0);
const answers = reactive({});
const result = ref(null);
const remainingSeconds = ref(0);
const letters = ['A', 'B', 'C', 'D'];
const singleChoiceTypes=['SINGLE_CHOICE','IMAGE_CHOICE','AUDIO_CHOICE','READING'];
const textTypes=['TEXT_INPUT','FILL_BLANK','DRAG_BLANK','LISTEN_TYPE'];
const hanziTarget=ref(null),hanziFeedback=ref('Viết từng nét theo đúng thứ tự'),recording=ref(false),recordingPreview=ref('');
let hanziWriter=null,mediaRecorder=null,mediaStream=null,recordedChunks=[];
let timer = null;

const currentQuestion = computed(() => quizDetail.value.questions[currentIndex.value]);
const questionType = computed(()=>currentQuestion.value?.questionType||'SINGLE_CHOICE');
const answeredCount = computed(() => quizDetail.value.questions.filter(question => answers[question.id]).length);
const progressPercent = computed(() => quizDetail.value.questions.length ? Math.round(((currentIndex.value + 1) / quizDetail.value.questions.length) * 100) : 0);
const timeText = computed(() => {
  if (!remainingSeconds.value) return 'Không giới hạn';
  const minutes = Math.floor(remainingSeconds.value / 60);
  const seconds = remainingSeconds.value % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
});

const reload = async () => {
  if (!classStore.selected || !auth.user) {
    quizzes.value = [];
    attempts.value = [];
    return;
  }
  try {
    quizzes.value = await quizzesApi.list(classStore.selected.id);
    attempts.value = await quizzesApi.attempts({ studentId: auth.user.id });
  } catch {
    quizzes.value = [];
    attempts.value = [];
  }
};

const startTimer = () => {
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    if (remainingSeconds.value > 0) remainingSeconds.value -= 1;
    if (remainingSeconds.value === 0 && quizDetail.value.timeLimitMinutes) submitQuiz(true);
  }, 1000);
};

const startQuiz = async (quiz) => {
  try {
    await ElMessageBox.confirm(`Bắt đầu làm quiz "${quiz.title}"?`, 'Xác nhận', { type: 'info' });
    quizDetail.value = await quizzesApi.get(quiz.id);
    currentAttempt.value = await quizzesApi.start(quiz.id);
    Object.keys(answers).forEach(key => delete answers[key]);
    currentIndex.value = 0;
    remainingSeconds.value = (quizDetail.value.timeLimitMinutes || 0) * 60;
    mode.value = 'taking';
    prepareQuestion();
    if (quizDetail.value.timeLimitMinutes) startTimer();
  } catch {}
};

const prepareQuestion=()=>{const q=currentQuestion.value;if(!q)return;if(answers[q.id]===undefined){if(['MULTIPLE_CHOICE','ORDERING'].includes(q.questionType))answers[q.id]=[];else if(['MATCHING','CLASSIFICATION'].includes(q.questionType))answers[q.id]={};else answers[q.id]='';}if(q.questionType==='HANZI_WRITE')nextTick(startHanziQuestion);};
const removeOrdered=i=>answers[currentQuestion.value.id].splice(i,1);
const selectHotspot=event=>{if(questionType.value!=='IMAGE_HOTSPOT')return;const rect=event.currentTarget.getBoundingClientRect();answers[currentQuestion.value.id]={x:(event.clientX-rect.left)/rect.width*100,y:(event.clientY-rect.top)/rect.height*100};};
const startHanziQuestion=()=>{const q=currentQuestion.value;if(!hanziTarget.value||q?.questionType!=='HANZI_WRITE')return;hanziTarget.value.innerHTML='';const size=Math.min(320,Math.max(240,hanziTarget.value.parentElement?.clientWidth||280));hanziWriter=HanziWriter.create(hanziTarget.value,q.config.character,{width:size,height:size,padding:16,showCharacter:false,showOutline:true,drawingColor:'#16856f',drawingWidth:10});hanziWriter.quiz({showHintAfterMisses:1,onMistake:()=>hanziFeedback.value='Sai nét — hãy viết lại nét này',onCorrectStroke:d=>hanziFeedback.value=`Đúng · còn ${d.strokesRemaining} nét`,onComplete:()=>{answers[q.id]={completed:true};hanziFeedback.value='Đã viết đúng chữ';}});};
const startRecording=async()=>{try{mediaStream=await navigator.mediaDevices.getUserMedia({audio:true});recordedChunks=[];mediaRecorder=new MediaRecorder(mediaStream);mediaRecorder.ondataavailable=e=>{if(e.data.size)recordedChunks.push(e.data);};mediaRecorder.onstop=uploadRecording;mediaRecorder.start();recording.value=true;}catch{ElMessage.error('Không thể truy cập micro');}};
const stopRecording=()=>{mediaRecorder?.stop();mediaStream?.getTracks().forEach(t=>t.stop());recording.value=false;};
const uploadRecording=async()=>{const blob=new Blob(recordedChunks,{type:mediaRecorder?.mimeType||'audio/webm'});if(recordingPreview.value)URL.revokeObjectURL(recordingPreview.value);recordingPreview.value=URL.createObjectURL(blob);const fd=new FormData();fd.append('file',new File([blob],`quiz-recording-${Date.now()}.webm`,{type:blob.type}));const uploaded=await quizzesApi.uploadMedia(fd);answers[currentQuestion.value.id]=uploaded.mediaUrl;ElMessage.success('Đã lưu bản ghi âm');};

const submitQuiz = async (auto = false) => {
  if (!currentAttempt.value) return;
  if (!auto) {
    try {
      await ElMessageBox.confirm('Nộp bài ngay bây giờ?', 'Xác nhận', { type: 'warning' });
    } catch { return; }
  }
  if (timer) clearInterval(timer);
  result.value = await quizzesApi.submit(currentAttempt.value.id, { ...answers });
  mode.value = 'result';
  ElMessage.success(auto ? 'Hết giờ, hệ thống đã tự nộp bài' : 'Đã nộp bài');
  await reload();
};

const reviewClass = (question, letter) => {
  const chosen = result.value.answers?.[question.id];
  if (question.correctAnswer === letter) return 'correct';
  if (chosen === letter && chosen !== question.correctAnswer) return 'wrong';
  return '';
};

const backToList = () => {
  mode.value = 'list';
  result.value = null;
  currentAttempt.value = null;
};

watch(() => classStore.selectedId, () => {
  backToList();
  reload();
});
watch(currentIndex,()=>{recordingPreview.value='';prepareQuestion();});

onMounted(async () => {
  if (!classStore.classes.length) await classStore.fetchClasses();
  await reload();
});
onUnmounted(() => { if (timer) clearInterval(timer);hanziWriter?.cancelQuiz();mediaStream?.getTracks().forEach(t=>t.stop());if(recordingPreview.value)URL.revokeObjectURL(recordingPreview.value); });
</script>

<style scoped>
.student-quiz { max-width: 1160px; margin: 0 auto; }
.quiz-page-heading { align-items: end; display: flex; gap: 20px; justify-content: space-between; margin-bottom: 20px; }
.quiz-page-heading h1, .quiz-taking-heading h1, .result-summary h1 { color: var(--ink-900); font-size: 29px; font-weight: 800; letter-spacing: 0; line-height: 1.15; margin: 6px 0; }
.quiz-page-heading p { color: var(--ink-500); font-size: 13px; line-height: 1.55; margin: 0; max-width: 620px; }
.quiz-page-heading :deep(.class-picker) { margin-bottom: 0; min-width: 240px; }
.quiz-overview-grid { align-items: start; display: grid; gap: 16px; grid-template-columns: minmax(0, 1.5fr) minmax(285px, 0.72fr); }
.quiz-collection { display: grid; gap: 12px; }
.quiz-card { align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; display: flex; gap: 15px; min-height: 132px; padding: 18px; transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease; }
.quiz-card:hover { border-color: #d99b62; box-shadow: var(--shadow-soft); transform: translateY(-2px); }
.quiz-card-icon { align-items: center; background: #fff0de; border-radius: 8px; color: #c77331; display: inline-flex; flex: 0 0 auto; font-size: 22px; height: 46px; justify-content: center; width: 46px; }
.quiz-card-content { flex: 1; min-width: 0; }
.quiz-card h2, .quiz-history h2 { color: var(--ink-900); font-size: 15px; font-weight: 800; line-height: 1.35; margin: 0; }
.quiz-card p { color: var(--ink-500); font-size: 12px; line-height: 1.55; margin: 5px 0 9px; }
.quiz-meta-list { color: var(--ink-500); display: flex; flex-wrap: wrap; font-size: 11px; gap: 12px; }
.quiz-meta-list span { align-items: center; display: inline-flex; gap: 4px; }
.quiz-meta-list .el-icon { color: #c77331; }
.quiz-history { background: #fffaf3; border: 1px solid #f0dfca; border-radius: 8px; min-height: 180px; padding: 18px; }
.history-heading { align-items: flex-start; display: flex; gap: 10px; margin-bottom: 15px; }
.history-icon { align-items: center; background: #ffe7bc; border-radius: 8px; color: #b87317; display: inline-flex; flex: 0 0 auto; font-size: 17px; height: 34px; justify-content: center; width: 34px; }
.history-heading p { color: var(--ink-500); font-size: 11px; line-height: 1.45; margin: 3px 0 0; }
.history-empty { color: var(--ink-400); font-size: 12px; padding: 24px 0 8px; text-align: center; }
.attempt-row { align-items: center; border-top: 1px solid #f0dfca; display: flex; font-size: 12px; gap: 10px; justify-content: space-between; padding: 12px 0; }
.attempt-row strong { color: var(--ink-900); display: block; font-size: 12px; }
.attempt-row span:not(.attempt-score) { color: var(--ink-500); display: block; font-size: 10px; margin-top: 3px; }
.attempt-score { align-items: center; background: #e2f5eb; border-radius: 999px; color: #15694f; display: inline-flex; font-size: 12px; font-weight: 800; height: 28px; justify-content: center; min-width: 34px; padding: 0 8px; }
.attempt-score.pending { background: #ffedda; color: #a4601e; }
.quiz-empty-state { align-items: center; background: var(--surface); border: 1px dashed var(--border-strong); border-radius: 8px; color: var(--ink-500); display: flex; flex-direction: column; justify-content: center; min-height: 260px; padding: 28px; text-align: center; }
.empty-icon { align-items: center; background: #fff0de; border-radius: 8px; color: #c77331; display: inline-flex; font-size: 23px; height: 48px; justify-content: center; margin-bottom: 12px; width: 48px; }
.quiz-empty-state strong { color: var(--ink-900); font-size: 14px; }
.quiz-empty-state p { font-size: 12px; margin: 5px 0 0; }

.take-shell { margin: 0 auto; max-width: 920px; }
.quiz-taking-heading { align-items: center; display: flex; gap: 16px; justify-content: space-between; margin-bottom: 18px; }
.quiz-taking-heading h1 { font-size: 24px; }
.timer { align-items: center; background: #e0f5ec; border: 1px solid #c8e8da; border-radius: 8px; color: #0f6e56; display: inline-flex; font-size: 17px; font-weight: 800; gap: 7px; padding: 10px 13px; white-space: nowrap; }
.timer.danger { background: #fde8e7; border-color: #f5c8c5; color: #b23b37; }
.quiz-take-card, .quiz-result-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--shadow-soft); padding: clamp(20px, 4vw, 38px); }
.take-progress-row { color: var(--ink-500); display: flex; font-size: 12px; font-weight: 700; justify-content: space-between; margin-bottom: 10px; }
.question-box { padding: 34px 0; }
.question-kicker { color: #c77331; display: block; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
.question-box h2 { color: var(--ink-900); font-size: clamp(20px, 2.4vw, 27px); font-weight: 800; line-height: 1.4; margin: 9px 0 23px; }
.answer-list { display: grid; gap: 10px; width: 100%; }
.answer-list :deep(.el-radio) { align-items: center; background: var(--surface); border-color: var(--border); border-radius: 8px; display: flex; margin-right: 0; min-height: 58px; padding: 11px 14px; transition: border-color 160ms ease, background 160ms ease; }
.answer-list :deep(.el-radio:hover) { border-color: #d99b62; background: #fffaf3; }
.answer-list :deep(.el-radio.is-checked) { background: #e6f5ef; border-color: #0f8e6d; }
.answer-list :deep(.el-radio__label) { align-items: center; color: var(--ink-900); display: flex; font-size: 14px; gap: 10px; padding-left: 9px; white-space: normal; }
.answer-list :deep(.el-radio__label b) { align-items: center; background: #edf1ee; border-radius: 6px; color: var(--ink-700); display: inline-flex; flex: 0 0 auto; font-size: 11px; height: 25px; justify-content: center; width: 25px; }
.answer-list :deep(.el-radio.is-checked .el-radio__label b) { background: #0f8e6d; color: #fff; }
.answer-list :deep(.el-checkbox){align-items:center;border-radius:8px;display:flex;margin:0;min-height:58px;padding:11px 14px;width:100%}.answer-list :deep(.el-checkbox__label){align-items:center;display:flex;gap:10px;white-space:normal}.option-image{border-radius:7px;height:clamp(90px,12vw,170px);object-fit:contain;width:clamp(120px,18vw,230px)}.question-media{border-radius:10px;cursor:crosshair;display:block;margin:0 auto 20px;max-height:min(52vh,520px);max-width:100%;object-fit:contain}.question-audio{margin-bottom:20px;width:100%}.reading-passage{background:#f6f8f7;border-left:4px solid #16856f;border-radius:7px;line-height:1.7;margin-bottom:20px;padding:16px;white-space:pre-wrap}.matching-list{display:grid;gap:14px}.matching-row{align-items:center;border:1px solid var(--border);border-radius:10px;display:grid;gap:18px;grid-template-columns:minmax(180px,.85fr) minmax(260px,1.15fr);min-height:150px;padding:16px}.matching-row>span{align-items:center;display:flex;gap:14px;font-weight:700;min-width:0}.matching-row em{font-style:normal}.matching-row>.el-select{width:100%}.mini-image{border-radius:8px;height:clamp(110px,14vw,190px);max-width:100%;object-fit:contain;width:clamp(140px,20vw,260px)}.matching-option{align-items:center;display:flex;gap:10px;min-height:60px}.matching-option .mini-image{height:56px;width:76px}.ordering .ordered-answer{border:1px dashed #16856f;border-radius:8px;display:flex;flex-wrap:wrap;gap:7px;min-height:60px;padding:10px}.ordered-answer span{background:#e1f5ee;border-radius:6px;cursor:pointer;padding:7px}.ordering>.el-button{margin:5px}.hotspot-help{color:#66756f;display:flex;flex-direction:column;gap:6px;text-align:center}.hanzi-quiz{align-items:center;display:flex;flex-direction:column;gap:10px}.hanzi-target{border:2px solid #cddbd5;max-width:320px;touch-action:none;width:100%}.record-answer{align-items:center;display:flex;flex-direction:column;gap:12px}.record-answer audio{max-width:100%}
.take-actions { align-items: center; border-top: 1px solid var(--border); display: flex; gap: 12px; justify-content: space-between; padding-top: 18px; }
.question-dots { display: flex; flex: 1; flex-wrap: wrap; gap: 6px; justify-content: center; }
.question-dot { background: var(--surface); border: 1px solid var(--border-strong); border-radius: 7px; color: var(--ink-500); cursor: pointer; font-size: 11px; font-weight: 800; height: 30px; padding: 0; transition: background 150ms ease, border-color 150ms ease; width: 30px; }
.question-dot.done { background: #e0f5ec; border-color: #7ecfb5; color: #0f6e56; }
.question-dot.active { background: #0f8e6d; border-color: #0f8e6d; color: #fff; }

.result-summary { align-items: center; border-bottom: 1px solid var(--border); display: flex; gap: 13px; padding-bottom: 24px; }
.result-icon { align-items: center; background: #e0f5ec; border-radius: 8px; color: #0f8e6d; display: inline-flex; flex: 0 0 auto; font-size: 28px; height: 56px; justify-content: center; width: 56px; }
.result-summary h1 { font-size: 23px; margin: 5px 0; }
.result-summary p { color: var(--ink-500); font-size: 12px; margin: 0; }
.score { align-items: center; background: #fff0de; border-radius: 8px; color: #b56522; display: inline-flex; flex: 0 0 auto; flex-direction: column; font-size: 28px; font-weight: 800; justify-content: center; line-height: 1.1; margin-left: auto; min-height: 66px; min-width: 80px; padding: 8px 12px; }
.score small { color: #9e713f; font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
.review-list { margin: 10px 0 22px; }
.review-question { border-bottom: 1px solid var(--border); padding: 19px 0; }
.review-question h2 { color: var(--ink-900); font-size: 14px; line-height: 1.5; margin: 0 0 12px; }
.review-options { display: grid; gap: 8px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.review-option { align-items: flex-start; border: 1px solid var(--border); border-radius: 7px; color: var(--ink-700); display: flex; font-size: 12px; gap: 7px; min-height: 42px; padding: 9px; }
.review-option b { color: var(--ink-400); }
.review-option.correct { background: #e5f5ec; border-color: #8ed4bb; color: #17684f; font-weight: 700; }
.review-option.wrong { background: #fcebea; border-color: #f0b8b3; color: #a33733; }
.child-quiz .quiz-card, .child-quiz .quiz-history, .child-quiz .quiz-take-card, .child-quiz .quiz-result-card { border-width: 2px; }
.child-quiz .quiz-card { background:#fffaf0; border-color:#efc982; }
.child-quiz .quiz-history { background:#edf7ff; border-color:#a8cde9; }
.child-quiz .quiz-take-card, .child-quiz .quiz-result-card { background:#fffdf7; border-color:#e5c47f; }
.child-quiz .quiz-card-icon { background:#ffe5bd; }
.child-quiz .history-icon { background:#dff1ff; color:#2e77ab; }
.child-quiz .quiz-card h2, .child-quiz .question-box h2 { line-height: 1.45; }
.child-quiz .answer-list :deep(.el-radio) { min-height: 66px; }
.child-quiz .question-dot { height: 34px; width: 34px; }

@media (max-width: 768px) {
  .quiz-page-heading, .quiz-taking-heading { align-items: stretch; flex-direction: column; }
  .quiz-page-heading :deep(.class-picker) { min-width: 0; width: 100%; }
  .quiz-overview-grid { grid-template-columns: 1fr; }
  .quiz-card { align-items: flex-start; flex-wrap: wrap; min-height: 0; }
  .quiz-card-content { flex-basis: calc(100% - 61px); }
  .quiz-card :deep(.el-button) { margin-left: 61px; }
  .quiz-taking-heading { gap: 10px; }
  .timer { align-self: flex-start; }
  .question-box { padding: 25px 0; }
  .take-actions { align-items: stretch; flex-wrap: wrap; }
  .take-actions :deep(.el-button) { flex: 1; }
  .question-dots { flex-basis: 100%; order: -1; }
  .result-summary { align-items: flex-start; flex-wrap: wrap; }
  .score { margin-left: 69px; }
  .review-options { grid-template-columns: 1fr; }
  .matching-row{grid-template-columns:1fr;min-height:0;padding:14px}.matching-row>span{flex-direction:column;justify-content:center;text-align:center}.matching-row .mini-image{height:auto;max-height:240px;width:min(100%,320px)}.option-image{height:auto;max-height:220px;width:min(100%,300px)}
}
</style>
