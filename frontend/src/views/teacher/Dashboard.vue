<template>
  <div>
    <el-row :gutter="14" class="mb-4">
      <el-col :span="6"><div class="metric-card"><div class="metric-label">Số lớp đang dạy</div><div class="metric-value">{{ classes.length }}</div><div class="metric-sub">{{ totalCourses }} khóa học</div></div></el-col>
      <el-col :span="6"><div class="metric-card"><div class="metric-label">Tổng học viên</div><div class="metric-value">{{ totalStudents }}</div><div class="metric-sub">Đang học</div></div></el-col>
      <el-col :span="6"><div class="metric-card"><div class="metric-label">Buổi đã dạy</div><div class="metric-value">{{ totalDone }}</div><div class="metric-sub">/ {{ totalPlanned }} buổi</div></div></el-col>
      <el-col :span="6"><div class="metric-card"><div class="metric-label">Cảnh báo mới</div><div class="metric-value" style="color:#E24B4A">{{ unreadCount }}</div><div class="metric-sub">Cần xử lý</div></div></el-col>
    </el-row>

    <el-row :gutter="14">
      <el-col :span="12">
        <el-card>
          <template #header><span class="section-title">Lớp học của tôi</span></template>
          <div v-for="c in classes" :key="c.id" class="class-row" @click="$router.push('/classes')">
            <div class="cr-top">
              <span class="cr-name">{{ c.name }}</span>
              <span class="badge badge-green">Đang học</span>
            </div>
            <div class="cr-meta">{{ c.studentCount }} học viên • {{ c.doneSessions }}/{{ c.total_sessions }} buổi</div>
            <el-progress :percentage="c.total_sessions ? Math.round(c.doneSessions/c.total_sessions*100) : 0" :show-text="false" :stroke-width="6" color="#1D9E75" />
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header><span class="section-title">Thông báo & Cảnh báo</span></template>
          <div v-if="notifications.length === 0" class="empty">Không có thông báo mới</div>
          <div v-for="n in notifications.slice(0,5)" :key="n.id" class="notif-row">
            <span class="notif-dot" :style="{ background: dotColor(n.notifType) }"></span>
            <div class="notif-body">
              <div class="notif-title">{{ n.title }} <span v-if="!n.isRead" class="badge badge-red">Mới</span></div>
              <div class="notif-content">{{ n.content }}</div>
              <div class="notif-time">{{ formatTime(n.createdAt) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useClassStore } from '@/stores/class';
import { notificationsApi } from '@/api';
import dayjs from 'dayjs';

const classStore = useClassStore();
const notifications = ref([]);
const unreadCount = computed(() => notifications.value.filter(n => !n.isRead).length);
const classes = computed(() => classStore.classes);
const totalCourses = computed(() => new Set(classes.value.map(c => c.course_id)).size);
const totalStudents = computed(() => classes.value.reduce((s, c) => s + (+c.studentCount || 0), 0));
const totalDone = computed(() => classes.value.reduce((s, c) => s + (+c.doneSessions || 0), 0));
const totalPlanned = computed(() => classes.value.reduce((s, c) => s + (+c.total_sessions || 0), 0));

const dotColor = (t) => ({ ALERT_ABSENCE: '#E24B4A', ALERT_HOMEWORK: '#EF9F27' }[t] || '#378ADD');
const formatTime = (d) => dayjs(d).fromNow ? dayjs(d).fromNow() : dayjs(d).format('DD/MM HH:mm');

onMounted(async () => {
  await classStore.fetchClasses();
  try { notifications.value = await notificationsApi.list(); } catch {}
});
</script>

<style scoped>
.mb-4 { margin-bottom: 14px; }
.class-row { padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.05); cursor: pointer; }
.class-row:last-child { border-bottom: none; }
.class-row:hover { background: #f9f9f7; }
.cr-top { display:flex; justify-content:space-between; margin-bottom: 6px; }
.cr-name { font-weight: 500; font-size: 13px; }
.cr-meta { font-size: 12px; color: #888; margin-bottom: 8px; }
.notif-row { display:flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.05); }
.notif-row:last-child { border-bottom: none; }
.notif-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 7px; flex-shrink: 0; }
.notif-title { font-size: 13px; font-weight: 500; }
.notif-content { font-size: 12px; color: #666; }
.notif-time { font-size: 11px; color: #aaa; margin-top: 2px; }
.empty { color: #aaa; padding: 20px; text-align: center; font-size: 13px; }
</style>
