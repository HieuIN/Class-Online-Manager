<template>
  <div>
    <ClassPicker @change="reload" />
    <div class="action-bar">
      <el-button type="primary" @click="openCreateSession">+ Tạo buổi học</el-button>
      <el-button @click="exportAtt">↓ Xuất Excel</el-button>
    </div>

    <el-card class="mb-4">
      <template #header>
        <div class="header-line">
          <span class="section-title">Bảng điểm danh – {{ doneSessions.length }} buổi đã dạy</span>
        </div>
      </template>
      <div class="table-scroll">
        <table class="att-table" v-if="doneSessions.length">
          <thead>
            <tr>
              <th class="sticky-col">Học viên</th>
              <th v-for="s in doneSessions" :key="s.id" class="session-col">
                <div class="session-head">
                  <span class="s-no">B{{ s.session_no }}</span>
                  <span class="td">{{ formatShort(s.planned_date) }}</span>
                  <div class="session-actions">
                    <el-button text size="small" @click="editSession(s)">Sửa buổi</el-button>
                    <el-button text size="small" @click="openSession(s)">Điểm danh</el-button>
                  </div>
                </div>
              </th>
              <th>Chuyên cần</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="st in students" :key="st.id">
              <td class="sticky-col">
                <div class="student-cell">
                  <el-avatar :size="26" :style="{ background: '#E1F5EE', color: '#0F6E56', fontSize:'10px', fontWeight:600 }">
                    {{ initials(st.fullName) }}
                  </el-avatar>
                  <span>{{ st.fullName }}</span>
                </div>
              </td>
              <td v-for="s in doneSessions" :key="s.id" class="att-cell">
                <span :class="['att-dot', dotClass(getStatus(st.id, s.id))]" :title="`${st.fullName} - Buổi ${s.session_no}`">
                  {{ dotShort(getStatus(st.id, s.id)) }}
                </span>
              </td>
              <td>
                <span :class="['badge', percentClass(percentFor(st.id))]">{{ percentFor(st.id) }}%</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty">Chưa có buổi học nào được đánh dấu hoàn thành</div>
      </div>
      <div class="legend">
        <span><span class="att-dot dot-p">✓</span> Có mặt</span>
        <span><span class="att-dot dot-a">✗</span> Vắng</span>
        <span><span class="att-dot dot-l">T</span> Đi muộn</span>
      </div>
    </el-card>

    <el-card>
      <template #header><span class="section-title">Buổi học sắp tới ({{ upcomingSessions.length }})</span></template>
      <div v-if="upcomingSessions.length === 0" class="empty">Không có buổi nào kế hoạch</div>
      <div v-for="s in upcomingSessions" :key="s.id" class="upcoming-row">
        <div>
          <div class="upcoming-topic">
            Buổi {{ s.session_no }} – {{ s.topic }}
            <el-button
              v-if="getMeetingUrl(s)"
              text
              size="small"
              class="link-copy"
              title="Copy link Zoom/Meet"
              @click="copyMeetingUrl(s)"
            >
              <el-icon><Link /></el-icon>
            </el-button>
          </div>
          <div class="upcoming-date">{{ formatDate(s.planned_date) }}{{ sessionTime(s) }}</div>
        </div>
        <div>
          <el-button size="small" @click="editSession(s)">Sửa</el-button>
          <el-button size="small" type="primary" @click="openSession(s)">Điểm danh</el-button>
          <el-button size="small" type="warning" plain @click="markDone(s)">Đánh dấu đã dạy</el-button>
        </div>
      </div>
    </el-card>

    <!-- Create/Edit session -->
    <el-dialog v-model="showSession" :title="sessionEditMode ? 'Sửa buổi học' : 'Tạo buổi học mới'" width="460px">
      <el-form label-position="top">
        <el-form-item label="Buổi số"><el-input-number v-model="newSession.session_no" :min="1" /></el-form-item>
        <el-form-item label="Ngày dự kiến">
          <el-date-picker v-model="newSession.planned_date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-form-item label="Ngày thực tế (nếu đã dạy)">
          <el-date-picker v-model="newSession.actual_date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-row :gutter="10">
          <el-col :span="12">
            <el-form-item label="Giờ bắt đầu">
              <el-time-picker v-model="newSession.start_time" format="HH:mm" value-format="HH:mm" placeholder="19:00" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Giờ kết thúc">
              <el-time-picker v-model="newSession.end_time" format="HH:mm" value-format="HH:mm" placeholder="21:00" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="Chủ đề"><el-input v-model="newSession.topic" placeholder="VD: Ngữ pháp Chương 3" /></el-form-item>
        <el-form-item label="Trạng thái">
          <el-select v-model="newSession.status">
            <el-option label="Kế hoạch" value="PLANNED" />
            <el-option label="Đã dạy" value="DONE" />
            <el-option label="Bị hủy" value="CANCELLED" />
          </el-select>
        </el-form-item>
        <el-form-item label="Link Zoom / Google Meet">
          <el-input v-model="newSession.meeting_url" placeholder="https://zoom.us/j/..." />
        </el-form-item>
        <el-form-item label="Ghi chú"><el-input v-model="newSession.note" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button v-if="sessionEditMode" type="danger" plain @click="deleteSession" style="float:left">Xóa</el-button>
        <el-button @click="showSession = false">Hủy</el-button>
        <el-button type="primary" @click="saveSession">{{ sessionEditMode ? 'Lưu' : 'Tạo' }}</el-button>
      </template>
    </el-dialog>

    <!-- Bulk attendance mark -->
    <el-dialog v-model="showMark" :title="markTitle" width="640px">
      <div v-if="markSession">
        <p style="font-size:13px;color:#666">{{ markSession.topic }} – {{ formatDate(markSession.planned_date) }}{{ sessionTime(markSession) }}</p>
        <div class="mark-toolbar">
          <el-button size="small" @click="markAll('PRESENT')">Tất cả có mặt</el-button>
          <el-button size="small" @click="markAll('ABSENT')">Tất cả vắng</el-button>
        </div>
        <el-table :data="markRecords" size="small" border>
          <el-table-column prop="fullName" label="Học viên" min-width="160" />
          <el-table-column label="Trạng thái" width="180">
            <template #default="{ row }">
              <el-select v-model="row.status" size="small">
                <el-option label="Có mặt" value="PRESENT" />
                <el-option label="Vắng" value="ABSENT" />
                <el-option label="Đi muộn" value="LATE" />
                <el-option label="Về sớm" value="LEFT_EARLY" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="Vắng có phép" width="100">
            <template #default="{ row }">
              <el-checkbox v-model="row.isExcused" :disabled="row.status !== 'ABSENT'" />
            </template>
          </el-table-column>
          <el-table-column label="Ghi chú">
            <template #default="{ row }">
              <el-input v-model="row.reason" size="small" placeholder="Lý do (nếu có)" />
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <el-button @click="showMark = false">Hủy</el-button>
        <el-button type="primary" @click="saveMark" :loading="saving">Lưu điểm danh</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, reactive } from 'vue';
