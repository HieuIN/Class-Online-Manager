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
        <el-table-column type="index" label="STT" width="70" align="center" />
        <el-table-column label="Học viên" prop="studentName" min-width="180" />
        <el-table-column label="Số tiền" width="140">
          <template #default="{ row }">{{ fmtMoney(row.amount) }}</template>
        </el-table-column>
        <el-table-column label="Đã đóng" width="140">
          <template #default="{ row }">
            <span v-if="row.status === 'PARTIAL' && !+row.paid_amount" class="missing-amount">Chưa nhập số tiền</span>
            <span v-else>{{ fmtMoney(row.paid_amount) }}</span>
          </template>
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
        <el-table-column label="Bằng chứng" width="120">
          <template #default="{ row }">
            <el-button v-if="row.latestProofUrl" link type="primary" @click="openProof(row.latestProofUrl)">Xem{{ +row.proofCount > 1 ? ` (${row.proofCount})` : '' }}</el-button>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="Hóa đơn" width="110">
          <template #default="{ row }">
            <el-button size="small" @click="downloadInvoice(row)">PDF</el-button>
          </template>
        </el-table-column>
        <el-table-column label="Hành động" width="280">
          <template #default="{ row }">
            <el-button size="small" @click="openInstallments(row)">Đợt</el-button>
            <el-button size="small" @click="openQr(row)">QR</el-button>
            <el-button v-if="+row.paid_amount > 0" size="small" @click="openEditPay(row)">Sửa</el-button>
            <el-button v-if="row.status !== 'PAID'" size="small" type="primary" @click="openPay(row)">Ghi nhận</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showPay" :title="isEditingPay ? 'Sửa thanh toán' : 'Ghi nhận thanh toán'" width="min(520px, 94vw)" @closed="clearProof">
      <el-form v-if="payRow" label-position="top">
        <el-form-item label="Học viên"><b>{{ payRow.studentName }}</b></el-form-item>
        <el-form-item label="Tổng học phí">{{ fmtMoney(payRow.amount) }}</el-form-item>
        <el-form-item :label="isEditingPay ? 'Tổng số tiền đã đóng' : 'Số tiền thu lần này'">
          <el-input-number v-model="payAmount" :min="0" :max="isEditingPay ? +payRow.amount : Math.max(0, +payRow.amount - +payRow.paid_amount)" :step="100000" />
        </el-form-item>
        <el-form-item label="Ảnh / hóa đơn chuyển tiền">
          <div class="proof-dropzone" tabindex="0" @click="proofInput?.click()" @paste="handleProofPaste" @dragover.prevent @drop.prevent="handleProofDrop">
            <input ref="proofInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" hidden @change="handleProofInput" />
            <template v-if="!proofFile">
              <b>Chọn file, kéo thả hoặc dán ảnh tại đây</b>
              <span>Ảnh/PDF, tối đa 10 MB · Có thể Ctrl+V ảnh chụp hóa đơn</span>
            </template>
            <template v-else>
              <img v-if="proofPreview" :src="proofPreview" alt="Bằng chứng thanh toán" />
              <b>{{ proofFile.name }}</b>
              <span>{{ formatFileSize(proofFile.size) }}</span>
              <el-button link type="danger" @click.stop="clearProof">Xóa</el-button>
            </template>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPay = false">Hủy</el-button>
        <el-button type="primary" @click="confirmPay">{{ isEditingPay ? 'Lưu thay đổi' : 'Xác nhận' }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showInstallments" title="Đóng học phí nhiều đợt" width="620px">
      <el-table :data="installments" size="small">
        <el-table-column prop="due_date" label="Hạn" width="120">
          <template #default="{ row }">{{ fmtDate(row.due_date) }}</template>
        </el-table-column>
        <el-table-column label="Số tiền"><template #default="{ row }">{{ fmtMoney(row.amount) }}</template></el-table-column>
        <el-table-column label="Đã đóng"><template #default="{ row }">{{ fmtMoney(row.paid_amount) }}</template></el-table-column>
        <el-table-column prop="status" label="Trạng thái" width="110" />
        <el-table-column width="120">
          <template #default="{ row }"><el-button size="small" type="primary" @click="payInstallment(row)">Thu đợt</el-button></template>
        </el-table-column>
      </el-table>
      <el-divider />
      <div class="installment-form">
        <el-date-picker v-model="installmentForm.dueDate" type="date" value-format="YYYY-MM-DD" placeholder="Hạn nộp" />
        <el-input-number v-model="installmentForm.amount" :min="0" :step="100000" />
        <el-button type="primary" @click="createInstallment">Thêm đợt</el-button>
      </div>
    </el-dialog>

    <el-dialog v-model="showQr" title="VietQR chuyển khoản" width="420px">
      <div v-if="qrInfo" class="qr-box">
        <img :src="qrInfo.qrUrl" alt="VietQR" />
        <b>{{ fmtMoney(qrInfo.amount) }}</b>
        <p>Nội dung: {{ qrInfo.content }}</p>
      </div>
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
import { mediaUrl } from '@/utils/media';

const classStore = useClassStore();
const payments = ref([]);
const showPay = ref(false);
const payRow = ref(null);
const payAmount = ref(0);
const isEditingPay = ref(false);
const proofFile = ref(null);
const proofPreview = ref('');
const proofInput = ref(null);
const showInstallments = ref(false);
const showQr = ref(false);
const installments = ref([]);
const installmentPayment = ref(null);
const installmentForm = ref({ dueDate: '', amount: 0 });
const qrInfo = ref(null);

const totalPaid = computed(() => payments.value.reduce((sum, payment) => sum + (+payment.paid_amount || 0), 0));
const totalAll = computed(() => payments.value.reduce((sum, payment) => sum + (+payment.amount || 0), 0));
const totalUnpaid = computed(() => Math.max(0, totalAll.value - totalPaid.value));

const reload = async () => {
  if (!classStore.selectedId) return;
  payments.value = await paymentsApi.list({ classId: classStore.selectedId });
};

const clearProof = () => {
  if (proofPreview.value) URL.revokeObjectURL(proofPreview.value);
  proofFile.value = null;
  proofPreview.value = '';
  if (proofInput.value) proofInput.value.value = '';
};
const setProof = (file) => {
  if (!file) return;
  if (!/^(image\/(jpeg|png|webp|gif)|application\/pdf)$/i.test(file.type)) { ElMessage.warning('Chỉ hỗ trợ ảnh hoặc PDF'); return; }
  if (file.size > 10 * 1024 * 1024) { ElMessage.warning('File bằng chứng tối đa 10 MB'); return; }
  clearProof();
  proofFile.value = file;
  if (file.type.startsWith('image/')) proofPreview.value = URL.createObjectURL(file);
};
const handleProofInput = event => setProof(event.target.files?.[0]);
const handleProofDrop = event => setProof(event.dataTransfer?.files?.[0]);
const handleProofPaste = event => {
  const item = [...(event.clipboardData?.items || [])].find(entry => entry.type.startsWith('image/'));
  const file = item?.getAsFile();
  if (file) { event.preventDefault(); setProof(new File([file], `hoa-don-${Date.now()}.${file.type.split('/')[1] || 'png'}`, { type:file.type })); }
};
const formatFileSize = size => size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(size / 1024)} KB`;
const openProof = url => window.open(mediaUrl(url), '_blank', 'noopener');
const openPay = (row) => { clearProof(); isEditingPay.value = false; payRow.value = row; payAmount.value = Math.max(0, +row.amount - +row.paid_amount); showPay.value = true; };
const openEditPay = (row) => { clearProof(); isEditingPay.value = true; payRow.value = row; payAmount.value = +row.paid_amount || 0; showPay.value = true; };

const confirmPay = async () => {
  if (!payAmount.value || payAmount.value <= 0) { ElMessage.warning('Vui lòng nhập số tiền lớn hơn 0'); return; }
  const formData = new FormData();
  formData.append('paidAmount', String(payAmount.value));
  if (proofFile.value) formData.append('proof', proofFile.value);
  if (isEditingPay.value) await paymentsApi.updatePayment(payRow.value.id, formData);
  else await paymentsApi.pay(payRow.value.id, formData);
  ElMessage.success(isEditingPay.value ? 'Đã cập nhật thanh toán' : 'Đã ghi nhận thanh toán');
  showPay.value = false;
  clearProof();
  reload();
};

const openInstallments = async (row) => {
  installmentPayment.value = row;
  installmentForm.value = { dueDate: row.due_date, amount: Math.max(0, +row.amount - +row.paid_amount) };
  installments.value = await paymentsApi.installments(row.id);
  showInstallments.value = true;
};

const createInstallment = async () => {
  if (!installmentPayment.value || !installmentForm.value.dueDate || !installmentForm.value.amount) return;
  await paymentsApi.createInstallment(installmentPayment.value.id, installmentForm.value);
  installments.value = await paymentsApi.installments(installmentPayment.value.id);
  reload();
};

const payInstallment = async (row) => {
  await paymentsApi.payInstallment(row.id, +row.amount - +row.paid_amount);
  installments.value = await paymentsApi.installments(installmentPayment.value.id);
  reload();
};

const openQr = async (row) => {
  qrInfo.value = await paymentsApi.vietqr(row.id);
  showQr.value = true;
};

const slugify = (text) => {
  return String(text || 'hoc-vien')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'hoc-vien';
};

const downloadInvoice = async (row) => {
  const blob = await paymentsApi.downloadInvoice(row.id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hoa-don-${slugify(row.studentName)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};

watch(() => classStore.selectedId, reload);
onMounted(reload);
</script>

<style scoped>
.mb-4 { margin-bottom: 14px; }
.installment-form { display:flex; gap: 8px; align-items:center; flex-wrap:wrap; }
.qr-box { display:flex; flex-direction:column; align-items:center; gap: 10px; text-align:center; }
.qr-box img { width: 280px; max-width: 100%; border: 1px solid #eee; border-radius: 8px; }
.missing-amount { color:#b7791f; font-size:12px; font-weight:600; }
.proof-dropzone { width:100%; min-height:145px; padding:16px; border:1.5px dashed #b9cec6; border-radius:10px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:7px; text-align:center; cursor:pointer; background:#f8fbfa; }
.proof-dropzone:focus, .proof-dropzone:hover { border-color:#15816b; background:#f0faf7; outline:none; }
.proof-dropzone span { color:#73827c; font-size:12px; }
.proof-dropzone img { max-width:100%; max-height:190px; object-fit:contain; border-radius:8px; }
</style>
