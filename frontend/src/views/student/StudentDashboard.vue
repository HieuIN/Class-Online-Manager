<template>
  <div>
    <ClassPicker @change="reload" />

    <el-row :gutter="14" class="mb-4">
      <el-col :span="6"><div class="metric-card"><div class="metric-label">Chuyên cần</div><div class="metric-value">{{ attendancePct }}%</div><div class="metric-sub">{{ attStats.present }}/{{ attStats.total }} buổi</div></div></el-col>
      <el-col :span="6"><div class="metric-card"><div class="metric-label">Điểm TB</div><div class="metric-value">{{ avg.average || '—' }}</div><div class="metric-sub">{{ classification }}</div></div></el-col>
      <el-col :span="6"><div class="metric-card"><div class="metric-label">Bài cần nộp</div><div class="metric-value" style="color:#EF9F27">{{ pendingAssign.length }}</div></div></el-col>
      <el-col :span="6"><div class="metric-card"><div class="metric-label">Thông báo</div><div class="metric-value" style="color:#378ADD">{{ unreadNotif }}</div></div></el-col>
    </el-row>

    <el-row :gutter="14">
      <el-col :span="12">
        <el-card class="mb-4">
          <template #header><span class="section-title">Buổi học sắp tới</span></template>
          <div v-if="upcomingSessions.length === 0" class="empty">Không có buổi học sắp tới</div>
          <div v-for="s in upcomingSessions" :key="s.id" class="session-row">
            <div class="session-info">
              <div class="session-title">Buổi {{ s.session_no }} – {{ s.topic || 'Chưa có chủ đề' }}</div>
              <div class="session-meta">
                {{ fmtDate(s.planned_date) }}
                <span v-if="s.start_time"> • {{ s.start_time.slice(0, 5) }}</span>
              </div>
            </div>
            <el-button v-if="canJoinSession(s)" type="success" size="small" @click="joinSession(s)">Tham gia</el-button>
          </div>
        </el-card>
        <el-card>
          <template #header><span class="section-title">Bài tập cần nộp</span></template>
          <div v-if="pendingAssign.length === 0" class="empty">Không có bài nào cần nộp 🎉</div>
          <div v-for="a in pendingAssign" :key="a.id" class="assign-row">
            <div class="ar-top">
              <span class="ar-title">{{ a.title }}</span>
              <span :class="['badge', a.is_required ? 'badge-red' : 'badge-gray']">{{ a.is_required ? 'Bắt buộc' : 'Tùy chọn' }}</span>
            </div>
            <div class="ar-meta">Hạn: {{ fmtDateTime(a.due_date) }}</div>
            <el-button size="small" type="primary" @click="$router.push('/student/assignments')">↑ Nộp bài</el-button>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header><span class="section-title">Điểm danh gần đây</span></template>
          <div class="att-grid">
            <div v-for="a in attRecords" :key="a.session_id" :class="['att-dot', dotClass(a.status)]" :title="`Buổi ${a.session_no}: ${fmtDate(a.planned_date)}`">
              {{ dotShort(a.status) }}
            </div>
          </div>
          <el-divider />
          <div class="att-summary">
            <span><b>{{ attStats.present }}</b> có mặt</span>
            <span><b style="color:#E24B4A">{{ attStats.absent }}</b> vắng</span>
            <span><b style="color:#EF9F27">{{ attStats.late }}</b> muộn</span>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useClassStore } from '@/stores/class';
import ClassPicker from '@/components/ClassPicker.vue';
import { attendanceApi, gradesApi, assignmentsApi, submissionsApi, notificationsApi, sessionsApi } from '@/api';
import { fmtDate, fmtDateTime, gradeClassify } from '@/utils/format';
import dayjs from 'dayjs';

const auth = useAuthStore();
const classStore = useClassStore();
const attStats = ref({ total: 0, present: 0, absent: 0, late: 0 });
const attRecords = ref([]);
const avg = ref({ average: null });
const pendingAssign = ref([]);
const unreadNotif = ref(0);
const allSessions = ref([]);

const attendancePct = computed(() => attStats.value.total ? Math.round(attStats.value.present / attStats.value.total * 100) : 100);
const classification = computed(() => gradeClassify(avg.value.average).label);

const upcomingSessions = computed(() => {
  const now = dayjs();
  return allSessions.value
    .filter(s => s.status === 'PLANNED' && !dayjs(s.planned_date).isBefore(now, 'day'))
    .sort((a, b) => dayjs(a.planned_date).valueOf() - dayjs(b.planned_date).valueOf())
    .slice(0, 3);
});

const getMeetingUrl = (s) => s.meeting_url || s.meetingUrl || '';
const sessionStart = (s) => s.start_time ? dayjs(`${s.planned_date} ${s.start_time}`) : dayjs(s.planned_date).startOf('day');
const canJoinSession = (s) => {
  const url = getMeetingUrl(s);
  if (!url) return false;
  const diffHours = sessionStart(s).diff(dayjs(), 'hour', true);
  return diffHours >= 0 && diffHours <= 24;
};
const joinSession = (s) => window.open(getMeetingUrl(s), '_blank');

const dotClass = (s) => ({ PRESENT:'dot-p', ABSENT:'dot-a', LATE:'dot-l' }[s] || 'dot-p');
const dotShort = (s) => ({ PRESENT:'✓', ABSENT:'✗', LATE:'T' }[s] || '?');

const reload = async () => {
  const cid = classStore.selectedId;
  if (!cid || !auth.user) return;
  attStats.value = await attendanceApi.stats(auth.user.id, cid);
  attRecords.value = await attendanceApi.byStudent(auth.user.id, cid);
  avg.value = await gradesApi.average(auth.user.id, cid);
  allSessions.value = await sessionsApi.list(cid);
  const all = await assignmentsApi.list(cid);
  const subs = await submissionsApi.byStudent(auth.user.id, cid);
  pendingAssign.value = all.filter(a => {
    const s = subs.find(x => x.assignment_id === a.id);
    return !s || s.status === 'NOT_SUBMITTED' || s.status === 'REVISION_REQUIRED';
  });
  unreadNotif.value = (await notificationsApi.unreadCount()) || 0;
};

watch(() => classStore.selectedId, reload);
onMounted(reload);
</script>

<style scoped>
.mb-4 { margin-bottom: 14px; }
.assign-row { padding: 10px 0; border-bottom: 1px solid #f0f0ee; }
.assign-row:last-child { border-bottom: none; }
.ar-top { display:flex; justify-content:space-between; margin-bottom: 4px; }
.ar-title { font-weight: 500; font-size: 13px; }
.ar-meta { font-size: 12px; color: #888; margin-bottom: 8px; }
.att-grid { display:flex; flex-wrap: wrap; gap: 5px; }
.att-dot { width: 28px; height: 28px; border-radius: 6px; display:flex; align-items:center; justify-content:center; font-size: 12px; font-weight: 600; }
.dot-p { background: #EAF3DE; color: #3B6D11; }
.dot-a { background: #FCEBEB; color: #A32D2D; }
.dot-l { background: #FAEEDA; color: #854F0B; }
.att-summary { display:flex; gap: 16px; font-size: 13px; }
.empty { padding: 20px; text-align: center; color: #aaa; }
.session-row { display:flex; justify-content:space-between; align-items:center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f0f0ee; }
.session-row:last-child { border-bottom: none; }
.session-info { min-width: 0; }
.session-title { font-weight: 500; font-size: 13px; color: #333; }
.session-meta { font-size: 12px; color: #888; margin-top: 3px; }
</style>
