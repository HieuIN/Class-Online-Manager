<template>
  <router-view />
</template>

<script setup>
import { onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();

const enforcePasswordChange = () => {
  if (auth.isAuthenticated && auth.user?.mustChangePassword && router.currentRoute.value.path !== '/force-change-password') {
    router.replace('/force-change-password');
  }
};

onMounted(async () => {
  if (!auth.isAuthenticated) return;
  await auth.fetchMe();
  enforcePasswordChange();
});

watch(() => auth.user?.mustChangePassword, enforcePasswordChange);
</script>
