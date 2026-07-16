<template>
  <el-container :class="['layout', { 'student-layout': auth.isStudent, 'student-kids-layout': isChildStudent }]">
    <div v-if="mobileSidebarOpen" class="mobile-backdrop" @click="mobileSidebarOpen = false"></div>
    <el-aside width="248px" :class="['sidebar', { open: mobileSidebarOpen }]">
      <div class="brand-block">
        <router-link to="/" class="brand-link" aria-label="Ctalk Chinese">
          <span class="brand-mark"><img src="/logo.svg" alt="" /></span>
          <BrandWordmark compact subtitle="Learning workspace" />
        </router-link>
        <div class="workspace-label">
          <span class="workspace-dot"></span>
          {{ roleLabel }}
        </div>
      </div>
      <el-menu :default-active="$route.path" router class="menu" @select="closeMobileSidebar">
        <template v-for="section in navSections" :key="section.labelKey">
          <div class="nav-section-label">{{ t(section.labelKey) }}</div>
          <el-menu-item v-for="item in section.items" :key="item.path" :index="item.path">
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ t(item.labelKey || item.label) }}</span>
          </el-menu-item>
        </template>
      </el-menu>
      <div class="footer">
        <el-dropdown trigger="click" placement="top-start">
          <div class="user-info">
            <UserAvatar :user="auth.user || {}" :size="34" />
          <div class="info-text">
            <div class="name">{{ auth.user?.fullName }}</div>
            <div class="role">{{ roleLabel }}</div>
          </div>
            <el-icon class="account-caret"><CaretTop /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="$router.push('/profile')">
                <el-icon><User /></el-icon> Hồ sơ
              </el-dropdown-item>
              <el-dropdown-item divided @click="logout">
                <el-icon><SwitchButton /></el-icon> Đăng xuất
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-title">
          <el-button class="mobile-menu-button" circle text @click="mobileSidebarOpen = true">
            <el-icon><MenuIcon /></el-icon>
          </el-button>
          <div>
            <div class="header-kicker">{{ roleLabel }}</div>
            <h2>{{ pageTitle }}</h2>
          </div>
        </div>
        <div class="header-right">
          <el-select v-model="settings.locale" class="language-select" size="small" @change="changeLocale">
            <el-option label="VI" value="vi" />
            <el-option label="EN" value="en" />
            <el-option label="中文" value="zh" />
          </el-select>
          <el-button v-if="!isChildStudent" class="header-icon-button" circle text aria-label="Đổi giao diện" @click="settings.toggleMode()">
            <el-icon><component :is="settings.mode === 'dark' ? Sunny : Moon" /></el-icon>
          </el-button>
          <el-badge :value="unread" :hidden="!unread" class="badge-bell">
            <el-button class="header-icon-button" circle text aria-label="Thông báo" @click="$router.push('/notifications')">
              <el-icon><Bell /></el-icon>
            </el-button>
          </el-badge>
        </div>
      </el-header>
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useClassStore } from '@/stores/class';
import { useSettingsStore } from '@/stores/settings';
import { ElNotification } from 'element-plus';
import { notificationsApi } from '@/api';
import UserAvatar from '@/components/UserAvatar.vue';
import BrandWordmark from '@/components/BrandWordmark.vue';
import { isChildLearner } from '@/utils/learner';
import {
  House, School, Select, Histogram, Document, TrendCharts, Folder, Calendar,
  PieChart, Money, Bell, SwitchButton, User, CaretTop, UserFilled, Reading, ChatDotRound, EditPen, Moon, Sunny, Menu as MenuIcon, Microphone,
} from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const classStore = useClassStore();
const settings = useSettingsStore();
const { t, locale } = useI18n();
const unread = ref(0);
const mobileSidebarOpen = ref(false);
let unreadTimer = null;
const seenStorageKey = computed(() => `cm-notification-popups:${auth.user?.id || 'guest'}`);
const handleReadChange = (event) => {
  const detail = event.detail || {};
  if (typeof detail.unread === 'number') unread.value = Math.max(0, detail.unread);
  else if (typeof detail.delta === 'number') unread.value = Math.max(0, unread.value + detail.delta);
};

const roleLabel = computed(() => ({ TEACHER: t('role.teacher'), STUDENT: t('role.student'), ADMIN: t('role.admin') }[auth.role] || ''));
const isChildStudent = computed(() => isChildLearner(auth.user));