import { useClassStore } from '@/stores/class';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Link } from '@element-plus/icons-vue';
import ClassPicker from '@/components/ClassPicker.vue';
import { classesApi, sessionsApi, attendanceApi } from '@/api';
import { initials } from '@/utils/format';
import dayjs from 'dayjs';

const classStore = useClassStore();
const students = ref([]);
const sessions = ref([]);
const matrix = ref([]);
const showSession = ref(false);
const showMark = ref(false);
const sessionEditMode = ref(false);
const sessionEditId = ref(null);
const markSession = ref(null);
const markRecords = ref([]);
const saving = ref(false);

const newSession = reactive({
  session_no: 1, planned_date: '', actual_date: '', start_time: '19:00', end_time: '21:00', topic: '', status: 'PLANNED', note: '', meeting_url: '',
});

const doneSessions = computed(() => sessions.value.filter(s => s.status === 'DONE'));
const upcomingSessions = computed(() => sessions.value.filter(s => s.status === 'PLANNED'));
const markTitle = computed(() => markSession.value ? `Điểm danh – Buổi ${markSession.value.session_no}` : '');

const getStatus = (studentId, sessionId) => {
  const row = matrix.value.find(m => m.studentId === studentId && m.sessionId === sessionId);
  return row?.status || 'PRESENT';
};

