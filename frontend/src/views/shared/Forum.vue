<template>
  <div class="forum-page">
    <div class="forum-toolbar">
      <ClassPicker @change="onClassChange" />
      <div class="forum-status">Bảng tin lớp • cập nhật realtime</div>
    </div>

    <div class="forum-feed">
      <el-card class="composer mb-4" shadow="never">
        <div class="composer-compact" v-if="!isComposing" @click="startCompose">
          <el-avatar :size="38" :src="auth.user?.avatarUrl">{{ initials(auth.user?.fullName) }}</el-avatar>
          <button class="compose-placeholder">Chia sẻ thông báo, câu hỏi hoặc tài liệu với lớp...</button>
        </div>

        <div v-else>
          <div class="composer-head">
            <el-avatar :size="36" :src="auth.user?.avatarUrl">{{ initials(auth.user?.fullName) }}</el-avatar>
            <div>
              <div class="composer-name">{{ auth.user?.fullName }}</div>
              <div class="composer-sub">{{ classStore.selected?.name || 'Chọn lớp để đăng bảng tin' }}</div>
            </div>
          </div>
          <el-input v-model="form.title" placeholder="Tiêu đề bài đăng (không bắt buộc)" class="mb-2" />
          <el-input v-model="form.content" type="textarea" :rows="3" resize="none" placeholder="Viết nội dung..." />

          <el-upload
            v-if="showMediaUploader || mediaFiles.length"
            v-model:file-list="mediaFiles"
            class="media-picker"
            drag
            multiple
            :auto-upload="false"
            :limit="8"
            :on-exceed="onMediaExceed"
          >
            <div class="upload-prompt">Thả file vào đây hoặc bấm để chọn</div>
            <template #tip>
              <div class="upload-tip">Ảnh, video, audio, PDF hoặc tài liệu. Tối đa 8 file, mỗi file 100MB.</div>
            </template>
          </el-upload>

          <div class="composer-actions">
            <div class="composer-tools">
              <button class="tool-btn" @click="showMediaUploader = !showMediaUploader">Đính kèm media</button>
              <span class="live-dot">Realtime</span>
            </div>
            <div class="composer-buttons">
              <el-button @click="cancelCompose">Hủy</el-button>
              <el-button type="primary" :loading="posting" @click="submitPost">Đăng</el-button>
            </div>
          </div>
        </div>
      </el-card>

      <div v-if="posts.length === 0" class="empty-card">Chưa có bài đăng nào trong lớp này</div>

      <el-card v-for="post in posts" :key="post.id" class="post-card mb-4" shadow="never">
      <div class="post-head">
        <div class="author">
          <el-avatar :size="38" :src="post.authorAvatarUrl">{{ initials(post.authorName) }}</el-avatar>
          <div>
            <div class="post-author">
              {{ post.authorName }}
              <span v-if="post.is_pinned" class="pin-badge">Đã ghim</span>
            </div>
            <div class="post-time">{{ roleLabel(post.authorRole) }} • {{ fmtTime(post.created_at) }}</div>
          </div>
        </div>
        <el-dropdown v-if="canManage(post)" trigger="click" @command="cmd => handleCommand(cmd, post)">
          <el-button text>⋯</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-if="auth.isTeacher || auth.isAdmin" command="pin">
                {{ post.is_pinned ? 'Bỏ ghim' : 'Ghim bài' }}
              </el-dropdown-item>
              <el-dropdown-item command="delete" divided>Xóa bài</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <div class="post-body" @click="openThread(post)">
        <h3 v-if="post.title">{{ post.title }}</h3>
        <p v-if="post.content">{{ post.content }}</p>
      </div>
      <div v-if="post.attachments?.length" :class="['media-grid', mediaCountClass(post.attachments)]">
        <div v-for="a in post.attachments" :key="a.id" class="media-item">
          <img v-if="isImage(a)" :src="a.fileUrl" :alt="a.fileName" @click="openMedia(a)" />
          <video v-else-if="isVideo(a)" :src="a.fileUrl" controls preload="metadata" />
          <audio v-else-if="isAudio(a)" :src="a.fileUrl" controls />
          <a v-else class="file-chip" :href="a.fileUrl" target="_blank" rel="noopener">
            <span>📎</span>
            <span>{{ a.fileName }}</span>
          </a>
        </div>
      </div>

      <div class="post-actions">
        <button class="comment-action" @click="openThread(post)">{{ post.commentCount || 0 }} bình luận</button>
      </div>
      </el-card>
    </div>

    <el-dialog v-model="showThread" :title="selectedPost?.title || 'Bình luận'" width="680px" @closed="selectedPost = null">
      <div v-if="selectedPost" class="thread-post">
        <div class="author">
          <el-avatar :size="34" :src="selectedPost.authorAvatarUrl">{{ initials(selectedPost.authorName) }}</el-avatar>
          <div>
            <div class="post-author">{{ selectedPost.authorName }}</div>
            <div class="post-time">{{ fmtTime(selectedPost.created_at) }}</div>
          </div>
        </div>
        <p v-if="selectedPost.content">{{ selectedPost.content }}</p>
        <div v-if="selectedPost.attachments?.length" :class="['media-grid', 'thread-media', mediaCountClass(selectedPost.attachments)]">
          <div v-for="a in selectedPost.attachments" :key="a.id" class="media-item">
            <img v-if="isImage(a)" :src="a.fileUrl" :alt="a.fileName" @click="openMedia(a)" />
            <video v-else-if="isVideo(a)" :src="a.fileUrl" controls preload="metadata" />
            <audio v-else-if="isAudio(a)" :src="a.fileUrl" controls />
            <a v-else class="file-chip" :href="a.fileUrl" target="_blank" rel="noopener">
              <span>📎</span>
              <span>{{ a.fileName }}</span>
            </a>
          </div>
        </div>
      </div>

      <div class="comments">
        <div v-for="c in comments" :key="c.id" class="comment">
          <el-avatar :size="30" :src="c.authorAvatarUrl">{{ initials(c.authorName) }}</el-avatar>
          <div class="comment-bubble">
            <div class="comment-author">{{ c.authorName }}</div>
            <div>{{ c.content }}</div>
            <div class="post-time">{{ fmtTime(c.created_at) }}</div>
          </div>
        </div>
        <div v-if="comments.length === 0" class="empty-comment">Chưa có bình luận</div>
      </div>

      <template #footer>
        <div class="comment-box">
          <el-input v-model="newComment" placeholder="Viết bình luận..." @keyup.enter="submitComment" />
          <el-button type="primary" :loading="commenting" @click="submitComment">Gửi</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import ClassPicker from '@/components/ClassPicker.vue';
