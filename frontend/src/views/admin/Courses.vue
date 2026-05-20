<template>
  <div>
    <div class="header-bar">
      <span class="section-title" style="margin:0">Quản lý khóa học</span>
      <el-button type="primary" @click="openCreate">+ Tạo khóa học</el-button>
    </div>

    <el-row :gutter="14">
      <el-col :span="8" v-for="c in courses" :key="c.id">
        <el-card>
          <template #header>
            <div class="header-line">
              <span class="cc-name">{{ c.name }}</span>
              <el-dropdown trigger="click" @command="(cmd) => onCmd(cmd, c)">
                <el-button text size="small">⋮</el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="edit">Sửa</el-dropdown-item>
                    <el-dropdown-item command="delete" divided>Xóa</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
          <div class="info-row"><span class="label">Mã:</span> <b>{{ c.code || '—' }}</b></div>
          <div class="info-row"><span class="label">Bắt đầu:</span> {{ fmtDate(c.start_date) }}</div>
          <div class="info-row"><span class="label">Kết thúc:</span> {{ fmtDate(c.end_date) }}</div>
          <div class="desc">{{ c.description || 'Chưa có mô tả' }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="showDialog" :title="editMode ? 'Sửa khóa học' : 'Tạo khóa học mới'" width="460px">
      <el-form label-position="top">
        <el-form-item label="Tên khóa"><el-input v-model="form.name" placeholder="VD: Tiếng Anh giao tiếp B1" /></el-form-item>
        <el-form-item label="Mã khóa"><el-input v-model="form.code" placeholder="VD: EN-B1" /></el-form-item>
        <el-form-item label="Mô tả"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
        <el-row :gutter="10">
          <el-col :span="12">
            <el-form-item label="Ngày bắt đầu">
              <el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Ngày kết thúc">
              <el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">Hủy</el-button>
        <el-button type="primary" @click="save">{{ editMode ? 'Lưu' : 'Tạo' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { coursesApi } from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';
import { fmtDate } from '@/utils/format';

const courses = ref([]);
const showDialog = ref(false);
const editMode = ref(false);
const editId = ref(null);
const form = reactive({ name: '', code: '', description: '', startDate: '', endDate: '' });

const load = async () => { courses.value = await coursesApi.list(); };

const openCreate = () => {
  editMode.value = false;
  Object.assign(form, { name: '', code: '', description: '', startDate: '', endDate: '' });
  showDialog.value = true;
};

const onCmd = async (cmd, c) => {
  if (cmd === 'edit') {
    editMode.value = true; editId.value = c.id;
    Object.assign(form, {
      name: c.name, code: c.code || '', description: c.description || '',
      startDate: c.start_date, endDate: c.end_date,
    });
    showDialog.value = true;
  } else if (cmd === 'delete') {
    try {
      await ElMessageBox.confirm(`Xóa khóa "${c.name}"? Tất cả lớp + dữ liệu sẽ bị xóa.`, 'Xác nhận', { type: 'warning' });
      await coursesApi.delete(c.id);
      ElMessage.success('Đã xóa');
      load();
    } catch {}
  }
};

const save = async () => {
  if (!form.name) { ElMessage.warning('Nhập tên khóa'); return; }
  try {
    if (editMode.value) {
      await coursesApi.update(editId.value, form);
      ElMessage.success('Đã cập nhật');
    } else {
      await coursesApi.create(form);
      ElMessage.success('Đã tạo khóa học');
    }
    showDialog.value = false;
    load();
  } catch {}
};

onMounted(load);
</script>

<style scoped>
.header-bar { display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px; }
.header-line { display:flex; justify-content:space-between; align-items:center; }
.cc-name { font-weight: 600; font-size: 14px; }
.info-row { font-size: 13px; margin-bottom: 6px; }
.info-row .label { color: #888; margin-right: 6px; }
.desc { font-size: 12px; color: #666; margin-top: 10px; padding-top: 10px; border-top: 1px solid #f0f0ee; }
</style>
