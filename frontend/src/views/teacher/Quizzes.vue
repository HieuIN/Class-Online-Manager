<template>
  <div class="quiz-page">
    <div class="topbar">
      <ClassPicker @change="reload" />
      <el-button type="primary" @click="openCreate">+ Tạo quiz</el-button>
    </div>

    <el-row :gutter="16">
      <el-col :span="9">
        <el-card class="panel">
          <template #header>
            <div class="panel-head">
              <span>Danh sách quiz</span>
              <el-tag size="small">{{ quizzes.length }}</el-tag>
            </div>
          </template>
          <div v-if="!quizzes.length" class="empty">Chưa có quiz nào cho lớp này</div>
          <div
            v-for="q in quizzes"
            :key="q.id"
            :class="['quiz-item', activeQuiz?.id === q.id ? 'active' : '']"
            @click="selectQuiz(q)"
          >
            <div class="quiz-title">{{ q.title }}</div>
            <div class="quiz-meta">
              {{ q.questionCount || 0 }} câu hỏi · {{ q.time_limit_minutes || 'Không giới hạn' }} phút
            </div>
            <div class="quiz-meta">Đã làm: {{ q.attemptCount || 0 }} lượt</div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="15">
        <el-card v-if="activeQuiz" class="panel">
          <template #header>
            <div class="panel-head">
              <div>
                <div class="detail-title">{{ activeQuiz.title }}</div>
                <div class="quiz-meta">{{ activeQuiz.description || 'Không có mô tả' }}</div>
              </div>
              <div>
                <el-button size="small" @click="openEdit(activeQuiz)">Sửa</el-button>
                <el-button size="small" type="danger" plain @click="removeQuiz(activeQuiz)">Xóa</el-button>
              </div>
            </div>
          </template>

          <el-row :gutter="12" class="metrics">
            <el-col :span="8"><div class="metric"><span>Câu hỏi</span><b>{{ fullQuiz.questions?.length || 0 }}</b></div></el-col>
            <el-col :span="8"><div class="metric"><span>Tổng điểm</span><b>{{ totalPoints }}</b></div></el-col>
            <el-col :span="8"><div class="metric"><span>Lượt làm</span><b>{{ attempts.length }}</b></div></el-col>
          </el-row>

          <el-tabs v-model="activeTab">
            <el-tab-pane label="Câu hỏi" name="questions">
              <div v-for="(q, idx) in fullQuiz.questions" :key="q.id" class="question-preview">
                <div class="question-line"><b>Câu {{ idx + 1 }}.</b> {{ q.question }}</div>
                <div class="options">
                  <span v-for="letter in letters" :key="letter" :class="['option', q.correctAnswer === letter ? 'correct' : '']">
                    {{ letter }}. {{ q[`option${letter}`] }}
                  </span>
                </div>
              </div>
            </el-tab-pane>
            <el-tab-pane label="Kết quả học viên" name="attempts">
              <el-table :data="attempts" size="small">
                <el-table-column label="Học viên" prop="studentName" min-width="150" />
                <el-table-column label="Email" prop="studentEmail" min-width="180" />
                <el-table-column label="Điểm" width="90">
                  <template #default="{ row }"><b>{{ row.score ?? '—' }}</b></template>
                </el-table-column>
                <el-table-column label="Bắt đầu" width="140">
                  <template #default="{ row }">{{ fmtDateTime(row.started_at) }}</template>
                </el-table-column>
                <el-table-column label="Nộp lúc" width="140">
                  <template #default="{ row }">{{ fmtDateTime(row.submitted_at) }}</template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </el-card>
        <el-card v-else class="panel"><div class="empty">Chọn một quiz để xem chi tiết</div></el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="showEditor" :title="editingId ? 'Sửa quiz' : 'Tạo quiz mới'" fullscreen>
      <div class="editor">
        <el-card>
          <el-form label-position="top">
            <el-row :gutter="14">
              <el-col :span="12">
                <el-form-item label="Tiêu đề"><el-input v-model="form.title" /></el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="Thời gian làm bài (phút)">
                  <el-input-number v-model="form.timeLimitMinutes" :min="1" :max="240" style="width:100%" />
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="Số câu hỏi"><el-input :model-value="form.questions.length" disabled /></el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="Mô tả"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>
            <el-row :gutter="14">
              <el-col :span="12">
                <el-form-item label="Mở từ">
                  <el-date-picker v-model="form.availableFrom" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width:100%" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="Đóng lúc">
                  <el-date-picker v-model="form.availableUntil" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width:100%" />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>
        </el-card>

        <div class="question-editor" v-for="(q, idx) in form.questions" :key="idx">
          <div class="question-editor-head">
            <b>Câu {{ idx + 1 }}</b>
            <el-button size="small" type="danger" plain @click="removeQuestion(idx)">Xóa câu</el-button>
          </div>
          <el-input v-model="q.question" type="textarea" :rows="2" placeholder="Nội dung câu hỏi" />
          <el-row :gutter="10" class="mt">
            <el-col :span="12" v-for="letter in letters" :key="letter">
              <el-input v-model="q[`option${letter}`]" :placeholder="`Đáp án ${letter}`" />
            </el-col>
          </el-row>
          <div class="question-footer">
            <span>Đáp án đúng</span>
            <el-radio-group v-model="q.correctAnswer">
              <el-radio-button v-for="letter in letters" :key="letter" :label="letter" />
            </el-radio-group>
            <span>Điểm</span>
            <el-input-number v-model="q.points" :min="0.25" :max="10" :step="0.25" />
          </div>
        </div>

        <el-button class="add-question" @click="addQuestion">+ Thêm câu hỏi</el-button>
      </div>
      <template #footer>
        <el-button @click="showEditor = false">Hủy</el-button>
        <el-button type="primary" @click="saveQuiz">Lưu quiz</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import ClassPicker from '@/components/ClassPicker.vue';
