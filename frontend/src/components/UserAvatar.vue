<template>
  <el-avatar :size="size" :src="avatarUrl || undefined" :style="avatarStyle">
    {{ avatarUrl ? '' : initials(name) }}
  </el-avatar>
</template>

<script setup>
import { computed } from 'vue';
import { initials } from '@/utils/format';

const props = defineProps({
  user: { type: Object, default: () => ({}) },
  size: { type: Number, default: 32 },
});

const name = computed(() => props.user?.fullName || props.user?.full_name || props.user?.name || props.user?.authorName || '');
const avatarUrl = computed(() => props.user?.avatarUrl || props.user?.avatar_url || props.user?.authorAvatarUrl || '');
const avatarStyle = computed(() => ({
  background: '#E1F5EE',
  color: '#0F6E56',
  fontWeight: 600,
}));
</script>
