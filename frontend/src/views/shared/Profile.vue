<template>
  <div class="profile-page">
    <el-row :gutter="14">
      <el-col :span="12">
        <el-card>
          <template #header><span class="section-title">Thông tin cá nhân</span></template>
          <div class="avatar-section">
            <el-avatar :size="84" :src="form.avatarUrl || undefined" class="profile-avatar">
              {{ initials(form.fullName) }}
            </el-avatar>
            <el-upload :auto-upload="false" :show-file-list="false" :on-change="uploadAvatar" accept="image/jpeg,image/png,image/webp">
              <el-button size="small">Tải ảnh lên</el-button>
            </el-upload>
            <div class="hint">JPG, PNG, WEBP tối đa 2MB</div>
          </div>
          <el-form label-position="top">
            <el-form-item label="Họ và tên"><el-input v-model="form.fullName" /></el-form-item>
            <el-form-item label="Email"><el-input v-model="form.email" disabled /></el-form-item>
            <el-form-item label="Số điện thoại"><el-input v-model="form.phone" /></el-form-item>
            <el-form-item v-if="auth.isStudent" label="Ngày sinh">
              <el-date-picker v-model="form.birthDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
              <div class="birthdate-help">Dùng để chọn giao diện học phù hợp với độ tuổi của bạn.</div>
            </el-form-item>
            <el-form-item label="Vai trò">
              <el-tag :type="auth.role === 'ADMIN' ? 'danger' : auth.role === 'TEACHER' ? 'primary' : 'success'">
                {{ roleLabel }}
              </el-tag>
            </el-form-item>
            <el-button type="primary" @click="saveProfile" :loading="saving">Lưu thay đổi</el-button>
          </el-form>
        </el-card>

        <el-card class="settings-card">
          <template #header><span class="section-title">Giao diện & ngôn ngữ</span></template>
          <el-form label-position="top">
            <el-form-item label="Theme">
              <el-radio-group v-model="settings.mode" @change="settings.setMode">
                <el-radio-button label="light">Light</el-radio-button>
                <el-radio-button label="dark">Dark</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="Ngôn ngữ">
              <el-select v-model="settings.locale" @change="changeLocale" style="width:180px">
                <el-option label="Tiếng Việt" value="vi" />
                <el-option label="English" value="en" />
                <el-option label="中文" value="zh" />
              </el-select>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card class="settings-card">
          <template #header><span class="section-title">Bảo mật & giới thiệu</span></template>
          <div class="security-row">
            <div>
              <b>Xác thực 2 bước</b>
              <p>Bật OTP qua email hoặc log server khi đăng nhập.</p>
            </div>
            <el-switch v-model="twoFactorEnabled" @change="toggle2fa" />
          </div>
          <el-divider />
          <div class="security-row">
            <div>
              <b>Mã giới thiệu</b>
              <p>{{ referral?.code || 'Chưa tạo' }}</p>
            </div>
            <el-button size="small" @click="loadReferral">Lấy mã</el-button>
          </div>
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

        <el-card v-if="auth.isStudent" class="settings-card">
          <template #header><span class="section-title">Lịch sử học</span></template>
          <el-table :data="transcript" size="small">
            <el-table-column prop="className" label="Lớp" min-width="160" />
            <el-table-column label="Buổi" width="80">
              <template #default="{ row }">{{ row.doneSessions }}/{{ row.totalSessions }}</template>
            </el-table-column>
            <el-table-column label="TB" width="70">
              <template #default="{ row }">{{ row.averageScore ?? '—' }}</template>
            </el-table-column>
            <el-table-column prop="certificateNumber" label="Chứng chỉ" width="120" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';
import { ElMessage } from 'element-plus';
import { authApi, learningExtrasApi, opsApi, usersApi } from '@/api';
import { initials } from '@/utils/format';

const auth = useAuthStore();
const settings = useSettingsStore();
const { locale } = useI18n();
const form = reactive({ fullName: '', email: '', phone: '', birthDate: '', avatarUrl: '' });
const pwd = reactive({ old: '', new: '', confirm: '' });
const saving = ref(false);
const changingPwd = ref(false);
const twoFactorEnabled = ref(false);
const referral = ref(null);
const transcript = ref([]);

const roleLabel = computed(() => ({ ADMIN: 'Quản trị', TEACHER: 'Giáo viên', STUDENT: 'Học viên' }[auth.role]));

const load = async () => {
  if (!auth.user) return;
  const u = await usersApi.get(auth.user.id);
  form.fullName = u.fullName;
  form.email = u.email;
  form.phone = u.phone || '';
  form.birthDate = u.birthDate || '';
  form.avatarUrl = u.avatarUrl || '';
  twoFactorEnabled.value = !!u.twoFactorEnabled;
  if (auth.isStudent) transcript.value = await learningExtrasApi.transcript(auth.user.id);
};

const saveProfile = async () => {
  if (!form.fullName) { ElMessage.warning('Họ tên không được trống'); return; }
  saving.value = true;
  try {
    await usersApi.update(auth.user.id, {
      fullName: form.fullName,
      phone: form.phone,
      birthDate: auth.isStudent ? form.birthDate || null : undefined,
    });
    auth.user.fullName = form.fullName;
    if (auth.isStudent) auth.user.birthDate = form.birthDate || null;
    localStorage.setItem('user', JSON.stringify(auth.user));
    ElMessage.success('Đã cập nhật');
  } finally { saving.value = false; }
};

const uploadAvatar = async (file) => {
  if (!file.raw) return;
  if (file.raw.size > 2 * 1024 * 1024) { ElMessage.warning('Ảnh tối đa 2MB'); return; }
  const fd = new FormData();
  fd.append('file', file.raw);
  const updated = await usersApi.uploadAvatar(auth.user.id, fd);
  form.avatarUrl = updated.avatarUrl;
  auth.user.avatarUrl = updated.avatarUrl;
  localStorage.setItem('user', JSON.stringify(auth.user));
  ElMessage.success('Đã cập nhật avatar');
};

const changeLocale = (value) => {
  settings.setLocale(value);
  locale.value = value;
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

const toggle2fa = async (enabled) => {
  await opsApi.set2fa(enabled);
  ElMessage.success(enabled ? 'Đã bật 2FA' : 'Đã tắt 2FA');
};

const loadReferral = async () => {
  referral.value = await opsApi.myReferralCode();
};

onMounted(load);
</script>

<style scoped>
.profile-page { max-width: 900px; }
.avatar-section { display:flex; flex-direction:column; align-items:center; gap:10px; margin-bottom: 20px; }
.profile-avatar { background:#E1F5EE; color:#0F6E56; font-size:28px; font-weight:600; }
.hint { font-size: 11px; color:#888; }
.birthdate-help { color:var(--ink-500); font-size:11px; line-height:1.45; margin-top:6px; }
.settings-card { margin-top: 14px; }
.security-row { display:flex; justify-content:space-between; gap:12px; align-items:center; }
.security-row p { margin:4px 0 0; color:#888; font-size:12px; }
</style>
