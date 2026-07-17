<template>
  <div>
    <div class="header-bar">
      <span class="section-title" style="margin:0">Quản lý người dùng</span>
      <el-button type="primary" @click="openCreate">+ Tạo người dùng</el-button>
    </div>

    <el-card>
      <div class="filter-row">
        <el-radio-group v-model="roleFilter" @change="load">
          <el-radio-button label="">Tất cả ({{ users.length }})</el-radio-button>
          <el-radio-button label="ADMIN">Admin</el-radio-button>
          <el-radio-button label="TEACHER">Giáo viên</el-radio-button>
          <el-radio-button label="STUDENT">Học viên</el-radio-button>
        </el-radio-group>
        <el-input v-model="search" placeholder="Tìm theo tên/email..." clearable style="width:280px">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </div>

      <div class="list-summary">Hiển thị {{ filteredUsers.length }} / {{ users.length }} người dùng</div>
      <el-table v-loading="loading" :data="filteredUsers" size="small" empty-text="Chưa có người dùng">
        <el-table-column label="Họ tên" min-width="180">
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
        <el-table-column label="SĐT" prop="phone" width="120" />
        <el-table-column label="Ngày sinh" width="120">
          <template #default="{ row }">{{ row.birthDate ? fmtDate(row.birthDate) : '—' }}</template>
        </el-table-column>
        <el-table-column label="Vai trò" width="110">
          <template #default="{ row }">
            <el-tag :type="row.role === 'ADMIN' ? 'danger' : row.role === 'TEACHER' ? 'primary' : 'success'" size="small">
              {{ roleLabel(row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Trạng thái" width="100">
          <template #default="{ row }">
            <div class="status-badges">
              <span :class="['badge', row.isActive ? 'badge-green' : 'badge-gray']">
                {{ row.isActive ? 'Hoạt động' : 'Khóa' }}
              </span>
              <span v-if="row.mustChangePassword" class="badge badge-amber">Đổi mật khẩu</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Ngày tạo" width="120">
          <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="Hành động" width="170">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">Sửa</el-button>
            <el-button size="small" type="warning" plain @click="resetPwd(row)">Reset PW</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Create/Edit dialog -->
    <el-dialog v-model="showDialog" :title="editMode ? 'Sửa người dùng' : 'Tạo người dùng mới'" width="460px">
      <el-form label-position="top">
        <el-form-item label="Họ tên"><el-input v-model="form.fullName" /></el-form-item>
        <el-form-item label="Email"><el-input v-model="form.email" :disabled="editMode" /></el-form-item>
        <el-form-item label="Điện thoại"><el-input v-model="form.phone" /></el-form-item>
        <el-form-item label="Vai trò">
          <el-select v-model="form.role">
            <el-option label="Học viên" value="STUDENT" />
            <el-option label="Giáo viên" value="TEACHER" />
            <el-option label="Quản trị" value="ADMIN" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.role === 'STUDENT'" label="Ngày sinh">
          <el-date-picker v-model="form.birthDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
          <div class="birthdate-help">Học viên dưới 13 tuổi sẽ tự dùng giao diện thiếu nhi.</div>
        </el-form-item>
        <el-form-item v-if="!editMode" label="Mật khẩu">
          <el-input v-model="form.password" type="password" show-password />
          <div class="birthdate-help">Người dùng sẽ được yêu cầu đổi mật khẩu này ngay sau lần đăng nhập đầu tiên.</div>
        </el-form-item>
        <el-form-item v-if="editMode">
          <el-checkbox v-model="form.isActive">Tài khoản đang hoạt động</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">Hủy</el-button>
        <el-button type="primary" :loading="saving" @click="save">{{ editMode ? 'Lưu' : 'Tạo' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { usersApi } from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';
import { initials, fmtDate } from '@/utils/format';

const users = ref([]);
const roleFilter = ref('');
const search = ref('');
const loading = ref(false);
const saving = ref(false);
const showDialog = ref(false);
const editMode = ref(false);
const editId = ref(null);
const form = reactive({ fullName: '', email: '', phone: '', birthDate: '', role: 'STUDENT', password: 'password123', isActive: true });

const roleLabel = (r) => ({ ADMIN: 'Admin', TEACHER: 'Giáo viên', STUDENT: 'Học viên' }[r] || r);

const filteredUsers = computed(() => {
  let list = users.value;
  if (roleFilter.value) list = list.filter(u => u.role === roleFilter.value);
  const q = search.value.toLowerCase().trim();
  if (q) list = list.filter(u => String(u.fullName || '').toLowerCase().includes(q) || String(u.email || '').toLowerCase().includes(q));
  return list;
});

const load = async () => {
  loading.value = true;
  try {
    const data = await usersApi.list();
    users.value = Array.isArray(data) ? data : [];
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || 'Could not load users');
  } finally {
    loading.value = false;
  }
};

const openCreate = () => {
  editMode.value = false; editId.value = null;
  Object.assign(form, { fullName: '', email: '', phone: '', birthDate: '', role: 'STUDENT', password: 'password123', isActive: true });
  showDialog.value = true;
};

const openEdit = (u) => {
  editMode.value = true; editId.value = u.id;
  Object.assign(form, { ...u, password: '' });
  showDialog.value = true;
};

const save = async () => {
  if (!form.fullName || !form.email) { ElMessage.warning('Nhập đủ họ tên + email'); return; }
  saving.value = true;
  try {
    if (editMode.value) {
      const data = {
        fullName: form.fullName,
        phone: form.phone,
        birthDate: form.role === 'STUDENT' ? form.birthDate || null : null,
        role: form.role,
        isActive: form.isActive,
      };
      await usersApi.update(editId.value, data);
      ElMessage.success('Đã cập nhật');
    } else {
      if (!form.password) { ElMessage.warning('Nhập mật khẩu'); return; }
      await usersApi.create({ ...form });
      ElMessage.success('Đã tạo người dùng');
    }
    showDialog.value = false;
    await load();
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || 'Could not save user');
  } finally {
    saving.value = false;
  }
};

const resetPwd = async (u) => {
  try {
    await ElMessageBox.confirm(`Reset mật khẩu của "${u.fullName}" về "password123"? Người dùng sẽ phải đổi mật khẩu khi đăng nhập lại.`, 'Xác nhận', { type: 'warning' });
    await usersApi.update(u.id, { password: 'password123' });
    ElMessage.success('Đã reset mật khẩu và bật yêu cầu đổi mật khẩu');
    await load();
  } catch {}
};

onMounted(load);
</script>

<style scoped>
.header-bar { display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px; }
.filter-row { display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px; }
.row-cell { display:flex; align-items:center; gap: 8px; }
.status-badges { display:flex; flex-wrap:wrap; gap:4px; }
.list-summary { color:var(--ink-500); font-size:12px; margin:0 0 10px; }
.birthdate-help { color:var(--ink-500); font-size:11px; line-height:1.45; margin-top:6px; }
</style>
