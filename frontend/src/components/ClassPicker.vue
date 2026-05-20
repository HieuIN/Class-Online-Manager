<template>
  <div class="class-picker">
    <span class="label">Lớp:</span>
    <el-select v-model="selectedId" @change="onChange" size="default" style="width: 280px;">
      <el-option v-for="c in classes" :key="c.id" :label="c.name" :value="c.id" />
    </el-select>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useClassStore } from '@/stores/class';

const emit = defineEmits(['change']);
const store = useClassStore();
const classes = computed(() => store.classes);
const selectedId = computed({
  get: () => store.selectedId,
  set: (v) => store.select(v),
});

const onChange = (v) => emit('change', v);
</script>

<style scoped>
.class-picker { display:flex; align-items:center; gap: 10px; margin-bottom: 16px; }
.label { font-size: 13px; color: #666; }
</style>