const teacherNav = [
  { path: '/dashboard', labelKey: 'menu.dashboard', icon: House, group: 'nav.overview' },
  { path: '/classes', labelKey: 'menu.classes', icon: School, group: 'nav.classroom' },
  { path: '/attendance', labelKey: 'menu.attendance', icon: Select, group: 'nav.classroom' },
  { path: '/grades', labelKey: 'menu.grades', icon: Histogram, group: 'nav.classroom' },
  { path: '/assignments', labelKey: 'menu.assignments', icon: Document, group: 'nav.classroom' },
  { path: '/quizzes', labelKey: 'menu.quiz', icon: EditPen, group: 'nav.classroom' },
  { path: '/forum', labelKey: 'menu.forum', icon: ChatDotRound, group: 'nav.learning' },
  { path: '/pronunciation', labelKey: 'menu.pronunciation', icon: Microphone, group: 'nav.learning' },
  { path: '/flashcards', label: 'Flashcards', icon: Reading, group: 'nav.learning' },
  { path: '/materials', labelKey: 'menu.materials', icon: Folder, group: 'nav.learning' },
  { path: '/class-extras', label: 'Extras', icon: Folder, group: 'nav.learning' },
  { path: '/progress', labelKey: 'menu.progress', icon: TrendCharts, group: 'nav.insights' },
  { path: '/calendar', labelKey: 'menu.calendar', icon: Calendar, group: 'nav.insights' },
  { path: '/analytics', labelKey: 'menu.reports', icon: PieChart, group: 'nav.insights' },
  { path: '/payments', labelKey: 'menu.payments', icon: Money, group: 'nav.insights' },
  { path: '/notifications', labelKey: 'menu.notifications', icon: Bell, group: 'nav.insights' },
];

const studentNav = [
  { path: '/student/dashboard', labelKey: 'menu.dashboard', icon: House, group: 'nav.overview' },
  { path: '/student/assignments', labelKey: 'menu.assignments', icon: Document, group: 'nav.learning' },
  { path: '/student/quizzes', labelKey: 'menu.quiz', icon: EditPen, group: 'nav.learning' },
  { path: '/pronunciation', labelKey: 'menu.pronunciation', icon: Microphone, group: 'nav.learning' },
  { path: '/flashcards', label: 'Flashcards', icon: Reading, group: 'nav.learning' },
  { path: '/materials', labelKey: 'menu.materials', icon: Folder, group: 'nav.learning' },
  { path: '/forum', labelKey: 'menu.forum', icon: ChatDotRound, group: 'nav.learning' },
  { path: '/student/grades', labelKey: 'menu.myGrades', icon: Histogram, group: 'nav.progress' },
  { path: '/student/attendance', labelKey: 'menu.attendance', icon: Select, group: 'nav.progress' },
  { path: '/calendar', labelKey: 'menu.calendar', icon: Calendar, group: 'nav.progress' },
  { path: '/class-extras', label: 'Extras', icon: Folder, group: 'nav.progress' },
  { path: '/notifications', labelKey: 'menu.notifications', icon: Bell, group: 'nav.progress' },
];

const adminNav = [
  { path: '/admin/dashboard', labelKey: 'menu.dashboard', icon: House, group: 'nav.overview' },
  { path: '/admin/users', labelKey: 'menu.users', icon: UserFilled, group: 'nav.management' },
  { path: '/admin/courses', labelKey: 'menu.courses', icon: Reading, group: 'nav.management' },
  { path: '/classes', labelKey: 'menu.classes', icon: School, group: 'nav.management' },
  { path: '/payments', labelKey: 'menu.payments', icon: Money, group: 'nav.management' },
  { path: '/admin/operations', label: 'Operations', icon: Select, group: 'nav.management' },
  { path: '/pronunciation', labelKey: 'menu.pronunciation', icon: Microphone, group: 'nav.learning' },
  { path: '/flashcards', label: 'Flashcards', icon: Reading, group: 'nav.learning' },
  { path: '/class-extras', label: 'Extras', icon: Folder, group: 'nav.learning' },
  { path: '/admin/revenue', labelKey: 'menu.revenue', icon: TrendCharts, group: 'nav.insights' },
  { path: '/analytics', labelKey: 'menu.reports', icon: PieChart, group: 'nav.insights' },
  { path: '/notifications', labelKey: 'menu.notifications', icon: Bell, group: 'nav.insights' },
];

const navItems = computed(() => {
  if (auth.isStudent) return studentNav;
  if (auth.isAdmin) return adminNav;
  return teacherNav;
});

const navSections = computed(() => {
  const sections = [];
  for (const item of navItems.value) {
    let section = sections.find(entry => entry.labelKey === item.group);
    if (!section) {
      section = { labelKey: item.group, items: [] };
      sections.push(section);
    }
    section.items.push(item);
  }
  return sections;
});

const pageTitle = computed(() => {
  if (route.path === '/profile') return 'Hồ sơ cá nhân';
  const item = navItems.value.find(n => n.path === route.path);
  return item ? t(item.labelKey || item.label) : 'Ctalk Chinese';
});

