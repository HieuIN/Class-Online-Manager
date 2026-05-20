<template>
  <div>
    <el-row :gutter="14" class="mb-4">
      <el-col :span="6"><div class="metric-card"><div class="metric-label">Tổng khóa học</div><div class="metric-value">{{ courses.length }}</div></div></el-col>
      <el-col :span="6"><div class="metric-card"><div class="metric-label">Lớp đang chạy</div><div class="metric-value">{{ classes.length }}</div></div></el-col>
      <el-col :span="6"><div class="metric-card"><div class="metric-label">Tổng học viên</div><div class="metric-value">{{ totalStudents }}</div></div></el-col>
      <el-col :span="6"><div class="metric-card"><div class="metric-label">Học phí chờ thu</div><div class="metric-value" style="color:#E24B4A;font-size:18px">{{ fmtMoney(pendingAmount) }}</div></div></el-col>
    </el-row>

    <el-row :gutter="14" class="mb-4">
      <el-col :span="14">
        <el-card>
          <template #header>
            <div class="header-line"><span class="section-title">Danh sách lớp</span>
              <el-button type="primary" size="small" @click="$router.push('/classes')">+ Tạo lớp</el-button>
            </div>
          </template>
          <el-table :data="classes" size="small">
            <el-table-column label="Lớp" prop="name" />
            <el-table-column label="GV" prop="teacherName" width="140" />
            <el-table-column label="HV" width="60">
              <template #default="{ row }">{{ row.studentCount }}</template>
            </el-table-column>
            <el-table-column label="Buổi" width="100">
              <template #default="{ row }">{{ row.doneSessions }}/{{ row.total_sessions }}</template>
            </el-table-column>
            <el-table-column label="Trạng thái" width="100">
              <template #default><span class="badge badge-green">Đang học</span></template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card>
          <template #header><span class="section-title">Tình trạng học phí</span></template>
          <v-chart :option="paymentChart" autoresize style="height:240px" />
        </el-card>
      </el-col>
    </el-row>

    <el-card>
      <template #header><span class="section-title">Quản lý học viên</span></template>
      <el-table :data="students" size="small">
        <el-table-column label="Học viên" prop="fullName" />
        <el-table-column label="Email" prop="email" />
        <el-table-column label="SĐT" prop="phone" width="120" />
        <el-table-column label="Ngày tạo" width="130">
          <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="Trạng thái" width="100">
          <template #default="{ row }">
            <span :class="['badge', row.isActive ? 'badge-green' : 'badge-gray']">
              {{ row.isActive ? 'Hoạt động' : 'Khóa' }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { coursesApi, classesApi, usersApi, paymentsApi } from '@/api';
import { fmtMoney, fmtDate } from '@/utils/format';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { PieChart } from 'echarts/charts';
import { TooltipComponent, LegendComponent } from 'echarts/components';

use([CanvasRenderer, PieChart, TooltipComponent, LegendComponent]);

const courses = ref([]);
const classes = ref([]);
const students = ref([]);
const paySummary = ref({ PAID: { total: 0, count: 0 }, PENDING: { total: 0, count: 0 }, PARTIAL: { total: 0, count: 0 } });

const totalStudents = computed(() => students.value.length);
const pendingAmount = computed(() => (paySummary.value.PENDING?.total || 0) + (paySummary.value.PARTIAL?.total || 0));

const paymentChart = computed(() => ({
  tooltip: { trigger: 'item' },
  legend: { bottom: 0 },
  series: [{
    type: 'pie', radius: ['40%', '70%'],
    data: [
      { value: paySummary.value.PAID?.count || 0, name: 'Đã đóng', itemStyle: { color: '#7CC242' } },
      { value: paySummary.value.PARTIAL?.count || 0, name: 'Một phần', itemStyle: { color: '#EF9F27' } },
      { value: paySummary.value.PENDING?.count || 0, name: 'Chưa đóng', itemStyle: { color: '#E24B4A' } },
    ],
  }],
}));

onMounted(async () => {
  courses.value = await coursesApi.list();
  classes.value = await classesApi.list();
  students.value = await usersApi.list('STUDENT');
  try { paySummary.value = await paymentsApi.summary(); } catch {}
});
</script>

<style scoped>
.mb-4 { margin-bottom: 14px; }
.header-line { display:flex; justify-content:space-between; align-items:center; }
</style>
