<template>
  <div>
    <ClassPicker @change="reload" />
    <div class="action-bar">
      <el-button v-if="canManage" type="primary" @click="showDeck = true">+ Bộ flashcard</el-button>
    </div>
    <el-row :gutter="14">
      <el-col :span="8">
        <el-card>
          <template #header><span class="section-title">Bộ từ vựng</span></template>
          <div v-for="d in decks" :key="d.id" :class="['deck-row', activeDeck?.id === d.id ? 'active' : '']" @click="selectDeck(d)">
            <b>{{ d.title }}</b>
            <span>{{ d.cardCount || 0 }} thẻ</span>
          </div>
          <div v-if="!decks.length" class="empty">Chưa có bộ flashcard</div>
        </el-card>
      </el-col>
      <el-col :span="16">
        <el-card>
          <template #header>
            <div class="header-line">
              <span class="section-title">{{ activeDeck?.title || 'Flashcards' }}</span>
              <el-button v-if="activeDeck && canManage" size="small" @click="showCard = true">+ Thêm thẻ</el-button>
            </div>
          </template>
          <div v-if="activeCard" class="study-card" @click="flipped = !flipped">
            <div class="side">{{ flipped ? activeCard.back : activeCard.front }}</div>
            <div v-if="flipped && activeCard.example" class="example">{{ activeCard.example }}</div>
            <FlashcardMedia v-if="activeCard.media_url || activeCard.mediaUrl" :card="activeCard" />
          </div>
          <div v-else class="empty">Chọn bộ flashcard để học</div>
          <div v-if="activeCard" class="study-actions">
            <el-button @click="prevCard">Trước</el-button>
            <el-button @click="nextCard">Tiếp</el-button>
            <el-button type="success" @click="mark(true)">Đã nhớ</el-button>
            <el-button type="warning" @click="mark(false)">Cần ôn</el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="showDeck" title="Tạo bộ flashcard" width="420px">
      <el-form label-position="top">
        <el-form-item label="Tên bộ"><el-input v-model="deckForm.title" /></el-form-item>
        <el-form-item label="Mô tả"><el-input v-model="deckForm.description" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDeck = false">Hủy</el-button>
        <el-button type="primary" @click="createDeck">Tạo</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showCard" title="Thêm thẻ" width="420px">
      <el-form label-position="top">
        <el-form-item label="Mặt trước"><el-input v-model="cardForm.front" /></el-form-item>
        <el-form-item label="Mặt sau"><el-input v-model="cardForm.back" /></el-form-item>
        <el-form-item label="Ví dụ"><el-input v-model="cardForm.example" type="textarea" /></el-form-item>
        <el-form-item label="Ảnh / media">
          <el-upload :auto-upload="false" :show-file-list="false" :on-change="uploadMedia" accept="image/*,audio/*,video/*,application/pdf">
            <el-button :loading="uploadingMedia">Chọn file</el-button>
          </el-upload>
          <div v-if="cardForm.mediaUrl" class="media-picked">
            <span>{{ cardForm.mediaType }}</span>
            <el-button size="small" text @click="clearMedia">Xóa</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCard = false">Hủy</el-button>
        <el-button type="primary" @click="createCard">Lưu</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, reactive, ref, watch, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import ClassPicker from '@/components/ClassPicker.vue';
import { learningExtrasApi } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useClassStore } from '@/stores/class';
import { mediaUrl } from '@/utils/media';

const auth = useAuthStore();
const classStore = useClassStore();
const decks = ref([]);
const cards = ref([]);
const index = ref(0);
const flipped = ref(false);
const activeDeck = ref(null);
const showDeck = ref(false);
const showCard = ref(false);
const uploadingMedia = ref(false);
const deckForm = reactive({ title: '', description: '' });
const cardForm = reactive({ front: '', back: '', example: '', mediaUrl: '', mediaType: '' });
const activeCard = computed(() => cards.value[index.value] || null);
const canManage = computed(() => auth.isTeacher || auth.isAdmin);

const reload = async () => {
  if (!classStore.classes.length) await classStore.fetchClasses();
  if (!classStore.selectedId) return;
  decks.value = await learningExtrasApi.decks(classStore.selectedId);
  if (!decks.value.some(d => d.id === activeDeck.value?.id)) activeDeck.value = null;
  if (!activeDeck.value && decks.value.length) await selectDeck(decks.value[0]);
  if (!decks.value.length) cards.value = [];
};

