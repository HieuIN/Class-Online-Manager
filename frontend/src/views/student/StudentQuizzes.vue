<template>
  <div class="student-quiz">
    <ClassPicker @change="reload" />

    <div v-if="mode === 'list'">
      <div class="section-head">
        <div>
          <h3>Quiz của lớp</h3>
          <p>{{ classStore.selected?.name }}</p>
        </div>
      </div>

      <el-row :gutter="14">
        <el-col :span="16">
          <el-card v-for="q in quizzes" :key="q.id" class="quiz-card">
            <div class="quiz-card-main">
              <div>
                <div class="quiz-title">{{ q.title }}</div>
                <div class="quiz-desc">{{ q.description || 'Không có mô tả' }}</div>
                <div class="quiz-meta">
                  {{ q.questionCount || 0 }} câu hỏi · {{ q.time_limit_minutes || 'Không giới hạn' }} phút
                </div>
              </div>
              <el-button type="primary" @click="startQuiz(q)">Làm bài</el-button>
            </div>
          </el-card>
          <el-card v-if="!quizzes.length"><div class="empty">Lớp này chưa có quiz</div></el-card>
        </el-col>
        <el-col :span="8">
          <el-card>
            <template #header><b>Lịch sử làm bài</b></template>
            <div v-if="!attempts.length" class="empty small">Chưa có lượt làm</div>
            <div v-for="a in attempts" :key="a.id" class="attempt-row">
              <div>
                <b>{{ a.quizTitle }}</b>
                <div>{{ fmtDateTime(a.submitted_at || a.started_at) }}</div>
              </div>
              <el-tag :type="a.submitted_at ? 'success' : 'warning'">{{ a.score ?? 'Đang làm' }}</el-tag>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <div v-else-if="mode === 'taking'" class="take-shell">
      <el-card class="take-card">
        <div class="take-head">
          <div>
            <div class="quiz-title">{{ quizDetail.title }}</div>
            <div class="quiz-meta">Câu {{ currentIndex + 1 }}/{{ quizDetail.questions.length }}</div>
          </div>
          <div class="timer" :class="{ danger: remainingSeconds <= 60 }">{{ timeText }}</div>
        </div>

        <el-progress :percentage="progressPercent" :show-text="false" />

        <div v-if="currentQuestion" class="question-box">
          <div class="question-text">{{ currentQuestion.question }}</div>
          <el-radio-group v-model="answers[currentQuestion.id]" class="answer-list">
            <el-radio v-for="letter in letters" :key="letter" :label="letter" border>
              <b>{{ letter }}.</b> {{ currentQuestion[`option${letter}`] }}
            </el-radio>
          </el-radio-group>
        </div>

        <div class="take-actions">
          <el-button :disabled="currentIndex === 0" @click="currentIndex--">Trước</el-button>
          <div class="dots">
            <button
              v-for="(q, idx) in quizDetail.questions"
              :key="q.id"
              :class="['dot', currentIndex === idx ? 'active' : '', answers[q.id] ? 'done' : '']"
              @click="currentIndex = idx"
            >{{ idx + 1 }}</button>
          </div>
          <el-button v-if="currentIndex < quizDetail.questions.length - 1" type="primary" @click="currentIndex++">Tiếp</el-button>
          <el-button v-else type="success" @click="submitQuiz">Nộp bài</el-button>
        </div>
      </el-card>
    </div>

    <div v-else-if="mode === 'result'" class="take-shell">
      <el-card class="take-card">
        <div class="result-head">
          <div>
            <div class="quiz-title">{{ result.quizTitle }}</div>
            <div class="quiz-meta">Đã nộp lúc {{ fmtDateTime(result.submitted_at) }}</div>
          </div>
          <div class="score">{{ result.score }}</div>
        </div>
        <div v-for="(q, idx) in result.questions" :key="q.id" class="review-question">
          <div class="question-text">Câu {{ idx + 1 }}. {{ q.question }}</div>
          <div class="review-options">
            <span
              v-for="letter in letters"
              :key="letter"
              :class="['review-option', reviewClass(q, letter)]"
            >
              {{ letter }}. {{ q[`option${letter}`] }}
            </span>
          </div>
        </div>
        <el-button type="primary" @click="backToList">Quay lại danh sách</el-button>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import ClassPicker from '@/components/ClassPicker.vue';
