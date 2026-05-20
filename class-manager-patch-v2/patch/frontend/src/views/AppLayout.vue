<template>
  <el-container class="layout">
    <el-aside width="220px" class="sidebar">
      <div class="logo">
        <div class="logo-line">🎓 <span>ClassManager</span></div>
        <div class="role-tag">{{ roleLabel }}</div>
      </div>
      <el-menu :default-active="$route.path" router class="menu">
        <el-menu-item v-for="item in navItems" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </el-menu-item>
      </el-menu>
      <div class="footer">
        <el-dropdown trigger="click" placement="top-start">
          <div class="user-info">
            <el-avatar :size="34" style="background:#E1F5EE;color:#0F6E56;font-weight:600">{{ initials(auth.user?.fullName) }}</el-avatar>
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
        <h2>{{ pageTitle }}</h2>
        <div class="header-right">
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
import { computed, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useClassStore } from '@/stores/class';
import { notificationsApi } from '@/api';
import { initials } from '@/utils/format';
import {
  House, School, Select, Histogram, Document, TrendCharts, Folder, Calendar,
  PieChart, Money, Bell, SwitchButton, User, CaretTop, UserFilled, Reading,
} from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const classStore = useClassStore();
const unread = ref(0);

const roleLabel = computed(() => ({ TEACHER: 'Giáo viên', STUDENT: 'Học viên', ADMIN: 'Quản trị viên' }[auth.role] || ''));

const teacherNav = [
  { path: '/dashboard', label: 'Tổng quan', icon: House },
  { path: '/classes', label: 'Quản lý lớp', icon: School },
  { path: '/attendance', label: 'Điểm danh', icon: Select },
  { path: '/grades', label: 'Quản lý điểm', icon: Histogram },
  { path: '/assignments', label: 'Bài tập', icon: Document },
  { path: '/progress', label: 'Tiến độ', icon: TrendCharts },
  { path: '/materials', label: 'Tài liệu', icon: Folder },
  { path: '/calendar', label: 'Lịch học', icon: Calendar },
  { path: '/analytics', label: 'Báo cáo', icon: PieChart },
  { path: '/payments', label: 'Học phí', icon: Money },
  { path: '/notifications', label: 'Thông báo', icon: Bell },
];

const studentNav = [
  { path: '/student/dashboard', label: 'Tổng quan', icon: House },
  { path: '/student/grades', label: 'Điểm của tôi', icon: Histogram },
  { path: '/student/assignments', label: 'Bài tập', icon: Document },
  { path: '/student/attendance', label: 'Điểm danh', icon: Select },
  { path: '/materials', label: 'Tài liệu', icon: Folder },
  { path: '/calendar', label: 'Lịch học', icon: Calendar },
  { path: '/notifications', label: 'Thông báo', icon: Bell },
];

const adminNav = [
  { path: '/admin/dashboard', label: 'Tổng quan', icon: House },
  { path: '/admin/users', label: 'Người dùng', icon: UserFilled },
  { path: '/admin/courses', label: 'Khóa học', icon: Reading },
  { path: '/classes', label: 'Quản lý lớp', icon: School },
  { path: '/payments', label: 'Học phí', icon: Money },
  { path: '/analytics', label: 'Báo cáo', icon: PieChart },
  { path: '/notifications', label: 'Thông báo', icon: Bell },
];

const navItems = computed(() => {
  if (auth.isStudent) return studentNav;
  if (auth.isAdmin) return adminNav;
  return teacherNav;
});

const pageTitle = computed(() => {
  if (route.path === '/profile') return 'Hồ sơ cá nhân';
  return navItems.value.find(n => n.path === route.path)?.label || 'ClassManager';
});

const logout = () => { auth.logout(); router.push('/login'); };

const loadUnread = async () => {
  try { const r = await notificationsApi.unreadCount(); unread.value = +r || 0; } catch {}
};

onMounted(async () => {
  await classStore.fetchClasses();
  loadUnread();
  setInterval(loadUnread, 60000);
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
.header h2 { font-size: 16px; font-weight: 600; margin: 0; }
.header-right { display:flex; align-items:center; gap: 10px; }
.main-content { background: #F5F4F0; padding: 18px 22px; }
</style>
