<template>
  <div>
    <div class="header-bar">
      <span class="section-title" style="margin:0">Thông báo</span>
      <el-button size="small" @click="markAll">Đánh dấu đã đọc tất cả</el-button>
    </div>

    <el-card class="mb-4">
      <div v-if="visibleNotifications.length === 0" class="empty">Không có thông báo cần xử lý</div>
      <div v-for="n in visibleNotifications" :key="n.id" :class="['notif-row', { unread: !n.isRead }]" @click="openNotification(n)">
        <span class="notif-dot" :style="{ background: dotColor(n.notifType) }">{{ notifIcon(n.notifType) }}</span>
        <div class="notif-body">
          <div class="notif-title">
            {{ n.title }}
            <span :class="['badge', typeClass(n.notifType)]">{{ typeLabel(n.notifType) }}</span>
            <span v-if="!n.isRead" class="badge badge-red">Mới</span>
          </div>
          <div class="notif-content">{{ notificationContent(n.content) }}</div>
          <div v-if="notificationSchedule(n)" class="notif-schedule">{{ notificationSchedule(n) }}</div>
          <div class="notif-time">{{ notificationTime(n.createdAt) }}</div>
        </div>
        <el-button size="small" type="primary" plain @click.stop="openNotification(n)">Xem</el-button>
      </div>
    </el-card>

    <el-card v-if="canEdit && classStore.selected">
      <template #header><span class="section-title">Cài đặt cảnh báo tự động – {{ classStore.selected.name }}</span></template>
      <el-form label-position="top">
        <el-form-item label="Vắng quá X buổi (tổng)">
          <el-input-number v-model="rule.maxTotalAbsences" :min="0" />
          <span class="hint">Cảnh báo khi học viên vắng nhiều hơn số buổi này</span>
        </el-form-item>
        <el-form-item label="Vắng liên tiếp Y buổi">
          <el-input-number v-model="rule.maxConsecutiveAbsences" :min="0" />
          <span class="hint">Cảnh báo khi vắng liên tiếp</span>
        </el-form-item>
        <el-form-item label="Không nộp N bài">
          <el-input-number v-model="rule.maxMissingAssignments" :min="0" />
          <span class="hint">Cảnh báo khi không nộp nhiều bài liên tiếp</span>
        </el-form-item>
        <el-button type="primary" @click="saveRule">Lưu cài đặt</el-button>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useClassStore } from '@/stores/class';
import { ElMessage } from 'element-plus';
import { notificationsApi } from '@/api';
import { useRouter } from 'vue-router';
import { notificationContent, notificationIsVisible, notificationSchedule, notificationTarget, notificationTime } from '@/utils/notification';

const auth = useAuthStore();
const classStore = useClassStore();
const router = useRouter();
const canEdit = computed(() => auth.isTeacher || auth.isAdmin);
const notifications = ref([]);
const visibleNotifications = computed(() => notifications.value.filter(notificationIsVisible));
const rule = reactive({ maxTotalAbsences: 3, maxConsecutiveAbsences: 2, maxMissingAssignments: 2 });

const dotColor = (t) => ({ ALERT_ABSENCE: '#E24B4A', ALERT_HOMEWORK: '#EF9F27', ASSIGNMENT_DUE: '#EF9F27', ASSIGNMENT_PUBLISHED: '#1D9E75', REMINDER: '#378ADD' }[t] || '#73808c');
const notifIcon = (t) => ({ REMINDER: '⏰', ALERT_ABSENCE: '!', ALERT_HOMEWORK: '!', ASSIGNMENT_DUE: '!', ASSIGNMENT_PUBLISHED: '✓' }[t] || '');
const typeLabel = (t) => ({ ALERT_ABSENCE: 'Cảnh báo chuyên cần', ALERT_HOMEWORK: 'Cảnh báo bài tập', ASSIGNMENT_DUE: 'Sắp đến hạn', ASSIGNMENT_PUBLISHED: 'Bài tập mới', REMINDER: 'Nhắc lịch học' }[t] || 'Thông báo');
const typeClass = (t) => ({ ALERT_ABSENCE: 'badge-red', ALERT_HOMEWORK: 'badge-amber', ASSIGNMENT_DUE: 'badge-amber', ASSIGNMENT_PUBLISHED: 'badge-green', REMINDER: 'badge-blue' }[t] || 'badge-gray');

const load = async () => {
  notifications.value = await notificationsApi.list();
  if (canEdit.value && classStore.selectedId) {
    try {
      const r = await notificationsApi.getRule(classStore.selectedId);
      if (r) Object.assign(rule, r);
    } catch {}
  }
};

const markOne = async (n) => {
  if (n.isRead) return;
  await notificationsApi.markRead(n.id);
  n.isRead = true;
  window.dispatchEvent(new CustomEvent('notifications:read-change', { detail: { delta: -1 } }));
};

const openNotification = async (n) => {
  await markOne(n);
  router.push(notificationTarget(n, auth.role));
};

const markAll = async () => {
  await notificationsApi.markAllRead();
  notifications.value.forEach(n => (n.isRead = true));
  window.dispatchEvent(new CustomEvent('notifications:read-change', { detail: { unread: 0 } }));
  ElMessage.success('Đã đánh dấu tất cả');
};

const saveRule = async () => {
  await notificationsApi.setRule(classStore.selectedId, rule);
  ElMessage.success('Đã lưu cài đặt');
};

watch(() => classStore.selectedId, load);
onMounted(load);
</script>

<style scoped>
.notif-schedule { color: var(--brand-700); font-size: 12px; font-weight: 700; margin-top: 5px; }
.header-bar { display:flex; justify-content:space-between; margin-bottom: 14px; }
.mb-4 { margin-bottom: 14px; }
.notif-row { display:flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f0f0ee; cursor: pointer; }
.notif-row:last-child { border-bottom: none; }
.notif-row:hover { background: #fafaf8; }
.notif-row.unread { background:rgba(55,138,221,.04); }
.notif-dot { width: 22px; height: 22px; border-radius: 50%; margin-top: 1px; flex-shrink: 0; display:flex; align-items:center; justify-content:center; font-size: 12px; color:#fff; }
.notif-body { flex: 1; }
.notif-title { font-size: 13px; font-weight: 500; margin-bottom: 3px; }
.notif-content { font-size: 12px; color: #666; }
.notif-time { font-size: 11px; color: #aaa; margin-top: 3px; }
.hint { font-size: 11px; color: #888; margin-left: 8px; }
.empty { padding: 30px; text-align: center; color: #aaa; }
</style>
