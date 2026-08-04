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
        <el-button size="small" type="primary" plain @click="preview(m)">
          {{ previewLabel(m) }}
        </el-button>
        <el-button size="small" text @click="download(m)">Tải</el-button>
        <template v-if="canEdit">
          <el-button size="small" text type="primary" @click="openEdit(m)">Sửa</el-button>
          <el-button size="small" text type="danger" @click="removeMat(m)">Xóa</el-button>
        </template>
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

    <el-dialog v-model="showEdit" title="Sửa tài liệu" width="460px">
      <el-form label-position="top">
        <el-form-item label="Tiêu đề"><el-input v-model="editMat.title" /></el-form-item>
        <el-form-item label="Chương"><el-input v-model="editMat.chapter" placeholder="VD: Chương 1" /></el-form-item>
        <el-form-item label="Bài"><el-input v-model="editMat.lesson" placeholder="VD: Bài 1" /></el-form-item>
        <el-form-item label="Loại">
          <el-select v-model="editMat.materialType">
            <el-option label="PDF" value="PDF" /> <el-option label="PPT" value="PPT" />
            <el-option label="Video" value="VIDEO" /> <el-option label="Audio" value="AUDIO" />
            <el-option label="Doc" value="DOC" /> <el-option label="Link" value="LINK" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editMat.materialType === 'LINK'" label="URL">
          <el-input v-model="editMat.linkUrl" placeholder="https://..." />
        </el-form-item>
        <el-form-item v-else label="Tệp mới (không bắt buộc)">
          <el-upload
            ref="editUploadRef"
            :auto-upload="false"
            :on-change="onEditFileChange"
            :on-remove="onEditFileRemove"
            :limit="1"
          >
            <el-button>Chọn tệp mới</el-button>
            <template #tip><div class="el-upload__tip">Bỏ trống để giữ nguyên tệp hiện tại.</div></template>
          </el-upload>
        </el-form-item>
        <el-form-item><el-checkbox v-model="editMat.isRequired">Bắt buộc</el-checkbox></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEdit = false">Hủy</el-button>
        <el-button type="primary" :loading="savingEdit" @click="saveEdit">Lưu thay đổi</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showPreview" :title="previewItem?.title || 'Xem tài liệu'" width="82vw" class="preview-dialog">
      <div v-if="previewItem" class="preview-body">
        <iframe v-if="previewKind === 'iframe'" :src="previewUrl" class="preview-frame" />
        <iframe v-else-if="previewKind === 'office'" :src="officePreviewUrl" class="preview-frame" allowfullscreen />
        <video v-else-if="previewKind === 'video'" :src="previewUrl" class="preview-media" controls playsinline />
        <audio v-else-if="previewKind === 'audio'" :src="previewUrl" class="preview-audio" controls />
        <img v-else-if="previewKind === 'image'" :src="previewUrl" class="preview-image" />
        <div v-else class="preview-fallback">
          <p>Loại tài liệu này không hỗ trợ xem trực tiếp ổn định trên trình duyệt.</p>
          <el-button type="primary" @click="download(previewItem)">Mở hoặc tải tài liệu</el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="showPreview = false">Đóng</el-button>
        <el-button v-if="previewItem" @click="download(previewItem)">Mở tab mới</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted } from 'vue';
import { useClassStore } from '@/stores/class';
import { useAuthStore } from '@/stores/auth';
import { ElMessage, ElMessageBox } from 'element-plus';
import ClassPicker from '@/components/ClassPicker.vue';
import { materialsApi } from '@/api';
import { mediaUrl } from '@/utils/media';

const classStore = useClassStore();
const auth = useAuthStore();
const canEdit = computed(() => auth.isTeacher || auth.isAdmin);
const materials = ref([]);
const showAdd = ref(false);
const showEdit = ref(false);
const showPreview = ref(false);
const previewItem = ref(null);
const uploading = ref(false);
const savingEdit = ref(false);
const newMat = reactive({ title: '', chapter: '', lesson: '', materialType: 'PDF', isRequired: false, linkUrl: '' });
const editMat = reactive({ id: null, title: '', chapter: '', lesson: '', materialType: 'PDF', isRequired: false, linkUrl: '' });
const file = ref(null);
const editFile = ref(null);
const editUploadRef = ref(null);

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
const materialUrl = (m) => mediaUrl(m.link_url || m.linkUrl || m.file_url || m.fileUrl || '');
const fileExt = (m) => materialUrl(m).split('?')[0].split('.').pop()?.toLowerCase() || '';
const materialType = (m) => (m.material_type || m.materialType || '').toUpperCase();

