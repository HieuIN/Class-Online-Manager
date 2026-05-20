<template>
  <div>
    <div class="header-bar">
      <span class="section-title" style="margin:0">Thông báo</span>
      <el-button size="small" @click="markAll">Đánh dấu đã đọc tất cả</el-button>
    </div>

    <el-card class="mb-4">
      <div v-if="notifications.length === 0" class="empty">Không có thông báo</div>
      <div v-for="n in notifications" :key="n.id" class="notif-row" @click="markOne(n)">
        <span class="notif-dot" :style="{ background: dotColor(n.notifType) }">{{ notifIcon(n.notifType) }}</span>
        <div class="notif-body">
          <div class="notif-title">
            {{ n.title }}
            <span :class="['badge', typeClass(n.notifType)]">{{ typeLabel(n.notifType) }}</span>
            <span v-if="!n.isRead" class="badge badge-red">Mới</span>
          </div>
          <div class="notif-content">{{ n.content }}</div>
          <div class="notif-time">{{ fmtTime(n.createdAt) }}</div>
        </div>
        <el-button v-if="n.relatedUrl" size="small" type="primary" plain @click.stop="openRelated(n)">Mở</el-button>
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
import dayjs from 'dayjs';

const auth = useAuthStore();
const classStore = useClassStore();
const canEdit = computed(() => auth.isTeacher || auth.isAdmin);
const notifications = ref([]);
const rule = reactive({ maxTotalAbsences: 3, maxConsecutiveAbsences: 2, maxMissingAssignments: 2 });

const dotColor = (t) => ({ ALERT_ABSENCE: '#E24B4A', ALERT_HOMEWORK: '#EF9F27', REMINDER: '#378ADD' }[t] || '#378ADD');
const notifIcon = (t) => ({ REMINDER: '⏰' }[t] || '');
const typeLabel = (t) => ({ ALERT_ABSENCE: 'Chuyên cần', ALERT_HOMEWORK: 'Bài tập', REMINDER: 'Nhắc lịch' }[t] || 'Thông báo');
const typeClass = (t) => ({ ALERT_ABSENCE: 'badge-red', ALERT_HOMEWORK: 'badge-amber', REMINDER: 'badge-blue' }[t] || 'badge-gray');
const fmtTime = (d) => dayjs(d).format('DD/MM/YYYY HH:mm');

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
};

const openRelated = async (n) => {
  await markOne(n);
  window.open(n.relatedUrl, '_blank');
};

const markAll = async () => {
  await notificationsApi.markAllRead();
  notifications.value.forEach(n => (n.isRead = true));
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
.header-bar { display:flex; justify-content:space-between; margin-bottom: 14px; }
.mb-4 { margin-bottom: 14px; }
.notif-row { display:flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f0f0ee; cursor: pointer; }
.notif-row:last-child { border-bottom: none; }
.notif-row:hover { background: #fafaf8; }
.notif-dot { width: 22px; height: 22px; border-radius: 50%; margin-top: 1px; flex-shrink: 0; display:flex; align-items:center; justify-content:center; font-size: 12px; color:#fff; }
.notif-body { flex: 1; }
.notif-title { font-size: 13px; font-weight: 500; margin-bottom: 3px; }
.notif-content { font-size: 12px; color: #666; }
.notif-time { font-size: 11px; color: #aaa; margin-top: 3px; }
.hint { font-size: 11px; color: #888; margin-left: 8px; }
.empty { padding: 30px; text-align: center; color: #aaa; }
</style>
