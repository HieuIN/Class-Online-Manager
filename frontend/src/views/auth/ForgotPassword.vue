<template>
  <div class="auth-wrap">
    <div class="auth-card">
      <div class="logo-box">
        <div class="logo-icon">CM</div>
        <h1>Quên mật khẩu</h1>
        <p class="subtitle">Nhập email tài khoản để nhận link đặt lại mật khẩu.</p>
      </div>

      <el-alert
        v-if="submitted"
        type="success"
        :closable="false"
        show-icon
        class="notice"
        title="Nếu email tồn tại, hệ thống đã gửi link đặt lại mật khẩu."
      />

      <el-alert
        v-if="devResetUrl"
        type="warning"
        :closable="false"
        class="notice"
        title="Dev mode: SMTP chưa cấu hình, dùng link bên dưới để test."
      >
        <template #default>
          <a :href="devResetUrl">{{ devResetUrl }}</a>
        </template>
      </el-alert>

      <el-form @submit.prevent="submit" label-position="top">
        <el-form-item label="Email">
          <el-input v-model="email" placeholder="email@example.com" size="large" />
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading" style="width:100%;" size="large">
          Gửi link reset
        </el-button>
      </el-form>

      <div class="back-row">
        <router-link to="/login">Quay lại đăng nhập</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { authApi } from '@/api';

const email = ref('');
const loading = ref(false);
const submitted = ref(false);
const devResetUrl = ref('');

const submit = async () => {
  if (!email.value) {
    ElMessage.warning('Vui lòng nhập email');
    return;
  }

  loading.value = true;
  try {
    const res = await authApi.forgotPassword(email.value);
    submitted.value = true;
    devResetUrl.value = res.devResetUrl || '';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.auth-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #E1F5EE, #F5F4F0); padding: 20px; }
.auth-card { background: #fff; padding: 40px 36px; border-radius: 16px; width: 100%; max-width: 440px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
.logo-box { text-align: center; margin-bottom: 28px; }
.logo-icon { display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; background: #E1F5EE; color: #0F6E56; font-weight: 700; }
.logo-box h1 { font-size: 24px; font-weight: 600; color: #0F6E56; margin: 12px 0 4px; }
.subtitle { color: #666; font-size: 13px; margin: 0; line-height: 1.5; }
.notice { margin-bottom: 16px; }
.notice a { color: #0F6E56; word-break: break-all; }
.back-row { text-align: center; margin-top: 16px; font-size: 13px; }
.back-row a { color: #0F6E56; text-decoration: none; font-weight: 500; }
.back-row a:hover { text-decoration: underline; }
</style>