const previewLabel = (m) => {
  const type = materialType(m);
  if (type === 'AUDIO') return 'Nghe';
  if (type === 'VIDEO') return 'Xem video';
  return 'Xem';
};

const previewKindFor = (m) => {
  const type = materialType(m);
  const ext = fileExt(m);
  if (type === 'AUDIO' || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
  if (type === 'VIDEO' || ['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  if (type === 'PDF' || ext === 'pdf' || type === 'LINK') return 'iframe';
  if (['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'].includes(ext)) return 'office';
  return 'fallback';
};

const previewUrl = computed(() => previewItem.value ? materialUrl(previewItem.value) : '');
const previewKind = computed(() => previewItem.value ? previewKindFor(previewItem.value) : 'fallback');
const officePreviewUrl = computed(() => `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl.value)}`);

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

const openEdit = (m) => {
  editFile.value = null;
  editUploadRef.value?.clearFiles();
  Object.assign(editMat, {
    id: m.id,
    title: m.title || '',
    chapter: m.chapter || '',
    lesson: m.lesson || '',
    materialType: materialType(m) || 'PDF',
    isRequired: Boolean(m.is_required ?? m.isRequired),
    linkUrl: m.link_url || m.linkUrl || '',
  });
  showEdit.value = true;
};

const onEditFileChange = (selectedFile) => { editFile.value = selectedFile.raw; };
const onEditFileRemove = () => { editFile.value = null; };

const saveEdit = async () => {
  if (!editMat.title.trim()) { ElMessage.warning('Nhập tiêu đề'); return; }
  if (editMat.materialType === 'LINK' && !editMat.linkUrl.trim()) { ElMessage.warning('Nhập URL tài liệu'); return; }
  savingEdit.value = true;
  try {
    const data = {
      title: editMat.title.trim(), chapter: editMat.chapter.trim(), lesson: editMat.lesson.trim(),
      materialType: editMat.materialType, isRequired: editMat.isRequired,
      linkUrl: editMat.materialType === 'LINK' ? editMat.linkUrl.trim() : null,
    };
    if (editMat.materialType !== 'LINK' && editFile.value) {
      const fd = new FormData();
      fd.append('file', editFile.value);
      Object.entries(data).forEach(([key, value]) => fd.append(key, String(value ?? '')));
      await materialsApi.replaceFile(editMat.id, fd);
    } else {
      await materialsApi.update(editMat.id, data);
    }
    ElMessage.success('Đã cập nhật tài liệu');
    showEdit.value = false;
    await reload();
  } finally { savingEdit.value = false; }
};

const removeMat = async (m) => {
  try {
    await ElMessageBox.confirm(
      `Bạn có chắc muốn xóa tài liệu “${m.title}”?`,
      'Xóa tài liệu',
      { confirmButtonText: 'Xóa', cancelButtonText: 'Hủy', type: 'warning' },
    );
    await materialsApi.delete(m.id);
    ElMessage.success('Đã xóa tài liệu');
    await reload();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') throw error;
  }
};

const preview = (m) => {
  if (!materialUrl(m)) {
    ElMessage.warning('Tài liệu chưa có link/file');
    return;
  }
  previewItem.value = m;
  showPreview.value = true;
};

const download = (m) => {
  const url = materialUrl(m);
  if (url) window.open(url, '_blank', 'noopener');
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
.preview-body { min-height: 60vh; display:flex; align-items:center; justify-content:center; background: #fafaf8; border-radius: 8px; overflow: hidden; }
.preview-frame { width: 100%; height: 68vh; border: 0; background: #fff; }
.preview-media { width: 100%; max-height: 68vh; background: #000; }
.preview-audio { width: min(720px, 100%); }
.preview-image { max-width: 100%; max-height: 68vh; object-fit: contain; }
.preview-fallback { text-align:center; color: #666; padding: 28px; }
</style>
