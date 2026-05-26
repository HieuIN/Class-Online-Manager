<template>
  <div class="login-wrap">
    <div class="login-card">
      <div class="logo-box">
        <img class="brand-logo" src="/logo.svg" alt="Ctalk Chinese" />
        <h1>Ctalk Chinese</h1>
        <p class="subtitle">Quản lý lớp học tiếng Trung online</p>
      </div>
      <el-form @submit.prevent="onLogin" label-position="top">
        <el-form-item label="Email">
          <el-input v-model="form.email" placeholder="email@example.com" size="large" />
        </el-form-item>
        <el-form-item label="Mật khẩu">
          <el-input v-model="form.password" type="password" placeholder="••••••••" size="large" show-password />
        </el-form-item>
        <el-form-item v-if="pendingOtpUserId" label="Mã OTP">
          <el-input v-model="form.otp" maxlength="6" placeholder="Nhập mã 6 số" size="large" />
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading" style="width:100%;" size="large">
          {{ pendingOtpUserId ? 'Xác minh OTP' : 'Đăng nhập' }}
        </el-button>
      </el-form>
      <div class="forgot-row">
        <router-link to="/forgot-password">Quên mật khẩu?</router-link>
      </div>
      <div class="hint">
        <strong>Tài khoản demo</strong> (password: <code>password123</code>):<br/>
        <span class="row"><span>GV: teacher@cm.com</span></span>
        <span class="row"><span>HV: student1@cm.com</span></span>
        <span class="row"><span>Admin: admin@cm.com</span></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { ElMessage } from 'element-plus';

const router = useRouter();
const auth = useAuthStore();
const form = reactive({ email: 'teacher@cm.com', password: 'password123', otp: '' });
const loading = ref(false);
const pendingOtpUserId = ref(null);

const redirectAfterLogin = () => {
  if (auth.isStudent) router.push('/student/dashboard');
  else if (auth.isAdmin) router.push('/admin/dashboard');
  else router.push('/dashboard');
};

const onLogin = async () => {
  loading.value = true;
  try {
    if (pendingOtpUserId.value) {
      await auth.verify2fa(pendingOtpUserId.value, form.otp);
      redirectAfterLogin();
      return;
    }
    const res = await auth.login(form.email, form.password);
    if (res.requiresOtp) {
      pendingOtpUserId.value = res.userId;
      ElMessage.info('Đã gửi mã OTP qua email hoặc log server');
      return;
    }
    redirectAfterLogin();
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #E1F5EE, #F5F4F0); padding: 20px; }
.login-card { background: #fff; padding: 40px 36px; border-radius: 16px; width: 100%; max-width: 400px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
.logo-box { text-align: center; margin-bottom: 28px; }
.brand-logo { width: 58px; height: 58px; display: block; margin: 0 auto 10px; border-radius: 14px; box-shadow: 0 10px 24px rgba(15,110,86,0.18); }
.logo-box h1 { font-size: 24px; font-weight: 600; color: #0F6E56; margin: 8px 0 4px; }
.subtitle { color: #888; font-size: 13px; margin: 0; }
.hint { margin-top: 22px; padding: 14px; background: #f5f4f0; border-radius: 8px; font-size: 12px; color: #666; line-height: 1.8; }
.hint .row { display: block; }
.hint code { background: #fff; padding: 1px 6px; border-radius: 4px; }
.forgot-row { text-align: right; margin-top: 12px; font-size: 13px; }
.forgot-row a { color: #0F6E56; text-decoration: none; font-weight: 500; }
.forgot-row a:hover { text-decoration: underline; }
</style>
