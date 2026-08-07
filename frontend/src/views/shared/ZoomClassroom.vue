<template>
  <section class="zoom-classroom">
    <header class="classroom-header">
      <div>
        <span class="eyebrow">PHÒNG HỌC TRỰC TUYẾN</span>
        <h1>{{ roomTitle }}</h1>
      </div>
      <div class="header-actions">
        <el-button @click="router.push('/calendar')">Về lịch học</el-button>
        <el-button v-if="!auth.isStudent" type="primary" plain @click="openZoom">Mở bằng ứng dụng Zoom</el-button>
      </div>
    </header>

    <el-alert
      v-if="errorMessage"
      :title="errorMessage"
      type="warning"
      :closable="false"
      show-icon
      class="room-alert"
    />
    <div v-if="loading" class="room-loading">
      <el-icon class="is-loading" :size="34"><Loading /></el-icon>
      <b>Đang chuẩn bị phòng học Zoom…</b>
      <span>Vui lòng cho phép sử dụng camera và micro khi trình duyệt hỏi.</span>
    </div>
    <div ref="zoomRoot" class="zoom-root" :class="{ hidden: loading || errorMessage }"></div>

    <div v-if="errorMessage" class="fallback-card">
      <h3>Chưa thể kết nối phòng học trên web</h3>
      <p>{{ auth.isStudent ? 'Bạn không cần mở ứng dụng Zoom. Hãy thử kết nối lại ngay trên website.' : 'Có thể thử lại trên web hoặc mở Zoom để kiểm tra phòng.' }}</p>
      <el-button type="primary" size="large" @click="retryOnWeb">Thử lại trên web</el-button>
      <el-button v-if="!auth.isStudent" size="large" @click="openZoom">Mở bằng Zoom</el-button>
    </div>
  </section>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Loading } from '@element-plus/icons-vue';
import { sessionsApi } from '@/api';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const zoomRoot = ref(null);
const loading = ref(true);
const errorMessage = ref('');
const roomTitle = ref('Lớp học Zoom');
const fallbackUrl = ref(String(route.query.fallback || ''));
let client = null;

const openZoom = () => {
  if (fallbackUrl.value) window.open(fallbackUrl.value, '_blank', 'noopener');
};
const retryOnWeb = () => window.location.reload();

onMounted(async () => {
  try {
    const config = await sessionsApi.zoomSignature(route.params.sessionId);
    fallbackUrl.value = config.meetingUrl || fallbackUrl.value;
    roomTitle.value = config.topic || roomTitle.value;
    const { default: ZoomMtgEmbedded } = await import('@zoom/meetingsdk/embedded');
    client = ZoomMtgEmbedded.createClient();
    await client.init({
      zoomAppRoot: zoomRoot.value,
      language: 'vi-VN',
      patchJsMedia: true,
      leaveOnPageUnload: true,
    });
    await client.join({
      sdkKey: config.sdkKey,
      signature: config.signature,
      meetingNumber: config.meetingNumber,
      password: config.password || '',
      userName: config.userName,
      ...(config.zak ? { zak: config.zak } : {}),
    });
    loading.value = false;
  } catch (error) {
    loading.value = false;
    errorMessage.value = error?.response?.data?.message || 'Không thể mở Zoom ngay trong trang lúc này.';
  }
});

onBeforeUnmount(() => {
  try { client?.leaveMeeting?.(); } catch {}
});
</script>

<style scoped>
.zoom-classroom { min-height: calc(100vh - 120px); display:flex; flex-direction:column; gap:16px; }
.classroom-header { display:flex; align-items:center; justify-content:space-between; gap:16px; }
.classroom-header h1 { margin:3px 0 0; font-size:24px; }
.eyebrow { color:#147d68; font-size:12px; font-weight:700; letter-spacing:.08em; }
.header-actions { display:flex; flex-wrap:wrap; gap:8px; }
.room-alert { flex:0 0 auto; }
.zoom-root { width:100%; height:clamp(560px, calc(100vh - 210px), 900px); min-height:560px; border-radius:14px; overflow:hidden; background:#111; }
.zoom-root.hidden { display:none; }
.room-loading, .fallback-card { min-height:360px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; text-align:center; border:1px solid #dce8e3; border-radius:14px; background:#fff; }
.room-loading span, .fallback-card p { color:#66766f; }
.fallback-card p { max-width:560px; margin:0 16px 8px; }
@media (max-width: 700px) {
  .classroom-header { align-items:flex-start; flex-direction:column; }
  .header-actions { width:100%; }
  .header-actions .el-button { flex:1; margin-left:0; }
  .zoom-root { height:calc(100dvh - 245px); min-height:480px; border-radius:8px; }
}
</style>