const selectDeck = async (deck) => {
  activeDeck.value = deck;
  cards.value = await learningExtrasApi.cards(deck.id);
  index.value = 0;
  flipped.value = false;
};

const createDeck = async () => {
  if (!deckForm.title) return;
  await learningExtrasApi.createDeck({ classId: classStore.selectedId, ...deckForm });
  Object.assign(deckForm, { title: '', description: '' });
  showDeck.value = false;
  await reload();
};

const createCard = async () => {
  if (!activeDeck.value || !cardForm.front || !cardForm.back) return;
  await learningExtrasApi.createCard(activeDeck.value.id, cardForm);
  Object.assign(cardForm, { front: '', back: '', example: '', mediaUrl: '', mediaType: '' });
  showCard.value = false;
  await selectDeck(activeDeck.value);
};

const uploadMedia = async (file) => {
  if (!file.raw) return;
  uploadingMedia.value = true;
  try {
    const fd = new FormData();
    fd.append('file', file.raw);
    const uploaded = await learningExtrasApi.uploadFlashcardMedia(fd);
    cardForm.mediaUrl = uploaded.mediaUrl;
    cardForm.mediaType = uploaded.mediaType;
    ElMessage.success('Đã tải media');
  } finally {
    uploadingMedia.value = false;
  }
};

const clearMedia = () => {
  cardForm.mediaUrl = '';
  cardForm.mediaType = '';
};

const FlashcardMedia = defineComponent({
  props: { card: { type: Object, required: true } },
  setup(props) {
    return () => {
      const url = mediaUrl(props.card.media_url || props.card.mediaUrl || '');
      const type = String(props.card.media_type || props.card.mediaType || '').toUpperCase();
      if (type === 'IMAGE') return h('img', { class: 'flash-media image', src: url, alt: 'Flashcard media' });
      if (type === 'AUDIO') return h('audio', { class: 'flash-media', src: url, controls: true, onClick: e => e.stopPropagation() });
      if (type === 'VIDEO') return h('video', { class: 'flash-media video', src: url, controls: true, onClick: e => e.stopPropagation() });
      return h('a', { class: 'flash-media-link', href: url, target: '_blank', onClick: e => e.stopPropagation() }, 'Mở file đính kèm');
    };
  },
});

const prevCard = () => { index.value = Math.max(0, index.value - 1); flipped.value = false; };
const nextCard = () => { index.value = Math.min(cards.value.length - 1, index.value + 1); flipped.value = false; };
const mark = async (remembered) => {
  if (!activeCard.value) return;
  await learningExtrasApi.markCard(activeCard.value.id, remembered);
  ElMessage.success(remembered ? 'Đã đánh dấu nhớ' : 'Đã đưa vào danh sách cần ôn');
  nextCard();
};

watch(() => classStore.selectedId, reload);
onMounted(reload);
</script>

<style scoped>
.action-bar { display:flex; justify-content:flex-end; margin-bottom: 14px; }
.header-line { display:flex; justify-content:space-between; align-items:center; }
.deck-row { padding: 10px; border-bottom: 1px solid #eee; cursor:pointer; display:flex; justify-content:space-between; }
.deck-row.active { background:#E1F5EE; color:#0F6E56; }
.study-card { min-height: 240px; border:1px solid #e5e1d8; border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:24px; cursor:pointer; background:#fff; }
.side { font-size:28px; font-weight:600; }
.example { margin-top:12px; color:#666; }
.flash-media { margin-top: 14px; max-width: 100%; }
.flash-media.image { max-height: 260px; object-fit: contain; border-radius: 8px; }
.flash-media.video { max-height: 280px; border-radius: 8px; }
.flash-media-link { margin-top: 14px; color: #0F6E56; font-weight: 600; }
.media-picked { margin-top: 8px; display:flex; align-items:center; gap:8px; color:#666; font-size:12px; }
.study-actions { margin-top: 12px; display:flex; gap:8px; justify-content:center; flex-wrap:wrap; }
.empty { padding: 24px; text-align:center; color:#999; }
@media (max-width: 768px) {
  :deep(.el-col) { max-width:100%; flex:0 0 100%; margin-bottom:12px; }
}
</style>