import { classPostsApi } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useClassStore } from '@/stores/class';
import { initials } from '@/utils/format';
import { io } from 'socket.io-client';
import dayjs from 'dayjs';

const auth = useAuthStore();
const classStore = useClassStore();
const posts = ref([]);
const comments = ref([]);
const selectedPost = ref(null);
const showThread = ref(false);
const newComment = ref('');
const posting = ref(false);
const commenting = ref(false);
const isComposing = ref(false);
const showMediaUploader = ref(false);
const form = reactive({ title: '', content: '' });
const mediaFiles = ref([]);
let socket = null;
let joinedClassId = null;

const fmtTime = (d) => dayjs(d).format('DD/MM/YYYY HH:mm');
const roleLabel = (role) => ({ TEACHER: 'Giáo viên', STUDENT: 'Học viên', ADMIN: 'Quản trị viên' }[role] || 'Thành viên');
const selectedClassId = computed(() => classStore.selectedId);

const canManage = (post) => auth.isAdmin || auth.isTeacher || +post.user_id === +auth.user?.id;
const isImage = (a) => String(a.mimeType || '').startsWith('image/');
const isVideo = (a) => String(a.mimeType || '').startsWith('video/');
const isAudio = (a) => String(a.mimeType || '').startsWith('audio/');
const openMedia = (a) => window.open(a.fileUrl, '_blank');
const onMediaExceed = () => ElMessage.warning('Tối đa 8 file cho mỗi bài đăng');
const mediaCountClass = (items = []) => `media-count-${Math.min(items.length, 4)}`;
const startCompose = () => { isComposing.value = true; };
const cancelCompose = () => {
  form.title = '';
  form.content = '';
  mediaFiles.value = [];
  showMediaUploader.value = false;
  isComposing.value = false;
};

