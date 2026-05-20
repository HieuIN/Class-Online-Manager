<template>
  <div>
    <div class="header-bar">
      <span class="section-title" style="margin:0">Lịch học – {{ currentMonth }}</span>
      <div>
        <el-button size="small" @click="changeMonth(-1)">← Tháng trước</el-button>
        <el-button size="small" @click="changeMonth(1)">Tháng sau →</el-button>
      </div>
    </div>

    <el-card class="mb-3">
      <template #header><span class="section-title">Sự kiện sắp tới</span></template>
      <div v-if="events.length === 0" class="empty">Không có sự kiện nào trong tháng này</div>
      <div v-for="(e, i) in events" :key="i" class="event-row" @click="openEvent(e)">
        <div class="event-date">{{ formatShort(e.startTime) }}</div>
        <div class="event-title">{{ e.title }}</div>
        <span :class="['badge', typeBadgeClass(e.eventType)]">{{ typeLabel(e.eventType) }}</span>
        <el-button v-if="eventMeetingUrl(e)" size="small" type="success" @click.stop="joinEvent(e)">Tham gia</el-button>
      </div>
    </el-card>

    <el-card>
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
import { calendarApi } from '@/api';
import dayjs from 'dayjs';

const currentDate = ref(dayjs());
const events = ref([]);
const showEvent = ref(false);
const selectedEvent = ref(null);

const currentMonth = computed(() => currentDate.value.format('MM/YYYY'));

const formatShort = (d) => dayjs(d).format('DD/MM HH:mm');
const formatEventTime = (e) => {
  const start = dayjs(e.startTime).format('DD/MM/YYYY HH:mm');
  return e.endTime ? `${start} - ${dayjs(e.endTime).format('HH:mm')}` : start;
};
const eventMeetingUrl = (e) => e?.meetingUrl || e?.meeting_url || '';
const openEvent = (e) => {
  selectedEvent.value = e;
  showEvent.value = true;
};
const joinEvent = (e) => {
  const url = eventMeetingUrl(e);
  if (url) window.open(url, '_blank');
};

const typeLabel = (t) => ({ SESSION: 'Buổi học', ASSIGNMENT_DUE: 'Deadline', EXAM: 'Kiểm tra' }[t] || 'Sự kiện');
const typeBadgeClass = (t) => ({ SESSION: 'badge-blue', ASSIGNMENT_DUE: 'badge-amber', EXAM: 'badge-red' }[t] || 'badge-gray');

const days = computed(() => {
  const start = currentDate.value.startOf('month');
  const end = currentDate.value.endOf('month');
  const startOfGrid = start.startOf('week').add(1, 'day'); // Monday-first
  const cells = [];
  let cur = startOfGrid;
  for (let i = 0; i < 35; i++) {
    const dayEvents = events.value.filter(e => dayjs(e.startTime).isSame(cur, 'day'));
    cells.push({
      date: cur.date(),
      inMonth: cur.month() === currentDate.value.month(),
      isToday: cur.isSame(dayjs(), 'day'),
      events: dayEvents,
    });
    cur = cur.add(1, 'day');
  }
  return cells;
});

const changeMonth = (delta) => { currentDate.value = currentDate.value.add(delta, 'month'); load(); };

const load = async () => {
  const start = currentDate.value.startOf('month').format('YYYY-MM-DD');
  const end = currentDate.value.endOf('month').format('YYYY-MM-DD');
  events.value = await calendarApi.list(start, end);
};

onMounted(load);
</script>

<style scoped>
.header-bar { display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px; }
.mb-3 { margin-bottom: 12px; }
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
</style>
