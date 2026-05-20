<template>
  <div>
    <ClassPicker @change="reload" />
    <div class="header-bar">
      <span class="section-title" style="margin:0">Thư viện tài liệu</span>
      <el-button type="primary" @click="showAdd = true" v-if="canEdit">+ Thêm tài liệu</el-button>
    </div>

    <el-card v-for="(items, chapter) in grouped" :key="chapter" class="mb-3">
      <template #header><span class="section-title">{{ chapter || 'Tài liệu chung' }}</span></template>
      <div v-for="m in items" :key="m.id" class="mat-row">
        <span class="mat-icon">{{ typeIcon(m.material_type) }}</span>
        <div class="mat-info">
          <div class="mat-title">{{ m.title }}</div>
          <div class="mat-meta">{{ m.lesson }} • {{ m.material_type || 'FILE' }}</div>
        </div>
        <span :class="['badge', m.is_required ? 'badge-red' : 'badge-gray']">
          {{ m.is_required ? 'Bắt buộc' : 'Tham khảo' }}
        </span>
        <el-button size="small" @click="download(m)">↓ Tải</el-button>
      </div>
      <div v-if="items.length === 0" class="empty">Chưa có tài liệu</div>
    </el-card>

    <el-card v-if="Object.keys(grouped).length === 0">
      <div class="empty">Chưa có tài liệu nào trong khóa học này</div>
    </el-card>

    <el-dialog v-model="showAdd" title="Thêm tài liệu" width="460px">
      <el-form label-position="top">
        <el-form-item label="Tiêu đề"><el-input v-model="newMat.title" /></el-form-item>
        <el-form-item label="Chương"><el-input v-model="newMat.chapter" placeholder="VD: Chương 1" /></el-form-item>
        <el-form-item label="Bài"><el-input v-model="newMat.lesson" placeholder="VD: Bài 1" /></el-form-item>
        <el-form-item label="Loại">
          <el-select v-model="newMat.materialType">
            <el-option label="PDF" value="PDF" /> <el-option label="PPT" value="PPT" />
            <el-option label="Video" value="VIDEO" /> <el-option label="Audio" value="AUDIO" />
            <el-option label="Doc" value="DOC" /> <el-option label="Link" value="LINK" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="newMat.materialType === 'LINK'" label="URL">
          <el-input v-model="newMat.linkUrl" placeholder="https://..." />
        </el-form-item>
        <el-form-item v-else label="File">
          <el-upload :auto-upload="false" :on-change="onFileChange" :limit="1">
            <el-button>Chọn file</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item><el-checkbox v-model="newMat.isRequired">Bắt buộc</el-checkbox></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAdd = false">Hủy</el-button>
        <el-button type="primary" @click="addMat" :loading="uploading">Lưu</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted } from 'vue';
import { useClassStore } from '@/stores/class';
import { useAuthStore } from '@/stores/auth';
import { ElMessage } from 'element-plus';
import ClassPicker from '@/components/ClassPicker.vue';
import { materialsApi } from '@/api';

const classStore = useClassStore();
const auth = useAuthStore();
const canEdit = computed(() => auth.isTeacher || auth.isAdmin);
const materials = ref([]);
const showAdd = ref(false);
const uploading = ref(false);
const newMat = reactive({ title: '', chapter: '', lesson: '', materialType: 'PDF', isRequired: false, linkUrl: '' });
const file = ref(null);

const grouped = computed(() => {
  const out = {};
  for (const m of materials.value) {
    const ch = m.chapter || 'Khác';
    if (!out[ch]) out[ch] = [];
    out[ch].push(m);
  }
  return out;
});

const typeIcon = (t) => ({ PDF: '📄', PPT: '📊', AUDIO: '🎵', VIDEO: '🎬', DOC: '📝', LINK: '🔗' }[t] || '📁');

const reload = async () => {
  const cls = classStore.selected;
  if (!cls) return;
  materials.value = await materialsApi.list(cls.course_id);
};

const onFileChange = (f) => { file.value = f.raw; };

const addMat = async () => {
  if (!newMat.title) { ElMessage.warning('Nhập tiêu đề'); return; }
  uploading.value = true;
  try {
    if (newMat.materialType === 'LINK') {
      await materialsApi.create({ courseId: classStore.selected.course_id, ...newMat });
    } else if (file.value) {
      const fd = new FormData();
      fd.append('file', file.value);
      fd.append('courseId', classStore.selected.course_id);
      fd.append('title', newMat.title);
      fd.append('chapter', newMat.chapter || '');
      fd.append('lesson', newMat.lesson || '');
      fd.append('materialType', newMat.materialType);
      fd.append('isRequired', String(newMat.isRequired));
      await materialsApi.upload(fd);
    } else { ElMessage.warning('Chọn file hoặc nhập URL'); return; }
    ElMessage.success('Đã thêm tài liệu');
    showAdd.value = false;
    newMat.title = ''; file.value = null;
    reload();
  } finally { uploading.value = false; }
};

const download = (m) => {
  if (m.link_url) window.open(m.link_url, '_blank');
  else if (m.file_url) window.open(m.file_url, '_blank');
};

watch(() => classStore.selectedId, reload);
onMounted(reload);
</script>

<style scoped>
.header-bar { display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px; }
.mb-3 { margin-bottom: 12px; }
.mat-row { display:flex; align-items:center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f0f0ee; }
.mat-row:last-child { border-bottom: none; }
.mat-icon { font-size: 22px; }
.mat-info { flex: 1; }
.mat-title { font-size: 13px; font-weight: 500; }
.mat-meta { font-size: 11px; color: #888; }
.empty { padding: 20px; text-align: center; color: #aaa; }
</style>
