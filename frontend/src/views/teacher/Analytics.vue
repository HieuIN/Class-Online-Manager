<template>
  <div>
    <ClassPicker @change="reload" />
    <el-row :gutter="14" class="mb-4">
      <el-col :span="8"><div class="metric-card"><div class="metric-label">Chuyên cần TB</div><div class="metric-value">{{ avgAttendance }}%</div></div></el-col>
      <el-col :span="8"><div class="metric-card"><div class="metric-label">Nộp bài</div><div class="metric-value">{{ onTimeRate }}%</div></div></el-col>
      <el-col :span="8"><div class="metric-card"><div class="metric-label">Điểm TB lớp</div><div class="metric-value">{{ avgGrade }}</div></div></el-col>
    </el-row>

    <el-tabs>
      <el-tab-pane label="Tổng quan">
        <el-row :gutter="14">
          <el-col :span="12"><el-card><template #header><span class="section-title">Phân bố điểm</span></template><v-chart :option="distOption" autoresize style="height:260px" /></el-card></el-col>
          <el-col :span="12"><el-card><template #header><span class="section-title">Chuyên cần theo học viên</span></template><v-chart :option="attOption" autoresize style="height:260px" /></el-card></el-col>
        </el-row>
        <el-card class="mt-3"><template #header><span class="section-title">Tỉ lệ nộp bài</span></template><v-chart :option="subOption" autoresize style="height:260px" /></el-card>
      </el-tab-pane>

      <el-tab-pane label="So sánh lớp">
        <el-card>
          <template #header>
            <div class="header-line">
              <span class="section-title">So sánh lớp</span>
              <el-select v-model="compareClassIds" multiple collapse-tags style="width:360px" @change="loadCompare">
                <el-option v-for="c in classStore.classes" :key="c.id" :label="c.name" :value="c.id" />
              </el-select>
            </div>
          </template>
          <v-chart :option="compareOption" autoresize style="height:300px" />
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="Ranking">
        <el-card>
          <template #header><span class="section-title">Xếp hạng học viên</span></template>
          <el-table :data="ranking" size="small" stripe>
            <el-table-column type="index" label="#" width="56" />
            <el-table-column prop="studentName" label="Học viên" min-width="180" />
            <el-table-column prop="averageScore" label="Điểm TB" width="100" />
            <el-table-column prop="attendanceRate" label="Chuyên cần" width="110">
              <template #default="{ row }">{{ row.attendanceRate }}%</template>
            </el-table-column>
            <el-table-column prop="submissionRate" label="Nộp bài" width="100">
              <template #default="{ row }">{{ row.submissionRate }}%</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="Dự đoán">
        <el-card>
          <template #header><span class="section-title">Dự đoán điểm cuối kỳ</span></template>
          <el-table :data="predictions" size="small" stripe>
            <el-table-column prop="studentName" label="Học viên" min-width="180" />
            <el-table-column prop="currentAverage" label="TB hiện tại" width="120" />
            <el-table-column prop="predictedFinal" label="Dự đoán" width="110" />
            <el-table-column prop="missingWeight" label="Hệ số còn thiếu" width="130" />
            <el-table-column label="Rủi ro" width="120">
              <template #default="{ row }">
                <span :class="['badge', riskBadge(row.riskLevel).cls]">{{ riskBadge(row.riskLevel).label }}</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="Heatmap">
        <el-card>
          <template #header><span class="section-title">Heatmap chuyên cần</span></template>
          <div class="heatmap">
            <div v-for="d in heatmap" :key="d.sessionId" :class="['heat-cell', heatClass(d)]" :title="`Buổi ${d.sessionNo}: vắng ${d.absent}, muộn ${d.late}`">
              <span>{{ shortDate(d.date) }}</span>
              <b>{{ d.absent + d.late }}</b>
            </div>
          </div>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="Bài tập khó">
        <el-card>
          <template #header><span class="section-title">Phân tích bài tập khó</span></template>
          <el-table :data="assignmentDifficulty" size="small" stripe>
            <el-table-column prop="title" label="Bài tập" min-width="180" />
            <el-table-column prop="avgScore" label="Điểm TB" width="100">
              <template #default="{ row }">{{ row.avgScore ?? '—' }}</template>
            </el-table-column>
            <el-table-column prop="submitted" label="Đã nộp" width="90" />
            <el-table-column prop="missing" label="Chưa nộp" width="100" />
            <el-table-column prop="revision" label="Cần sửa" width="90" />
            <el-table-column label="Đánh giá" width="120">
              <template #default="{ row }">
                <span :class="['badge', difficultyBadge(row).cls]">{{ difficultyBadge(row).label }}</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>
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
import { classesApi, gradesApi, assignmentsApi, submissionsApi, attendanceApi, analyticsApi } from '@/api';

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent, LegendComponent]);

