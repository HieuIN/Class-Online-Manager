<template>
  <div class="page-shell teacher-dashboard">
    <div class="page-heading">
      <div>
        <span class="eyebrow">Không gian giảng dạy</span>
        <h1>Công việc hôm nay</h1>
        <p>Giữ nhịp lớp học, theo dõi tiến độ và xử lý các việc cần chú ý.</p>
      </div>
      <div class="page-actions">
        <el-button @click="$router.push('/calendar')">Xem lịch học</el-button>
        <el-button type="primary" @click="$router.push('/classes')">Mở quản lý lớp</el-button>
      </div>
    </div>

    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-label">Lớp đang dạy</div>
        <div class="metric-value">{{ classes.length }}</div>
        <div class="metric-sub">{{ totalCourses }} khóa học</div>
      </div>
      <div class="metric-card tone-blue">
        <div class="metric-label">Học viên đang theo học</div>
        <div class="metric-value">{{ totalStudents }}</div>
        <div class="metric-sub">Trong các lớp phụ trách</div>
      </div>
      <div class="metric-card tone-gold">
        <div class="metric-label">Tiến độ buổi học</div>
        <div class="metric-value">{{ totalDone }}</div>
        <div class="metric-sub">Đã dạy trên {{ totalPlanned }} buổi</div>
      </div>
      <div class="metric-card tone-red">
        <div class="metric-label">Cần xử lý</div>
        <div class="metric-value">{{ unreadCount }}</div>
        <div class="metric-sub">Thông báo chưa đọc</div>
      </div>
    </div>

    <div class="content-grid">
      <el-card>
        <template #header>
          <div class="panel-heading">
            <div>
              <div class="section-title">Lớp học của tôi</div>
              <div class="section-helper">Chọn lớp để tiếp tục công việc</div>
            </div>
            <el-button text type="primary" @click="$router.push('/classes')">Quản lý lớp</el-button>
          </div>
        </template>
        <div v-if="classes.length === 0" class="empty-state">Bạn chưa được phân công lớp học nào.</div>
        <button v-for="c in classes" :key="c.id" class="class-row" type="button" @click="$router.push('/classes')">
          <span class="class-index">{{ String(c.id).padStart(2, '0') }}</span>
          <span class="class-row-content">
            <span class="cr-top">
              <strong class="cr-name">{{ c.name }}</strong>
              <span class="badge badge-green">Đang học</span>
            </span>
            <span class="cr-meta">{{ c.studentCount }} học viên · {{ c.doneSessions }}/{{ c.total_sessions }} buổi</span>
            <span class="class-progress-line">
              <el-progress :percentage="c.total_sessions ? Math.round(c.doneSessions / c.total_sessions * 100) : 0" :show-text="false" :stroke-width="5" />
              <small>{{ c.total_sessions ? Math.round(c.doneSessions / c.total_sessions * 100) : 0 }}%</small>
            </span>
          </span>
        </button>
      </el-card>

      <el-card>
        <template #header>
          <div class="panel-heading">
            <div>
              <div class="section-title">Thông báo và cảnh báo</div>
              <div class="section-helper">Các việc mới nhất cần kiểm tra</div>
            </div>
            <el-button text type="primary" @click="$router.push('/notifications')">Tất cả</el-button>
          </div>
        </template>
        <div v-if="notifications.length === 0" class="empty-state">Không có thông báo mới.</div>
        <button v-for="n in notifications.slice(0, 5)" :key="n.id" type="button" :class="['notif-row', { unread: !n.isRead }]" @click="openNotification(n)">
          <span class="notif-dot" :style="{ background: dotColor(n.notifType) }"></span>
          <div class="notif-body">
            <div class="notif-title">{{ n.title }} <span v-if="!n.isRead" class="badge badge-red">Mới</span></div>
            <div class="notif-content">{{ notificationContent(n.content) }}</div>
            <div v-if="notificationSchedule(n)" class="notif-schedule">{{ notificationSchedule(n) }}</div>
            <div class="notif-time">{{ notificationTime(n.createdAt) }}</div>
          </div>
          <span class="notif-arrow">›</span>
        </button>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useClassStore } from '@/stores/class';
