<template>
  <div>
    <div class="header-bar">
      <span class="section-title" style="margin:0">Danh sách lớp học</span>
      <el-button type="primary" @click="showCreate = true">+ Tạo lớp mới</el-button>
    </div>

    <el-row :gutter="14" class="mb-4">
      <el-col :span="12" v-for="c in classes" :key="c.id">
        <el-card :class="['class-card', classStore.selectedId === c.id ? 'selected' : '']" @click="classStore.select(c.id)" shadow="hover">
          <div class="cc-top">
            <div>
              <div class="cc-name">{{ c.name }}</div>
              <div class="cc-teacher">GV: {{ c.teacherName || 'Chưa phân công' }}</div>
            </div>
            <div>
              <span class="badge badge-green">Đang học</span>
              <el-dropdown trigger="click" @command="(cmd) => onCardCmd(cmd, c)">
                <el-button text size="small" style="margin-left:6px">⋮</el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="edit">Sửa</el-dropdown-item>
                    <el-dropdown-item command="delete" divided>Xóa</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
          <div class="cc-meta">{{ c.studentCount }} học viên • {{ c.doneSessions }}/{{ c.total_sessions }} buổi</div>
          <el-progress :percentage="c.total_sessions ? Math.round(c.doneSessions / c.total_sessions * 100) : 0" :show-text="false" :stroke-width="6" color="#1D9E75" />
          <div class="cc-pct">{{ c.total_sessions ? Math.round(c.doneSessions / c.total_sessions * 100) : 0 }}% hoàn thành</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card v-if="selected">
      <template #header>
        <div class="header-line">
          <span class="section-title">Học viên – {{ selected.name }}</span>
          <div>
            <el-button size="small" type="primary" @click="showEnroll = true">+ Thêm học viên</el-button>
            <el-button size="small" @click="showNewStudent = true">+ Tạo học viên mới</el-button>
          </div>
        </div>
      </template>
      <el-table :data="students" size="small">
        <el-table-column label="Học viên" min-width="180">
          <template #default="{ row }">
            <div class="row-cell">
              <el-avatar :size="26" :style="{ background:'#E1F5EE', color:'#0F6E56', fontSize:'10px', fontWeight:600 }">
                {{ initials(row.fullName) }}
              </el-avatar>
              <span>{{ row.fullName }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Email" prop="email" />
        <el-table-column label="Điện thoại" prop="phone" width="120" />
        <el-table-column label="Ngày tham gia" width="130">
          <template #default="{ row }">{{ fmtDate(row.enrolledAt) }}</template>
        </el-table-column>
        <el-table-column label="Hành động" width="120">
          <template #default="{ row }">
            <el-button size="small" type="danger" plain @click="unenroll(row)">Xóa khỏi lớp</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="students.length === 0" class="empty">Chưa có học viên nào trong lớp này</div>
    </el-card>

    <!-- Create/Edit class -->
    <el-dialog v-model="showCreate" :title="editMode ? 'Sửa lớp' : 'Tạo lớp mới'" width="460px">
      <el-form label-position="top">
        <el-form-item label="Khóa học">
          <el-select v-model="newCls.courseId" placeholder="Chọn khóa">
            <el-option v-for="c in courses" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="Giáo viên phụ trách">
          <el-select v-model="newCls.teacherId" placeholder="Chọn giáo viên" clearable>
            <el-option v-for="t in teachers" :key="t.id" :label="t.fullName" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="Tên lớp"><el-input v-model="newCls.name" placeholder="VD: HSK3 – Tối 2-4-6" /></el-form-item>
        <el-form-item label="Tổng số buổi"><el-input-number v-model="newCls.totalSessions" :min="1" /></el-form-item>
        <el-form-item label="Học phí (VND)"><el-input-number v-model="newCls.tuitionFee" :min="0" :step="100000" /></el-form-item>
        <el-form-item label="Lịch học"><el-input v-model="newCls.scheduleNote" placeholder="VD: Tối T2-T4-T6, 19:00-21:00" /></el-form-item>
        <template v-if="!editMode">
          <el-divider content-position="left">Tự sinh buổi học</el-divider>
          <el-form-item>
            <el-checkbox v-model="schedule.autoGenerate">Tự tạo lịch học sau khi tạo lớp</el-checkbox>
          </el-form-item>
          <template v-if="schedule.autoGenerate">
            <el-form-item label="Ngày bắt đầu">
              <el-date-picker v-model="schedule.startDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
            <el-form-item label="Các thứ trong tuần">
              <el-checkbox-group v-model="schedule.weekdays" class="weekday-group">
                <el-checkbox :value="1">T2</el-checkbox>
                <el-checkbox :value="2">T3</el-checkbox>
                <el-checkbox :value="3">T4</el-checkbox>
                <el-checkbox :value="4">T5</el-checkbox>
                <el-checkbox :value="5">T6</el-checkbox>
                <el-checkbox :value="6">T7</el-checkbox>
                <el-checkbox :value="0">CN</el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item label="Giờ học">
              <div class="time-row">
                <el-time-picker v-model="schedule.startTime" format="HH:mm" value-format="HH:mm" placeholder="Bắt đầu" />
                <el-time-picker v-model="schedule.endTime" format="HH:mm" value-format="HH:mm" placeholder="Kết thúc" />
              </div>
            </el-form-item>
          </template>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="closeCreate">Hủy</el-button>
        <el-button type="primary" @click="saveClass">{{ editMode ? 'Cập nhật' : 'Tạo' }}</el-button>
      </template>
    </el-dialog>

    <!-- Enroll existing students dialog -->
    <el-dialog v-model="showEnroll" title="Thêm học viên vào lớp" width="540px">
      <p style="font-size:13px;color:#666;margin-bottom:10px">Chọn học viên đã có sẵn trong hệ thống:</p>
      <el-input v-model="searchStudent" placeholder="Tìm theo tên hoặc email..." clearable style="margin-bottom:12px">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-checkbox-group v-model="selectedStudentIds">
        <div v-for="s in filteredStudents" :key="s.id" class="enroll-row">
          <el-checkbox :value="s.id" :disabled="isEnrolled(s.id)">
            <div class="enroll-info">
              <div><b>{{ s.fullName }}</b> <span v-if="isEnrolled(s.id)" class="badge badge-gray">Đã trong lớp</span></div>
              <div class="text-xs">{{ s.email }} • {{ s.phone || 'Chưa có SĐT' }}</div>
            </div>
          </el-checkbox>
        </div>
      </el-checkbox-group>
      <div v-if="filteredStudents.length === 0" class="empty">Không tìm thấy học viên</div>
      <template #footer>
        <el-button @click="showEnroll = false">Hủy</el-button>
        <el-button type="primary" @click="bulkEnroll" :loading="enrolling">
          Thêm {{ selectedStudentIds.length }} học viên
        </el-button>
      </template>
    </el-dialog>

    <!-- Create new student dialog -->
    <el-dialog v-model="showNewStudent" title="Tạo học viên mới" width="460px">
      <el-form label-position="top">
        <el-form-item label="Họ tên"><el-input v-model="newStudent.fullName" /></el-form-item>
        <el-form-item label="Email"><el-input v-model="newStudent.email" type="email" /></el-form-item>
        <el-form-item label="Điện thoại"><el-input v-model="newStudent.phone" /></el-form-item>
        <el-form-item label="Mật khẩu">
          <el-input v-model="newStudent.password" type="password" show-password />
        </el-form-item>
        <el-checkbox v-model="newStudent.enrollNow">Đăng ký vào lớp này luôn</el-checkbox>
      </el-form>
      <template #footer>
        <el-button @click="showNewStudent = false">Hủy</el-button>
        <el-button type="primary" @click="createStudent" :loading="creating">Tạo</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted } from 'vue';
