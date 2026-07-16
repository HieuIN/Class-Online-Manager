<template>
  <div class="login-wrap">
    <aside class="login-intro" :class="{ 'motion-paused': isCarouselPaused }">
      <Transition name="slide-fade" mode="out-in">
        <div :key="currentSlide.id" class="login-slide-image" :style="{ backgroundImage: `url(${currentSlide.image})` }"></div>
      </Transition>
      <div class="intro-shade"></div>
      <div class="intro-ornament intro-ornament-left" aria-hidden="true">学</div>
      <div class="intro-ornament intro-ornament-right" aria-hidden="true">说</div>
      <router-link to="/login" class="intro-brand">
        <img class="brand-logo" src="/logo.svg" alt="Ctalk Chinese" />
        <BrandWordmark light subtitle="Learning workspace" />
      </router-link>
      <div class="intro-content" aria-live="polite">
        <Transition name="copy-fade" mode="out-in">
          <div :key="currentSlide.id" class="intro-copy">
            <div class="trailer-meta">
              <span class="eyebrow">{{ currentSlide.kicker }}</span>
              <span class="trailer-live"><i></i> Trailer CTalk</span>
            </div>
            <h1>{{ currentSlide.title }}</h1>
            <p>{{ currentSlide.description }}</p>
            <div class="hanzi-quote">
              <span>{{ currentSlide.hanzi }}</span>
              <small>{{ currentSlide.translation }}</small>
            </div>
          </div>
        </Transition>
      </div>
      <div class="carousel-controls">
        <el-button circle text aria-label="Ảnh trước" @click="previousSlide">
          <el-icon><ArrowLeft /></el-icon>
        </el-button>
        <div class="carousel-dots" role="tablist" aria-label="Chọn nội dung giới thiệu">
          <button
            v-for="(slide, index) in slides"
            :key="slide.id"
            :class="{ active: activeSlide === index }"
            type="button"
            :aria-label="`Chuyển đến nội dung ${index + 1}`"
            :aria-selected="activeSlide === index"
            role="tab"
            @click="goToSlide(index)"
          ></button>
        </div>
        <el-button circle text :aria-label="isCarouselPaused ? 'Tiếp tục tự chuyển' : 'Dừng tự chuyển'" @click="toggleCarousel">
          <el-icon><component :is="isCarouselPaused ? VideoPlay : VideoPause" /></el-icon>
        </el-button>
        <el-button circle text aria-label="Ảnh tiếp theo" @click="nextSlide">
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </div>
      <div class="trailer-timeline" aria-hidden="true">
        <span class="trailer-counter">0{{ activeSlide + 1 }} / 0{{ slides.length }}</span>
        <div class="trailer-progress"><i :key="currentSlide.id"></i></div>
        <span class="trailer-caption">{{ isCarouselPaused ? 'Đã tạm dừng' : 'Đang phát' }}</span>
      </div>
    </aside>
    <main class="login-card">
      <div class="form-heading">
        <span class="eyebrow">Đăng nhập</span>
        <h2>{{ pendingOtpUserId ? 'Xác minh tài khoản' : 'Trở lại hành trình của bạn' }}</h2>
        <p>{{ pendingOtpUserId ? 'Nhập mã OTP đã được gửi để tiếp tục.' : 'Tiếp tục bài học đang dở, kiểm tra lịch học và cập nhật kết quả mới nhất.' }}</p>
      </div>
      <el-form @submit.prevent="onLogin" label-position="top">
        <el-form-item label="Email">
          <el-input v-model="form.email" placeholder="email@example.com" size="large" />
        </el-form-item>
        <el-form-item label="Mật khẩu">
          <el-input v-model="form.password" type="password" placeholder="••••••••" size="large" show-password />
        </el-form-item>
        <el-form-item v-if="pendingOtpUserId" label="Mã OTP">
          <el-input v-model="form.otp" maxlength="6" placeholder="Nhập mã 6 số" size="large" />
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading" style="width:100%;" size="large">
          {{ pendingOtpUserId ? 'Xác minh OTP' : 'Đăng nhập' }}
        </el-button>
      </el-form>
      <div v-if="!pendingOtpUserId" class="forgot-row">
        <router-link to="/forgot-password">Quên mật khẩu?</router-link>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { ElMessage } from 'element-plus';
import { ArrowLeft, ArrowRight, VideoPause, VideoPlay } from '@element-plus/icons-vue';
import BrandWordmark from '@/components/BrandWordmark.vue';
import studyDeskImage from '@/assets/login/study-desk.jpg';
import onlineLessonImage from '@/assets/login/online-lesson.jpg';
import calligraphyDeskImage from '@/assets/login/calligraphy-desk.jpg';

