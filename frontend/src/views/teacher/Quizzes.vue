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
                <div class="question-line"><b>Câu {{ idx + 1 }}.</b> <el-tag size="small">{{ questionTypes.find(t=>t.value===(q.questionType||'SINGLE_CHOICE'))?.label }}</el-tag> {{ q.question }}</div>
                <img v-if="q.mediaType==='IMAGE'&&q.mediaUrl" :src="mediaUrl(q.mediaUrl)" class="preview-question-media" />
                <div v-if="choiceTypes.includes(q.questionType||'SINGLE_CHOICE')" class="options">
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
                <el-table-column label="Chi tiết" width="110"><template #default="{row}"><el-button size="small" @click="openAttempt(row)">{{ row.needs_manual_grading ? 'Chấm bài' : 'Xem' }}</el-button></template></el-table-column>
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
          <el-form-item label="Loại câu hỏi" class="question-type-select">
            <el-select v-model="q.questionType" style="width:100%" @change="changeQuestionType(q)">
              <el-option v-for="type in questionTypes" :key="type.value" :label="type.label" :value="type.value" />
            </el-select>
          </el-form-item>
          <el-input v-model="q.question" type="textarea" :rows="2" placeholder="Nội dung câu hỏi" />
          <div class="media-editor">
            <el-input v-model="q.mediaUrl" placeholder="URL ảnh / GIF / âm thanh / video của câu hỏi" />
            <el-upload :auto-upload="false" :show-file-list="false" :on-change="file=>uploadMedia(file,q)"><el-button :loading="uploadingMedia">Tải media</el-button></el-upload>
          </div>
          <img v-if="q.mediaType==='IMAGE'&&q.mediaUrl" class="media-preview" :src="mediaUrl(q.mediaUrl)" />
          <audio v-if="q.mediaType==='AUDIO'&&q.mediaUrl" :src="mediaUrl(q.mediaUrl)" controls />
          <video v-if="q.mediaType==='VIDEO'&&q.mediaUrl" :src="mediaUrl(q.mediaUrl)" class="media-preview" controls />

          <template v-if="choiceTypes.includes(q.questionType)">
            <el-input v-if="q.questionType==='READING'" v-model="q.config.passage" class="mt" type="textarea" :rows="4" placeholder="Đoạn văn dùng cho câu hỏi" />
            <el-row :gutter="10" class="mt">
              <el-col :span="12" v-for="letter in letters" :key="letter">
                <div class="option-editor">
                  <el-input v-model="q[`option${letter}`]" :placeholder="`Đáp án ${letter}`" />
                  <el-input v-model="q.config.optionMedia[letter]" placeholder="URL ảnh đáp án (tùy chọn)" />
                </div>
              </el-col>
            </el-row>
            <div class="question-footer"><span>Đáp án đúng</span>
              <el-checkbox-group v-if="q.questionType==='MULTIPLE_CHOICE'" v-model="q.config.correctAnswers"><el-checkbox-button v-for="letter in letters" :key="letter" :label="letter" /></el-checkbox-group>
              <el-radio-group v-else v-model="q.correctAnswer"><el-radio-button v-for="letter in letters" :key="letter" :label="letter" /></el-radio-group>
            </div>
          </template>
          <template v-else-if="q.questionType==='TRUE_FALSE'">
            <div class="question-footer"><span>Đáp án đúng</span><el-radio-group v-model="q.correctAnswer"><el-radio-button label="TRUE">Đúng</el-radio-button><el-radio-button label="FALSE">Sai</el-radio-button></el-radio-group></div>
          </template>
          <template v-else-if="textTypes.includes(q.questionType)">
            <el-input v-model="q.answerText" class="mt" placeholder="Các đáp án chấp nhận, cách nhau bằng dấu |" />
            <el-input v-if="q.questionType==='DRAG_BLANK'" v-model="q.config.wordBankText" class="mt" placeholder="Ngân hàng từ, cách nhau bằng dấu |" />
          </template>
          <template v-else-if="q.questionType==='MATCHING'">
            <p class="form-tip">Mỗi vế có thể dùng chữ, ảnh hoặc cả hai. Hai cột sẽ được trộn độc lập khi học sinh làm bài.</p>
            <div v-for="(pair,pairIndex) in q.config.pairs" :key="pair.id || pairIndex" class="matching-pair-editor">
              <div class="matching-side"><b>Vế A</b><el-input v-model="pair.leftText" placeholder="Chữ / nội dung vế A"/><el-input v-model="pair.leftImage" placeholder="URL ảnh vế A"/><el-upload :auto-upload="false" :show-file-list="false" :on-change="file=>uploadPairImage(file,pair,'leftImage')"><el-button :loading="uploadingMedia">Tải ảnh A</el-button></el-upload><img v-if="pair.leftImage" :src="mediaUrl(pair.leftImage)" class="pair-preview"/></div>
              <div class="matching-arrow">↔</div>
              <div class="matching-side"><b>Vế B</b><el-input v-model="pair.rightText" placeholder="Chữ / nội dung vế B"/><el-input v-model="pair.rightImage" placeholder="URL ảnh vế B"/><el-upload :auto-upload="false" :show-file-list="false" :on-change="file=>uploadPairImage(file,pair,'rightImage')"><el-button :loading="uploadingMedia">Tải ảnh B</el-button></el-upload><img v-if="pair.rightImage" :src="mediaUrl(pair.rightImage)" class="pair-preview"/></div>
              <el-button type="danger" plain @click="q.config.pairs.splice(pairIndex,1)">×</el-button>
            </div>
            <el-button class="mt" @click="q.config.pairs.push(blankPair())">+ Thêm cặp nối</el-button>
          </template>
          <template v-else-if="q.questionType==='ORDERING'">
            <el-input v-model="q.config.itemsText" class="mt" type="textarea" placeholder="Nhập thứ tự đúng, mỗi từ/cụm từ cách nhau bằng dấu |" />
          </template>
          <template v-else-if="q.questionType==='CLASSIFICATION'">
            <el-input v-model="q.config.categoriesText" class="mt" placeholder="Tên các nhóm, cách nhau bằng dấu |" />
            <div v-for="(item,itemIndex) in q.config.classItems" :key="itemIndex" class="config-row"><el-input v-model="item.text" placeholder="Từ hoặc nội dung"/><el-input v-model="item.image" placeholder="URL ảnh"/><el-input v-model="item.group" placeholder="Nhóm đúng"/><el-button @click="q.config.classItems.splice(itemIndex,1)">×</el-button></div>
            <el-button class="mt" @click="q.config.classItems.push({text:'',image:'',group:''})">+ Thêm mục phân loại</el-button>
          </template>
          <template v-else-if="q.questionType==='IMAGE_HOTSPOT'">
            <p class="form-tip">Vùng đúng tính theo phần trăm ảnh.</p><div class="hotspot-grid"><el-input-number v-model="q.config.correctArea.x" :min="0" :max="100"/><el-input-number v-model="q.config.correctArea.y" :min="0" :max="100"/><el-input-number v-model="q.config.correctArea.width" :min="1" :max="100"/><el-input-number v-model="q.config.correctArea.height" :min="1" :max="100"/></div>
          </template>
          <template v-else-if="q.questionType==='HANZI_WRITE'"><el-input v-model="q.config.character" class="mt" maxlength="1" placeholder="Chữ Hán học sinh phải viết" /></template>
          <template v-else-if="q.questionType==='RECORDING'"><p class="recording-note">Học sinh sẽ ghi âm trực tiếp. Câu này được đánh dấu chờ giáo viên chấm.</p></template>
          <div class="question-footer">
            <span>Điểm</span>
            <el-input-number v-model="q.points" :min="0.25" :max="10" :step="0.25" />
            <el-input v-model="q.explanation" placeholder="Giải thích sau khi nộp bài (tùy chọn)" />
          </div>
        </div>

        <div class="add-question-row"><el-select v-model="newQuestionType"><el-option v-for="type in questionTypes" :key="type.value" :label="type.label" :value="type.value" /></el-select><el-button type="primary" plain @click="addQuestion">+ Thêm câu hỏi loại này</el-button></div>
      </div>
      <template #footer>
        <el-button @click="showEditor = false">Hủy</el-button>
        <el-button type="primary" @click="saveQuiz">Lưu quiz</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="showAttempt" title="Chi tiết lượt làm" width="min(720px,95vw)">
      <div v-if="attemptDetail"><div v-for="(q,i) in attemptDetail.questions" :key="q.id" class="attempt-answer"><b>Câu {{ i+1 }}. {{ q.question }}</b><audio v-if="q.questionType==='RECORDING'&&attemptDetail.answers?.[q.id]" :src="mediaUrl(attemptDetail.answers[q.id])" controls/><p v-else>Trả lời: {{ JSON.stringify(attemptDetail.answers?.[q.id] ?? '—') }}</p></div><el-form-item label="Điểm tổng"><el-input-number v-model="manualScore" :min="0" :max="totalPoints" /></el-form-item></div>
      <template #footer><el-button @click="showAttempt=false">Đóng</el-button><el-button type="primary" @click="saveManualGrade">Lưu điểm</el-button></template>
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
import { mediaUrl } from '@/utils/media';

