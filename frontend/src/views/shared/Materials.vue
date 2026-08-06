<template>
  <div>
    <ClassPicker @change="reload" />
    <div class="header-bar">
      <span class="section-title" style="margin:0">{{ activeTab === 'lectures' ? 'Bài giảng và buổi học đã ghi lại' : 'Thư viện tài liệu' }}</span>
      <el-button v-if="canEdit" type="primary" @click="openAdd">+ {{ activeTab === 'lectures' ? 'Thêm bài giảng' : 'Thêm tài liệu' }}</el-button>
    </div>

    <el-tabs v-model="activeTab" class="material-tabs">
      <el-tab-pane label="Tài liệu" name="materials" />
      <el-tab-pane label="Bài giảng" name="lectures" />
    </el-tabs>

    <div v-if="activeTab === 'lectures'" class="lecture-intro">
      <b>Xem lại bài học mọi lúc</b>
      <span>Video chỉ bắt đầu tải khi người dùng mở bài giảng, giúp trang tải nhanh và tiết kiệm dữ liệu.</span>
    </div>

    <el-card v-for="(items, chapter) in grouped" :key="chapter" class="mb-3">
      <template #header><span class="section-title">{{ chapter || 'Tài liệu chung' }}</span></template>
      <div v-for="m in items" :key="m.id" class="mat-row">
        <span :class="['mat-icon', `mat-icon--${resolvedMaterialType(m).toLowerCase()}`]">
          {{ typeIcon(m) }}
        </span>
        <div class="mat-info">
          <div class="mat-title">{{ m.title }}</div>
          <div class="mat-meta">{{ m.lesson }} • {{ resolvedMaterialType(m) }}</div>
        </div>
        <span :class="['badge', m.is_required ? 'badge-red' : 'badge-gray']">
          {{ m.is_required ? 'Bắt buộc' : 'Tham khảo' }}
        </span>
        <el-button size="small" type="primary" plain @click="preview(m)">
          {{ previewLabel(m) }}
        </el-button>
        <el-button size="small" text @click="download(m)">{{ materialType(m) === 'LECTURE_YOUTUBE' ? 'Mở YouTube' : 'Tải' }}</el-button>
        <template v-if="canEdit">
          <el-button size="small" text type="primary" @click="openEdit(m)">Sửa</el-button>
          <el-button size="small" text type="danger" @click="removeMat(m)">Xóa</el-button>
        </template>
      </div>
      <div v-if="items.length === 0" class="empty">{{ activeTab === 'lectures' ? 'Chưa có bài giảng' : 'Chưa có tài liệu' }}</div>
    </el-card>

    <el-card v-if="Object.keys(grouped).length === 0">
      <div class="empty">{{ activeTab === 'lectures' ? 'Chưa có bài giảng nào trong khóa học này' : 'Chưa có tài liệu nào trong khóa học này' }}</div>
    </el-card>

    <el-dialog v-model="showLectureAdd" title="Thêm bài giảng" width="min(520px, 94vw)">
      <el-form label-position="top">
        <el-form-item label="Tiêu đề bài giảng"><el-input v-model="newLecture.title" placeholder="Ví dụ: Buổi 6 - Giao tiếp tại nhà hàng" /></el-form-item>
        <el-form-item label="Buổi / bài"><el-input v-model="newLecture.lesson" placeholder="Ví dụ: Buổi 6" /></el-form-item>
        <el-form-item label="Nguồn bài giảng">
          <el-radio-group v-model="newLecture.sourceType"><el-radio-button value="YOUTUBE">Link YouTube</el-radio-button><el-radio-button value="FILE">Tải tệp lên</el-radio-button></el-radio-group>
        </el-form-item>
        <el-form-item v-if="newLecture.sourceType === 'YOUTUBE'" label="Link video YouTube">
          <el-input v-model="newLecture.linkUrl" placeholder="https://www.youtube.com/watch?v=... hoặc https://youtu.be/..." />
          <div class="form-tip">Nên dùng video Không công khai (Unlisted) để học viên có link mới xem được.</div>
        </el-form-item>
        <el-form-item v-else label="File bài giảng hoặc video">
          <el-upload ref="lectureUploadRef" drag :auto-upload="false" :on-change="onLectureFileChange" :limit="1" accept=".pdf,.ppt,.pptx,.doc,.docx,.mp4,.webm,.mov">
            <div class="lecture-upload-copy"><b>Kéo thả hoặc chọn tệp</b><span>PDF, PowerPoint, Word, MP4, WebM hoặc MOV · tối đa 200 MB</span></div>
          </el-upload>
          <div class="form-tip">Với video dài, dùng YouTube sẽ xem nhanh và tiết kiệm dung lượng máy chủ hơn.</div>
        </el-form-item>
        <el-form-item><el-checkbox v-model="newLecture.isRequired">Bài giảng bắt buộc xem</el-checkbox></el-form-item>
      </el-form>
      <template #footer><el-button @click="showLectureAdd = false">Hủy</el-button><el-button type="primary" :loading="uploading" @click="addLecture">Lưu bài giảng</el-button></template>
    </el-dialog>

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

    <el-dialog v-model="showEdit" :title="isLecture(editMat) ? 'Sửa bài giảng' : 'Sửa tài liệu'" width="min(520px, 94vw)">
      <el-form label-position="top">
        <el-form-item label="Tiêu đề"><el-input v-model="editMat.title" /></el-form-item>
        <el-form-item label="Chương"><el-input v-model="editMat.chapter" placeholder="VD: Chương 1" /></el-form-item>
        <el-form-item label="Bài"><el-input v-model="editMat.lesson" placeholder="VD: Bài 1" /></el-form-item>
        <el-form-item label="Loại">
          <el-select v-model="editMat.materialType">
            <el-option label="PDF" value="PDF" /> <el-option label="PPT" value="PPT" />
            <el-option label="Video" value="VIDEO" /> <el-option label="Audio" value="AUDIO" />
            <el-option label="Doc" value="DOC" /> <el-option label="Link" value="LINK" />
            <el-option label="Bài giảng YouTube" value="LECTURE_YOUTUBE" /> <el-option label="Bài giảng dạng tệp" value="LECTURE_FILE" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="['LINK', 'LECTURE_YOUTUBE'].includes(editMat.materialType)" :label="editMat.materialType === 'LECTURE_YOUTUBE' ? 'Link YouTube' : 'URL'">
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
        <iframe v-if="previewKind === 'youtube'" :src="previewUrl" class="preview-frame youtube-frame" title="Video bài giảng YouTube" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen />
        <iframe v-else-if="previewKind === 'iframe'" :src="previewUrl" class="preview-frame" loading="lazy" />
        <iframe v-else-if="previewKind === 'office'" :src="officePreviewUrl" class="preview-frame" loading="lazy" allowfullscreen />
        <video v-else-if="previewKind === 'video'" :src="previewUrl" class="preview-media" controls playsinline preload="metadata" />
        <audio v-else-if="previewKind === 'audio'" :src="previewUrl" class="preview-audio" controls preload="metadata" />
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
const activeTab = ref('materials');
const showAdd = ref(false);
const showLectureAdd = ref(false);
const showEdit = ref(false);
const showPreview = ref(false);
const previewItem = ref(null);
const uploading = ref(false);
const savingEdit = ref(false);
const newMat = reactive({ title: '', chapter: '', lesson: '', materialType: 'PDF', isRequired: false, linkUrl: '' });
const newLecture = reactive({ title: '', lesson: '', sourceType: 'YOUTUBE', linkUrl: '', isRequired: false });
const editMat = reactive({ id: null, title: '', chapter: '', lesson: '', materialType: 'PDF', isRequired: false, linkUrl: '' });
const file = ref(null);
const editFile = ref(null);
const editUploadRef = ref(null);
const lectureUploadRef = ref(null);
const lectureFile = ref(null);

