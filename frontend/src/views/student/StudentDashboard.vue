<template>
  <div :class="['page-shell', 'student-dashboard', { 'child-dashboard': childMode }]">
    <section :class="['student-hero', currentHeroSlide.tone]" aria-labelledby="student-welcome-title">
      <Transition name="hero-copy" mode="out-in">
        <div :key="currentHeroSlide.id" class="student-hero-copy">
          <span class="eyebrow hero-eyebrow">{{ currentHeroSlide.kicker }}</span>
          <h1 id="student-welcome-title">{{ currentHeroSlide.title }}</h1>
          <p>{{ currentHeroSlide.description }}</p>
          <div class="hero-actions">
            <el-button type="primary" @click="runHeroAction(currentHeroSlide.primaryAction)">
              <el-icon><component :is="currentHeroSlide.primaryAction.icon" /></el-icon>
              {{ currentHeroSlide.primaryAction.label }}
            </el-button>
            <el-button v-if="currentHeroSlide.secondaryAction" plain @click="runHeroAction(currentHeroSlide.secondaryAction)">
              <el-icon><component :is="currentHeroSlide.secondaryAction.icon" /></el-icon>
              {{ currentHeroSlide.secondaryAction.label }}
            </el-button>
          </div>
        </div>
      </Transition>
      <img class="student-hero-art" :src="learningJourneyHero" alt="Học viên luyện chữ Hán và phát âm tiếng Trung" />
      <div class="hero-carousel-controls" aria-label="Điều hướng thông tin học tập">
        <el-button circle text aria-label="Thông tin trước" @click="previousHeroSlide"><el-icon><ArrowLeft /></el-icon></el-button>
        <div class="hero-slide-dots" role="tablist" aria-label="Chọn thông tin học tập">
          <button
            v-for="(slide, index) in heroSlides"
            :key="slide.id"
            :class="{ active: activeHeroSlide === index }"
            type="button"
            :aria-label="`Thông tin ${index + 1}`"
            :aria-selected="activeHeroSlide === index"
            role="tab"
            @click="goToHeroSlide(index)"
          ></button>
        </div>
        <el-button circle text :aria-label="heroCarouselPaused ? 'Tiếp tục tự chuyển' : 'Dừng tự chuyển'" @click="toggleHeroCarousel">
          <el-icon><component :is="heroCarouselPaused ? VideoPlay : VideoPause" /></el-icon>
        </el-button>
        <el-button circle text aria-label="Thông tin tiếp theo" @click="nextHeroSlide"><el-icon><ArrowRight /></el-icon></el-button>
      </div>
    </section>

    <section class="learning-plan" aria-labelledby="learning-plan-title">
      <div class="learning-plan-heading">
        <div>
          <span class="eyebrow">Hành trình hôm nay</span>
          <h2 id="learning-plan-title">Chọn một nhiệm vụ và bắt đầu</h2>
        </div>
        <div class="class-context">
          <span class="context-label">Lớp đang xem</span>
          <ClassPicker @change="reload" />
        </div>
      </div>
      <div class="learning-quick-grid">
        <button type="button" class="learning-quick-card pronunciation" @click="$router.push('/pronunciation')">
          <span class="quick-icon"><el-icon><Microphone /></el-icon></span>
          <span class="quick-content">
            <strong>Phát âm</strong>
            <small>Nghe mẫu, đọc theo và nộp bản ghi âm</small>
          </span>
          <span class="quick-action">Bắt đầu</span>
        </button>
        <button type="button" class="learning-quick-card quiz" @click="$router.push('/student/quizzes')">
          <span class="quick-icon"><el-icon><EditPen /></el-icon></span>
          <span class="quick-content">
            <strong>Quiz</strong>
            <small>Ôn lại kiến thức bằng câu hỏi ngắn</small>
          </span>
          <span class="quick-action">Làm quiz</span>
        </button>
        <button type="button" class="learning-quick-card flashcards" @click="$router.push('/flashcards')">
          <span class="quick-icon"><el-icon><Reading /></el-icon></span>
          <span class="quick-content">
            <strong>Flashcards</strong>
            <small>Ôn từ vựng theo nhịp độ của bạn</small>
          </span>
          <span class="quick-action">Ôn tập</span>
        </button>
      </div>
    </section>

    <section class="student-metric-grid" aria-label="Tiến độ học tập">
      <div class="student-metric attendance-metric">
        <span class="metric-icon"><el-icon><Calendar /></el-icon></span>
        <div>
          <div class="metric-label">Chuyên cần</div>
          <div class="metric-value">{{ attendancePct }}%</div>
          <div class="metric-sub">{{ attStats.present }}/{{ attStats.total }} buổi có mặt</div>
        </div>
      </div>
      <div class="student-metric grade-metric">
        <span class="metric-icon"><el-icon><EditPen /></el-icon></span>
        <div>
          <div class="metric-label">Điểm trung bình</div>
          <div class="metric-value">{{ avg.average || '-' }}</div>
          <div class="metric-sub">{{ classification }}</div>
        </div>
      </div>
      <div class="student-metric assignment-metric">
        <span class="metric-icon"><el-icon><Reading /></el-icon></span>
        <div>
          <div class="metric-label">Bài cần nộp</div>
          <div class="metric-value">{{ pendingAssign.length }}</div>
          <div class="metric-sub">Cần hoàn thành</div>
        </div>
      </div>
      <div class="student-metric notification-metric">
        <span class="metric-icon"><el-icon><Bell /></el-icon></span>
        <div>
          <div class="metric-label">Thông báo mới</div>
          <div class="metric-value">{{ unreadNotif }}</div>
          <div class="metric-sub">Chưa đọc</div>
        </div>
      </div>
    </section>

    <div class="content-grid student-content-grid">
      <div class="student-left-column">
        <el-card class="upcoming-card">
          <template #header>
            <div class="panel-heading">
              <div>
                <div class="section-title">Buổi học sắp tới</div>
                <div class="section-helper">Chuẩn bị trước giờ học</div>
              </div>
              <el-button text type="primary" @click="$router.push('/calendar')">Mở lịch</el-button>
            </div>
          </template>
          <div v-if="upcomingSessions.length === 0" class="empty-state">Chưa có buổi học sắp tới.</div>
          <div v-for="s in upcomingSessions" :key="s.id" class="session-row">
            <div class="session-date">
              <b>{{ String(s.sessionNo).padStart(2, '0') }}</b>
              <span>Buổi</span>
            </div>
            <div class="session-info">
              <div class="session-title">{{ s.topic || 'Chưa có chủ đề' }}</div>
              <div class="session-meta">
                {{ fmtDate(s.plannedDate) }}
                <span v-if="s.startTime"> · {{ s.startTime.slice(0, 5) }}</span>
              </div>
            </div>
            <el-button v-if="canJoinSession(s)" type="primary" size="small" @click="joinSession(s)">Tham gia</el-button>
          </div>
        </el-card>

        <el-card class="assignments-card">
          <template #header>
            <div class="panel-heading">
              <div>
                <div class="section-title">Bài tập cần nộp</div>
                <div class="section-helper">Ưu tiên hoàn thành đúng hạn</div>
              </div>
              <el-button text type="primary" @click="$router.push('/student/assignments')">Xem bài tập</el-button>
            </div>
          </template>
          <div v-if="pendingAssign.length === 0" class="empty-state">Bạn đã hoàn thành tất cả bài tập.</div>
          <div v-for="a in pendingAssign" :key="a.id" class="assign-row">
            <div class="assignment-check">{{ a.is_required ? '!' : '·' }}</div>
            <div class="assignment-info">
              <div class="ar-top">
                <strong class="ar-title">{{ a.title }}</strong>
                <span :class="['badge', a.is_required ? 'badge-red' : 'badge-gray']">{{ a.is_required ? 'Bắt buộc' : 'Tùy chọn' }}</span>
              </div>
              <div class="ar-meta">Hạn nộp: {{ fmtDateTime(a.due_date) }}</div>
            </div>
            <el-button size="small" @click="$router.push('/student/assignments')">Nộp bài</el-button>
          </div>
        </el-card>
      </div>

      <div class="student-right-column">
        <el-card v-if="certificates.length" class="certificate-card">
          <template #header>
            <div>
              <div class="section-title">Chứng chỉ của bạn</div>
              <div class="section-helper">Các khóa học đã hoàn thành</div>
            </div>
          </template>
          <div v-for="cert in certificates" :key="cert.id" class="cert-row">
            <div>
              <div class="cert-title">{{ cert.courseName || cert.className }}</div>
              <div class="cert-meta">{{ cert.cert_number }} · {{ cert.classification }} · {{ cert.final_score }}</div>
            </div>
            <el-button size="small" type="primary" @click="downloadCertificate(cert.id)">Tải PDF</el-button>
          </div>
        </el-card>

        <el-card class="attendance-card">
          <template #header>
            <div>
              <div class="section-title">Điểm danh gần đây</div>
              <div class="section-helper">Mỗi ô tương ứng một buổi học</div>
            </div>
          </template>
          <div v-if="attRecords.length === 0" class="empty-state">Chưa có dữ liệu điểm danh.</div>
          <div v-else class="att-grid">
            <div v-for="a in attRecords" :key="a.session_id" :class="['att-dot', dotClass(a.status)]" :title="`Buoi ${a.session_no}: ${fmtDate(a.planned_date)}`">
              {{ dotShort(a.status) }}
            </div>
          </div>
          <div class="att-summary">
            <span><b>{{ attStats.present }}</b> có mặt</span>
            <span><b class="absent-value">{{ attStats.absent }}</b> vắng</span>
            <span><b class="late-value">{{ attStats.late }}</b> muộn</span>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, ArrowRight, Bell, Calendar, EditPen, Microphone, Reading, VideoPause, VideoPlay } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { useClassStore } from '@/stores/class';