const classStore = useClassStore();
const quizzes = ref([]);
const activeQuiz = ref(null);
const fullQuiz = ref({ questions: [] });
const attempts = ref([]);
const activeTab = ref('questions');
const showEditor = ref(false);
const editingId = ref(null);
const letters = ['A', 'B', 'C', 'D'];
const uploadingMedia = ref(false);
const showAttempt=ref(false),attemptDetail=ref(null),manualScore=ref(0);
const newQuestionType = ref('SINGLE_CHOICE');
const questionTypes = [
  ['SINGLE_CHOICE','Chọn một đáp án'],['MULTIPLE_CHOICE','Chọn nhiều đáp án'],['TRUE_FALSE','Đúng / Sai'],
  ['IMAGE_CHOICE','Nhìn ảnh và chọn'],['AUDIO_CHOICE','Nghe và chọn'],['MATCHING','Nối cặp chữ / ảnh'],
  ['ORDERING','Sắp xếp từ thành câu'],['TEXT_INPUT','Trả lời ngắn'],['FILL_BLANK','Điền chỗ trống'],
  ['DRAG_BLANK','Kéo từ vào chỗ trống'],['LISTEN_TYPE','Nghe và nhập lại'],['CLASSIFICATION','Phân loại'],
  ['READING','Đọc đoạn văn và trả lời'],['IMAGE_HOTSPOT','Chọn vị trí trên ảnh'],['HANZI_WRITE','Viết chữ Hán theo nét'],
  ['RECORDING','Ghi âm câu trả lời'],
].map(([value,label])=>({value,label}));
const choiceTypes=['SINGLE_CHOICE','MULTIPLE_CHOICE','IMAGE_CHOICE','AUDIO_CHOICE','READING'];
const textTypes=['TEXT_INPUT','FILL_BLANK','DRAG_BLANK','LISTEN_TYPE'];
const form = reactive({
  title: '',
  description: '',
  timeLimitMinutes: 30,
  availableFrom: '',
  availableUntil: '',
  questions: [],
});

