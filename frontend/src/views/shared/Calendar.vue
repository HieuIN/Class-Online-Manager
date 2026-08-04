<template>
  <div>
    <div class="header-bar">
      <span class="section-title" style="margin:0">Lịch học - {{ viewMode === 'week' ? weekTitle : currentMonth }}</span>
      <div class="calendar-actions">
        <el-button size="small" @click="changePeriod(-1)">← {{ viewMode === 'week' ? 'Tuần trước' : 'Tháng trước' }}</el-button>
        <el-button size="small" @click="goToday">Hôm nay</el-button>
        <el-button size="small" @click="changePeriod(1)">{{ viewMode === 'week' ? 'Tuần sau' : 'Tháng sau' }} →</el-button>
        <el-button size="small" type="primary" plain :disabled="!classStore.selectedId" @click="exportIcs">Xuất .ics</el-button>
        <el-button v-if="canManage" size="small" type="primary" :disabled="!classStore.selectedId" @click="openCreateSession">+ Tạo lịch học</el-button>
      </div>
    </div>

    <ClassPicker @change="load" />
    <el-segmented v-model="viewMode" :options="viewOptions" class="view-switch" @change="load" />

    <el-card v-if="viewMode === 'week'" class="mb-3">
      <template #header><span class="section-title">Timetable tuần</span></template>
      <div class="week-scroll">
        <div class="week-grid">
          <div class="time-head"></div>
          <div v-for="d in weekDays" :key="d.key" :class="['week-head', { today: d.isToday }]">
            <b>{{ d.label }}</b>
            <span>{{ d.date }}</span>
          </div>
          <template v-for="hour in hours" :key="hour">
            <div class="time-cell">{{ hour }}:00</div>
            <div v-for="d in weekDays" :key="`${d.key}-${hour}`" class="week-cell">
              <div
                v-for="e in eventsForSlot(d.day, hour)"
                :key="`${e.eventType}-${e.id}`"
                :class="['week-event', typeBadgeClass(e.eventType)]"
                @click="openEvent(e)"
              >
                <b>{{ e.className || typeLabel(e.eventType) }}</b>
                <span>{{ eventTimeRange(e) }}</span>
                <em>{{ e.title }}</em>
              </div>
            </div>
          </template>
        </div>
      </div>
    </el-card>

    <el-card class="mb-3">
      <template #header><span class="section-title">Sự kiện sắp tới</span></template>
      <div v-if="events.length === 0" class="empty">Không có sự kiện nào trong khoảng này</div>
      <div v-for="(e, i) in events" :key="i" class="event-row" @click="openEvent(e)">
        <div class="event-date">{{ formatShort(e) }}</div>
        <div class="event-title">{{ e.title }}</div>
        <span :class="['badge', typeBadgeClass(e.eventType)]">{{ typeLabel(e.eventType) }}</span>
        <el-button v-if="canJoinEvent(e)" size="small" type="success" @click.stop="joinEvent(e)">Vào lớp</el-button>
        <span v-else-if="eventMeetingUrl(e) && e.eventType === 'SESSION'" class="join-hint">{{ joinHint(e) }}</span>
      </div>
    </el-card>

    <el-card v-if="viewMode === 'month'">
      <template #header><span class="section-title">Xem theo lưới tháng</span></template>
      <div class="cal-grid">
        <div v-for="d in ['T2','T3','T4','T5','T6','T7','CN']" :key="d" class="cal-head">{{ d }}</div>
        <div v-for="(day, i) in days" :key="i" :class="['cal-cell', { other: !day.inMonth, today: day.isToday }]">
          <div class="cal-day">{{ day.date }}</div>
          <div
            v-for="(e, j) in day.events"
            :key="j"
            :class="['cal-event', typeBadgeClass(e.eventType)]"
            :title="e.title"
            @click.stop="openEvent(e)"
          >
            {{ e.title }}
          </div>
        </div>
      </div>
    </el-card>

    <el-dialog v-model="showEvent" :title="selectedEvent?.title || 'Chi tiết sự kiện'" width="440px">
      <div v-if="selectedEvent" class="event-detail">
        <div class="detail-row"><span>Loại</span><b>{{ typeLabel(selectedEvent.eventType) }}</b></div>
        <div class="detail-row"><span>Lớp</span><b>{{ selectedEvent.className || '—' }}</b></div>
        <div class="detail-row"><span>Thời gian</span><b>{{ formatEventTime(selectedEvent) }}</b></div>
        <div v-if="eventMeetingUrl(selectedEvent)" class="meeting-box">
          <div><b>{{ meetingPlatform(selectedEvent) }}</b><div class="meeting-url">{{ eventMeetingUrl(selectedEvent) }}</div></div>
          <el-button v-if="canJoinEvent(selectedEvent)" type="success" @click="joinEvent(selectedEvent)">Vào lớp</el-button>
          <span v-else class="join-hint">{{ joinHint(selectedEvent) }}</span>
        </div>
      </div>
      <template #footer>
        <el-button v-if="canManage && selectedEvent?.eventType === 'SESSION'" type="primary" plain @click="openEditSession(selectedEvent)">Sửa lịch học</el-button>
        <el-button @click="showEvent = false">Đóng</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showCreate" :title="editingSessionId ? 'Sửa lịch học' : 'Tạo lịch học'" width="500px">
      <el-form label-position="top">
        <el-form-item label="Lớp"><el-input :model-value="classStore.selected?.name" disabled /></el-form-item>
        <el-form-item label="Chủ đề buổi học"><el-input v-model="sessionForm.topic" placeholder="VD: Ngữ pháp Bài 3" /></el-form-item>
        <el-form-item label="Ngày học">
          <el-date-picker v-model="sessionForm.plannedDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="Bắt đầu"><el-time-picker v-model="sessionForm.startTime" format="HH:mm" value-format="HH:mm" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="Kết thúc"><el-time-picker v-model="sessionForm.endTime" format="HH:mm" value-format="HH:mm" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="Nền tảng học trực tuyến">
          <el-radio-group v-model="sessionForm.platform">
            <el-radio-button label="GOOGLE_MEET">Google Meet</el-radio-button>
            <el-radio-button label="TEAMS">Microsoft Teams</el-radio-button>
            <el-radio-button label="ZOOM">Zoom</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="Đường dẫn phòng học">
          <el-input v-model="sessionForm.meetingUrl" :placeholder="meetingPlaceholder">
            <template #append><el-button @click="openMeetingCreator">Tạo phòng</el-button></template>
          </el-input>
          <div class="form-tip">Mở trang tạo phòng, sau đó dán đường dẫn mời vào đây.</div>
        </el-form-item>
        <el-form-item label="Ghi chú"><el-input v-model="sessionForm.note" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">Hủy</el-button>
        <el-button type="primary" :loading="saving" @click="saveSession">{{ editingSessionId ? 'Lưu thay đổi' : 'Tạo lịch học' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { useClassStore } from '@/stores/class';
import { useAuthStore } from '@/stores/auth';
import { calendarApi, sessionsApi } from '@/api';
import ClassPicker from '@/components/ClassPicker.vue';
import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';

const currentDate = ref(dayjs());
const events = ref([]);
const showEvent = ref(false);
const selectedEvent = ref(null);
const showCreate = ref(false);
const editingSessionId = ref(null);
const saving = ref(false);
const viewMode = ref('week');
const classStore = useClassStore();
const auth = useAuthStore();
const canManage = computed(() => auth.isTeacher || auth.isAdmin);
const sessionForm = reactive({ topic: '', plannedDate: '', startTime: '19:00', endTime: '21:00', platform: 'GOOGLE_MEET', meetingUrl: '', note: '' });
const viewOptions = [{ label: 'Tuần', value: 'week' }, { label: 'Tháng', value: 'month' }];
const hours = Array.from({ length: 16 }, (_, i) => i + 7);

const currentMonth = computed(() => currentDate.value.format('MM/YYYY'));
const weekTitle = computed(() => `${currentDate.value.startOf('week').add(1, 'day').format('DD/MM')} - ${currentDate.value.startOf('week').add(7, 'day').format('DD/MM/YYYY')}`);
const weekDays = computed(() => {
  const monday = currentDate.value.startOf('week').add(1, 'day');
  return Array.from({ length: 7 }, (_, i) => {
    const day = monday.add(i, 'day');
    return { key: day.format('YYYY-MM-DD'), day, label: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][i], date: day.format('DD/MM'), isToday: day.isSame(dayjs(), 'day') };
  });
});

const eventDateTime = (e, field = 'startTime') => {
  const value = e?.[field];
  if (!value) return null;
  // Session date + time is stored as a timezone-less classroom wall clock.
  // PostgreSQL serializes it with Z, so remove that suffix to avoid adding UTC+7 twice.
  return dayjs(e.eventType === 'SESSION' ? String(value).replace(/Z$/, '') : value);
};
const formatShort = (e) => eventDateTime(e)?.format('DD/MM HH:mm') || '';
const eventTimeRange = (e) => {
  const start = eventDateTime(e)?.format('HH:mm') || '';
  return e.endTime ? `${start}-${eventDateTime(e, 'endTime').format('HH:mm')}` : start;
};
const formatEventTime = (e) => {
  const start = eventDateTime(e)?.format('DD/MM/YYYY HH:mm') || '';
  return e.endTime ? `${start} - ${eventDateTime(e, 'endTime').format('HH:mm')}` : start;
};
const eventMeetingUrl = (e) => e?.meetingUrl || e?.meeting_url || '';
const meetingPlatform = (e) => {
  const url = eventMeetingUrl(e).toLowerCase();
  if (url.includes('teams.microsoft.com')) return 'Microsoft Teams';
  if (url.includes('zoom.us')) return 'Zoom';
  if (url.includes('meet.google.com')) return 'Google Meet';
  return 'Phòng học trực tuyến';
};
const canJoinEvent = (e) => {
  if (!eventMeetingUrl(e)) return false;
  if (e.eventType !== 'SESSION') return true;
  const now = dayjs();
  const start = eventDateTime(e);
  const end = e.endTime ? eventDateTime(e, 'endTime') : start.add(2, 'hour');
  return now.isAfter(start.subtract(15, 'minute')) && now.isBefore(end.add(30, 'minute'));
};
const joinHint = (e) => {
  const start = eventDateTime(e);
  if (dayjs().isBefore(start.subtract(15, 'minute'))) return `Mở trước giờ học 15 phút`;
  return 'Buổi học đã kết thúc';
};
const openEvent = (e) => { selectedEvent.value = e; showEvent.value = true; };
const joinEvent = (e) => { const url = eventMeetingUrl(e); if (url) window.open(url, '_blank'); };
const typeLabel = (t) => ({ SESSION: 'Buổi học', ASSIGNMENT_DUE: 'Deadline', EXAM: 'Kiểm tra' }[t] || 'Sự kiện');
const typeBadgeClass = (t) => ({ SESSION: 'badge-blue', ASSIGNMENT_DUE: 'badge-amber', EXAM: 'badge-red' }[t] || 'badge-gray');
const eventsForSlot = (day, hour) => events.value.filter(e => {
  const start = eventDateTime(e);
  return start.isSame(day, 'day') && start.hour() === hour;
});

const days = computed(() => {
  const start = currentDate.value.startOf('month');
  const startOfGrid = start.startOf('week').add(1, 'day');
  const cells = [];
  let cur = startOfGrid;
  for (let i = 0; i < 35; i++) {
    cells.push({
      date: cur.date(),
      inMonth: cur.month() === currentDate.value.month(),
      isToday: cur.isSame(dayjs(), 'day'),
      events: events.value.filter(e => eventDateTime(e).isSame(cur, 'day')),
    });
    cur = cur.add(1, 'day');
  }
  return cells;
});

const changePeriod = (delta) => {
  currentDate.value = viewMode.value === 'week' ? currentDate.value.add(delta, 'week') : currentDate.value.add(delta, 'month');
  load();
};
const goToday = () => { currentDate.value = dayjs(); load(); };
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
const exportIcs = async () => {
  if (!classStore.selectedId) return;
  const blob = await calendarApi.exportIcs(classStore.selectedId);
  downloadBlob(blob, `lich-hoc-${classStore.selected?.name || 'class'}.ics`);
};

const meetingCreators = {
  GOOGLE_MEET: 'https://meet.google.com/new',
  TEAMS: 'https://teams.microsoft.com/v2/',
  ZOOM: 'https://zoom.us/meeting/schedule',
};
const meetingPlaceholder = computed(() => ({
  GOOGLE_MEET: 'https://meet.google.com/xxx-xxxx-xxx',
  TEAMS: 'https://teams.microsoft.com/l/meetup-join/...',
  ZOOM: 'https://zoom.us/j/...',
}[sessionForm.platform]));
const openMeetingCreator = () => window.open(meetingCreators[sessionForm.platform], '_blank', 'noopener');
const openCreateSession = () => {
  editingSessionId.value = null;
  Object.assign(sessionForm, { topic: '', plannedDate: dayjs().format('YYYY-MM-DD'), startTime: '19:00', endTime: '21:00', platform: 'GOOGLE_MEET', meetingUrl: '', note: '' });
  showCreate.value = true;
};
const platformFromUrl = (url) => {
  const value = String(url || '').toLowerCase();
  if (value.includes('teams.microsoft.com')) return 'TEAMS';
  if (value.includes('zoom.us')) return 'ZOOM';
  return 'GOOGLE_MEET';
};
const openEditSession = (e) => {
  editingSessionId.value = e.id;
  const start = eventDateTime(e);
  const end = eventDateTime(e, 'endTime');
  const meetingUrl = eventMeetingUrl(e);
  Object.assign(sessionForm, {
    topic: e.title || '', plannedDate: start.format('YYYY-MM-DD'), startTime: start.format('HH:mm'),
    endTime: end?.format('HH:mm') || start.add(2, 'hour').format('HH:mm'),
    platform: platformFromUrl(meetingUrl), meetingUrl, note: '',
  });
  showEvent.value = false;
  showCreate.value = true;
};
const validMeetingUrl = () => {
  if (!sessionForm.meetingUrl) return true;
  try {
    const host = new URL(sessionForm.meetingUrl).hostname.toLowerCase();
    return ({ GOOGLE_MEET: ['meet.google.com'], TEAMS: ['teams.microsoft.com'], ZOOM: ['zoom.us'] }[sessionForm.platform] || []).some(domain => host === domain || host.endsWith(`.${domain}`));
  } catch { return false; }
};
const saveSession = async () => {
  if (!sessionForm.topic.trim() || !sessionForm.plannedDate || !sessionForm.startTime || !sessionForm.endTime) { ElMessage.warning('Nhập đầy đủ chủ đề, ngày và giờ học'); return; }
  if (sessionForm.endTime <= sessionForm.startTime) { ElMessage.warning('Giờ kết thúc phải sau giờ bắt đầu'); return; }
  if (!validMeetingUrl()) { ElMessage.warning('Đường dẫn không đúng với nền tảng đã chọn'); return; }
  saving.value = true;
  try {
    const data = { plannedDate: sessionForm.plannedDate, startTime: sessionForm.startTime, endTime: sessionForm.endTime, topic: sessionForm.topic.trim(), meetingUrl: sessionForm.meetingUrl.trim() || null };
    if (editingSessionId.value) {
      await sessionsApi.update(editingSessionId.value, data);
      ElMessage.success('Đã cập nhật lịch học và đường dẫn phòng');
    } else {
      const existing = await sessionsApi.list(classStore.selectedId);
      const nextNo = Math.max(0, ...existing.map(s => Number(s.session_no || s.sessionNo || 0))) + 1;
      await sessionsApi.create({ classId: classStore.selectedId, sessionNo: nextNo, ...data, status: 'PLANNED', note: sessionForm.note.trim() || null });
      ElMessage.success('Đã tạo lịch học và lên lịch nhắc lớp');
    }
    showCreate.value = false;
    await load();
  } finally { saving.value = false; }
};

const load = async () => {
  const weekStart = currentDate.value.startOf('week').add(1, 'day');
  const start = viewMode.value === 'week' ? weekStart.format('YYYY-MM-DD') : currentDate.value.startOf('month').format('YYYY-MM-DD');
  const end = viewMode.value === 'week' ? weekStart.add(6, 'day').format('YYYY-MM-DD') : currentDate.value.endOf('month').format('YYYY-MM-DD');
  const allEvents = await calendarApi.list(start, end);
  const selectedClassId = Number(classStore.selectedId || 0);
  events.value = selectedClassId ? allEvents.filter(e => Number(e.classId || e.class_id) === selectedClassId) : allEvents;
};

onMounted(load);
</script>

<style scoped>
.header-bar { display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px; }
.calendar-actions { display:flex; flex-wrap:wrap; gap: 6px; justify-content:flex-end; }
.view-switch { margin-bottom: 12px; }
.mb-3 { margin-bottom: 12px; }
.week-scroll { overflow-x: auto; }
.week-grid { min-width: 860px; display:grid; grid-template-columns: 58px repeat(7, 1fr); border: 1px solid #f0f0ee; border-radius: 8px; overflow: hidden; }
.time-head, .week-head, .time-cell, .week-cell { border-right: 1px solid #f0f0ee; border-bottom: 1px solid #f0f0ee; }
.week-head { background:#fafaf8; padding: 8px; text-align:center; display:flex; flex-direction:column; gap:2px; font-size: 12px; }
.week-head.today { background:#E1F5EE; color:#0F6E56; }
.time-cell { background:#fafaf8; color:#888; font-size: 11px; padding: 8px 6px; text-align:center; min-height: 62px; }
.week-cell { min-height: 62px; padding: 4px; background:#fff; }
.week-event { border-radius: 6px; padding: 5px 6px; font-size: 11px; cursor:pointer; display:flex; flex-direction:column; gap:2px; }
.week-event b, .week-event em { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.week-event em { font-style: normal; opacity: 0.9; }
.event-row { display:flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f0f0ee; align-items:center; cursor: pointer; }
.event-row:last-child { border-bottom: none; }
.event-row:hover { background: #fafaf8; }
.event-date { font-size: 12px; font-weight: 500; min-width: 95px; color: #666; }
.event-title { font-size: 13px; flex: 1; }
.join-hint { color:#888; font-size:11px; white-space:nowrap; }
.form-tip { margin-top:6px; color:#888; font-size:11px; }
.empty { padding: 20px; text-align: center; color: #aaa; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.cal-head { padding: 6px; text-align: center; font-size: 11px; color: #888; font-weight: 600; }
.cal-cell { min-height: 80px; padding: 5px; background: #f5f4f0; border-radius: 6px; font-size: 11px; }
.cal-cell.other { background: #fafaf8; color: #ccc; }
.cal-cell.today { background: #E1F5EE; border: 1px solid #1D9E75; }
.cal-day { font-weight: 600; margin-bottom: 3px; }
.cal-event { padding: 2px 5px; border-radius: 3px; margin-top: 2px; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.event-detail { display:flex; flex-direction:column; gap: 10px; }
.detail-row { display:flex; justify-content:space-between; gap: 16px; font-size: 13px; }
.detail-row span { color: #888; }
.meeting-box { margin-top: 6px; padding: 12px; background: #E1F5EE; border-radius: 8px; display:flex; align-items:center; justify-content:space-between; gap: 12px; }
.meeting-url { min-width: 0; color: #0F6E56; font-size: 12px; word-break: break-all; }
@media (max-width: 768px) {
  .header-bar { align-items:flex-start; flex-direction:column; gap: 10px; }
  .calendar-actions { justify-content:flex-start; }
  .cal-grid { min-width: 640px; }
}
</style>