import { useClassStore } from '@/stores/class';
import { ElMessage, ElMessageBox } from 'element-plus';
import { classesApi, coursesApi, enrollmentsApi, sessionsApi, usersApi } from '@/api';
import { initials, fmtDate } from '@/utils/format';
import dayjs from 'dayjs';

const classStore = useClassStore();
const classes = computed(() => classStore.classes);
const selected = computed(() => classStore.selected);
const students = ref([]);
const allStudents = ref([]);
const teachers = ref([]);
const courses = ref([]);
const showCreate = ref(false);
const showEnroll = ref(false);
const showNewStudent = ref(false);
const editMode = ref(false);
const editId = ref(null);
const selectedStudentIds = ref([]);
const searchStudent = ref('');
const enrolling = ref(false);
const creating = ref(false);

const newCls = reactive({ courseId: null, teacherId: null, name: '', totalSessions: 20, tuitionFee: 3000000, scheduleNote: '' });
const schedule = reactive({ autoGenerate: false, startDate: dayjs().format('YYYY-MM-DD'), weekdays: [1, 3, 5], startTime: '19:00', endTime: '21:00' });
const newStudent = reactive({ fullName: '', email: '', phone: '', password: 'password123', enrollNow: true });

const filteredStudents = computed(() => {
  const q = searchStudent.value.toLowerCase().trim();
  if (!q) return allStudents.value;
  return allStudents.value.filter(s => s.fullName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
});

const isEnrolled = (sid) => students.value.some(s => s.id === sid);

const loadStudents = async () => {
  if (!selected.value) return;
  students.value = await classesApi.students(selected.value.id);
};

const loadAllStudents = async () => {
  try { allStudents.value = await usersApi.list('STUDENT'); } catch {}
};

const loadTeachers = async () => {
  try { teachers.value = await usersApi.list('TEACHER'); } catch {}
};

const closeCreate = () => {
  showCreate.value = false; editMode.value = false; editId.value = null;
  Object.assign(newCls, { courseId: null, teacherId: null, name: '', totalSessions: 20, tuitionFee: 3000000, scheduleNote: '' });
  Object.assign(schedule, { autoGenerate: false, startDate: dayjs().format('YYYY-MM-DD'), weekdays: [1, 3, 5], startTime: '19:00', endTime: '21:00' });
};

const saveClass = async () => {
  if (!newCls.courseId || !newCls.name) { ElMessage.warning('Nhập khóa học + tên lớp'); return; }
  if (!editMode.value && schedule.autoGenerate && (!schedule.startDate || !schedule.weekdays.length || !schedule.startTime || !schedule.endTime)) {
    ElMessage.warning('Nhập đủ ngày bắt đầu, thứ trong tuần và giờ học');
    return;
  }
  try {
    if (editMode.value) {
      await classesApi.update(editId.value, newCls);
      ElMessage.success('Đã cập nhật');
    } else {
      const created = await classesApi.create({
        ...newCls,
        startDate: schedule.autoGenerate ? schedule.startDate : undefined,
        scheduleNote: buildScheduleNote(),
      });
      if (schedule.autoGenerate && created?.id) {
        const result = await sessionsApi.generate({
          classId: created.id,
          startDate: schedule.startDate,
          weekdays: schedule.weekdays,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          totalSessions: newCls.totalSessions,
        });
        ElMessage.success(`Đã tạo lớp và ${result.created || 0} buổi học`);
      } else {
        ElMessage.success('Đã tạo lớp');
      }
    }
    closeCreate();
    await classStore.fetchClasses();
  } catch {}
};

const buildScheduleNote = () => {
  if (!schedule.autoGenerate) return newCls.scheduleNote;
  const labels = { 0: 'CN', 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7' };
  const days = [...schedule.weekdays].sort((a, b) => a - b).map(d => labels[d]).join('-');
  return newCls.scheduleNote || `${days}, ${schedule.startTime}-${schedule.endTime}`;
};

const onCardCmd = async (cmd, c) => {
  if (cmd === 'edit') {
    editMode.value = true; editId.value = c.id;
    Object.assign(newCls, {
      courseId: c.course_id, teacherId: c.teacher_id || null, name: c.name,
      totalSessions: c.total_sessions, tuitionFee: +c.tuition_fee,
      scheduleNote: c.schedule_note,
    });
    showCreate.value = true;
  } else if (cmd === 'delete') {
    try {
      await ElMessageBox.confirm(`Xóa lớp "${c.name}"? Toàn bộ dữ liệu (điểm danh, điểm, bài tập, học phí...) sẽ bị xóa.`, 'Xác nhận', { type: 'warning' });
      await classesApi.delete(c.id);
      ElMessage.success('Đã xóa');
      await classStore.fetchClasses();
    } catch {}
  }
};

const bulkEnroll = async () => {
  if (!selectedStudentIds.value.length) { ElMessage.warning('Chọn ít nhất 1 học viên'); return; }
  enrolling.value = true;
  try {
    await enrollmentsApi.bulkEnroll(selected.value.id, selectedStudentIds.value);
    ElMessage.success(`Đã thêm ${selectedStudentIds.value.length} học viên`);
    showEnroll.value = false;
    selectedStudentIds.value = [];
    searchStudent.value = '';
    await loadStudents();
    await classStore.fetchClasses();
  } finally { enrolling.value = false; }
};

const createStudent = async () => {
  if (!newStudent.fullName || !newStudent.email || !newStudent.password) {
    ElMessage.warning('Nhập đủ họ tên, email, mật khẩu');
    return;
  }
  creating.value = true;
  try {
    const created = await usersApi.create({
      ...newStudent, role: 'STUDENT',
    });
    if (newStudent.enrollNow && created?.id) {
      await enrollmentsApi.enroll(selected.value.id, created.id);
    }
    ElMessage.success('Đã tạo học viên mới');
    showNewStudent.value = false;
    Object.assign(newStudent, { fullName: '', email: '', phone: '', password: 'password123', enrollNow: true });
    await loadAllStudents();
    await loadStudents();
    await classStore.fetchClasses();
  } finally { creating.value = false; }
};

const unenroll = async (st) => {
  try {
    await ElMessageBox.confirm(`Xóa "${st.fullName}" khỏi lớp này?`, 'Xác nhận', { type: 'warning' });
    // Find enrollment id
    const enrolls = await enrollmentsApi.list({ studentId: st.id });
    const e = enrolls.find(x => x.class_id === selected.value.id);
    if (e) await enrollmentsApi.delete(e.id);
    ElMessage.success('Đã xóa khỏi lớp');
    loadStudents();
    await classStore.fetchClasses();
  } catch {}
};

watch(() => classStore.selectedId, loadStudents);
onMounted(async () => {
  await classStore.fetchClasses();
  courses.value = await coursesApi.list();
  await loadAllStudents();
  await loadTeachers();
  loadStudents();
});
</script>

<style scoped>
.header-bar { display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px; }
.header-line { display:flex; justify-content:space-between; align-items:center; }
.mb-4 { margin-bottom: 14px; }
.class-card { cursor:pointer; transition: all 0.15s; }
.class-card.selected { border-color: #1D9E75; border-width: 1.5px; }
.cc-top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 8px; }
.cc-name { font-weight: 600; font-size: 14px; }
.cc-teacher { font-size: 12px; color: #888; margin-top: 2px; }
.cc-meta { font-size: 12px; color: #666; margin-bottom: 6px; }
.cc-pct { font-size: 11px; color: #999; margin-top: 4px; }
.row-cell { display:flex; align-items:center; gap: 8px; }
.empty { padding: 30px; text-align: center; color: #aaa; }
.enroll-row { padding: 8px 6px; border-bottom: 1px solid #f0f0ee; }
.enroll-row:last-child { border-bottom: none; }
.enroll-info { display:inline-block; vertical-align:middle; }
.text-xs { font-size: 11px; color: #888; }
.weekday-group { display:flex; flex-wrap:wrap; gap: 4px 12px; }
.time-row { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; }
</style>