const totalPoints = computed(() => (fullQuiz.value.questions || []).reduce((s, q) => s + Number(q.points || 0), 0));

const blankPair = () => ({ id:`pair-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,leftText:'',leftImage:'',rightText:'',rightImage:'' });
const normalizePair = (pair, index=0) => ({ id:pair.id || `pair-${Date.now()}-${index}`, leftText:pair.leftText ?? pair.left ?? '', leftImage:pair.leftImage ?? pair.image ?? '', rightText:pair.rightText ?? pair.right ?? '', rightImage:pair.rightImage ?? '' });
const blankConfig = () => ({ optionMedia:{A:'',B:'',C:'',D:''}, correctAnswers:[], pairs:[blankPair()], itemsText:'', categoriesText:'', classItems:[{text:'',image:'',group:''}], correctArea:{x:25,y:25,width:50,height:50}, wordBankText:'', character:'', passage:'' });
const blankQuestion = (questionType='SINGLE_CHOICE') => ({ questionType, question: '', optionA: '', optionB: '', optionC: '', optionD: '', correctAnswer: questionType==='TRUE_FALSE'?'TRUE':'A', answerText:'', mediaUrl:'', mediaType:'', explanation:'', config:blankConfig(), points: 1 });
const changeQuestionType = q => { const keep={question:q.question,points:q.points,questionType:q.questionType};Object.assign(q,blankQuestion(q.questionType),keep); };

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
      questionType: q.questionType || 'SINGLE_CHOICE',
      question: q.question,
      optionA: q.optionA || '',
      optionB: q.optionB || '',
      optionC: q.optionC || '',
      optionD: q.optionD || '',
      correctAnswer: q.correctAnswer || 'A',
      answerText: (q.config?.acceptableAnswers || []).join('|'),
      mediaUrl: q.mediaUrl || '', mediaType: q.mediaType || '', explanation: q.explanation || '',
      config: { ...blankConfig(), ...(q.config || {}), pairs:(q.config?.pairs || []).map(normalizePair), optionMedia:{...blankConfig().optionMedia,...(q.config?.optionMedia||{})}, correctArea:{...blankConfig().correctArea,...(q.config?.correctArea||{})} },
      points: Number(q.points || 1),
    })),
  });
  showEditor.value = true;
};

const addQuestion = () => form.questions.push(blankQuestion(newQuestionType.value));
const removeQuestion = (idx) => {
  if (form.questions.length === 1) return ElMessage.warning('Quiz cần ít nhất 1 câu hỏi');
  form.questions.splice(idx, 1);
};

const saveQuiz = async () => {
  if (!form.title.trim()) return ElMessage.warning('Nhập tiêu đề quiz');
  if (!form.questions.length || form.questions.some(q => !q.question.trim())) return ElMessage.warning('Mỗi câu hỏi cần có nội dung');
  const questions=form.questions.map(q=>{
    const config={...q.config};
    if(textTypes.includes(q.questionType))config.acceptableAnswers=String(q.answerText||'').split('|').map(v=>v.trim()).filter(Boolean);
    if(q.questionType==='DRAG_BLANK')config.wordBank=String(config.wordBankText||'').split('|').map(v=>v.trim()).filter(Boolean);
    if(q.questionType==='ORDERING')config.correctOrder=String(config.itemsText||'').split('|').map(v=>v.trim()).filter(Boolean);
    if(q.questionType==='MATCHING'){
      config.pairs=(config.pairs||[]).map(normalizePair).filter(p=>(p.leftText||p.leftImage)&&(p.rightText||p.rightImage));
      config.correctPairs=Object.fromEntries(config.pairs.map(p=>[p.id,p.id]));
    }
    if(q.questionType==='CLASSIFICATION'){config.categories=String(config.categoriesText||'').split('|').map(v=>v.trim()).filter(Boolean);config.correctGroups=Object.fromEntries((config.classItems||[]).filter(i=>i.text).map(i=>[i.text,i.group]));}
    return {...q,config,correctAnswer:q.questionType==='MULTIPLE_CHOICE'?(config.correctAnswers||[]).join(','):q.correctAnswer};
  });
  const payload = { classId: classStore.selectedId, ...form, questions };
  if (editingId.value) await quizzesApi.update(editingId.value, payload);
  else await quizzesApi.create(payload);
  ElMessage.success('Đã lưu quiz');
  showEditor.value = false;
  await reload();
};

const uploadMedia = async (file, question) => { if(!file.raw)return;uploadingMedia.value=true;try{const fd=new FormData();fd.append('file',file.raw);const result=await quizzesApi.uploadMedia(fd);question.mediaUrl=result.mediaUrl;question.mediaType=result.mediaType;}finally{uploadingMedia.value=false;} };
const uploadPairImage = async (file, pair, field) => { if(!file.raw)return;uploadingMedia.value=true;try{const fd=new FormData();fd.append('file',file.raw);const result=await quizzesApi.uploadMedia(fd);pair[field]=result.mediaUrl;}finally{uploadingMedia.value=false;} };
const openAttempt=async row=>{attemptDetail.value=await quizzesApi.attempt(row.id);manualScore.value=Number(attemptDetail.value.score||0);showAttempt.value=true;};
const saveManualGrade=async()=>{await quizzesApi.gradeAttempt(attemptDetail.value.id,manualScore.value);showAttempt.value=false;await selectQuiz(activeQuiz.value);ElMessage.success('Đã lưu điểm');};

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
.question-type-select{margin:0 0 10px}.media-editor,.add-question-row,.config-row{display:flex;gap:8px;margin-top:10px}.media-editor .el-input,.add-question-row .el-select{flex:1}.media-preview,.preview-question-media{display:block;max-height:220px;max-width:100%;object-fit:contain;margin:10px 0;border-radius:8px}.option-editor{display:grid;gap:5px}.config-row .el-input{flex:1}.hotspot-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.recording-note,.form-tip{background:#fff7e8;color:#996515;padding:10px;border-radius:7px;font-size:12px}.add-question-row{margin-top:14px}@media(max-width:700px){.config-row,.media-editor,.add-question-row{flex-direction:column}.hotspot-grid{grid-template-columns:repeat(2,1fr)}.question-footer{align-items:flex-start;flex-wrap:wrap}}
.matching-pair-editor{align-items:center;border:1px solid var(--border);border-radius:10px;display:grid;gap:10px;grid-template-columns:1fr auto 1fr auto;margin-top:10px;padding:12px}.matching-side{display:grid;gap:7px}.matching-arrow{color:#16856f;font-size:22px;font-weight:700}.pair-preview{border-radius:7px;height:90px;max-width:150px;object-fit:contain}@media(max-width:700px){.matching-pair-editor{grid-template-columns:1fr}.matching-arrow{text-align:center;transform:rotate(90deg)}}
.attempt-answer{border-bottom:1px solid #eee;padding:12px 0}.attempt-answer audio{display:block;margin-top:10px;width:100%}
</style>