import { useAuthStore } from '@/stores/auth';
import { useClassStore } from '@/stores/class';
import { quizzesApi } from '@/api';
import { fmtDateTime } from '@/utils/format';

const auth = useAuthStore();
const classStore = useClassStore();
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
let timer = null;

const currentQuestion = computed(() => quizDetail.value.questions[currentIndex.value]);
const progressPercent = computed(() => quizDetail.value.questions.length ? Math.round(((currentIndex.value + 1) / quizDetail.value.questions.length) * 100) : 0);
const timeText = computed(() => {
  if (!remainingSeconds.value) return 'Không giới hạn';
  const m = Math.floor(remainingSeconds.value / 60);
  const s = remainingSeconds.value % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
});

const reload = async () => {
  if (!classStore.selectedId || !auth.user) return;
  quizzes.value = await quizzesApi.list(classStore.selectedId);
  attempts.value = await quizzesApi.attempts({ studentId: auth.user.id });
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
    Object.keys(answers).forEach(k => delete answers[k]);
    currentIndex.value = 0;
    remainingSeconds.value = (quizDetail.value.timeLimitMinutes || 0) * 60;
    mode.value = 'taking';
    if (quizDetail.value.timeLimitMinutes) startTimer();
  } catch {}
};

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

const reviewClass = (q, letter) => {
  const chosen = result.value.answers?.[q.id];
  if (q.correctAnswer === letter) return 'correct';
  if (chosen === letter && chosen !== q.correctAnswer) return 'wrong';
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

onMounted(reload);
onUnmounted(() => { if (timer) clearInterval(timer); });
</script>

<style scoped>
.section-head { display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; }
.section-head h3 { margin:0; font-size:18px; }
.section-head p { margin:4px 0 0; color:#6b7280; font-size:13px; }
.quiz-card { margin-bottom:12px; }
.quiz-card-main { display:flex; justify-content:space-between; align-items:center; gap:16px; }
.quiz-title { font-weight:700; font-size:16px; color:#1f2937; }
.quiz-desc, .quiz-meta { font-size:13px; color:#6b7280; margin-top:4px; }
.attempt-row { display:flex; justify-content:space-between; gap:8px; border-bottom:1px solid #eee; padding:10px 0; font-size:12px; }
.attempt-row:last-child { border-bottom:0; }
.empty { padding:36px; text-align:center; color:#9ca3af; }
.empty.small { padding:14px; }
.take-shell { max-width:860px; margin:0 auto; }
.take-card { min-height:540px; }
.take-head, .result-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
.timer { color:#0F6E56; background:#E1F5EE; border-radius:8px; padding:8px 12px; font-weight:700; font-size:18px; }
.timer.danger { color:#A32D2D; background:#FDECEC; }
.question-box { padding:26px 0; }
.question-text { font-weight:700; font-size:18px; margin-bottom:16px; }
.answer-list { display:grid; grid-template-columns:1fr; gap:10px; width:100%; }
.answer-list :deep(.el-radio) { margin-right:0; min-height:48px; display:flex; align-items:center; }
.take-actions { display:flex; align-items:center; justify-content:space-between; gap:12px; border-top:1px solid #eee; padding-top:16px; }
.dots { display:flex; flex-wrap:wrap; gap:6px; justify-content:center; flex:1; }
.dot { width:30px; height:30px; border-radius:50%; border:1px solid #d1d5db; background:#fff; cursor:pointer; }
.dot.done { background:#E1F5EE; border-color:#1D9E75; }
.dot.active { background:#1D9E75; border-color:#1D9E75; color:#fff; }
.score { font-size:42px; font-weight:800; color:#0F6E56; }
.review-question { border-top:1px solid #eee; padding:16px 0; }
.review-options { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:8px; }
.review-option { border:1px solid #e5e7eb; border-radius:6px; padding:8px; font-size:13px; }
.review-option.correct { background:#E1F5EE; border-color:#1D9E75; color:#0F6E56; font-weight:700; }
.review-option.wrong { background:#FDECEC; border-color:#D85C5C; color:#A32D2D; }
</style>
