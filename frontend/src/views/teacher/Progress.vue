<template>
  <div>
    <ClassPicker @change="reload" />

    <el-row :gutter="14" class="mb-4">
      <el-col :span="8"><div class="metric-card"><div class="metric-label">Tổng buổi kế hoạch</div><div class="metric-value">{{ progress.total || 0 }}</div></div></el-col>
      <el-col :span="8"><div class="metric-card"><div class="metric-label">Đã dạy xong</div><div class="metric-value" style="color:#639922">{{ progress.done || 0 }}</div></div></el-col>
      <el-col :span="8"><div class="metric-card"><div class="metric-label">Buổi delay</div><div class="metric-value" style="color:#EF9F27">{{ progress.delayed || 0 }}</div></div></el-col>
    </el-row>

    <el-card class="mb-4">
      <template #header><span class="section-title">Tiến độ tổng thể</span></template>
      <el-progress :percentage="progress.percent || 0" :stroke-width="14" color="#1D9E75" />
      <div class="progress-meta">
        <span>{{ progress.percent || 0 }}% hoàn thành</span>
        <span>{{ progress.done || 0 }}/{{ progress.total || 0 }} buổi</span>
      </div>
      <el-alert v-if="progress.delayed" type="warning" :title="`Có ${progress.delayed} buổi bị delay so với kế hoạch`" show-icon :closable="false" style="margin-top:14px"/>
    </el-card>

    <el-card>
      <template #header><span class="section-title">Kế hoạch vs Thực tế</span></template>
      <el-table :data="progress.sessions || []" size="small" stripe>
        <el-table-column label="#" prop="session_no" width="60" />
        <el-table-column label="Chủ đề" prop="topic" />
        <el-table-column label="Ngày KH" width="120">
          <template #default="{ row }">{{ fmtDate(row.planned_date) }}</template>
        </el-table-column>
        <el-table-column label="Ngày thực tế" width="130">
          <template #default="{ row }">{{ fmtDate(row.actual_date) }}</template>
        </el-table-column>
        <el-table-column label="Trạng thái" width="120">
          <template #default="{ row }">
            <span :class="['badge', row.status === 'DONE' ? 'badge-green' : 'badge-gray']">
              {{ row.status === 'DONE' ? 'Đã dạy' : 'Kế hoạch' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="Ghi chú" prop="note" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useClassStore } from '@/stores/class';
import ClassPicker from '@/components/ClassPicker.vue';
import { sessionsApi } from '@/api';
import { fmtDate } from '@/utils/format';

const classStore = useClassStore();
const progress = ref({});

const reload = async () => {
  const cid = classStore.selectedId;
  if (!cid) return;
  progress.value = await sessionsApi.progress(cid);
};

watch(() => classStore.selectedId, reload);
onMounted(reload);
</script>

<style scoped>
.mb-4 { margin-bottom: 14px; }
.progress-meta { display:flex; justify-content:space-between; font-size: 12px; color: #888; margin-top: 8px; }
</style>
