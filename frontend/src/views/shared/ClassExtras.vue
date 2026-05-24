<template>
  <div>
    <ClassPicker @change="reload" />
    <el-tabs>
      <el-tab-pane label="Feedback ẩn danh">
        <el-row :gutter="14">
          <el-col :span="10">
            <el-card>
              <template #header><span class="section-title">Gửi feedback</span></template>
              <el-rate v-model="feedback.rating" />
              <el-input v-model="feedback.comment" type="textarea" :rows="4" placeholder="Nhận xét cuối khóa..." style="margin-top:12px" />
              <el-button type="primary" style="margin-top:12px" @click="submitFeedback">Gửi ẩn danh</el-button>
              <el-alert v-if="sentiment" :title="`Sentiment: ${sentiment.sentiment}`" :closable="false" style="margin-top:12px" />
            </el-card>
          </el-col>
          <el-col :span="14">
            <el-card>
              <template #header><span class="section-title">Thống kê feedback</span></template>
              <div class="metric-line">
                <b>{{ stats.count || 0 }}</b> lượt • <b>{{ stats.avgRating || 0 }}</b>/5
              </div>
              <div v-for="c in stats.comments || []" :key="c.id" class="comment-row">
                <el-rate :model-value="c.rating" disabled size="small" />
                <p>{{ c.comment || 'Không có bình luận' }}</p>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>
      <el-tab-pane label="Thư viện ảnh">
        <el-card>
          <template #header>
            <div class="header-line">
              <span class="section-title">Ảnh lớp học</span>
              <el-upload v-if="canManage" :auto-upload="false" :show-file-list="false" :on-change="uploadPhoto" accept="image/jpeg,image/png,image/webp,image/gif">
                <el-button type="primary">Tải ảnh</el-button>
              </el-upload>
            </div>
          </template>
          <div class="gallery-grid">
            <div v-for="p in photos" :key="p.id" class="photo-card">
              <img :src="p.fileUrl" alt="Ảnh lớp học" />
              <el-button v-if="canManage" size="small" type="danger" plain @click="removePhoto(p)">Xóa</el-button>
            </div>
          </div>
          <div v-if="!photos.length" class="empty">Chưa có ảnh</div>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import ClassPicker from '@/components/ClassPicker.vue';
import { learningExtrasApi } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useClassStore } from '@/stores/class';

const auth = useAuthStore();
const classStore = useClassStore();
const feedback = reactive({ rating: 5, comment: '' });
const stats = ref({});
const photos = ref([]);
const sentiment = ref(null);
const canManage = computed(() => auth.isTeacher || auth.isAdmin);

const reload = async () => {
  if (!classStore.classes.length) await classStore.fetchClasses();
  if (!classStore.selectedId) return;
  photos.value = await learningExtrasApi.gallery(classStore.selectedId);
  if (canManage.value) {
    try { stats.value = await learningExtrasApi.anonymousFeedbackStats(classStore.selectedId); } catch { stats.value = {}; }
  } else {
    stats.value = {};
  }
};

const submitFeedback = async () => {
  if (!classStore.selectedId) return;
  await learningExtrasApi.submitAnonymousFeedback(classStore.selectedId, feedback);
  sentiment.value = await learningExtrasApi.sentiment(feedback.comment);
  ElMessage.success('Đã gửi feedback');
  await reload();
};

const uploadPhoto = async (file) => {
  if (!classStore.selectedId || !file.raw) return;
  const fd = new FormData();
  fd.append('file', file.raw);
  await learningExtrasApi.uploadGallery(classStore.selectedId, fd);
  await reload();
};

const removePhoto = async (photo) => {
  await learningExtrasApi.deleteGallery(photo.id);
  await reload();
};

watch(() => classStore.selectedId, reload);
onMounted(reload);
</script>

<style scoped>
.header-line { display:flex; justify-content:space-between; align-items:center; }
.metric-line { margin-bottom: 10px; color:#666; }
.comment-row { padding: 10px 0; border-bottom: 1px solid #eee; }
.comment-row p { margin: 6px 0 0; }
.gallery-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
.photo-card { border:1px solid #eee; border-radius:8px; padding:8px; background:#fff; }
.photo-card img { width:100%; aspect-ratio:4/3; object-fit:cover; border-radius:6px; display:block; margin-bottom:8px; }
.empty { padding: 24px; text-align:center; color:#999; }
@media (max-width: 768px) {
  :deep(.el-col) { max-width:100%; flex:0 0 100%; margin-bottom:12px; }
}
</style>
