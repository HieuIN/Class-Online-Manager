<template>
  <Teleport to="body">
    <div v-if="clientViewActive" class="ctalk-client-bar">
      <div class="ctalk-client-brand">
        <strong>Ctalk Chinese</strong>
        <span>{{ roomTitle }}</span>
      </div>
      <div class="ctalk-client-actions">
        <span class="pip-status">Cửa sổ nhỏ tự bật khi chuyển tab</span>
        <button type="button" @click="toggleClientFullscreen">
          {{ clientFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình' }}
        </button>
        <button type="button" class="secondary" @click="leaveClientView">Về lịch học</button>
      </div>
    </div>
  </Teleport>
  <section ref="classroomRoot" class="zoom-classroom" :class="{ 'is-fullscreen': isFullscreen }">
    <header class="classroom-header">
      <div>
        <span class="eyebrow">PHÒNG HỌC TRỰC TUYẾN</span>
        <h1>{{ roomTitle }}</h1>
      </div>
      <div class="header-actions">
        <el-button v-if="!waitingForStart && !errorMessage" type="primary" @click="toggleFullscreen">
          <el-icon><FullScreen /></el-icon>
          {{ isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình' }}
        </el-button>
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
    <div v-if="waitingForStart" class="waiting-card">
      <span class="waiting-badge">LỚP HỌC CHƯA BẮT ĐẦU</span>
      <h2>{{ scheduledLabel }}</h2>
      <p class="countdown-label">Sẽ bắt đầu sau</p>
      <strong class="countdown">{{ countdownLabel }}</strong>
      <span>Phòng học sẽ tự mở trên website khi đến giờ.</span>
      <el-button @click="router.push('/calendar')">Về lịch học</el-button>
    </div>
    <el-alert
      v-else-if="hostMustStart"
      title="Phòng Zoom đang chờ giáo viên bắt đầu"
      type="info"
      :closable="false"
      show-icon
      class="room-alert"
    >
      <template #default>
        <div class="host-connect-row">
          <span>Kết nối tài khoản Zoom một lần để bắt đầu và điều hành phòng ngay trong Ctalk.</span>
          <el-button type="primary" :loading="connectingZoom" @click="connectZoom">Kết nối Zoom</el-button>
        </div>
      </template>
    </el-alert>
    <div v-if="loading && !waitingForStart" class="room-loading">
      <el-icon class="is-loading" :size="34"><Loading /></el-icon>
      <b>Đang chuẩn bị phòng học Zoom…</b>
      <span>Vui lòng cho phép sử dụng camera và micro khi trình duyệt hỏi.</span>
    </div>
    <div ref="zoomRoot" class="zoom-root" :class="{ hidden: loading || errorMessage || waitingForStart }"></div>

    <div v-if="errorMessage" class="fallback-card">
      <h3>Chưa thể kết nối phòng học trên web</h3>
      <p>{{ auth.isStudent ? 'Bạn không cần mở ứng dụng Zoom. Hãy thử kết nối lại ngay trên website.' : 'Có thể thử lại trên web hoặc mở Zoom để kiểm tra phòng.' }}</p>
      <el-button type="primary" size="large" @click="retryOnWeb">Thử lại trên web</el-button>
      <el-button v-if="!auth.isStudent" size="large" @click="openZoom">Mở bằng Zoom</el-button>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FullScreen, Loading } from '@element-plus/icons-vue';
import { sessionsApi } from '@/api';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const zoomRoot = ref(null);
const classroomRoot = ref(null);
const isFullscreen = ref(false);
const clientViewActive = ref(false);
const clientFullscreen = ref(false);
const loading = ref(true);
const errorMessage = ref('');
const waitingForStart = ref(false);
const remainingSeconds = ref(0);
const startsAt = ref(null);
const hostMustStart = ref(false);
const connectingZoom = ref(false);
const roomTitle = ref('Lớp học Zoom');
const fallbackUrl = ref(String(route.query.fallback || ''));
let client = null;
let clientViewZoom = null;
let countdownTimer = null;

const scheduledLabel = computed(() => startsAt.value
  ? new Intl.DateTimeFormat('vi-VN', { weekday:'long', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(startsAt.value)
  : '');
const countdownLabel = computed(() => {
  const total = Math.max(0, remainingSeconds.value);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0
    ? `${hours} giờ ${String(minutes).padStart(2, '0')} phút ${String(seconds).padStart(2, '0')} giây`
    : `${minutes} phút ${String(seconds).padStart(2, '0')} giây`;
});

const openZoom = () => {
  if (fallbackUrl.value) window.open(fallbackUrl.value, '_blank', 'noopener');
};
const retryOnWeb = () => window.location.reload();
const syncFullscreenState = () => {
  isFullscreen.value = document.fullscreenElement === classroomRoot.value;
  clientFullscreen.value = Boolean(document.fullscreenElement) && clientViewActive.value;
};
const toggleFullscreen = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await classroomRoot.value?.requestFullscreen();
  } catch {
    errorMessage.value = 'Trình duyệt không cho phép mở toàn màn hình. Vui lòng kiểm tra quyền của trình duyệt.';
  }
};
const toggleClientFullscreen = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    errorMessage.value = 'Trình duyệt không cho phép mở toàn màn hình. Vui lòng kiểm tra quyền của trình duyệt.';
  }
};
const leaveClientView = () => {
  clientViewActive.value = false;
  try {
    clientViewZoom?.leaveMeeting?.({
      confirm: false,
      success: () => router.push('/calendar'),
      error: () => router.push('/calendar'),
    });
  } catch {
    router.push('/calendar');
  }
};
const connectZoom = async () => {
  connectingZoom.value = true;
  try {
    const result = await sessionsApi.zoomOauthUrl();
    window.location.assign(result.url);
  } catch (error) {
    connectingZoom.value = false;
    errorMessage.value = error?.response?.data?.message || 'Không thể bắt đầu kết nối Zoom.';
  }
};

const joinWithClientView = async (config) => {
  const { ZoomMtg } = await import('@zoom/meetingsdk');
  clientViewZoom = ZoomMtg;
  ZoomMtg.preLoadWasm();
  ZoomMtg.prepareWebSDK();
  ZoomMtg.i18n.load('vi-VN');
  ZoomMtg.i18n.reload('vi-VN');
  const root = document.getElementById('zmmtg-root');
  if (root) root.style.display = 'block';

  await new Promise((resolve, reject) => {
    ZoomMtg.init({
      leaveUrl: `${window.location.origin}/calendar`,
      patchJsMedia: true,
      leaveOnPageUnload: true,
      sharingMode: 'fit',
      showPureSharingContent: true,
      defaultView: 'speaker',
      disablePictureInPicture: false,
      success: resolve,
      error: reject,
    });
  });
  await new Promise((resolve, reject) => {
    ZoomMtg.join({
      signature: config.signature,
      meetingNumber: config.meetingNumber,
      passWord: config.password || '',
      userName: config.userName,
      userEmail: '',
      ...(config.zak ? { zak: config.zak } : {}),
      success: resolve,
      error: reject,
    });
  });
  loading.value = false;
  clientViewActive.value = true;
};

const joinOnWeb = async (config) => {
  try {
    waitingForStart.value = false;
    loading.value = true;
    hostMustStart.value = auth.isTeacher && !config.canStartInWeb;
    if (auth.isStudent) {
      await joinWithClientView(config);
      return;
    }
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
};

onMounted(async () => {
  document.addEventListener('fullscreenchange', syncFullscreenState);
  try {
    const config = await sessionsApi.zoomSignature(route.params.sessionId);
    fallbackUrl.value = config.meetingUrl || fallbackUrl.value;
    roomTitle.value = config.topic || roomTitle.value;
    startsAt.value = config.startsAt ? new Date(config.startsAt) : null;
    const updateCountdown = () => {
      remainingSeconds.value = startsAt.value ? Math.max(0, Math.ceil((startsAt.value.getTime() - Date.now()) / 1000)) : 0;
      waitingForStart.value = remainingSeconds.value > 0;
      if (remainingSeconds.value <= 0) {
        if (countdownTimer) window.clearInterval(countdownTimer);
        countdownTimer = null;
        joinOnWeb(config);
      }
    };
    updateCountdown();
    if (waitingForStart.value) {
      loading.value = false;
      countdownTimer = window.setInterval(updateCountdown, 1000);
    }
  } catch (error) {
    loading.value = false;
    errorMessage.value = error?.response?.data?.message || 'Không thể chuẩn bị phòng Zoom lúc này.';
  }
});

onBeforeUnmount(() => {
  clientViewActive.value = false;
  document.removeEventListener('fullscreenchange', syncFullscreenState);
  if (countdownTimer) window.clearInterval(countdownTimer);
  try { clientViewZoom?.leaveMeeting?.({ confirm: false }); } catch {}
  try { client?.leaveMeeting?.(); } catch {}
});
</script>

<style scoped>
.zoom-classroom { min-height:calc(100dvh - 126px); display:flex; flex-direction:column; gap:12px; }
.classroom-header { display:flex; align-items:center; justify-content:space-between; gap:16px; }
.classroom-header h1 { margin:3px 0 0; font-size:24px; }
.eyebrow { color:#147d68; font-size:12px; font-weight:700; letter-spacing:.08em; }
.header-actions { display:flex; flex-wrap:wrap; gap:8px; }
.room-alert { flex:0 0 auto; }
.zoom-root { width:100%; height:calc(100dvh - 182px); min-height:620px; flex:1 1 auto; border-radius:14px; overflow:hidden; background:#111; }
.zoom-root.hidden { display:none; }
.zoom-classroom:fullscreen, .zoom-classroom.is-fullscreen { position:relative; width:100vw; height:100dvh; min-height:100dvh; padding:0; gap:0; background:#0d0f0f; overflow:hidden; box-sizing:border-box; }
.zoom-classroom:fullscreen .classroom-header, .zoom-classroom.is-fullscreen .classroom-header { position:absolute; inset:8px 10px auto 10px; z-index:20; pointer-events:none; color:#fff; }
.zoom-classroom:fullscreen .classroom-header > *, .zoom-classroom.is-fullscreen .classroom-header > * { pointer-events:auto; }
.zoom-classroom:fullscreen .eyebrow, .zoom-classroom.is-fullscreen .eyebrow { display:none; }
.zoom-classroom:fullscreen .classroom-header h1, .zoom-classroom.is-fullscreen .classroom-header h1 { margin:0; font-size:18px; }
.zoom-classroom:fullscreen .zoom-root, .zoom-classroom.is-fullscreen .zoom-root { position:absolute; inset:0; width:100vw; height:100dvh; min-height:0; border-radius:0; }
.room-loading, .fallback-card, .waiting-card { min-height:360px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; text-align:center; border:1px solid #dce8e3; border-radius:14px; background:#fff; }
.room-loading span, .fallback-card p { color:#66766f; }
.fallback-card p { max-width:560px; margin:0 16px 8px; }
.waiting-card h2 { margin:0; text-transform:capitalize; }
.waiting-card > span:last-of-type, .countdown-label { color:#66766f; margin:0; }
.waiting-badge { padding:7px 12px; border-radius:999px; background:#fff3d6; color:#956400; font-size:12px; font-weight:800; letter-spacing:.06em; }
.countdown { color:#147d68; font-size:clamp(28px, 5vw, 48px); font-variant-numeric:tabular-nums; }
.host-connect-row { display:flex; align-items:center; justify-content:space-between; gap:16px; width:100%; }
:global(body:has(.ctalk-client-bar)) { overflow:hidden; }
:global(body:has(.ctalk-client-bar) #zmmtg-root) {
  top:64px !important;
  height:calc(100dvh - 64px) !important;
  z-index:1000 !important;
}
:global(:fullscreen body:has(.ctalk-client-bar) #zmmtg-root) {
  top:0 !important;
  height:100dvh !important;
}
.ctalk-client-bar {
  position:fixed;
  inset:0 0 auto 0;
  z-index:2147483646;
  height:64px;
  padding:8px 16px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:16px;
  box-sizing:border-box;
  color:#17251f;
  background:rgba(255,255,255,.97);
  border-bottom:1px solid #dce8e3;
  box-shadow:0 2px 12px rgba(17,53,43,.12);
}
.ctalk-client-brand { min-width:0; display:flex; align-items:center; gap:12px; }
.ctalk-client-brand strong { color:#147d68; white-space:nowrap; }
.ctalk-client-brand span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:700; }
.ctalk-client-actions { display:flex; align-items:center; gap:8px; flex:0 0 auto; }
.ctalk-client-actions button {
  min-height:38px;
  padding:0 15px;
  border:1px solid #147d68;
  border-radius:8px;
  color:#fff;
  background:#147d68;
  font:inherit;
  font-weight:700;
  cursor:pointer;
}
.ctalk-client-actions button.secondary { color:#173c32; background:#fff; border-color:#ccdcd6; }
.pip-status { color:#63736d; font-size:13px; white-space:nowrap; }
:global(:fullscreen .ctalk-client-bar) {
  inset:8px 10px auto auto;
  width:auto;
  height:46px;
  padding:4px;
  border:0;
  border-radius:10px;
  color:#fff;
  background:rgba(8,15,13,.78);
  box-shadow:none;
}
:global(:fullscreen .ctalk-client-brand),
:global(:fullscreen .pip-status) { display:none; }
@media (max-width: 700px) {
  .zoom-classroom { min-height:calc(100dvh - 94px); gap:8px; }
  .classroom-header { align-items:flex-start; flex-direction:column; gap:8px; }
  .classroom-header h1 { font-size:18px; }
  .header-actions { width:100%; }
  .header-actions .el-button { flex:1; margin-left:0; }
  .zoom-root { height:calc(100dvh - 210px); min-height:520px; border-radius:8px; }
  .zoom-classroom:fullscreen .classroom-header, .zoom-classroom.is-fullscreen .classroom-header { flex-direction:row; align-items:center; }
  .zoom-classroom:fullscreen .classroom-header > div:first-child, .zoom-classroom.is-fullscreen .classroom-header > div:first-child { display:none; }
  .zoom-classroom:fullscreen .header-actions, .zoom-classroom.is-fullscreen .header-actions { margin-left:auto; width:auto; }
  .zoom-classroom:fullscreen .header-actions .el-button:not(:first-child), .zoom-classroom.is-fullscreen .header-actions .el-button:not(:first-child) { display:none; }
  .ctalk-client-bar { height:56px; padding:6px 8px; }
  :global(body:has(.ctalk-client-bar) #zmmtg-root) { top:56px !important; height:calc(100dvh - 56px) !important; }
  .ctalk-client-brand span, .pip-status { display:none; }
  .ctalk-client-actions button { min-height:36px; padding:0 10px; font-size:13px; }
}
</style>