const percentFor = (studentId) => {
  const total = doneSessions.value.length;
  if (!total) return 100;
  let p = 0, l = 0;
  for (const s of doneSessions.value) {
    const status = getStatus(studentId, s.id);
    if (status === 'PRESENT') p++; else if (status === 'LATE') l++;
  }
  return Math.round((p + l * 0.5) / total * 100);
};
const percentClass = (p) => p >= 80 ? 'badge-green' : p >= 60 ? 'badge-amber' : 'badge-red';
const dotClass = (s) => ({ PRESENT:'dot-p', ABSENT:'dot-a', LATE:'dot-l', LEFT_EARLY:'dot-l' }[s] || 'dot-p');
const dotShort = (s) => ({ PRESENT:'✓', ABSENT:'✗', LATE:'T', LEFT_EARLY:'S' }[s] || '?');
const formatShort = (d) => d ? dayjs(d).format('DD/MM') : '';
const formatDate = (d) => d ? dayjs(d).format('DD/MM/YYYY') : '';
const getMeetingUrl = (s) => s.meeting_url || s.meetingUrl || '';
const getStartTime = (s) => s.start_time || s.startTime || '';
const getEndTime = (s) => s.end_time || s.endTime || '';
const shortTime = (t) => t ? String(t).slice(0, 5) : '';
const sessionTime = (s) => {
  const start = shortTime(getStartTime(s));
  const end = shortTime(getEndTime(s));
  if (!start && !end) return '';
  return ` • ${start || '--:--'}${end ? `-${end}` : ''}`;
};

const copyMeetingUrl = async (s) => {
  const url = getMeetingUrl(s);
  if (!url) return;
  await navigator.clipboard.writeText(url);
  ElMessage.success('Đã copy link Zoom/Meet');
};

const reload = async () => {
  const cid = classStore.selectedId;
  if (!cid) return;
  const [stu, ses, mtx] = await Promise.all([
    classesApi.students(cid), sessionsApi.list(cid), attendanceApi.matrix(cid),
  ]);
  students.value = stu; sessions.value = ses; matrix.value = mtx;
  newSession.session_no = (sessions.value.length || 0) + 1;
};

const openCreateSession = () => {
  sessionEditMode.value = false;
  Object.assign(newSession, {
    session_no: sessions.value.length + 1,
    planned_date: dayjs().format('YYYY-MM-DD'),
    actual_date: '', start_time: '19:00', end_time: '21:00', topic: '', status: 'PLANNED', note: '', meeting_url: '',
  });
  showSession.value = true;
};

const editSession = (s) => {
  sessionEditMode.value = true;
  sessionEditId.value = s.id;
  Object.assign(newSession, {
    session_no: s.session_no, planned_date: s.planned_date,
    actual_date: s.actual_date || '', start_time: shortTime(getStartTime(s)) || '19:00', end_time: shortTime(getEndTime(s)) || '21:00',
    topic: s.topic, status: s.status, note: s.note || '',
    meeting_url: getMeetingUrl(s),
  });
  showSession.value = true;
};

const saveSession = async () => {
  if (!newSession.planned_date || !newSession.topic) { ElMessage.warning('Nhập đủ ngày + chủ đề'); return; }
  const payload = {
    sessionNo: newSession.session_no, plannedDate: newSession.planned_date,
    actualDate: newSession.actual_date || null,
    startTime: newSession.start_time || null,
    endTime: newSession.end_time || null,
    topic: newSession.topic, status: newSession.status, note: newSession.note,
    meetingUrl: newSession.meeting_url || null,
  };
  try {
    if (sessionEditMode.value) {
      await sessionsApi.update(sessionEditId.value, payload);
      ElMessage.success('Đã cập nhật');
    } else {
      await sessionsApi.create({ classId: classStore.selectedId, ...payload });
      ElMessage.success('Đã tạo buổi học');
    }
    showSession.value = false;
    reload();
  } catch {}
};

const deleteSession = async () => {
  try {
    await ElMessageBox.confirm('Xóa buổi học này? Điểm danh của buổi này sẽ bị xóa.', 'Xác nhận', { type: 'warning' });
    await sessionsApi.delete(sessionEditId.value);
    ElMessage.success('Đã xóa');
    showSession.value = false;
    reload();
  } catch {}
};

const markDone = async (s) => {
  try {
    await ElMessageBox.confirm(
      `Đánh dấu buổi ${s.session_no} là đã dạy? Thao tác này sẽ cập nhật tiến độ lớp.`,
      'Xác nhận',
      { type: 'warning', confirmButtonText: 'Đánh dấu đã dạy', cancelButtonText: 'Hủy' },
    );
    await sessionsApi.update(s.id, { status: 'DONE', actualDate: dayjs().format('YYYY-MM-DD') });
    ElMessage.success('Đã đánh dấu hoàn thành');
    reload();
  } catch {}
};