import { notificationsApi } from '@/api';
import { notificationContent, notificationSchedule, notificationTarget, notificationTime } from '@/utils/notification';

const classStore = useClassStore();
const router = useRouter();
const notifications = ref([]);
const unreadCount = computed(() => notifications.value.filter(n => !n.isRead).length);
const classes = computed(() => classStore.classes);
const totalCourses = computed(() => new Set(classes.value.map(c => c.course_id)).size);
const totalStudents = computed(() => classes.value.reduce((s, c) => s + (+c.studentCount || 0), 0));
const totalDone = computed(() => classes.value.reduce((s, c) => s + (+c.doneSessions || 0), 0));
const totalPlanned = computed(() => classes.value.reduce((s, c) => s + (+c.total_sessions || 0), 0));

const dotColor = (t) => ({ ALERT_ABSENCE: '#E24B4A', ALERT_HOMEWORK: '#EF9F27', ASSIGNMENT_DUE: '#EF9F27', ASSIGNMENT_PUBLISHED: '#1D9E75', REMINDER: '#378ADD' }[t] || '#73808c');
const openNotification = async (n) => {
  if (!n.isRead) {
    await notificationsApi.markRead(n.id);
    n.isRead = true;
    window.dispatchEvent(new CustomEvent('notifications:read-change', { detail: { delta: -1 } }));
  }
  router.push(notificationTarget(n, 'TEACHER'));
};

onMounted(async () => {
  await classStore.fetchClasses();
  try { notifications.value = await notificationsApi.list(); } catch {}
});
</script>

<style scoped>
.page-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.notif-schedule { color: var(--brand-700); font-size: 12px; font-weight: 700; margin-top: 5px; }
.class-row { background: transparent; border: 0; border-bottom: 1px solid var(--border); cursor: pointer; display: flex; gap: 12px; padding: 14px 0; text-align: left; width: 100%; }
.class-row:first-of-type { padding-top: 2px; }
.class-row:last-child { border-bottom: 0; padding-bottom: 2px; }
.class-row:hover .cr-name { color: var(--brand-700); }
.class-index { align-items: center; background: var(--surface-soft); border-radius: 7px; color: var(--brand-700); display: inline-flex; font-size: 11px; font-weight: 800; height: 30px; justify-content: center; margin-top: 1px; width: 30px; }
.class-row-content { min-width: 0; flex: 1; }
.cr-top { align-items: center; display: flex; gap: 10px; justify-content: space-between; margin-bottom: 4px; }
.cr-name { color: var(--ink-900); font-size: 14px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cr-meta { color: var(--ink-500); display: block; font-size: 12px; margin-bottom: 9px; }
.class-progress-line { align-items: center; display: flex; gap: 8px; }
.class-progress-line :deep(.el-progress) { flex: 1; }
.class-progress-line small { color: var(--ink-500); font-size: 11px; font-weight: 700; width: 30px; }
.notif-row { align-items:flex-start; background:transparent; border:0; border-bottom: 1px solid var(--border); cursor:pointer; display: flex; gap: 11px; padding: 13px 8px; text-align:left; width:100%; }
.notif-row:last-child { border-bottom: 0; padding-bottom: 1px; }
.notif-row:hover { background:var(--surface-soft); }
.notif-row.unread { background:rgba(55,138,221,.035); }
.notif-dot { border-radius: 50%; flex: 0 0 auto; height: 8px; margin-top: 6px; width: 8px; }
.notif-body { flex:1; min-width: 0; }
.notif-arrow { color:var(--ink-400); font-size:22px; line-height:1; margin-top:2px; }
.notif-title { align-items: center; color: var(--ink-900); display: flex; flex-wrap: wrap; font-size: 13px; font-weight: 800; gap: 6px; }
.notif-content { color: var(--ink-500); font-size: 12px; line-height: 1.45; margin-top: 3px; }
.notif-time { color: var(--ink-400); font-size: 11px; margin-top: 5px; }
@media (max-width: 768px) {
  .page-actions { width: 100%; }
  .page-actions :deep(.el-button) { flex: 1; margin-left: 0; }
}
</style>
