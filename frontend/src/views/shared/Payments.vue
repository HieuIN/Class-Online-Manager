<template>
  <div>
    <ClassPicker @change="reload" />

    <el-row :gutter="14" class="mb-4">
      <el-col :span="8"><div class="metric-card"><div class="metric-label">Đã thu</div><div class="metric-value" style="color:#639922">{{ fmtMoney(totalPaid) }}</div></div></el-col>
      <el-col :span="8"><div class="metric-card"><div class="metric-label">Còn nợ</div><div class="metric-value" style="color:#E24B4A">{{ fmtMoney(totalUnpaid) }}</div></div></el-col>
      <el-col :span="8"><div class="metric-card"><div class="metric-label">Tổng</div><div class="metric-value">{{ fmtMoney(totalAll) }}</div></div></el-col>
    </el-row>

    <el-card>
      <template #header><span class="section-title">Học phí – {{ classStore.selected?.name }}</span></template>
      <el-table :data="payments" size="small">
        <el-table-column label="Học viên" prop="studentName" min-width="180" />
        <el-table-column label="Số tiền" width="140">
          <template #default="{ row }">{{ fmtMoney(row.amount) }}</template>
        </el-table-column>
        <el-table-column label="Đã đóng" width="140">
          <template #default="{ row }">{{ fmtMoney(row.paid_amount) }}</template>
        </el-table-column>
        <el-table-column label="Trạng thái" width="130">
          <template #default="{ row }">
            <span :class="['badge', paymentBadge(row.status).cls]">{{ paymentBadge(row.status).label }}</span>
          </template>
        </el-table-column>
        <el-table-column label="Hạn nộp" width="120">
          <template #default="{ row }">{{ fmtDate(row.due_date) }}</template>
        </el-table-column>
        <el-table-column label="Ngày đóng" width="120">
          <template #default="{ row }">{{ row.paid_at ? fmtDate(row.paid_at) : '—' }}</template>
        </el-table-column>
        <el-table-column label="Hóa đơn" width="110">
          <template #default="{ row }">
            <el-button size="small" @click="downloadInvoice(row)">PDF</el-button>
          </template>
        </el-table-column>
        <el-table-column label="Hành động" width="140">
          <template #default="{ row }">
            <el-button v-if="row.status !== 'PAID'" size="small" type="primary" @click="openPay(row)">Ghi nhận</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showPay" title="Ghi nhận thanh toán" width="380px">
      <el-form v-if="payRow" label-position="top">
        <el-form-item label="Học viên"><b>{{ payRow.studentName }}</b></el-form-item>
        <el-form-item label="Tổng học phí">{{ fmtMoney(payRow.amount) }}</el-form-item>
        <el-form-item label="Số tiền thu lần này">
          <el-input-number v-model="payAmount" :min="0" :max="+payRow.amount" :step="100000" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPay = false">Hủy</el-button>
        <el-button type="primary" @click="confirmPay">Xác nhận</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useClassStore } from '@/stores/class';
import { ElMessage } from 'element-plus';
import ClassPicker from '@/components/ClassPicker.vue';
import { paymentsApi } from '@/api';
import { fmtMoney, fmtDate, paymentBadge } from '@/utils/format';

const classStore = useClassStore();
const payments = ref([]);
const showPay = ref(false);
const payRow = ref(null);
const payAmount = ref(0);

const totalPaid = computed(() => payments.value.filter(p => p.status === 'PAID').reduce((s, p) => s + +p.amount, 0));
const totalUnpaid = computed(() => payments.value.filter(p => p.status !== 'PAID').reduce((s, p) => s + (+p.amount - +p.paid_amount), 0));
const totalAll = computed(() => totalPaid.value + totalUnpaid.value);

const reload = async () => {
  if (!classStore.selectedId) return;
  payments.value = await paymentsApi.list({ classId: classStore.selectedId });
};

const openPay = (row) => { payRow.value = row; payAmount.value = +row.amount - +row.paid_amount; showPay.value = true; };

const confirmPay = async () => {
  await paymentsApi.pay(payRow.value.id, payAmount.value);
  ElMessage.success('Đã ghi nhận thanh toán');
  showPay.value = false;
  reload();
};

const downloadInvoice = async (row) => {
  const blob = await paymentsApi.downloadInvoice(row.id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = (row.studentName || 'hoc-vien').replace(/[^\w-]+/g, '-');
  a.href = url;
  a.download = `hoa-don-${name}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};

watch(() => classStore.selectedId, reload);
onMounted(reload);
</script>

<style scoped>
.mb-4 { margin-bottom: 14px; }
</style>