import { useClassStore } from '@/stores/class';
import { quizzesApi } from '@/api';
import { fmtDateTime } from '@/utils/format';

const classStore = useClassStore();
const quizzes = ref([]);
const activeQuiz = ref(null);
const fullQuiz = ref({ questions: [] });
const attempts = ref([]);
const activeTab = ref('questions');
const showEditor = ref(false);
const editingId = ref(null);
const letters = ['A', 'B', 'C', 'D'];
const form = reactive({
  title: '',
  description: '',
  timeLimitMinutes: 30,
  availableFrom: '',
  availableUntil: '',
  questions: [],
});

const totalPoints = computed(() => (fullQuiz.value.questions || []).reduce((s, q) => s + Number(q.points || 0), 0));

const blankQuestion = () => ({ question: '', optionA: '', optionB: '', optionC: '', optionD: '', correctAnswer: 'A', points: 1 });

const resetForm = () => {
  Object.assign(form, { title: '', description: '', timeLimitMinutes: 30, availableFrom: '', availableUntil: '', questions: [blankQuestion()] });
};

const reload = async () => {
  if (!classStore.selectedId) return;
  quizzes.value = await quizzesApi.list(classStore.selectedId);
  if (quizzes.value.length) await selectQuiz(activeQuiz.value ? quizzes.value.find(q => q.id === activeQuiz.value.id) || quizzes.value[0] : quizzes.value[0]);
  else {
    activeQuiz.value = null;
    fullQuiz.value = { questions: [] };
    attempts.value = [];
  }
};

const selectQuiz = async (quiz) => {
  if (!quiz) return;
  activeQuiz.value = quiz;
  fullQuiz.value = await quizzesApi.full(quiz.id);
  attempts.value = await quizzesApi.attempts({ quizId: quiz.id });
};

const openCreate = () => {
  editingId.value = null;
  resetForm();
  showEditor.value = true;
};

const openEdit = async (quiz) => {
  const data = await quizzesApi.full(quiz.id);
  editingId.value = quiz.id;
  Object.assign(form, {
    title: data.title,
    description: data.description || '',
    timeLimitMinutes: data.timeLimitMinutes || 30,
    availableFrom: data.availableFrom || '',
    availableUntil: data.availableUntil || '',
    questions: data.questions.map(q => ({
      question: q.question,
      optionA: q.optionA || '',
      optionB: q.optionB || '',
      optionC: q.optionC || '',
      optionD: q.optionD || '',
      correctAnswer: q.correctAnswer || 'A',
      points: Number(q.points || 1),
    })),
  });
  showEditor.value = true;
};

const addQuestion = () => form.questions.push(blankQuestion());
const removeQuestion = (idx) => {
  if (form.questions.length === 1) return ElMessage.warning('Quiz cần ít nhất 1 câu hỏi');
  form.questions.splice(idx, 1);
};

const saveQuiz = async () => {
  if (!form.title.trim()) return ElMessage.warning('Nhập tiêu đề quiz');
  if (!form.questions.length || form.questions.some(q => !q.question.trim())) return ElMessage.warning('Mỗi câu hỏi cần có nội dung');
  const payload = { classId: classStore.selectedId, ...form };
  if (editingId.value) await quizzesApi.update(editingId.value, payload);
  else await quizzesApi.create(payload);
  ElMessage.success('Đã lưu quiz');
  showEditor.value = false;
  await reload();
};

const removeQuiz = async (quiz) => {
  try {
    await ElMessageBox.confirm(`Xóa quiz "${quiz.title}" và toàn bộ lượt làm?`, 'Xác nhận', { type: 'warning' });
    await quizzesApi.delete(quiz.id);
    ElMessage.success('Đã xóa quiz');
    await reload();
  } catch {}
};

watch(() => classStore.selectedId, reload);
onMounted(reload);
</script>

<style scoped>
.topbar { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px; }
.panel { min-height: 420px; }
.panel-head { display:flex; align-items:center; justify-content:space-between; gap: 12px; }
.quiz-item { padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 10px; cursor:pointer; background:#fff; }
.quiz-item.active { border-color:#1D9E75; background:#F0FBF6; }
.quiz-title, .detail-title { font-weight: 700; color:#1f2937; }
.quiz-meta { font-size: 12px; color:#6b7280; margin-top: 4px; }
.metrics { margin-bottom: 14px; }
.metric { background:#F5F4F0; border-radius:8px; padding:12px; display:flex; justify-content:space-between; align-items:center; }
.metric span { color:#6b7280; font-size:12px; }
.metric b { font-size:22px; color:#0F6E56; }
.empty { padding: 36px; text-align:center; color:#9ca3af; }
.question-preview { border-bottom:1px solid #eee; padding:12px 0; }
.question-line { margin-bottom:8px; }
.options { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.option { background:#f8fafc; border:1px solid #e5e7eb; border-radius:6px; padding:8px; font-size:13px; }
.option.correct { background:#E1F5EE; border-color:#1D9E75; color:#0F6E56; font-weight:600; }
.editor { max-width: 980px; margin:0 auto; }
.question-editor { background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:14px; margin-top:12px; }
.question-editor-head, .question-footer { display:flex; align-items:center; gap:12px; justify-content:space-between; margin-bottom:10px; }
.question-footer { justify-content:flex-start; margin-top:10px; }
.mt { margin-top:10px; row-gap:10px; }
.add-question { width:100%; margin-top:12px; border-style:dashed; }
</style>
