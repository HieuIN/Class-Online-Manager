<template>
  <div class="auth-wrap">
    <div class="auth-card">
      <div class="logo-box">
        <div class="logo-icon">CM</div>
        <h1>Đặt lại mật khẩu</h1>
        <p class="subtitle">Tạo mật khẩu mới cho tài khoản ClassManager.</p>
      </div>

      <el-alert
        v-if="!token"
        type="error"
        :closable="false"
        show-icon
        class="notice"
        title="Link reset không hợp lệ hoặc thiếu token."
      />

      <el-form @submit.prevent="submit" label-position="top">
        <el-form-item label="Mật khẩu mới">
          <el-input v-model="form.password" type="password" placeholder="Tối thiểu 6 ký tự" size="large" show-password />
        </el-form-item>
        <el-form-item label="Nhập lại mật khẩu">
          <el-input v-model="form.confirm" type="password" placeholder="Nhập lại mật khẩu mới" size="large" show-password />
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading" :disabled="!token" style="width:100%;" size="large">
          Cập nhật mật khẩu
        </el-button>
      </el-form>

      <div class="back-row">
        <router-link to="/login">Quay lại đăng nhập</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { authApi } from '@/api';

const route = useRoute();
const router = useRouter();
const token = computed(() => Array.isArray(route.query.token) ? route.query.token[0] || '' : route.query.token || '');
const loading = ref(false);
const form = reactive({ password: '', confirm: '' });

const submit = async () => {
  if (form.password.length < 6) {
    ElMessage.warning('Mật khẩu mới tối thiểu 6 ký tự');
    return;
  }
  if (form.password !== form.confirm) {
    ElMessage.warning('Mật khẩu nhập lại chưa khớp');
    return;
  }

  loading.value = true;
  try {
    await authApi.resetPassword(token.value, form.password);
    ElMessage.success('Đã cập nhật mật khẩu. Vui lòng đăng nhập lại.');
    router.push('/login');
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
.back-row { text-align: center; margin-top: 16px; font-size: 13px; }
.back-row a { color: #0F6E56; text-decoration: none; font-weight: 500; }
.back-row a:hover { text-decoration: underline; }
</style>