const router = useRouter();
const auth = useAuthStore();
const form = reactive({ email: '', password: '', otp: '' });
const loading = ref(false);
const pendingOtpUserId = ref(null);
const activeSlide = ref(0);
const isCarouselPaused = ref(false);
let carouselTimer = null;

const slides = [
  {
    id: 'practice',
    image: studyDeskImage,
    kicker: 'Nền tảng học tiếng Trung',
    title: 'Mỗi buổi học, một bước gần hơn với tiếng Trung.',
    description: 'Theo sát lộ trình của bạn từ lịch học, bài tập và luyện phát âm đến điểm số và phản hồi từ giáo viên.',
    hanzi: '学而时习之',
    translation: 'Học rồi thường xuyên ôn tập.',
  },
  {
    id: 'consistency',
    image: onlineLessonImage,
    kicker: 'Học đều từng ngày',
    title: 'Một nhịp học vững vàng tạo nên tiến bộ dài lâu.',
    description: 'Chủ động xem lịch, hoàn thành bài tập và nhận hỗ trợ từ giáo viên khi bạn cần.',
    hanzi: '不积跬步，无以至千里',
    translation: 'Không tích từng bước nhỏ, không thể đi nghìn dặm.',
  },
  {
    id: 'mastery',
    image: calligraphyDeskImage,
    kicker: 'Học sâu, nhớ lâu',
    title: 'Ôn điều đã học để tự tin dùng điều mới.',
    description: 'Mỗi bài học là một mảnh ghép giúp bạn hiểu, nói và sử dụng tiếng Trung tự nhiên hơn.',
    hanzi: '温故而知新',
    translation: 'Ôn điều cũ để hiểu thêm điều mới.',
  },
];

const currentSlide = computed(() => slides[activeSlide.value]);

const stopCarousel = () => {
  if (carouselTimer) clearInterval(carouselTimer);
  carouselTimer = null;
};

const startCarousel = () => {
  stopCarousel();
  if (!isCarouselPaused.value) carouselTimer = setInterval(() => {
    activeSlide.value = (activeSlide.value + 1) % slides.length;
  }, 9000);
};

const goToSlide = (index) => {
  activeSlide.value = index;
  startCarousel();
};

const previousSlide = () => goToSlide((activeSlide.value - 1 + slides.length) % slides.length);
const nextSlide = () => goToSlide((activeSlide.value + 1) % slides.length);
const toggleCarousel = () => {
  isCarouselPaused.value = !isCarouselPaused.value;
  startCarousel();
};

const redirectAfterLogin = () => {
  if (auth.isStudent) router.push('/student/dashboard');
  else if (auth.isAdmin) router.push('/admin/dashboard');
  else router.push('/dashboard');
};

const onLogin = async () => {
  loading.value = true;
  try {
    if (pendingOtpUserId.value) {
      await auth.verify2fa(pendingOtpUserId.value, form.otp);
      redirectAfterLogin();
      return;
    }
    const res = await auth.login(form.email, form.password);
    if (res.requiresOtp) {
      pendingOtpUserId.value = res.userId;
      ElMessage.info('Đã gửi mã OTP qua email hoặc log server');
      return;
    }
    redirectAfterLogin();
  } catch {
    // The shared HTTP interceptor already presents the API error to the user.
  } finally {
    loading.value = false;
  }
};

onMounted(startCarousel);
onUnmounted(stopCarousel);
</script>