import ClassPicker from '@/components/ClassPicker.vue';
import { attendanceApi, gradesApi, assignmentsApi, submissionsApi, notificationsApi, sessionsApi, certificatesApi } from '@/api';
import { fmtDate, fmtDateTime, gradeClassify } from '@/utils/format';
import learningJourneyHero from '@/assets/student/learning-journey-hero.jpg';
import { isChildLearner } from '@/utils/learner';
import dayjs from 'dayjs';

const auth = useAuthStore();
const classStore = useClassStore();
const router = useRouter();
const attStats = ref({ total: 0, present: 0, absent: 0, late: 0 });
const attRecords = ref([]);
const avg = ref({ average: null });
const pendingAssign = ref([]);
const unreadNotif = ref(0);
const allSessions = ref([]);
const certificates = ref([]);
const activeHeroSlide = ref(0);
const heroCarouselPaused = ref(false);
let heroCarouselTimer = null;

const firstName = computed(() => String(auth.user?.fullName || 'bạn').trim().split(/\s+/).at(-1) || 'bạn');
const childMode = computed(() => isChildLearner(auth.user));
const attendancePct = computed(() => attStats.value.total ? Math.round(attStats.value.present / attStats.value.total * 100) : 100);
const classification = computed(() => gradeClassify(avg.value.average).label);

