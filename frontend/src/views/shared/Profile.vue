<template>
  <div class="profile-page">
    <el-row :gutter="14">
      <el-col :span="12">
        <el-card>
          <template #header><span class="section-title">Thông tin cá nhân</span></template>
          <div class="avatar-section">
            <el-avatar :size="80" :style="{ background:'#E1F5EE', color:'#0F6E56', fontSize:'28px', fontWeight:600 }">
              {{ initials(form.fullName) }}
            </el-avatar>
          </div>
          <el-form label-position="top">
            <el-form-item label="Họ và tên"><el-input v-model="form.fullName" /></el-form-item>
            <el-form-item label="Email"><el-input v-model="form.email" disabled /></el-form-item>
            <el-form-item label="Số điện thoại"><el-input v-model="form.phone" /></el-form-item>
            <el-form-item label="Vai trò">
              <el-tag :type="auth.role === 'ADMIN' ? 'danger' : auth.role === 'TEACHER' ? 'primary' : 'success'">
                {{ roleLabel }}
              </el-tag>
            </el-form-item>
            <el-button type="primary" @click="saveProfile" :loading="saving">Lưu thay đổi</el-button>
          </el-form>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header><span class="section-title">Đổi mật khẩu</span></template>
          <el-form label-position="top">
            <el-form-item label="Mật khẩu hiện tại">
              <el-input v-model="pwd.old" type="password" show-password />
            </el-form-item>
            <el-form-item label="Mật khẩu mới">
              <el-input v-model="pwd.new" type="password" show-password />
            </el-form-item>
            <el-form-item label="Nhập lại mật khẩu mới">
              <el-input v-model="pwd.confirm" type="password" show-password />
            </el-form-item>
            <el-button type="primary" @click="changePassword" :loading="changingPwd">Đổi mật khẩu</el-button>
          </el-form>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { ElMessage } from 'element-plus';
import { authApi, usersApi } from '@/api';
import { initials } from '@/utils/format';

const auth = useAuthStore();
const form = reactive({ fullName: '', email: '', phone: '' });
const pwd = reactive({ old: '', new: '', confirm: '' });
const saving = ref(false);
const changingPwd = ref(false);

const roleLabel = computed(() => ({ ADMIN: 'Quản trị', TEACHER: 'Giáo viên', STUDENT: 'Học viên' }[auth.role]));

const load = async () => {
  if (!auth.user) return;
  const u = await usersApi.get(auth.user.id);
  form.fullName = u.fullName; form.email = u.email; form.phone = u.phone || '';
};

const saveProfile = async () => {
  if (!form.fullName) { ElMessage.warning('Họ tên không được trống'); return; }
  saving.value = true;
  try {
    await usersApi.update(auth.user.id, { fullName: form.fullName, phone: form.phone });
    auth.user.fullName = form.fullName;
    localStorage.setItem('user', JSON.stringify(auth.user));
    ElMessage.success('Đã cập nhật');
  } finally { saving.value = false; }
};

const changePassword = async () => {
  if (!pwd.old || !pwd.new) { ElMessage.warning('Nhập đủ mật khẩu'); return; }
  if (pwd.new !== pwd.confirm) { ElMessage.warning('Mật khẩu mới không khớp'); return; }
  if (pwd.new.length < 6) { ElMessage.warning('Mật khẩu mới tối thiểu 6 ký tự'); return; }
  changingPwd.value = true;
  try {
    await authApi.changePassword(pwd.old, pwd.new);
    ElMessage.success('Đã đổi mật khẩu');
    pwd.old = ''; pwd.new = ''; pwd.confirm = '';
  } finally { changingPwd.value = false; }
};

onMounted(load);
</script>

<style scoped>
.profile-page { max-width: 900px; }
.avatar-section { text-align: center; margin-bottom: 20px; }
</style>
