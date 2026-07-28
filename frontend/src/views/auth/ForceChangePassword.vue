<template>
  <div class="force-password-page">
    <section class="force-password-intro">
      <router-link to="/login" class="brand-link" aria-label="Ctalk Chinese">
        <img src="/logo.svg" alt="Ctalk Chinese" />
        <BrandWordmark light subtitle="Learning workspace" />
      </router-link>
      <div class="force-password-copy">
        <span class="eyebrow">Bảo mật tài khoản</span>
        <h1>Tạo mật khẩu chỉ dành cho bạn.</h1>
        <p>Mật khẩu hiện tại là mật khẩu tạm thời. Hãy đổi ngay để tiếp tục vào không gian học tập của bạn.</p>
        <div class="security-note"><span>01</span><p>Không chia sẻ mật khẩu mới với người khác.</p></div>
      </div>
    </section>

    <main class="force-password-card">
      <div class="form-heading">
        <span class="eyebrow">Bước bắt buộc</span>
        <h2>Đổi mật khẩu</h2>
        <p>Chọn mật khẩu từ 6 ký tự trở lên để hoàn tất đăng nhập.</p>
      </div>

      <el-form @submit.prevent="submit" label-position="top">
        <el-form-item label="Mật khẩu tạm thời">
          <el-input v-model="form.currentPassword" type="password" autocomplete="current-password" show-password size="large" />
        </el-form-item>
        <el-form-item label="Mật khẩu mới">
          <el-input v-model="form.newPassword" type="password" autocomplete="new-password" show-password size="large" />
        </el-form-item>
        <el-form-item label="Nhập lại mật khẩu mới">
          <el-input v-model="form.confirmPassword" type="password" autocomplete="new-password" show-password size="large" />
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading" size="large" style="width:100%">Lưu mật khẩu mới</el-button>
      </el-form>

      <button type="button" class="logout-link" @click="logout">Đăng xuất khỏi tài khoản này</button>
    </main>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { authApi } from '@/api';
import { useAuthStore } from '@/stores/auth';
import BrandWordmark from '@/components/BrandWordmark.vue';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const loading = ref(false);
const form = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' });

const destination = () => {
  const requestedPath = typeof route.query.redirect === 'string' ? route.query.redirect : '';
  if (requestedPath.startsWith('/') && !requestedPath.startsWith('//')) return requestedPath;
  if (auth.isStudent) return '/student/dashboard';
  if (auth.isAdmin) return '/admin/dashboard';
  return '/dashboard';
};

const submit = async () => {
  if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
    ElMessage.warning('Nhập đầy đủ thông tin mật khẩu');
    return;
  }
  if (form.newPassword.length < 6) {
    ElMessage.warning('Mật khẩu mới tối thiểu 6 ký tự');
    return;
  }
  if (form.newPassword !== form.confirmPassword) {
    ElMessage.warning('Mật khẩu nhập lại chưa khớp');
    return;
  }

  loading.value = true;
  try {
    await authApi.changePassword(form.currentPassword, form.newPassword);
    await auth.fetchMe();
    ElMessage.success('Đã cập nhật mật khẩu mới');
    router.replace(destination());
  } finally {
    loading.value = false;
  }
};

const logout = () => {
  auth.logout();
  router.replace('/login');
};
</script>

<style scoped>
.force-password-page { background: var(--canvas); display: grid; grid-template-columns: minmax(0, 1fr) minmax(410px, 0.82fr); min-height: 100vh; }
.force-password-intro { background: #123f35; color: #f5fbf8; display: flex; flex-direction: column; justify-content: center; padding: 56px clamp(42px, 8vw, 140px); position: relative; }
.force-password-intro::after { border: 1px solid rgba(237, 165, 60, 0.42); content: '安'; color: rgba(255, 245, 219, 0.18); font-family: "Songti SC", "STSong", serif; font-size: clamp(150px, 18vw, 260px); line-height: 1; position: absolute; right: 7%; top: 14%; }
.brand-link { align-items: center; display: flex; gap: 10px; left: clamp(42px, 8vw, 140px); position: absolute; text-decoration: none; top: 30px; z-index: 1; }
.brand-link img { height: 36px; width: 36px; }
.force-password-copy { max-width: 510px; position: relative; z-index: 1; }
.force-password-copy .eyebrow { color: #a8e1ce; }
.force-password-copy h1 { font-size: clamp(32px, 3.8vw, 50px); font-weight: 800; letter-spacing: 0; line-height: 1.12; margin: 12px 0 15px; }
.force-password-copy > p { color: #c1d7ce; font-size: 15px; line-height: 1.7; margin: 0; max-width: 430px; }
.security-note { align-items: flex-start; border-top: 1px solid rgba(255, 255, 255, 0.2); display: flex; gap: 12px; margin-top: 34px; padding-top: 16px; }
.security-note span { color: #eca53c; font-size: 12px; font-weight: 800; }
.security-note p { color: #d6e6df; font-size: 12px; margin: 0; }
.force-password-card { align-self: center; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--shadow-float); justify-self: center; max-width: 430px; padding: 36px; width: calc(100% - 44px); }
.form-heading { margin-bottom: 26px; }
.form-heading h2 { color: var(--ink-900); font-size: 25px; font-weight: 800; letter-spacing: 0; margin: 7px 0; }
.form-heading p { color: var(--ink-500); font-size: 13px; line-height: 1.55; margin: 0; }
.logout-link { background: none; border: 0; color: var(--ink-500); cursor: pointer; display: block; font: inherit; font-size: 12px; margin: 16px auto 0; padding: 4px; }
.logout-link:hover { color: var(--brand-700); text-decoration: underline; }
@media (max-width: 860px) {
  .force-password-page { display: flex; padding: 20px; }
  .force-password-intro { display: none; }
  .force-password-card { margin: auto; width: min(430px, 100%); }
}
@media (max-width: 480px) {
  .force-password-page { padding: 14px; }
  .force-password-card { padding: 26px 20px; }
}
</style>