const isLecture = (m) => ['LECTURE_YOUTUBE', 'LECTURE_FILE'].includes(materialType(m));
const visibleMaterials = computed(() => materials.value.filter(m => activeTab.value === 'lectures' ? isLecture(m) : !isLecture(m)));

const grouped = computed(() => {
  const out = {};
  for (const m of visibleMaterials.value) {
    const ch = m.chapter || 'Khác';
    if (!out[ch]) out[ch] = [];
    out[ch].push(m);
  }
  return out;
});

const materialUrl = (m) => mediaUrl(m.link_url || m.linkUrl || m.file_url || m.fileUrl || '');
const fileExt = (m) => materialUrl(m).split('?')[0].split('.').pop()?.toLowerCase() || '';
const materialType = (m) => (m.material_type || m.materialType || '').toUpperCase();
const resolvedMaterialType = (m) => {
  const ext = fileExt(m);
  if (ext === 'pdf') return 'PDF';
  if (['doc', 'docx'].includes(ext)) return 'WORD';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'EXCEL';
  if (['ppt', 'pptx'].includes(ext)) return 'PPT';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'IMAGE';
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'AUDIO';
  if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) return 'VIDEO';
  if (['zip', 'rar', '7z'].includes(ext)) return 'ZIP';
  const type = materialType(m);
  if (type === 'LECTURE_YOUTUBE') return 'VIDEO';
  if (type === 'LECTURE_FILE') return 'FILE';
  if (type === 'DOC') return 'WORD';
  return type || 'FILE';
};
const typeIcon = (m) => ({
  PDF: 'PDF', WORD: 'W', EXCEL: 'X', PPT: 'P', IMAGE: 'IMG',
  AUDIO: '♪', VIDEO: '▶', LINK: '↗', ZIP: 'ZIP', FILE: 'FILE',
}[resolvedMaterialType(m)] || 'FILE');

