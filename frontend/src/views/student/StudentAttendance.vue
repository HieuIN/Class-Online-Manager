<template>
  <div>
    <ClassPicker @change="reload" />

    <el-row :gutter="14" class="mb-4">
      <el-col :span="6"><div class="metric-card"><div class="metric-label">Tổng buổi</div><div class="metric-value">{{ stats.total }}</div></div></el-col>
      <el-col :span="6"><div class="metric-card"><div class="metric-label">Có mặt</div><div class="metric-value" style="color:#639922">{{ stats.present }}</div></div></el-col>
      <el-col :span="6"><div class="metric-card"><div class="metric-label">Vắng</div><div class="metric-value" style="color:#E24B4A">{{ stats.absent }}</div></div></el-col>
      <el-col :span="6"><div class="metric-card"><div class="metric-label">Đi muộn</div><div class="metric-value" style="color:#EF9F27">{{ stats.late }}</div></div></el-col>
    </el-row>

    <el-card class="mb-4">
      <template #header><span class="section-title">Chuyên cần tổng thể</span></template>
      <el-progress :percentage="pct" :stroke-width="14" :color="barColor" />
      <div class="meta-row">
        <span>{{ pct }}%</span>
        <span :class="['badge', pct >= 80 ? 'badge-green' : pct >= 60 ? 'badge-amber' : 'badge-red']">
          {{ pct >= 80 ? 'Tốt' : pct >= 60 ? 'Cần cải thiện' : 'Cảnh báo' }}
        </span>
      </div>
    </el-card>

    <el-card>
      <template #header><span class="section-title">Chi tiết từng buổi</span></template>
      <el-table :data="records" size="small">
        <el-table-column label="Buổi" prop="session_no" width="80" />
        <el-table-column label="Ngày" width="130">
          <template #default="{ row }">{{ fmtDate(row.planned_date) }}</template>
        </el-table-column>
        <el-table-column label="Chủ đề" prop="topic" />
        <el-table-column label="Trạng thái" width="130">
          <template #default="{ row }">
            <span :class="['badge', attendanceBadge(row.status).cls]">{{ attendanceBadge(row.status).label }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useClassStore } from '@/stores/class';
import ClassPicker from '@/components/ClassPicker.vue';
import { attendanceApi } from '@/api';
import { attendanceBadge, fmtDate } from '@/utils/format';

const auth = useAuthStore();
const classStore = useClassStore();
const stats = ref({ total: 0, present: 0, absent: 0, late: 0 });
const records = ref([]);

const pct = computed(() => stats.value.total ? Math.round(stats.value.present / stats.value.total * 100) : 100);
const barColor = computed(() => pct.value >= 80 ? '#639922' : pct.value >= 60 ? '#EF9F27' : '#E24B4A');

const reload = async () => {
  const cid = classStore.selectedId;
  if (!cid || !auth.user) return;
  stats.value = await attendanceApi.stats(auth.user.id, cid);
  records.value = await attendanceApi.byStudent(auth.user.id, cid);
};

watch(() => classStore.selectedId, reload);
onMounted(reload);
</script>

<style scoped>
.mb-4 { margin-bottom: 14px; }
.meta-row { display:flex; justify-content:space-between; margin-top: 10px; font-weight: 600; }
</style>