const changeLocale = (value) => {
  settings.setLocale(value);
  locale.value = value;
};

watch(() => settings.locale, (value) => { locale.value = value; });
watch(() => route.path, () => { mobileSidebarOpen.value = false; });

const logout = () => { auth.logout(); router.push('/login'); };
const closeMobileSidebar = () => { mobileSidebarOpen.value = false; };

const getSeenPopupIds = () => {
  try { return new Set(JSON.parse(sessionStorage.getItem(seenStorageKey.value) || '[]')); } catch { return new Set(); }
};

const saveSeenPopupIds = (ids) => {
  sessionStorage.setItem(seenStorageKey.value, JSON.stringify([...ids].slice(-100)));
};

const cleanNotificationContent = (content) => String(content || '').replace(/^session_id=\d+;\s*/, '');

const showNotificationPopup = (n) => {
  ElNotification({
    title: n.title || 'Thông báo mới',
    message: cleanNotificationContent(n.content),
    type: n.notifType === 'REMINDER' ? 'info' : 'warning',
    position: 'bottom-right',
    duration: 9000,
    onClick: async () => {
      try { await notificationsApi.markRead(n.id); unread.value = Math.max(0, unread.value - 1); } catch {}
      if (n.relatedUrl) window.open(n.relatedUrl, '_blank');
      else router.push('/notifications');
    },
  });
};

const loadUnread = async () => {
  try {
    const list = await notificationsApi.list();
    const unreadList = list.filter(n => !n.isRead);
    unread.value = unreadList.length;

    const seen = getSeenPopupIds();
    const fresh = unreadList
      .filter(n => !seen.has(n.id))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(-3);

    for (const n of fresh) {
      showNotificationPopup(n);
      seen.add(n.id);
    }
    if (fresh.length) saveSeenPopupIds(seen);
  } catch {}
};

onMounted(async () => {
  settings.applyTheme();
  locale.value = settings.locale;
  await classStore.fetchClasses();
  loadUnread();
  window.addEventListener('notifications:read-change', handleReadChange);
  unreadTimer = setInterval(loadUnread, 30000);
});

onUnmounted(() => {
  window.removeEventListener('notifications:read-change', handleReadChange);
  if (unreadTimer) clearInterval(unreadTimer);
});
</script>

