<template>
  <div>
    <div class="header-bar">
      <span class="section-title" style="margin:0">Lịch học - {{ viewMode === 'week' ? weekTitle : currentMonth }}</span>
      <div class="calendar-actions">
        <el-button size="small" @click="changePeriod(-1)">← {{ viewMode === 'week' ? 'Tuần trước' : 'Tháng trước' }}</el-button>
        <el-button size="small" @click="goToday">Hôm nay</el-button>
        <el-button size="small" @click="changePeriod(1)">{{ viewMode === 'week' ? 'Tuần sau' : 'Tháng sau' }} →</el-button>
        <el-button size="small" type="primary" plain :disabled="!classStore.selectedId" @click="exportIcs">Xuất .ics</el-button>
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
        <div class="event-date">{{ formatShort(e.startTime) }}</div>
        <div class="event-title">{{ e.title }}</div>
        <span :class="['badge', typeBadgeClass(e.eventType)]">{{ typeLabel(e.eventType) }}</span>
        <el-button v-if="eventMeetingUrl(e)" size="small" type="success" @click.stop="joinEvent(e)">Tham gia</el-button>
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
          <div class="meeting-url">{{ eventMeetingUrl(selectedEvent) }}</div>
          <el-button type="success" @click="joinEvent(selectedEvent)">Tham gia học</el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="showEvent = false">Đóng</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useClassStore } from '@/stores/class';
import { calendarApi } from '@/api';
import ClassPicker from '@/components/ClassPicker.vue';
import dayjs from 'dayjs';

const currentDate = ref(dayjs());
const events = ref([]);
const showEvent = ref(false);
const selectedEvent = ref(null);
const viewMode = ref('week');
const classStore = useClassStore();
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

const formatShort = (d) => dayjs(d).format('DD/MM HH:mm');
const eventTimeRange = (e) => {
  const start = dayjs(e.startTime).format('HH:mm');
  return e.endTime ? `${start}-${dayjs(e.endTime).format('HH:mm')}` : start;
};
const formatEventTime = (e) => {
  const start = dayjs(e.startTime).format('DD/MM/YYYY HH:mm');
  return e.endTime ? `${start} - ${dayjs(e.endTime).format('HH:mm')}` : start;
};
const eventMeetingUrl = (e) => e?.meetingUrl || e?.meeting_url || '';
const openEvent = (e) => { selectedEvent.value = e; showEvent.value = true; };
const joinEvent = (e) => { const url = eventMeetingUrl(e); if (url) window.open(url, '_blank'); };
const typeLabel = (t) => ({ SESSION: 'Buổi học', ASSIGNMENT_DUE: 'Deadline', EXAM: 'Kiểm tra' }[t] || 'Sự kiện');
const typeBadgeClass = (t) => ({ SESSION: 'badge-blue', ASSIGNMENT_DUE: 'badge-amber', EXAM: 'badge-red' }[t] || 'badge-gray');
const eventsForSlot = (day, hour) => events.value.filter(e => {
  const start = dayjs(e.startTime);
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
      events: events.value.filter(e => dayjs(e.startTime).isSame(cur, 'day')),
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

const load = async () => {
  const weekStart = currentDate.value.startOf('week').add(1, 'day');
  const start = viewMode.value === 'week' ? weekStart.format('YYYY-MM-DD') : currentDate.value.startOf('month').format('YYYY-MM-DD');
  const end = viewMode.value === 'week' ? weekStart.add(6, 'day').format('YYYY-MM-DD') : currentDate.value.endOf('month').format('YYYY-MM-DD');
  events.value = await calendarApi.list(start, end);
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