const upcomingSessions = computed(() => {
  const now = dayjs();
  return allSessions.value
    .filter(s => s.status === 'PLANNED' && !dayjs(s.plannedDate).isBefore(now, 'day'))
    .sort((a, b) => dayjs(a.plannedDate).valueOf() - dayjs(b.plannedDate).valueOf())
    .slice(0, 3);
});

const getMeetingUrl = (s) => s.meeting_url || s.meetingUrl || '';
const sessionStart = (s) => s.startTime ? dayjs(`${s.plannedDate} ${s.startTime}`) : dayjs(s.plannedDate).startOf('day');
const canJoinSession = (s) => {
  const url = getMeetingUrl(s);
  if (!url) return false;
  const diffHours = sessionStart(s).diff(dayjs(), 'hour', true);
  return diffHours >= 0 && diffHours <= 24;
};
const joinSession = (s) => window.open(getMeetingUrl(s), '_blank');

const heroSlides = computed(() => {
  const slides = [
    {
      id: 'welcome',
      tone: 'hero-welcome',
      kicker: childMode.value ? 'Hành trình khám phá tiếng Trung' : 'Không gian học tập của bạn',
      title: childMode.value
        ? `Chào ${firstName.value}, mình cùng chinh phục một thử thách nhé!`
        : `Chào ${firstName.value}, hôm nay mình bắt đầu từ đâu?`,
      description: childMode.value
        ? 'Chọn một nhiệm vụ nhỏ, làm thật tập trung và từng ngày bạn sẽ nói tiếng Trung tự tin hơn.'
        : 'Một bước nhỏ mỗi ngày giúp bạn nhớ từ vựng, tự tin phát âm và tiến gần hơn đến mục tiêu của mình.',
      primaryAction: { label: 'Luyện phát âm', path: '/pronunciation', icon: Microphone },
      secondaryAction: { label: 'Xem lịch học', path: '/calendar', icon: Calendar },
    },
  ];

  const nextSession = upcomingSessions.value[0];
  if (nextSession) {
    const time = nextSession.startTime ? ` lúc ${nextSession.startTime.slice(0, 5)}` : '';
    const joinable = canJoinSession(nextSession);
    slides.push({
      id: `session-${nextSession.id}`,
      tone: 'hero-session',
      kicker: 'Buổi học tiếp theo',
      title: `Buổi ${nextSession.sessionNo}: ${nextSession.topic || 'Chuẩn bị bài mới'}`,
      description: `${fmtDate(nextSession.plannedDate)}${time}. Hãy mở tài liệu và chuẩn bị trước vài phút để vào lớp chủ động hơn.`,
      primaryAction: joinable
        ? { label: 'Tham gia buổi học', type: 'join', session: nextSession, icon: Calendar }
        : { label: 'Mở lịch học', path: '/calendar', icon: Calendar },
      secondaryAction: { label: 'Xem tài liệu', path: '/materials', icon: Reading },
    });
  }

  const nextAssignment = pendingAssign.value[0];
  if (nextAssignment) {
    slides.push({
      id: `assignment-${nextAssignment.id}`,
      tone: 'hero-assignment',
      kicker: 'Bài tập cần ưu tiên',
      title: nextAssignment.title,
      description: `Hạn nộp ${fmtDateTime(nextAssignment.due_date)}.${nextAssignment.is_required ? ' Đây là bài bắt buộc của lớp.' : ' Hoàn thành sớm để chủ động ôn lại.'}`,
      primaryAction: { label: 'Mở bài tập', path: '/student/assignments', icon: EditPen },
      secondaryAction: { label: 'Ôn flashcards', path: '/flashcards', icon: Reading },
    });
  }

  if (unreadNotif.value > 0) {
    slides.push({
      id: 'notifications',
      tone: 'hero-notification',
      kicker: 'Có cập nhật mới',
      title: `Bạn có ${unreadNotif.value} thông báo chưa đọc`,
      description: 'Kiểm tra thông báo để không bỏ lỡ lịch học, phản hồi của giáo viên hoặc thay đổi mới của lớp.',
      primaryAction: { label: 'Xem thông báo', path: '/notifications', icon: Bell },
      secondaryAction: { label: 'Xem lịch học', path: '/calendar', icon: Calendar },
    });
  }

  return slides;
});