<style scoped>
.layout { min-height: 100vh; background: var(--canvas); }
.student-layout { --student-jade: #0f8e6d; --student-coral: #d97755; --student-gold: #d89a2a; --student-blue: #497bc4; }
.student-kids-layout {
  --brand-700: #0d765c;
  --brand-600: #128964;
  --brand-500: #1aa878;
  --brand-100: #dff5e9;
  --canvas: #fff8e9;
  --surface: #fffdf7;
  --surface-soft: #fff1d6;
  --ink-900: #19382c;
  --ink-700: #355847;
  --ink-500: #62776c;
  --ink-400: #7d9186;
  --border: #e5d8bc;
  --border-strong: #d7c89f;
  --shadow-soft: 0 8px 22px rgba(94, 76, 35, 0.08);
  --shadow-float: 0 16px 38px rgba(94, 76, 35, 0.14);
  --el-bg-color: #fffdf7;
  --el-bg-color-page: #fff8e9;
  --el-bg-color-overlay: #fffdf7;
  --el-fill-color-blank: #fffdf7;
  --el-fill-color: #fff7e8;
  --el-fill-color-light: #fff1d6;
  --el-fill-color-lighter: #fff8ed;
  --el-border-color: #e5d8bc;
  --el-border-color-light: #f0e6cf;
  --el-text-color-primary: #19382c;
  --el-text-color-regular: #355847;
  --el-text-color-secondary: #62776c;
}
.student-layout .workspace-dot { background: var(--student-gold); }
.student-layout .menu :deep(.el-menu-item) { border-radius: 8px; }
.student-layout .menu :deep(.el-menu-item.is-active) { background: #def4ea; box-shadow: inset 3px 0 0 var(--student-jade); }
.student-layout .menu :deep(.el-menu-item.is-active .el-icon) { color: var(--student-jade); }
.student-kids-layout .sidebar { background: #fffdf7; border-right-color: #e5d8bc; }
.student-kids-layout .brand-block { background: #fff5df; border-bottom-color: #e5d8bc; }
.student-kids-layout .workspace-label { color: #7b6844; }
.student-kids-layout .menu :deep(.el-menu-item) { min-height: 42px; }
.student-kids-layout .menu :deep(.el-menu-item:hover) { background: #fff1d6; color: #19382c; }
.student-kids-layout .menu :deep(.el-menu-item.is-active) { background: #ddf5e8; box-shadow: inset 3px 0 0 #e39836; color: #155f4c; }
.student-kids-layout .menu :deep(.el-menu-item.is-active .el-icon) { color: #d27b27; }
.student-kids-layout .main-content { background: #fff8e9; }
.student-kids-layout .header { background: rgba(255, 253, 247, 0.94); border-bottom-color: #e5d8bc; }
.student-kids-layout .footer { border-top-color: #e5d8bc; }
.sidebar { background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 0; }
.brand-block { padding: 20px 16px 16px; border-bottom: 1px solid var(--border); }
.brand-link { align-items: center; color: inherit; display: flex; gap: 10px; text-decoration: none; }
.brand-mark { align-items: center; display: inline-flex; height: 34px; justify-content: center; width: 34px; }
.brand-mark img { display: block; height: 34px; width: 34px; }
.workspace-label { align-items: center; color: var(--ink-500); display: flex; font-size: 11px; font-weight: 650; gap: 7px; margin: 17px 3px 0; text-transform: uppercase; letter-spacing: 0.06em; }
.workspace-dot { background: #e4a23a; border-radius: 50%; height: 6px; width: 6px; }
.menu { background: transparent; border: none !important; flex: 1; overflow-y: auto; padding: 10px 10px 16px; }
.nav-section-label { color: var(--ink-400); font-size: 10px; font-weight: 800; letter-spacing: 0.09em; margin: 17px 9px 6px; text-transform: uppercase; }
.nav-section-label:first-child { margin-top: 6px; }
.menu :deep(.el-menu-item) { border-radius: 7px; color: var(--ink-700); font-size: 13px; height: 38px; line-height: 38px; margin: 2px 0; padding-left: 11px !important; }
.menu :deep(.el-menu-item .el-icon) { color: var(--ink-500); font-size: 17px; margin-right: 10px; }
.menu :deep(.el-menu-item:hover) { background: var(--surface-soft); color: var(--ink-900); }
.menu :deep(.el-menu-item.is-active .el-icon) { color: var(--brand-700); }
.footer { border-top: 1px solid var(--border); padding: 12px; }
.user-info { align-items: center; border-radius: 7px; cursor: pointer; display: flex; gap: 10px; padding: 6px; transition: background 0.15s ease; }
.user-info:hover { background: var(--surface-soft); }
.info-text { flex: 1; min-width: 0; }
.info-text .name { color: var(--ink-900); font-size: 13px; font-weight: 750; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.info-text .role { color: var(--ink-500); font-size: 11px; margin-top: 1px; }
.account-caret { color: var(--ink-400); font-size: 12px; }
.header { background: color-mix(in srgb, var(--surface) 94%, transparent); backdrop-filter: blur(14px); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; min-height: 68px; padding: 0 26px; position: sticky; top: 0; z-index: 100; }
.header-title { align-items: center; display: flex; gap: 10px; min-width: 0; }
.header-kicker { color: var(--ink-400); font-size: 10px; font-weight: 750; letter-spacing: 0.08em; line-height: 1.1; margin-bottom: 3px; text-transform: uppercase; }
.header h2 { color: var(--ink-900); font-size: 17px; font-weight: 800; letter-spacing: 0; line-height: 1.15; margin: 0; }
.header-right { align-items: center; display: flex; gap: 6px; }
.language-select { width: 83px; }
.header-icon-button { color: var(--ink-700); height: 34px; width: 34px; }
.header-icon-button:hover { background: var(--surface-soft); color: var(--brand-700); }
.badge-bell :deep(.el-badge__content) { border: 2px solid var(--surface); box-shadow: none; font-weight: 800; }
.main-content { background: var(--canvas); min-height: calc(100vh - 68px); padding: 24px 26px 34px; }
.mobile-menu-button { display: none; }
.mobile-backdrop { display: none; }

@media (max-width: 768px) {
  .layout { min-height: 100dvh; }
  .sidebar { bottom: 0; box-shadow: var(--shadow-float); left: 0; position: fixed; top: 0; transform: translateX(-100%); transition: transform 0.2s ease; width: 248px !important; z-index: 2100; }
  .sidebar.open { transform: translateX(0); }
  .mobile-backdrop { background: rgba(12, 23, 18, 0.42); bottom: 0; display: block; left: 0; position: fixed; right: 0; top: 0; z-index: 2090; }
  .mobile-menu-button { display: inline-flex; flex: 0 0 auto; }
  .header { min-height: 58px; padding: 0 12px; gap: 8px; }
  .header h2 { font-size: 15px; max-width: 162px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .header-kicker { display: none; }
  .header-right { gap: 2px; }
  .language-select { width: 70px; }
  .main-content { min-height: calc(100dvh - 58px); padding: 14px 12px 26px; }
}
</style>
