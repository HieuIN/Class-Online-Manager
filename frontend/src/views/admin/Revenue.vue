<template>
  <div>
    <div class="header-bar">
      <span class="section-title" style="margin:0">Báo cáo doanh thu</span>
      <div class="actions">
        <el-date-picker
          v-model="range"
          type="daterange"
          range-separator="→"
          start-placeholder="Từ ngày"
          end-placeholder="Đến ngày"
          value-format="YYYY-MM-DD"
          @change="load"
        />
        <el-button @click="exportCsv">↓ Xuất CSV</el-button>
      </div>
    </div>

    <el-row :gutter="14" class="mb-4">
      <el-col :span="8"><div class="metric-card"><div class="metric-label">Tổng doanh thu kỳ</div><div class="metric-value" style="color:#639922">{{ fmtMoney(totalRevenue) }}</div></div></el-col>
      <el-col :span="8"><div class="metric-card"><div class="metric-label">Trung bình/tháng</div><div class="metric-value">{{ fmtMoney(avgMonthly) }}</div></div></el-col>
      <el-col :span="8"><div class="metric-card"><div class="metric-label">Tổng giao dịch</div><div class="metric-value" style="color:#378ADD">{{ totalPayments }}</div></div></el-col>
    </el-row>

    <el-row :gutter="14" class="mb-4">
      <el-col :span="14">
        <el-card>
          <template #header><span class="section-title">Doanh thu theo tháng</span></template>
          <v-chart :option="lineOption" autoresize style="height:320px" />
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card>
          <template #header><span class="section-title">Tỉ trọng theo lớp</span></template>
          <v-chart :option="pieOption" autoresize style="height:320px" />
        </el-card>
      </el-col>
    </el-row>

    <el-card>
      <template #header><span class="section-title">Chi tiết doanh thu</span></template>
      <el-table :data="rows" size="small" stripe>
        <el-table-column label="Tháng" width="120">
          <template #default="{ row }">{{ monthLabel(row.month) }}</template>
        </el-table-column>
        <el-table-column label="Lớp" prop="class_name" min-width="220" />
        <el-table-column label="Doanh thu" width="160">
          <template #default="{ row }">{{ fmtMoney(row.revenue) }}</template>
        </el-table-column>
        <el-table-column label="Số GD" prop="payment_count" width="100" />
      </el-table>
      <div v-if="rows.length === 0" class="empty">Không có dữ liệu doanh thu trong kỳ này</div>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import dayjs from 'dayjs';
import { paymentsApi } from '@/api';
import { fmtMoney } from '@/utils/format';

use([CanvasRenderer, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent]);

const range = ref([dayjs().subtract(11, 'month').startOf('month').format('YYYY-MM-DD'), dayjs().endOf('month').format('YYYY-MM-DD')]);
const rows = ref([]);

const monthLabel = (d) => dayjs(d).format('MM/YYYY');
const totalRevenue = computed(() => rows.value.reduce((s, r) => s + +r.revenue, 0));
const totalPayments = computed(() => rows.value.reduce((s, r) => s + +r.payment_count, 0));
const monthKeys = computed(() => [...new Set(rows.value.map(r => monthLabel(r.month)))]);
const avgMonthly = computed(() => monthKeys.value.length ? Math.round(totalRevenue.value / monthKeys.value.length) : 0);
const classNames = computed(() => [...new Set(rows.value.map(r => r.class_name))]);

const totalsByMonth = computed(() => {
  const out = {};
  for (const r of rows.value) out[monthLabel(r.month)] = (out[monthLabel(r.month)] || 0) + +r.revenue;
  return out;
});

const revenueByClass = computed(() => {
  const out = {};
  for (const r of rows.value) out[r.class_name] = (out[r.class_name] || 0) + +r.revenue;
  return out;
});

const lineOption = computed(() => ({
  tooltip: { trigger: 'axis', valueFormatter: (v) => fmtMoney(v) },
  legend: { bottom: 0, textStyle: { fontSize: 11 } },
  grid: { left: 50, right: 20, top: 30, bottom: 60 },
  xAxis: { type: 'category', data: monthKeys.value },
  yAxis: { type: 'value', axisLabel: { formatter: (v) => `${Math.round(v / 1000000)}tr` } },
  series: [
    { name: 'Tổng', type: 'line', smooth: true, data: monthKeys.value.map(m => totalsByMonth.value[m] || 0), lineStyle: { width: 3 }, itemStyle: { color: '#1D9E75' } },
    ...classNames.value.map(name => ({
      name,
      type: 'line',
      smooth: true,
      data: monthKeys.value.map(m => rows.value.filter(r => monthLabel(r.month) === m && r.class_name === name).reduce((s, r) => s + +r.revenue, 0)),
    })),
  ],
}));

const pieOption = computed(() => ({
  tooltip: { trigger: 'item', valueFormatter: (v) => fmtMoney(v) },
  legend: { bottom: 0, textStyle: { fontSize: 11 } },
  series: [{
    type: 'pie',
    radius: ['42%', '70%'],
    data: Object.entries(revenueByClass.value).map(([name, value]) => ({ name, value })),
  }],
}));

const load = async () => {
  const [from, to] = range.value || [];
  if (!from || !to) return;
  rows.value = await paymentsApi.revenueReport(from, to);
};

const exportCsv = () => {
  const out = [['Tháng', 'Lớp', 'Doanh thu', 'Số GD']];
  for (const r of rows.value) out.push([monthLabel(r.month), r.class_name, r.revenue, r.payment_count]);
  const csv = '\uFEFF' + out.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bao-cao-doanh-thu-${range.value[0]}-${range.value[1]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

onMounted(load);
</script>

<style scoped>
.header-bar { display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px; gap: 12px; }
.actions { display:flex; align-items:center; gap: 8px; }
.mb-4 { margin-bottom: 14px; }
.empty { padding: 24px; text-align:center; color:#aaa; }
</style>
