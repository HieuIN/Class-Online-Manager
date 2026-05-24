<template>
  <div>
    <el-row :gutter="14">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="header-line">
              <span class="section-title">Backup</span>
              <el-button size="small" type="primary" @click="createBackup">Tạo backup</el-button>
            </div>
          </template>
          <el-table :data="backups" size="small">
            <el-table-column prop="fileName" label="File" />
            <el-table-column label="Kích thước" width="110">
              <template #default="{ row }">{{ row.size }} B</template>
            </el-table-column>
            <el-table-column width="90">
              <template #default="{ row }"><el-button size="small" @click="downloadBackup(row)">Tải</el-button></template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="header-line">
              <span class="section-title">Tự động hóa</span>
              <el-button size="small" @click="runBirthdays">Chúc sinh nhật</el-button>
            </div>
          </template>
          <el-date-picker v-model="commissionMonth" type="month" value-format="YYYY-MM" />
          <el-button style="margin-left:8px" @click="loadCommissions">Tính hoa hồng</el-button>
          <el-table :data="commissions" size="small" style="margin-top:12px">
            <el-table-column prop="teacherName" label="Giáo viên" />
            <el-table-column label="Doanh thu"><template #default="{ row }">{{ fmtMoney(row.revenue) }}</template></el-table-column>
            <el-table-column label="Hoa hồng"><template #default="{ row }">{{ fmtMoney(row.commission) }}</template></el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="mt">
      <template #header><span class="section-title">Audit log</span></template>
      <el-table :data="logs" size="small">
        <el-table-column prop="created_at" label="Thời gian" width="170" />
        <el-table-column prop="actorName" label="Người thao tác" width="160" />
        <el-table-column prop="action" label="Hành động" width="160" />
        <el-table-column prop="entity_type" label="Đối tượng" width="120" />
        <el-table-column prop="entity_id" label="ID" width="80" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { opsApi, paymentsApi } from '@/api';
import { fmtMoney } from '@/utils/format';

const backups = ref([]);
const logs = ref([]);
const commissions = ref([]);
const commissionMonth = ref(new Date().toISOString().slice(0, 7));

const load = async () => {
  backups.value = await opsApi.backups();
  logs.value = await opsApi.auditLogs();
};

const createBackup = async () => {
  await opsApi.createBackup();
  ElMessage.success('Đã tạo backup');
  backups.value = await opsApi.backups();
};

const downloadBackup = async (row) => {
  const blob = await opsApi.downloadBackup(row.fileName);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = row.fileName;
  a.click();
  URL.revokeObjectURL(url);
};

const runBirthdays = async () => {
  const rows = await opsApi.runBirthdays();
  ElMessage.success(`Đã tạo ${rows.length || 0} thông báo sinh nhật`);
};

const loadCommissions = async () => {
  commissions.value = await paymentsApi.commissions(commissionMonth.value);
};

onMounted(async () => { await load(); await loadCommissions(); });
</script>

<style scoped>
.header-line { display:flex; justify-content:space-between; align-items:center; }
.mt { margin-top:14px; }
@media (max-width: 768px) {
  :deep(.el-col) { max-width:100%; flex:0 0 100%; margin-bottom:12px; }
}
</style>