const openSession = (s) => {
  markSession.value = s;
  markRecords.value = students.value.map(st => {
    const cur = matrix.value.find(m => m.studentId === st.id && m.sessionId === s.id);
    return {
      studentId: st.id, fullName: st.fullName,
      status: cur?.status || 'PRESENT',
      isExcused: cur?.isExcused || false,
      reason: cur?.reason || '',
    };
  });
  showMark.value = true;
};

const markAll = (status) => {
  markRecords.value.forEach(r => r.status = status);
};

const saveMark = async () => {
  saving.value = true;
  try {
    if (markSession.value.status === 'PLANNED') {
      await ElMessageBox.confirm(
        'Lưu điểm danh và đánh dấu buổi này là đã dạy?',
        'Xác nhận',
        { type: 'warning', confirmButtonText: 'Lưu và đánh dấu', cancelButtonText: 'Hủy' },
      );
    }
    await attendanceApi.bulkMark(markSession.value.id, markRecords.value.map(r => ({
      studentId: r.studentId, status: r.status, isExcused: r.isExcused, reason: r.reason,
    })));
    // If session was PLANNED → mark DONE
    if (markSession.value.status === 'PLANNED') {
      await sessionsApi.update(markSession.value.id, { status: 'DONE', actualDate: dayjs().format('YYYY-MM-DD') });
    }
    ElMessage.success('Đã lưu điểm danh');
    showMark.value = false;
    reload();
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') console.error(e);
  } finally { saving.value = false; }
};

const exportAtt = () => {
  // Export client-side: build CSV
  const rows = [];
  rows.push(['Học viên', ...doneSessions.value.map(s => `Buổi ${s.session_no} (${formatShort(s.planned_date)})`), 'Chuyên cần']);
  for (const st of students.value) {
    rows.push([
      st.fullName,
      ...doneSessions.value.map(s => ({PRESENT:'Có',ABSENT:'Vắng',LATE:'Muộn',LEFT_EARLY:'Về sớm'}[getStatus(st.id, s.id)] || '')),
      percentFor(st.id) + '%',
    ]);
  }
  const csv = '\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `diem-danh-${classStore.selected?.name || 'lop'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

watch(() => classStore.selectedId, reload);
onMounted(reload);
</script>

<style scoped>
.action-bar { display:flex; justify-content:flex-end; gap: 8px; margin-bottom: 14px; }
.header-line { display:flex; justify-content:space-between; align-items:center; }
.mb-4 { margin-bottom: 14px; }
.table-scroll { overflow-x: auto; }
.att-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.att-table th, .att-table td { padding: 6px 8px; border-bottom: 1px solid #f0f0ee; text-align: center; }
.att-table th { background: #fafaf8; font-weight: 600; color: #888; font-size: 11px; padding: 4px; }
.att-table th.sticky-col, .att-table td.sticky-col { text-align: left; min-width: 150px; position: sticky; left: 0; background: #fff; z-index: 1; }
.att-table th.sticky-col { background: #fafaf8; }
.session-col { min-width: 82px; }
.session-head { display:flex; flex-direction:column; align-items:center; }
.session-actions { display:flex; flex-direction:column; align-items:center; margin-top: 2px; }
.session-actions .el-button { padding: 0; margin: 0; font-size: 10px; line-height: 14px; }
.s-no { font-weight: 600; font-size: 11px; }
.td { font-weight: 400; font-size: 9px; color: #aaa; }
.student-cell { display:flex; align-items:center; gap: 8px; }
.att-cell { padding: 4px !important; }
.att-dot { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 5px; font-size: 11px; font-weight: 600; }
.dot-p { background: #EAF3DE; color: #3B6D11; }
.dot-a { background: #FCEBEB; color: #A32D2D; }
.dot-l { background: #FAEEDA; color: #854F0B; }
.legend { display:flex; gap: 16px; font-size: 11px; color: #888; margin-top: 12px; align-items: center; }
.legend > span { display:flex; align-items:center; gap: 5px; }
.upcoming-row { display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid #f0f0ee; }
.upcoming-row:last-child { border-bottom: none; }
.upcoming-topic { display:flex; align-items:center; gap: 4px; font-weight: 500; font-size: 13px; }
.upcoming-date { font-size: 11px; color: #888; margin-top: 2px; }
.link-copy { padding: 0 2px; color: #0F6E56; }
.empty { padding: 20px; text-align: center; color: #aaa; font-size: 13px; }
.mark-toolbar { margin-bottom: 12px; }
</style>