<style scoped>
.login-wrap { align-items: stretch; background: var(--canvas); display: grid; grid-template-columns: minmax(0, 1fr) minmax(410px, 0.82fr); min-height: 100vh; }
.login-intro { background: #123f35; color: #f5fbf8; display: flex; flex-direction: column; isolation: isolate; justify-content: center; overflow: hidden; padding: 56px clamp(42px, 8vw, 140px); position: relative; }
.login-slide-image { animation: cinematic-pan 11s ease-out both; background-position: center; background-size: cover; inset: -3%; position: absolute; z-index: 0; }
.intro-shade { background: rgba(8, 32, 24, 0.72); inset: 0; position: absolute; z-index: 1; }
.motion-paused .login-slide-image,
.motion-paused .intro-ornament,
.motion-paused .trailer-progress i { animation-play-state: paused; }
.intro-ornament { color: rgba(255, 245, 219, 0.14); font-family: "Songti SC", "STSong", serif; font-size: clamp(100px, 12vw, 190px); line-height: 1; position: absolute; user-select: none; z-index: 1; }
.intro-ornament-left { animation: ornament-drift 12s ease-in-out infinite; left: 5%; top: 18%; }
.intro-ornament-right { animation: ornament-drift 14s ease-in-out -5s infinite reverse; bottom: 13%; right: 7%; }
.intro-brand { align-items: center; display: flex; gap: 10px; left: clamp(42px, 8vw, 140px); position: absolute; text-decoration: none; top: 30px; z-index: 2; }
.brand-logo { display: block; height: 36px; width: 36px; }
.intro-content { position: relative; z-index: 2; }
.intro-copy { max-width: 520px; }
.trailer-meta { align-items: center; display: flex; gap: 12px; }
.intro-copy .eyebrow { color: #a8e1ce; }
.trailer-live { align-items: center; color: #d8e9e1; display: inline-flex; font-size: 10px; font-weight: 700; gap: 6px; letter-spacing: 0.06em; text-transform: uppercase; }
.trailer-live i { background: #eca53c; border-radius: 50%; box-shadow: 0 0 0 5px rgba(236, 165, 60, 0.13); height: 6px; width: 6px; }
.intro-copy h1 { font-size: clamp(31px, 3.6vw, 48px); font-weight: 800; letter-spacing: 0; line-height: 1.12; margin: 12px 0 14px; }
.intro-copy p { color: #c1d7ce; font-size: 15px; line-height: 1.7; margin: 0; max-width: 460px; }
.hanzi-quote { border-left: 2px solid #e4a23a; display: grid; gap: 5px; margin-top: 30px; padding-left: 15px; }
.hanzi-quote span { color: #fff; font-family: "Noto Serif CJK SC", "Songti SC", serif; font-size: 27px; letter-spacing: 0.08em; line-height: 1.25; }
.hanzi-quote small { color: #d4e4dd; font-size: 12px; line-height: 1.5; }
.carousel-controls { align-items: center; bottom: 32px; display: flex; gap: 7px; left: clamp(42px, 8vw, 140px); position: absolute; z-index: 2; }
.carousel-controls :deep(.el-button) { color: #fff; }
.carousel-controls :deep(.el-button:hover) { background: rgba(255, 255, 255, 0.12); border-color: rgba(255, 255, 255, 0.45); }
.carousel-dots { display: flex; gap: 7px; margin: 0 4px; }
.carousel-dots button { background: rgba(255, 255, 255, 0.45); border: 0; border-radius: 999px; cursor: pointer; height: 6px; padding: 0; transition: background 180ms ease, width 180ms ease; width: 6px; }
.carousel-dots button.active { background: #e4a23a; width: 18px; }
.trailer-timeline { align-items: center; bottom: 37px; color: #d3e4dc; display: flex; font-size: 10px; gap: 10px; letter-spacing: 0.04em; position: absolute; right: clamp(42px, 8vw, 140px); text-transform: uppercase; z-index: 2; }
.trailer-counter { color: #fff; font-weight: 800; }
.trailer-progress { background: rgba(255, 255, 255, 0.28); height: 2px; overflow: hidden; width: 94px; }
.trailer-progress i { animation: trailer-progress 9s linear both; background: #eca53c; display: block; height: 100%; transform-origin: left; width: 100%; }
.trailer-caption { min-width: 62px; }
.slide-fade-enter-active, .slide-fade-leave-active { transition: opacity 550ms ease; }
.slide-fade-enter-from, .slide-fade-leave-to { opacity: 0; }
.copy-fade-enter-active, .copy-fade-leave-active { transition: opacity 250ms ease, transform 250ms ease; }
.copy-fade-enter-from, .copy-fade-leave-to { opacity: 0; transform: translateY(8px); }
@keyframes cinematic-pan {
  from { transform: scale(1); }
  to { transform: scale(1.09) translate3d(-1%, -0.6%, 0); }
}
@keyframes ornament-drift {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(-4deg); }
  50% { transform: translate3d(0, -15px, 0) rotate(4deg); }
}
@keyframes trailer-progress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
.login-card { align-self: center; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--shadow-float); justify-self: center; max-width: 430px; padding: 36px; width: calc(100% - 44px); }
.form-heading { margin-bottom: 26px; }
.form-heading h2 { color: var(--ink-900); font-size: 25px; font-weight: 800; letter-spacing: 0; margin: 7px 0 7px; }
.form-heading p { color: var(--ink-500); font-size: 13px; line-height: 1.55; margin: 0; }
.forgot-row { text-align: right; margin-top: 12px; font-size: 13px; }
.forgot-row a { color: var(--brand-700); text-decoration: none; font-weight: 700; }
.forgot-row a:hover { text-decoration: underline; }
@media (max-width: 860px) {
  .login-wrap { display: flex; padding: 20px; }
  .login-intro { display: none; }
  .login-card { margin: auto; width: min(430px, 100%); }
}
@media (max-width: 480px) {
  .login-wrap { padding: 14px; }
  .login-card { padding: 26px 20px; }
}
@media (prefers-reduced-motion: reduce) {
  .login-slide-image,
  .intro-ornament,
  .trailer-progress i { animation: none; }
  .slide-fade-enter-active,
  .slide-fade-leave-active,
  .copy-fade-enter-active,
  .copy-fade-leave-active { transition: none; }
}
</style>
