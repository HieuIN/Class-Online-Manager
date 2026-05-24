<template>
  <el-container class="layout">
    <div v-if="mobileSidebarOpen" class="mobile-backdrop" @click="mobileSidebarOpen = false"></div>
    <el-aside width="220px" :class="['sidebar', { open: mobileSidebarOpen }]">
      <div class="logo">
        <div class="logo-line">🎓 <span>ClassManager</span></div>
        <div class="role-tag">{{ roleLabel }}</div>
      </div>
      <el-menu :default-active="$route.path" router class="menu" @select="closeMobileSidebar">
        <el-menu-item v-for="item in navItems" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ t(item.labelKey || item.label) }}</span>
        </el-menu-item>
      </el-menu>
      <div class="footer">
        <el-dropdown trigger="click" placement="top-start">
          <div class="user-info">
            <UserAvatar :user="auth.user || {}" :size="34" />
            <div class="info-text">
              <div class="name">{{ auth.user?.fullName }}</div>
              <div class="role">{{ roleLabel }}</div>
            </div>
            <el-icon><CaretTop /></el-icon>
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
          <h2>{{ pageTitle }}</h2>
        </div>
        <div class="header-right">
          <el-select v-model="settings.locale" size="small" style="width: 88px" @change="changeLocale">
            <el-option label="VI" value="vi" />
            <el-option label="EN" value="en" />
            <el-option label="中文" value="zh" />
          </el-select>
          <el-button circle text @click="settings.toggleMode()">
            <el-icon><component :is="settings.mode === 'dark' ? Sunny : Moon" /></el-icon>
          </el-button>
          <el-badge :value="unread" :hidden="!unread" class="badge-bell">
            <el-button circle text @click="$router.push('/notifications')">
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
import {
  House, School, Select, Histogram, Document, TrendCharts, Folder, Calendar,
  PieChart, Money, Bell, SwitchButton, User, CaretTop, UserFilled, Reading, ChatDotRound, EditPen, Moon, Sunny, Menu as MenuIcon,
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

const teacherNav = [
  { path: '/dashboard', labelKey: 'menu.dashboard', icon: House },
  { path: '/classes', labelKey: 'menu.classes', icon: School },
  { path: '/attendance', labelKey: 'menu.attendance', icon: Select },
  { path: '/grades', labelKey: 'menu.grades', icon: Histogram },
  { path: '/assignments', labelKey: 'menu.assignments', icon: Document },
  { path: '/quizzes', labelKey: 'menu.quiz', icon: EditPen },
  { path: '/forum', labelKey: 'menu.forum', icon: ChatDotRound },
  { path: '/flashcards', label: 'Flashcards', icon: Reading },
  { path: '/class-extras', label: 'Extras', icon: Folder },
  { path: '/progress', labelKey: 'menu.progress', icon: TrendCharts },
  { path: '/materials', labelKey: 'menu.materials', icon: Folder },
  { path: '/calendar', labelKey: 'menu.calendar', icon: Calendar },
  { path: '/analytics', labelKey: 'menu.reports', icon: PieChart },
  { path: '/payments', labelKey: 'menu.payments', icon: Money },
  { path: '/notifications', labelKey: 'menu.notifications', icon: Bell },
];

const studentNav = [
  { path: '/student/dashboard', labelKey: 'menu.dashboard', icon: House },
  { path: '/student/grades', labelKey: 'menu.myGrades', icon: Histogram },
  { path: '/student/assignments', labelKey: 'menu.assignments', icon: Document },
  { path: '/student/quizzes', labelKey: 'menu.quiz', icon: EditPen },
  { path: '/forum', labelKey: 'menu.forum', icon: ChatDotRound },
  { path: '/flashcards', label: 'Flashcards', icon: Reading },
  { path: '/class-extras', label: 'Extras', icon: Folder },
  { path: '/student/attendance', labelKey: 'menu.attendance', icon: Select },
  { path: '/materials', labelKey: 'menu.materials', icon: Folder },
  { path: '/calendar', labelKey: 'menu.calendar', icon: Calendar },
  { path: '/notifications', labelKey: 'menu.notifications', icon: Bell },
];

const adminNav = [
  { path: '/admin/dashboard', labelKey: 'menu.dashboard', icon: House },
  { path: '/admin/users', labelKey: 'menu.users', icon: UserFilled },
  { path: '/admin/courses', labelKey: 'menu.courses', icon: Reading },
  { path: '/classes', labelKey: 'menu.classes', icon: School },
  { path: '/flashcards', label: 'Flashcards', icon: Reading },
  { path: '/class-extras', label: 'Extras', icon: Folder },
  { path: '/payments', labelKey: 'menu.payments', icon: Money },
  { path: '/admin/revenue', labelKey: 'menu.revenue', icon: TrendCharts },
  { path: '/admin/operations', label: 'Operations', icon: Select },
  { path: '/analytics', labelKey: 'menu.reports', icon: PieChart },
  { path: '/notifications', labelKey: 'menu.notifications', icon: Bell },
];

const navItems = computed(() => {
  if (auth.isStudent) return studentNav;
  if (auth.isAdmin) return adminNav;
  return teacherNav;
});

const pageTitle = computed(() => {
  if (route.path === '/profile') return 'Hồ sơ cá nhân';
  const item = navItems.value.find(n => n.path === route.path);
  return item ? t(item.labelKey || item.label) : 'ClassManager';
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
.layout { height: 100vh; }
.sidebar { background: #fff; border-right: 1px solid rgba(0,0,0,0.08); display: flex; flex-direction: column; padding: 0; }
.logo { padding: 18px 16px 14px; border-bottom: 1px solid rgba(0,0,0,0.08); }
.logo-line { font-size: 15px; font-weight: 600; color: #0F6E56; display:flex; align-items:center; gap:6px; }
.role-tag { font-size: 11px; color: #888; margin-top: 4px; }
.menu { flex: 1; border: none !important; overflow-y: auto; }
.menu :deep(.el-menu-item) { font-size: 13px; height: 38px; line-height: 38px; }
.footer { padding: 12px 14px; border-top: 1px solid rgba(0,0,0,0.08); }
.user-info { display:flex; align-items:center; gap: 10px; cursor: pointer; padding: 4px; border-radius: 6px; transition: all 0.15s; }
.user-info:hover { background: #f5f4f0; }
.info-text { flex: 1; }
.info-text .name { font-size: 13px; font-weight: 500; }
.info-text .role { font-size: 11px; color: #888; }
.header { background: #fff; border-bottom: 1px solid rgba(0,0,0,0.08); display:flex; align-items:center; justify-content:space-between; padding: 0 22px; }
.header-title { min-width: 0; display:flex; align-items:center; gap: 8px; }
.header h2 { font-size: 16px; font-weight: 600; margin: 0; }
.header-right { display:flex; align-items:center; gap: 10px; }
.main-content { background: #F5F4F0; padding: 18px 22px; }
.mobile-menu-button { display: none; }
.mobile-backdrop { display: none; }

@media (max-width: 768px) {
  .layout { height: 100dvh; }
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 220px !important;
    z-index: 2100;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    box-shadow: 0 12px 32px rgba(15, 110, 86, 0.18);
  }
  .sidebar.open { transform: translateX(0); }
  .mobile-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 2090;
    background: rgba(0,0,0,0.34);
  }
  .mobile-menu-button { display: inline-flex; flex: 0 0 auto; }
  .header { height: 56px; padding: 0 10px; gap: 8px; }
  .header h2 {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .header-right { gap: 4px; }
  .header-right :deep(.el-select) { width: 72px !important; }
  .main-content { padding: 12px 10px; }
}
</style>