const currentHeroSlide = computed(() => heroSlides.value[activeHeroSlide.value] || heroSlides.value[0]);
const stopHeroCarousel = () => {
  if (heroCarouselTimer) clearInterval(heroCarouselTimer);
  heroCarouselTimer = null;
};
const startHeroCarousel = () => {
  stopHeroCarousel();
  if (!heroCarouselPaused.value && heroSlides.value.length > 1) {
    heroCarouselTimer = setInterval(() => {
      activeHeroSlide.value = (activeHeroSlide.value + 1) % heroSlides.value.length;
    }, 8000);
  }
};
const goToHeroSlide = (index) => {
  activeHeroSlide.value = index;
  startHeroCarousel();
};
const previousHeroSlide = () => goToHeroSlide((activeHeroSlide.value - 1 + heroSlides.value.length) % heroSlides.value.length);
const nextHeroSlide = () => goToHeroSlide((activeHeroSlide.value + 1) % heroSlides.value.length);
const toggleHeroCarousel = () => {
  heroCarouselPaused.value = !heroCarouselPaused.value;
  startHeroCarousel();
};
const runHeroAction = (action) => {
  if (action.type === 'join') joinSession(action.session);
  else router.push(action.path);
};

const dotClass = (s) => ({ PRESENT: 'dot-p', ABSENT: 'dot-a', LATE: 'dot-l' }[s] || 'dot-p');
const dotShort = (s) => ({ PRESENT: 'OK', ABSENT: 'X', LATE: 'M' }[s] || '?');

