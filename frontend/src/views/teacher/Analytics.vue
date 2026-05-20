<template>
  <div>
    <ClassPicker @change="reload" />
    <el-row :gutter="14" class="mb-4">
      <el-col :span="8"><div class="metric-card"><div class="metric-label">Chuyên cần TB</div><div class="metric-value">{{ avgAttendance }}%</div></div></el-col>
      <el-col :span="8"><div class="metric-card"><div class="metric-label">Nộp bài đúng hạn</div><div class="metric-value">{{ onTimeRate }}%</div></div></el-col>
      <el-col :span="8"><div class="metric-card"><div class="metric-label">Điểm TB lớp</div><div class="metric-value">{{ avgGrade }}</div></div></el-col>
    </el-row>
    <el-row :gutter="14">
      <el-col :span="12"><el-card><template #header><span class="section-title">Phân bố điểm</span></template><v-chart :option="distOption" autoresize style="height:260px" /></el-card></el-col>
      <el-col :span="12"><el-card><template #header><span class="section-title">Chuyên cần theo học viên</span></template><v-chart :option="attOption" autoresize style="height:260px" /></el-card></el-col>
    </el-row>
    <el-card class="mt-3"><template #header><span class="section-title">Tỉ lệ nộp bài</span></template><v-chart :option="subOption" autoresize style="height:260px" /></el-card>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useClassStore } from '@/stores/class';
import ClassPicker from '@/components/ClassPicker.vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { classesApi, gradesApi, assignmentsApi, submissionsApi, attendanceApi } from '@/api';

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent, LegendComponent]);

const classStore = useClassStore();
const distribution = ref({ yeu: 0, tb: 0, kha: 0, gioi: 0 });
const attStats = ref([]);
const subStats = ref([]);
const avgGrade = ref('—');
const onTimeRate = ref(0);

const avgAttendance = computed(() => {
  if (!attStats.value.length) return 0;
  const sum = attStats.value.reduce((s, x) => s + (x.total ? (x.P + x.L*0.5) / x.total * 100 : 0), 0);
  return Math.round(sum / attStats.value.length);
});

const distOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: ['Yếu (<5)', 'TB (5-7)', 'Khá (7-8.5)', 'Giỏi (≥8.5)'] },
  yAxis: { type: 'value', minInterval: 1 },
  series: [{ type: 'bar', data: [distribution.value.yeu, distribution.value.tb, distribution.value.kha, distribution.value.gioi],
    itemStyle: { color: (p) => ['#FCEBEB','#FAEEDA','#E6F1FB','#EAF3DE'][p.dataIndex] } }],
}));

const attOption = computed(() => ({
  tooltip: { trigger: 'axis' }, legend: { bottom: 0, textStyle: { fontSize: 11 } },
  xAxis: { type: 'category', data: attStats.value.map(s => s.name.split(' ').pop()) },
  yAxis: { type: 'value' },
  series: [
    { name: 'Có mặt', type: 'bar', stack: 'a', data: attStats.value.map(s => s.P), itemStyle: { color: '#7CC242' } },
    { name: 'Vắng', type: 'bar', stack: 'a', data: attStats.value.map(s => s.A), itemStyle: { color: '#E24B4A' } },
    { name: 'Muộn', type: 'bar', stack: 'a', data: attStats.value.map(s => s.L), itemStyle: { color: '#EF9F27' } },
  ],
}));

const subOption = computed(() => ({
  tooltip: { trigger: 'axis' }, legend: { bottom: 0, textStyle: { fontSize: 11 } },
  yAxis: { type: 'category', data: subStats.value.map(s => s.title) },
  xAxis: { type: 'value' },
  series: [
    { name: 'Đã nộp', type: 'bar', stack: 'a', data: subStats.value.map(s => s.submitted), itemStyle: { color: '#7CC242' } },
    { name: 'Chưa nộp', type: 'bar', stack: 'a', data: subStats.value.map(s => s.missing), itemStyle: { color: '#E24B4A' } },
  ],
}));

const reload = async () => {
  const cid = classStore.selectedId;
  if (!cid) return;
  const students = await classesApi.students(cid);
  try { distribution.value = await gradesApi.distribution(cid); } catch {}
  attStats.value = [];
  let totalG = 0, cnt = 0;
  for (const st of students) {
    try {
      const s = await attendanceApi.stats(st.id, cid);
      attStats.value.push({ name: st.fullName, P: s.present, A: s.absent, L: s.late, total: s.total });
      const a = await gradesApi.average(st.id, cid);
      if (a.average) { totalG += +a.average; cnt++; }
    } catch {}
  }
  avgGrade.value = cnt ? (totalG / cnt).toFixed(1) : '—';
  const asgs = await assignmentsApi.list(cid);
  subStats.value = [];
  let subSum = 0, missSum = 0;
  for (const a of asgs) {
    try {
      const m = await submissionsApi.matrix(a.id);
      const submitted = m.filter(x => x.status && x.status !== 'NOT_SUBMITTED').length;
      const missing = m.length - submitted;
      subStats.value.push({ title: a.title, submitted, missing });
      subSum += submitted; missSum += missing;
    } catch {}
  }
  onTimeRate.value = (subSum + missSum) ? Math.round(subSum / (subSum + missSum) * 100) : 0;
};

watch(() => classStore.selectedId, reload);
onMounted(reload);
</script>

<style scoped>
.mb-4 { margin-bottom: 14px; } .mt-3 { margin-top: 12px; }
</style>