const classStore = useClassStore();
const distribution = ref({ yeu: 0, tb: 0, kha: 0, gioi: 0 });
const attStats = ref([]);
const subStats = ref([]);
const avgGrade = ref('—');
const onTimeRate = ref(0);
const ranking = ref([]);
const predictions = ref([]);
const heatmap = ref([]);
const assignmentDifficulty = ref([]);
const compareRows = ref([]);
const compareClassIds = ref([]);

const avgAttendance = computed(() => {
  if (!attStats.value.length) return 0;
  const sum = attStats.value.reduce((s, x) => s + (x.total ? (x.P + x.L * 0.5) / x.total * 100 : 0), 0);
  return Math.round(sum / attStats.value.length);
});

const distOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: ['Yếu (<5)', 'TB (5-7)', 'Khá (7-8.5)', 'Giỏi (≥8.5)'] },
  yAxis: { type: 'value', minInterval: 1 },
  series: [{ type: 'bar', data: [distribution.value.yeu, distribution.value.tb, distribution.value.kha, distribution.value.gioi], itemStyle: { color: (p) => ['#FCEBEB', '#FAEEDA', '#E6F1FB', '#EAF3DE'][p.dataIndex] } }],
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
const compareOption = computed(() => ({
  tooltip: { trigger: 'axis' }, legend: { bottom: 0 },
  xAxis: { type: 'category', data: compareRows.value.map(r => r.className) },
  yAxis: { type: 'value' },
  series: [
    { name: 'Điểm TB', type: 'bar', data: compareRows.value.map(r => r.avgGrade), itemStyle: { color: '#185FA5' } },
    { name: 'Chuyên cần %', type: 'bar', data: compareRows.value.map(r => r.attendanceRate), itemStyle: { color: '#1D9E75' } },
    { name: 'Nộp bài %', type: 'bar', data: compareRows.value.map(r => r.submissionRate), itemStyle: { color: '#EF9F27' } },
  ],
}));

const riskBadge = (risk) => ({
  HIGH: { label: 'Cao', cls: 'badge-red' },
  MEDIUM: { label: 'Trung bình', cls: 'badge-amber' },
  LOW: { label: 'Thấp', cls: 'badge-green' },
  NO_DATA: { label: 'Chưa có dữ liệu', cls: 'badge-gray' },
}[risk] || { label: risk, cls: 'badge-gray' });
const heatClass = (d) => {
  const rate = d.total ? (d.absent + d.late) / d.total : 0;
  if (rate >= 0.5) return 'heat-high';
  if (rate >= 0.25) return 'heat-mid';
  if (rate > 0) return 'heat-low';
  return 'heat-none';
};
const difficultyBadge = (row) => {
  const missingRate = row.total ? row.missing / row.total : 0;
  if ((row.avgScore != null && row.avgScore < 5) || missingRate >= 0.4) return { label: 'Khó', cls: 'badge-red' };
  if ((row.avgScore != null && row.avgScore < 7) || row.revision > 0 || missingRate >= 0.2) return { label: 'Cần ôn', cls: 'badge-amber' };
  return { label: 'Ổn', cls: 'badge-green' };
};
const shortDate = (d) => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

const loadCompare = async () => {
  compareRows.value = compareClassIds.value.length ? await analyticsApi.compareClasses(compareClassIds.value) : [];
};

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
  [ranking.value, predictions.value, heatmap.value, assignmentDifficulty.value] = await Promise.all([
    analyticsApi.ranking(cid),
    analyticsApi.predictFinal(cid),
    analyticsApi.attendanceHeatmap(cid),
    analyticsApi.assignmentDifficulty(cid),
  ]);
  if (!compareClassIds.value.length && classStore.classes.length) compareClassIds.value = [cid, ...classStore.classes.filter(c => c.id !== cid).slice(0, 2).map(c => c.id)];
  await loadCompare();
};

watch(() => classStore.selectedId, reload);
onMounted(async () => {
  if (!classStore.classes.length) await classStore.fetchClasses();
  reload();
});
</script>

<style scoped>
.mb-4 { margin-bottom: 14px; }
.mt-3 { margin-top: 12px; }
.header-line { display:flex; justify-content:space-between; align-items:center; gap: 12px; }
.heatmap { display:grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 8px; }
.heat-cell { min-height: 58px; border-radius: 8px; padding: 8px; display:flex; flex-direction:column; justify-content:space-between; font-size: 11px; }
.heat-cell b { font-size: 18px; }
.heat-none { background:#F5F4F0; color:#888; }
.heat-low { background:#EAF3DE; color:#3B6D11; }
.heat-mid { background:#FAEEDA; color:#854F0B; }
.heat-high { background:#FCEBEB; color:#A32D2D; }
@media (max-width: 768px) {
  .header-line { flex-direction:column; align-items:flex-start; }
}
</style>