const reload = async () => {
  const cid = classStore.selectedId;
  if (!cid || !auth.user) return;
  attStats.value = await attendanceApi.stats(auth.user.id, cid);
  attRecords.value = await attendanceApi.byStudent(auth.user.id, cid);
  avg.value = await gradesApi.average(auth.user.id, cid);
  allSessions.value = await sessionsApi.list(cid);
  const all = await assignmentsApi.list(cid);
  const subs = await submissionsApi.byStudent(auth.user.id, cid);
  pendingAssign.value = all.filter(a => {
    const s = subs.find(x => x.assignment_id === a.id);
    return !s || s.status === 'NOT_SUBMITTED' || s.status === 'REVISION_REQUIRED';
  });
  unreadNotif.value = (await notificationsApi.unreadCount()) || 0;
  certificates.value = await certificatesApi.list({ studentId: auth.user.id });
};

const downloadCertificate = async (id) => {
  const blob = await certificatesApi.download(id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `certificate-${id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};

watch(() => classStore.selectedId, reload);
watch(() => heroSlides.value.length, (length) => {
  if (activeHeroSlide.value >= length) activeHeroSlide.value = 0;
  startHeroCarousel();
});
onMounted(async () => {
  await reload();
  startHeroCarousel();
});
onUnmounted(stopHeroCarousel);
</script>

<style scoped>
.student-dashboard { display: grid; gap: 18px; }
.student-hero { align-items: stretch; background: #dff2ea; border: 1px solid #cde5da; border-radius: 8px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(340px, 0.82fr); min-height: 270px; overflow: hidden; position: relative; }
.student-hero.hero-session { background: #e6effd; border-color: #cbdcf8; }
.student-hero.hero-assignment { background: #fff1de; border-color: #f2dbb8; }
.student-hero.hero-notification { background: #f0eafb; border-color: #ddd0f0; }
.student-hero-copy { align-self: center; max-width: 620px; padding: 38px clamp(26px, 4vw, 52px) 76px; position: relative; z-index: 1; }
.hero-eyebrow { color: #0f6e56; }
.student-hero h1 { color: #13382c; font-size: clamp(28px, 3.1vw, 42px); font-weight: 800; letter-spacing: 0; line-height: 1.12; margin: 11px 0 12px; }
.student-hero p { color: #406156; font-size: 15px; line-height: 1.65; margin: 0; max-width: 540px; }
.student-hero.hero-session h1 { color: #1c3a63; }
.student-hero.hero-session p { color: #536a85; }
.student-hero.hero-assignment h1 { color: #523822; }
.student-hero.hero-assignment p { color: #745c45; }
.student-hero.hero-notification h1 { color: #45335d; }
.student-hero.hero-notification p { color: #695778; }
.child-dashboard .student-hero { border-color: #addfca; }
.child-dashboard .student-hero-copy { max-width: 660px; }
.child-dashboard .hero-actions :deep(.el-button) { min-height: 42px; }
.child-dashboard .learning-quick-card { border-top: 3px solid var(--quick-color); }
.child-dashboard .student-metric { border-top: 3px solid var(--metric-color); }
.hero-actions { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 22px; }
.hero-actions :deep(.el-button) { min-height: 38px; }
.student-hero-art { height: 100%; min-height: 270px; object-fit: cover; object-position: 70% center; width: 100%; }
.hero-carousel-controls { align-items: center; bottom: 20px; display: flex; gap: 7px; left: clamp(26px, 4vw, 52px); position: absolute; z-index: 2; }
.hero-carousel-controls :deep(.el-button) { color: #285847; height: 29px; width: 29px; }
.hero-carousel-controls :deep(.el-button:hover) { background: rgba(255, 255, 255, 0.52); color: #0f6e56; }
.hero-slide-dots { display: flex; gap: 6px; margin: 0 3px; }
.hero-slide-dots button { background: rgba(24, 89, 68, 0.32); border: 0; border-radius: 999px; cursor: pointer; height: 6px; padding: 0; transition: background 180ms ease, width 180ms ease; width: 6px; }
.hero-slide-dots button.active { background: #0f7d60; width: 18px; }
.hero-copy-enter-active, .hero-copy-leave-active { transition: opacity 240ms ease, transform 240ms ease; }
.hero-copy-enter-from, .hero-copy-leave-to { opacity: 0; transform: translateY(8px); }

.learning-plan { padding-top: 3px; }
.learning-plan-heading { align-items: end; display: flex; gap: 18px; justify-content: space-between; margin-bottom: 12px; }
.learning-plan h2 { color: var(--ink-900); font-size: 19px; font-weight: 800; letter-spacing: 0; line-height: 1.25; margin: 5px 0 0; }
.class-context { align-items: center; display: flex; gap: 9px; min-width: 300px; }
.context-label { color: var(--ink-500); font-size: 12px; font-weight: 700; white-space: nowrap; }
.class-context :deep(.class-picker) { margin-bottom: 0; }
.class-context :deep(.class-picker .label) { display: none; }
.learning-quick-grid { display: grid; gap: 12px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.learning-quick-card { align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; color: var(--ink-900); cursor: pointer; display: flex; gap: 12px; min-height: 100px; padding: 16px; text-align: left; transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease; width: 100%; }
.learning-quick-card:hover { border-color: var(--quick-color); box-shadow: var(--shadow-soft); transform: translateY(-2px); }
.learning-quick-card.pronunciation { --quick-color: #0f9474; --quick-soft: #ddf5eb; }
.learning-quick-card.quiz { --quick-color: #d57b3f; --quick-soft: #fff0df; }
.learning-quick-card.flashcards { --quick-color: #527cc8; --quick-soft: #e6efff; }
.quick-icon { align-items: center; background: var(--quick-soft); border-radius: 8px; color: var(--quick-color); display: inline-flex; flex: 0 0 auto; font-size: 21px; height: 42px; justify-content: center; width: 42px; }
.quick-content { display: grid; gap: 4px; min-width: 0; }
.quick-content strong { font-size: 14px; font-weight: 800; }
.quick-content small { color: var(--ink-500); font-size: 11px; line-height: 1.45; }
.quick-action { color: var(--quick-color); font-size: 11px; font-weight: 800; margin-left: auto; white-space: nowrap; }

.student-metric-grid { display: grid; gap: 12px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.student-metric { align-items: flex-start; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; display: flex; gap: 12px; min-height: 114px; padding: 17px; }
.metric-icon { align-items: center; background: var(--metric-soft); border-radius: 8px; color: var(--metric-color); display: inline-flex; flex: 0 0 auto; font-size: 18px; height: 36px; justify-content: center; width: 36px; }
.attendance-metric { --metric-color: #168565; --metric-soft: #ddf5eb; }
.grade-metric { --metric-color: #7450a8; --metric-soft: #f0e8ff; }
.assignment-metric { --metric-color: #c67520; --metric-soft: #fff0d8; }
.notification-metric { --metric-color: #3d70bf; --metric-soft: #e4edff; }
.metric-label { color: var(--ink-500); font-size: 11px; font-weight: 750; }
.metric-value { color: var(--ink-900); font-size: 27px; font-weight: 800; letter-spacing: 0; line-height: 1.15; margin-top: 5px; }
.metric-sub { color: var(--ink-400); font-size: 11px; margin-top: 5px; }

.student-content-grid { align-items: start; }
.student-left-column, .student-right-column { display: grid; gap: 16px; min-width: 0; }
.session-row { align-items: center; border-bottom: 1px solid var(--border); display: flex; gap: 12px; padding: 13px 0; }
.session-row:first-of-type { padding-top: 2px; }
.session-row:last-child { border-bottom: 0; padding-bottom: 2px; }
.session-date { align-items: center; background: #e5f5ef; border-radius: 8px; color: #0f6e56; display: flex; flex-direction: column; flex: 0 0 auto; height: 42px; justify-content: center; width: 42px; }
.session-date b { font-size: 15px; line-height: 1; }
.session-date span { font-size: 9px; font-weight: 800; letter-spacing: 0.05em; margin-top: 3px; text-transform: uppercase; }
.session-info { flex: 1; min-width: 0; }
.session-title { color: var(--ink-900); font-size: 13px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.session-meta { color: var(--ink-500); font-size: 12px; margin-top: 3px; }
.assignments-card { margin-top: 0; }
.assign-row { align-items: center; border-bottom: 1px solid var(--border); display: flex; gap: 10px; padding: 13px 0; }
.assign-row:first-of-type { padding-top: 2px; }
.assign-row:last-child { border-bottom: 0; padding-bottom: 2px; }
.assignment-check { align-items: center; background: #fff0d8; border-radius: 50%; color: #986016; display: flex; flex: 0 0 auto; font-size: 15px; font-weight: 800; height: 25px; justify-content: center; width: 25px; }
.assignment-info { flex: 1; min-width: 0; }
.ar-top { align-items: center; display: flex; gap: 8px; justify-content: space-between; }
.ar-title { color: var(--ink-900); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ar-meta { color: var(--ink-500); font-size: 12px; margin-top: 3px; }
.cert-row { align-items: center; display: flex; gap: 12px; justify-content: space-between; }
.cert-title { color: var(--ink-900); font-size: 13px; font-weight: 800; }
.cert-meta { color: var(--ink-500); font-size: 12px; margin-top: 3px; }
.att-grid { display: flex; flex-wrap: wrap; gap: 7px; }
.att-dot { align-items: center; border-radius: 8px; display: flex; font-size: 10px; font-weight: 800; height: 29px; justify-content: center; width: 29px; }
.dot-p { background: #e3f3e7; color: #27673a; }
.dot-a { background: #fbe9e7; color: #a63737; }
.dot-l { background: #fbf0d9; color: #986016; }
.att-summary { border-top: 1px solid var(--border); color: var(--ink-500); display: flex; flex-wrap: wrap; font-size: 12px; gap: 13px; margin-top: 16px; padding-top: 13px; }
.att-summary b { color: var(--brand-700); }
.att-summary .absent-value { color: var(--danger); }
.att-summary .late-value { color: var(--warning); }

@media (max-width: 1100px) {
  .student-hero { grid-template-columns: minmax(0, 1fr) minmax(290px, 0.75fr); }
  .student-metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .learning-quick-grid { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
  .student-dashboard { gap: 14px; }
  .student-hero { display: flex; flex-direction: column; }
  .student-hero-copy { padding: 26px 20px 62px; }
  .student-hero h1 { font-size: 29px; }
  .student-hero-art { height: 190px; min-height: 0; object-position: center 56%; }
  .hero-carousel-controls { bottom: 204px; left: 20px; }
  .learning-plan-heading { align-items: stretch; flex-direction: column; gap: 12px; }
  .class-context { align-items: stretch; flex-direction: column; min-width: 0; }
  .class-context :deep(.el-select) { width: 100% !important; }
  .learning-quick-card { min-height: 88px; }
  .student-metric-grid { gap: 10px; }
  .student-metric { min-height: 102px; padding: 14px; }
  .quick-action { display: none; }
}
</style>