const loadPosts = async () => {
  if (!selectedClassId.value) return;
  posts.value = await classPostsApi.list(selectedClassId.value);
  if (selectedPost.value) {
    const fresh = posts.value.find(p => p.id === selectedPost.value.id);
    if (fresh) selectedPost.value = fresh;
  }
};

const loadComments = async () => {
  if (!selectedPost.value) return;
  comments.value = await classPostsApi.comments(selectedPost.value.id);
};

const openThread = async (post) => {
  selectedPost.value = post;
  showThread.value = true;
  await loadComments();
};

const submitPost = async () => {
  if (!selectedClassId.value) return ElMessage.warning('Chọn lớp trước khi đăng');
  const files = mediaFiles.value.map(f => f.raw).filter(Boolean);
  if (!form.content.trim() && !files.length) return ElMessage.warning('Nhập nội dung hoặc chọn file để đăng');
  posting.value = true;
  try {
    const data = new FormData();
    data.append('classId', selectedClassId.value);
    data.append('title', form.title || '');
    data.append('content', form.content || '');
    files.forEach(file => data.append('files', file));
    await classPostsApi.create(data);
    form.title = '';
    form.content = '';
    mediaFiles.value = [];
    showMediaUploader.value = false;
    isComposing.value = false;
    await loadPosts();
  } finally {
    posting.value = false;
  }
};

const submitComment = async () => {
  if (!selectedPost.value || !newComment.value.trim()) return;
  commenting.value = true;
  try {
    await classPostsApi.addComment(selectedPost.value.id, newComment.value);
    newComment.value = '';
    await Promise.all([loadComments(), loadPosts()]);
  } finally {
    commenting.value = false;
  }
};

const handleCommand = async (cmd, post) => {
  if (cmd === 'pin') {
    await classPostsApi.pin(post.id);
    await loadPosts();
    return;
  }
  if (cmd === 'delete') {
    await ElMessageBox.confirm('Xóa bài đăng này và toàn bộ bình luận?', 'Xác nhận', { type: 'warning' });
    await classPostsApi.delete(post.id);
    if (selectedPost.value?.id === post.id) showThread.value = false;
    await loadPosts();
  }
};

const closeSocket = () => {
  if (socket && joinedClassId) socket.emit('class-posts:leave', { classId: joinedClassId });
  if (socket) socket.disconnect();
  socket = null;
  joinedClassId = null;
};

const openSocket = () => {
  closeSocket();
  if (!selectedClassId.value || !auth.token) return;
  socket = io(import.meta.env.VITE_SOCKET_URL || '/', { transports: ['websocket'], auth: { token: auth.token } });
  joinedClassId = selectedClassId.value;
  socket.on('connect', () => {
    socket.emit('class-posts:join', { classId: selectedClassId.value, token: auth.token });
  });
  socket.on('class-posts:update', async (payload) => {
    await loadPosts();
    if (selectedPost.value && payload.postId === selectedPost.value.id) await loadComments();
  });
};

const onClassChange = async () => {
  await loadPosts();
  openSocket();
};

watch(selectedClassId, onClassChange);

onMounted(async () => {
  await loadPosts();
  openSocket();
});

onBeforeUnmount(closeSocket);
</script>

