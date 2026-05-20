<template>
  <div>
    <ClassPicker @change="reload" />

    <el-row :gutter="14" class="mb-4">
      <el-col :span="8"><div class="metric-card"><div class="metric-label">Điểm TB</div><div class="metric-value">{{ avg.average || '—' }}</div></div></el-col>
      <el-col :span="8"><div class="metric-card"><div class="metric-label">Xếp loại</div><div class="metric-value"><span :class="['badge', gradeClassify(avg.average).cls]" style="font-size:14px">{{ gradeClassify(avg.average).label }}</span></div></div></el-col>
      <el-col :span="8"><div class="metric-card"><div class="metric-label">Lớp</div><div class="metric-value" style="font-size:15px">{{ classStore.selected?.name }}</div></div></el-col>
    </el-row>

    <el-card>
      <template #header><span class="section-title">Bảng điểm chi tiết</span></template>
      <el-table :data="grades" size="default">
        <el-table-column label="Cột điểm" prop="itemName" />
        <el-table-column label="Hệ số" width="100">
          <template #default="{ row }">{{ row.weight }}%</template>
        </el-table-column>
        <el-table-column label="Tối đa" prop="maxScore" width="80" />
        <el-table-column label="Điểm của bạn" width="140">
          <template #default="{ row }">
            <span class="score" :style="{ color: scoreColor(row.score) }">
              {{ row.score != null ? row.score : '—' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="Nhận xét giáo viên" prop="feedback" />
      </el-table>
      <el-divider />
      <div class="avg-row">
        <span class="avg-label">Điểm trung bình</span>
        <span class="avg-value">{{ avg.average || '—' }}</span>
        <span :class="['badge', gradeClassify(avg.average).cls]">{{ gradeClassify(avg.average).label }}</span>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useClassStore } from '@/stores/class';
import ClassPicker from '@/components/ClassPicker.vue';
import { gradesApi } from '@/api';
import { gradeClassify } from '@/utils/format';

const auth = useAuthStore();
const classStore = useClassStore();
const grades = ref([]);
const avg = ref({ average: null });

const scoreColor = (s) => s == null ? '#ddd' : s >= 8 ? '#639922' : s >= 5 ? 'inherit' : '#E24B4A';

const reload = async () => {
  const cid = classStore.selectedId;
  if (!cid || !auth.user) return;
  grades.value = await gradesApi.byStudent(auth.user.id, cid);
  avg.value = await gradesApi.average(auth.user.id, cid);
};

watch(() => classStore.selectedId, reload);
onMounted(reload);
</script>

<style scoped>
.mb-4 { margin-bottom: 14px; }
.score { font-size: 18px; font-weight: 600; }
.avg-row { display:flex; align-items:center; gap: 12px; font-weight: 600; }
.avg-label { flex: 1; }
.avg-value { font-size: 20px; }
</style>