const previewLabel = (m) => {
  const type = materialType(m);
  if (type === 'LECTURE_YOUTUBE') return 'Xem bài giảng';
  if (type === 'AUDIO') return 'Nghe';
  if (type === 'VIDEO') return 'Xem video';
  return 'Xem';
};

const previewKindFor = (m) => {
  const type = materialType(m);
  const ext = fileExt(m);
  if (type === 'LECTURE_YOUTUBE') return 'youtube';
  if (type === 'AUDIO' || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
  if (type === 'VIDEO' || ['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  if (type === 'PDF' || ext === 'pdf' || type === 'LINK') return 'iframe';
  if (['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'].includes(ext)) return 'office';
  return 'fallback';
};

const youtubeEmbedUrl = (url) => {
  try {
    const parsed = new URL(url);
    let id = parsed.hostname.includes('youtu.be') ? parsed.pathname.split('/').filter(Boolean)[0] : parsed.searchParams.get('v');
    if (!id && parsed.pathname.includes('/embed/')) id = parsed.pathname.split('/embed/')[1]?.split('/')[0];
    if (!id && parsed.pathname.includes('/shorts/')) id = parsed.pathname.split('/shorts/')[1]?.split('/')[0];
    return id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : '';
  } catch { return ''; }
};
const previewUrl = computed(() => {
  if (!previewItem.value) return '';
  const url = materialUrl(previewItem.value);
  return previewKindFor(previewItem.value) === 'youtube' ? youtubeEmbedUrl(url) : url;
});
const previewKind = computed(() => previewItem.value ? previewKindFor(previewItem.value) : 'fallback');
const officePreviewUrl = computed(() => `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl.value)}`);

const reload = async () => {
  const cls = classStore.selected;
  if (!cls) return;
  materials.value = await materialsApi.list(cls.course_id);
};

const onFileChange = (f) => { file.value = f.raw; };
const openAdd = () => { if (activeTab.value === 'lectures') showLectureAdd.value = true; else showAdd.value = true; };
const onLectureFileChange = (f) => { lectureFile.value = f.raw; };

const addLecture = async () => {
  if (!newLecture.title.trim()) { ElMessage.warning('Nhập tiêu đề bài giảng'); return; }
  uploading.value = true;
  try {
    if (newLecture.sourceType === 'YOUTUBE') {
      if (!youtubeEmbedUrl(newLecture.linkUrl.trim())) { ElMessage.warning('Link YouTube chưa hợp lệ'); return; }
      await materialsApi.create({ courseId: classStore.selected.course_id, title: newLecture.title.trim(), chapter: 'Bài giảng', lesson: newLecture.lesson.trim(), materialType: 'LECTURE_YOUTUBE', linkUrl: newLecture.linkUrl.trim(), isRequired: newLecture.isRequired });
    } else {
      if (!lectureFile.value) { ElMessage.warning('Chọn file bài giảng'); return; }
      if (lectureFile.value.size > 200 * 1024 * 1024) { ElMessage.warning('File bài giảng tối đa 200 MB'); return; }
      const fd = new FormData();
      fd.append('file', lectureFile.value); fd.append('courseId', classStore.selected.course_id); fd.append('title', newLecture.title.trim()); fd.append('chapter', 'Bài giảng'); fd.append('lesson', newLecture.lesson.trim()); fd.append('materialType', 'LECTURE_FILE'); fd.append('isRequired', String(newLecture.isRequired));
      await materialsApi.upload(fd);
    }
    ElMessage.success('Đã thêm bài giảng');
    showLectureAdd.value = false; lectureFile.value = null; lectureUploadRef.value?.clearFiles();
    Object.assign(newLecture, { title: '', lesson: '', sourceType: 'YOUTUBE', linkUrl: '', isRequired: false });
    await reload();
  } finally { uploading.value = false; }
};

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
  if (['LINK', 'LECTURE_YOUTUBE'].includes(editMat.materialType) && !editMat.linkUrl.trim()) { ElMessage.warning('Nhập URL tài liệu'); return; }
  if (editMat.materialType === 'LECTURE_YOUTUBE' && !youtubeEmbedUrl(editMat.linkUrl.trim())) { ElMessage.warning('Link YouTube chưa hợp lệ'); return; }
  savingEdit.value = true;
  try {
    const data = {
      title: editMat.title.trim(), chapter: editMat.chapter.trim(), lesson: editMat.lesson.trim(),
      materialType: editMat.materialType, isRequired: editMat.isRequired,
      linkUrl: ['LINK', 'LECTURE_YOUTUBE'].includes(editMat.materialType) ? editMat.linkUrl.trim() : null,
    };
    if (!['LINK', 'LECTURE_YOUTUBE'].includes(editMat.materialType) && editFile.value) {
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
  if (previewKindFor(m) === 'youtube' && !youtubeEmbedUrl(materialUrl(m))) { ElMessage.warning('Link YouTube không hợp lệ'); return; }
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
.material-tabs { margin-bottom: 12px; }
.lecture-intro { align-items:center; background:var(--el-color-primary-light-9); border:1px solid var(--el-color-primary-light-7); border-radius:10px; display:flex; gap:10px 18px; margin:-2px 0 14px; padding:12px 14px; }
.lecture-intro span { color:var(--el-text-color-secondary); font-size:12px; }
.form-tip { color:var(--el-text-color-secondary); font-size:12px; line-height:1.45; margin-top:6px; }
.lecture-upload-copy { display:flex; flex-direction:column; gap:6px; padding:12px; }
.lecture-upload-copy span { color:var(--el-text-color-secondary); font-size:12px; }
.mb-3 { margin-bottom: 12px; }
.mat-row { display:flex; align-items:center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f0f0ee; }
.mat-row:last-child { border-bottom: none; }
.mat-icon {
  width: 38px; height: 44px; flex: 0 0 38px; display:flex; align-items:center; justify-content:center;
  position:relative; overflow:hidden; border-radius: 5px 5px 6px 6px; background:#73808c;
  color:#fff; font-size: 10px; line-height:1; font-weight:800; letter-spacing:-.2px;
  box-shadow: inset 0 -12px 0 rgba(0,0,0,.08);
}
.mat-icon::after {
  content:''; position:absolute; top:0; right:0; width:10px; height:10px;
  background:rgba(255,255,255,.75); border-radius:0 0 0 3px;
}
.mat-icon--pdf { background:#d94b4b; }
.mat-icon--word { background:#3478c5; }
.mat-icon--excel { background:#27865b; }
.mat-icon--ppt { background:#df6b3b; }
.mat-icon--image { background:#8b5fc4; }
.mat-icon--audio { background:#b65aa0; font-size:20px; }
.mat-icon--video { background:#5a61b6; font-size:17px; }
.mat-icon--link { background:#168b8b; font-size:20px; }
.mat-icon--zip { background:#ae8327; }
.mat-info { flex: 1; }
.mat-title { font-size: 13px; font-weight: 500; }
.mat-meta { font-size: 11px; color: #888; }
.empty { padding: 20px; text-align: center; color: #aaa; }
.preview-body { min-height: 60vh; display:flex; align-items:center; justify-content:center; background: #fafaf8; border-radius: 8px; overflow: hidden; }
.preview-frame { width: 100%; height: 68vh; border: 0; background: #fff; }
.youtube-frame { aspect-ratio:16/9; height:auto; max-height:68vh; }
.preview-media { width: 100%; max-height: 68vh; background: #000; }
.preview-audio { width: min(720px, 100%); }
.preview-image { max-width: 100%; max-height: 68vh; object-fit: contain; }
.preview-fallback { text-align:center; color: #666; padding: 28px; }
@media (max-width: 640px) { .header-bar { align-items:flex-start; flex-direction:column; gap:10px; } .header-bar .el-button { width:100%; } .lecture-intro { align-items:flex-start; flex-direction:column; } .mat-row { align-items:flex-start; flex-wrap:wrap; } .mat-info { min-width:calc(100% - 62px); } .youtube-frame { min-height:220px; } }
</style>