<style scoped>
.forum-page { max-width: 980px; margin: 0 auto; }
.forum-toolbar { display:flex; align-items:flex-start; justify-content:space-between; gap: 14px; margin-bottom: 4px; }
.forum-toolbar :deep(.class-picker) { margin-bottom: 10px; }
.forum-status { color:#888; font-size: 12px; padding-top: 10px; white-space: nowrap; }
.forum-feed { max-width: 820px; margin: 0 auto; }
.mb-4 { margin-bottom: 14px; }
.mb-2 { margin-bottom: 10px; }
.composer, .post-card, .empty-card { border-radius: 8px; border: 1px solid #ebe8df; }
.composer :deep(.el-card__body), .post-card :deep(.el-card__body) { padding: 14px; }
.composer-compact { display:flex; align-items:center; gap: 10px; cursor:pointer; }
.compose-placeholder { flex:1; height: 38px; border: 1px solid #e2dfd5; border-radius: 999px; background:#fafaf8; color:#888; text-align:left; padding: 0 16px; font-size: 13px; cursor:pointer; }
.compose-placeholder:hover { border-color:#1D9E75; background:#f7fbf8; }
.composer-head, .post-head, .author, .comment { display:flex; align-items:center; gap: 10px; }
.composer-head { margin-bottom: 12px; }
.composer-name, .post-author, .comment-author { font-weight: 600; font-size: 13px; }
.composer-sub, .post-time { font-size: 11px; color: #888; }
.composer-actions { display:flex; justify-content:space-between; align-items:center; margin-top: 10px; gap: 10px; }
.composer-tools, .composer-buttons { display:flex; align-items:center; gap: 8px; }
.tool-btn, .comment-action { border:none; background:transparent; color:#0F6E56; font-size: 13px; cursor:pointer; padding: 6px 8px; border-radius: 6px; }
.tool-btn:hover, .comment-action:hover { background:#E1F5EE; }
.media-picker { margin-top: 10px; }
.media-picker :deep(.el-upload-dragger) { padding: 18px 12px; min-height: 74px; display:flex; align-items:center; justify-content:center; }
.upload-prompt { font-size: 13px; color:#666; }
.upload-tip { font-size: 11px; color:#999; margin-top: 4px; }
.live-dot { font-size: 11px; color:#1D9E75; background:#E1F5EE; padding: 3px 8px; border-radius: 99px; }
.post-card { background:#fff; }
.post-head { justify-content:space-between; align-items:flex-start; }
.post-body { cursor:pointer; padding: 10px 0 6px; white-space: pre-wrap; }
.post-body h3 { margin: 0 0 6px; font-size: 16px; line-height: 1.35; }
.post-body p, .thread-post p { margin: 0; color:#333; line-height: 1.55; white-space: pre-wrap; font-size: 14px; }
.pin-badge { display:inline-flex; align-items:center; margin-left: 6px; padding: 2px 6px; border-radius: 99px; background:#FCEBEB; color:#A32D2D; font-size: 10px; font-weight: 600; }
.media-grid { display:grid; gap: 6px; margin: 8px 0 10px; }
.media-count-1 { grid-template-columns: 1fr; }
.media-count-2 { grid-template-columns: repeat(2, 1fr); }
.media-count-3, .media-count-4 { grid-template-columns: repeat(2, 1fr); }
.media-item { border-radius: 8px; overflow:hidden; background:#f5f4f0; border:1px solid #ece9e1; }
.media-item img { display:block; width:100%; height:190px; object-fit:cover; cursor:pointer; }
.media-count-1 .media-item img { height:auto; max-height: 420px; object-fit:contain; background:#111; }
.media-item video { display:block; width:100%; max-height:360px; background:#111; }
.media-item audio { width:100%; padding: 10px; box-sizing:border-box; }
.file-chip { display:flex; align-items:center; gap:8px; padding: 12px; color:#0F6E56; text-decoration:none; font-size: 13px; word-break: break-word; }
.post-actions { border-top: 1px solid #f0f0ee; padding-top: 8px; display:flex; justify-content:flex-end; }
.empty-card { background:#fff; padding: 28px; text-align:center; color:#aaa; }
.thread-post { border-bottom:1px solid #f0f0ee; padding-bottom: 12px; margin-bottom: 12px; }
.thread-media { margin-bottom: 0; }
.comments { max-height: 360px; overflow:auto; }
.comment { align-items:flex-start; margin-bottom: 10px; }
.comment-bubble { background:#f5f4f0; border-radius: 8px; padding: 8px 10px; flex: 1; }
.comment-box { display:flex; gap: 8px; width: 100%; }
.empty-comment { text-align:center; color:#aaa; padding: 18px; }
@media (max-width: 720px) {
  .forum-page, .forum-feed { max-width: none; }
  .forum-toolbar { display:block; }
  .forum-status { display:none; }
  .media-count-2, .media-count-3, .media-count-4 { grid-template-columns: 1fr; }
}
</style>
