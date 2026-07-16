<template>
  <div class="page-shell admin-dashboard">
    <div class="page-heading">
      <div>
        <span class="eyebrow">Trung tâm</span>
        <h1>Toàn cảnh vận hành</h1>
        <p>Theo dõi lớp học, học viên và học phí từ một nơi.</p>
      </div>
      <div class="page-actions">
        <el-button @click="$router.push('/admin/users')">Quản lý người dùng</el-button>
        <el-button type="primary" @click="$router.push('/classes')">Tạo lớp mới</el-button>
      </div>
    </div>

    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-label">Khóa học</div>
        <div class="metric-value">{{ courses.length }}</div>
        <div class="metric-sub">Đang được quản lý</div>
      </div>
      <div class="metric-card tone-blue">
        <div class="metric-label">Lớp đang vận hành</div>
        <div class="metric-value">{{ classes.length }}</div>
        <div class="metric-sub">Toàn trung tâm</div>
      </div>
      <div class="metric-card tone-violet">
        <div class="metric-label">Học viên</div>
        <div class="metric-value">{{ totalStudents }}</div>
        <div class="metric-sub">Tài khoản học viên</div>
      </div>
      <div class="metric-card tone-red">
        <div class="metric-label">Học phí cần theo dõi</div>
        <div class="metric-value money-value">{{ fmtMoney(pendingAmount) }}</div>
        <div class="metric-sub">Chưa thanh toán hoặc thanh toán một phần</div>
      </div>
    </div>

    <div class="content-grid admin-main-grid">
      <el-card>
        <template #header>
          <div class="panel-heading">
            <div>
              <div class="section-title">Lớp học đang vận hành</div>
              <div class="section-helper">Tiến độ và giáo viên phụ trách</div>
            </div>
            <el-button text type="primary" @click="$router.push('/classes')">Xem tất cả</el-button>
          </div>
        </template>
        <el-table :data="classes" size="small" empty-text="Chưa có lớp học">
          <el-table-column label="Lớp" prop="name" min-width="170" />
          <el-table-column label="Giáo viên" prop="teacherName" min-width="130" />
          <el-table-column label="Học viên" width="90" align="center">
            <template #default="{ row }">{{ row.studentCount }}</template>
          </el-table-column>
          <el-table-column label="Tiến độ" min-width="130">
            <template #default="{ row }">
              <div class="progress-cell">
                <el-progress :percentage="row.total_sessions ? Math.round(row.doneSessions / row.total_sessions * 100) : 0" :show-text="false" :stroke-width="5" />
                <span>{{ row.doneSessions }}/{{ row.total_sessions }} buổi</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="Trạng thái" width="112">
            <template #default><span class="badge badge-green">Đang học</span></template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-card class="payment-panel">
        <template #header>
          <div>
            <div class="section-title">Học phí</div>
            <div class="section-helper">Tình trạng các khoản thu</div>
          </div>
        </template>
        <v-chart :option="paymentChart" autoresize class="payment-chart" />
        <div class="payment-legend">
          <span><i class="legend-dot paid"></i>Đã thanh toán</span>
          <span><i class="legend-dot partial"></i>Một phần</span>
          <span><i class="legend-dot pending"></i>Chờ thu</span>
        </div>
      </el-card>
    </div>

    <el-card class="students-panel">
      <template #header>
        <div class="panel-heading">
          <div>
            <div class="section-title">Học viên mới</div>
            <div class="section-helper">Danh sách tài khoản học viên trong hệ thống</div>
          </div>
          <el-button text type="primary" @click="$router.push('/admin/users')">Mở quản lý học viên</el-button>
        </div>
      </template>
      <el-table :data="students" size="small" empty-text="Chưa có học viên">
        <el-table-column label="Học viên" prop="fullName" min-width="160" />
        <el-table-column label="Email" prop="email" min-width="190" />
        <el-table-column label="Điện thoại" prop="phone" min-width="120" />
        <el-table-column label="Ngày tạo" min-width="120">
          <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="Trạng thái" width="110">
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
.page-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.money-value { font-size: 21px; }
.admin-main-grid { margin-bottom: 16px; }
.progress-cell { align-items: center; display: flex; gap: 8px; }
.progress-cell :deep(.el-progress) { flex: 1; min-width: 48px; }
.progress-cell span { color: var(--ink-500); font-size: 11px; white-space: nowrap; }
.payment-chart { height: 208px; }
.payment-legend { display: grid; gap: 8px; margin: -2px 0 3px; }
.payment-legend span { align-items: center; color: var(--ink-500); display: flex; font-size: 12px; gap: 7px; }
.legend-dot { border-radius: 50%; height: 8px; width: 8px; }
.legend-dot.paid { background: #7cc242; }
.legend-dot.partial { background: #ef9f27; }
.legend-dot.pending { background: #e24b4a; }
.students-panel { margin-top: 0; }
@media (max-width: 768px) {
  .page-actions { width: 100%; }
  .page-actions :deep(.el-button) { flex: 1; margin-left: 0; }
  .money-value { font-size: 18px; }
}
</style>
