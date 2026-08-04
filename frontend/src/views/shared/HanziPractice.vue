<template>
  <div class="hanzi-page">
    <div class="page-head">
      <div><p class="eyebrow">HỌC TẬP</p><h2>Luyện chữ Hán</h2><p>Học nghĩa và thứ tự nét trước, sau đó tự viết lại từng nét.</p></div>
      <el-button v-if="canManage" type="primary" @click="showSet = true">+ Tạo bộ chữ</el-button>
    </div>
    <ClassPicker @change="reload" />

    <div class="layout">
      <el-card class="set-panel">
        <template #header><b>Bộ luyện chữ</b></template>
        <button v-for="set in sets" :key="set.id" :class="['set-row',{active:activeSet?.id===set.id}]" @click="selectSet(set)">
          <span><b>{{ set.title }}</b><small>{{ set.characterCount }} chữ</small></span>
          <em v-if="!canManage">{{ set.completedCount || 0 }}/{{ set.characterCount }}</em>
        </button>
        <el-empty v-if="!sets.length" description="Chưa có bộ luyện chữ" />
      </el-card>

      <el-card class="content-panel">
        <template #header>
          <div class="panel-head"><b>{{ activeSet?.title || 'Chọn một bộ chữ' }}</b><el-button v-if="canManage && activeSet" @click="openCreateCharacter">+ Thêm chữ</el-button></div>
        </template>

        <template v-if="activeCharacter">
          <div class="mode-tabs">
            <el-button :type="mode==='learn'?'primary':'default'" @click="mode='learn'">1. Học chữ</el-button>
            <el-button :type="mode==='practice'?'primary':'default'" @click="openPractice">2. Luyện viết</el-button>
          </div>

          <div v-if="mode==='learn'" class="learn-card">
            <div class="character-info">
              <div class="hanzi">{{ activeCharacter.character }}</div>
              <b>{{ activeCharacter.pinyin }}</b>
              <h3>{{ activeCharacter.meaning }}</h3>
              <p v-if="activeCharacter.note"><strong>Chú thích:</strong> {{ activeCharacter.note }}</p>
              <p v-if="activeCharacter.example"><strong>Ví dụ:</strong> {{ activeCharacter.example }}</p>
            </div>
            <div class="visuals">
              <figure v-if="activeCharacter.stroke_gif_url"><img :src="mediaUrl(activeCharacter.stroke_gif_url)" alt="GIF thứ tự nét" /><figcaption>Thứ tự nét</figcaption></figure>
              <figure v-if="activeCharacter.illustration_url"><img :src="mediaUrl(activeCharacter.illustration_url)" alt="Hình minh họa" /><figcaption>Hình minh họa</figcaption></figure>
            </div>
            <div class="learn-actions">
              <el-button :disabled="characterIndex===0" @click="previousCharacter">Trước</el-button>
              <span>{{ characterIndex+1 }}/{{ characters.length }}</span>
              <el-button type="primary" @click="finishLearningCharacter">{{ characterIndex===characters.length-1 ? 'Đã học xong · Luyện viết' : 'Đã học · Chữ tiếp theo' }}</el-button>
            </div>
          </div>

          <div v-else class="practice-card">
            <div class="practice-copy">
              <span>Viết chữ</span><strong>{{ activeCharacter.character }}</strong><small>{{ activeCharacter.meaning }} · {{ activeCharacter.pinyin }}</small>
            </div>
            <div class="writer-wrap"><div ref="writerTarget" class="writer-target"></div></div>
            <div :class="['feedback',feedbackType]">{{ feedback }}</div>
            <div class="practice-actions">
              <el-button @click="showStrokeHint">Gợi ý nét tiếp theo</el-button>
              <el-button @click="restartQuiz">Viết lại</el-button>
              <el-button v-if="characterComplete" type="success" @click="nextPracticeCharacter">Chữ tiếp theo</el-button>
            </div>
          </div>

          <div v-if="canManage" class="manage-actions">
            <el-button type="primary" plain @click="openEditCharacter">Sửa chữ</el-button>
            <el-button type="danger" plain @click="removeCharacter">Xóa chữ</el-button>
          </div>
        </template>
        <el-empty v-else :description="activeSet ? 'Bộ này chưa có chữ' : 'Hãy chọn một bộ luyện chữ'" />
      </el-card>
    </div>

    <el-dialog v-model="showSet" title="Tạo bộ luyện chữ" width="440px">
      <el-form label-position="top"><el-form-item label="Tên bộ *"><el-input v-model="setForm.title" placeholder="VD: 10 chữ HSK1 - Bài 1" /></el-form-item><el-form-item label="Mô tả"><el-input v-model="setForm.description" type="textarea" /></el-form-item></el-form>
      <template #footer><el-button @click="showSet=false">Hủy</el-button><el-button type="primary" @click="createSet">Tạo bộ</el-button></template>
    </el-dialog>

    <el-dialog v-model="showCharacter" :title="editingId ? 'Sửa chữ Hán' : 'Thêm chữ Hán'" width="620px">
      <div @paste="pasteMedia($event,'strokeGifUrl')">
        <el-form label-position="top">
          <el-row :gutter="12"><el-col :span="8"><el-form-item label="Chữ Hán *"><el-input v-model="characterForm.character" maxlength="1" /></el-form-item></el-col><el-col :span="8"><el-form-item label="Pinyin"><el-input v-model="characterForm.pinyin" /></el-form-item></el-col><el-col :span="8"><el-form-item label="Thứ tự"><el-input-number v-model="characterForm.displayOrder" :min="0" /></el-form-item></el-col></el-row>
          <el-form-item label="Nghĩa *"><el-input v-model="characterForm.meaning" /></el-form-item>
          <el-form-item label="Chú thích"><el-input v-model="characterForm.note" type="textarea" :rows="2" /></el-form-item>
          <el-form-item label="Ví dụ"><el-input v-model="characterForm.example" type="textarea" :rows="2" /></el-form-item>
          <el-form-item label="GIF thứ tự nét">
            <el-input v-model="characterForm.strokeGifUrl" placeholder="Dán URL GIF hoặc Ctrl+V ảnh GIF tại đây" @paste.stop="pasteMedia($event,'strokeGifUrl')" />
            <el-upload :auto-upload="false" :show-file-list="false" :on-change="file=>uploadMedia(file,'strokeGifUrl')" accept="image/gif,image/*"><el-button class="upload-button" :loading="uploading">Chọn GIF/ảnh</el-button></el-upload>
            <img v-if="characterForm.strokeGifUrl" class="form-preview" :src="mediaUrl(characterForm.strokeGifUrl)" />
          </el-form-item>
          <el-form-item label="Hình minh họa (không bắt buộc)">
            <el-input v-model="characterForm.illustrationUrl" placeholder="Dán URL hoặc chọn ảnh" @paste.stop="pasteMedia($event,'illustrationUrl')" />
            <el-upload :auto-upload="false" :show-file-list="false" :on-change="file=>uploadMedia(file,'illustrationUrl')" accept="image/*"><el-button class="upload-button" :loading="uploading">Chọn hình</el-button></el-upload>
            <img v-if="characterForm.illustrationUrl" class="form-preview" :src="mediaUrl(characterForm.illustrationUrl)" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer><el-button @click="showCharacter=false">Hủy</el-button><el-button type="primary" @click="saveCharacter">Lưu chữ</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import HanziWriter from 'hanzi-writer';
import { ElMessage, ElMessageBox } from 'element-plus';
import ClassPicker from '@/components/ClassPicker.vue';
import { hanziApi, learningExtrasApi } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useClassStore } from '@/stores/class';
import { mediaUrl } from '@/utils/media';

const auth=useAuthStore(), classStore=useClassStore();
const canManage=computed(()=>auth.isTeacher||auth.isAdmin);
const sets=ref([]), characters=ref([]), activeSet=ref(null), characterIndex=ref(0), mode=ref('learn');
const showSet=ref(false), showCharacter=ref(false), editingId=ref(null), uploading=ref(false), writerTarget=ref(null);
const setForm=reactive({title:'',description:''});
const characterForm=reactive({character:'',pinyin:'',meaning:'',note:'',example:'',strokeGifUrl:'',illustrationUrl:'',displayOrder:0});
const feedback=ref('Viết từng nét vào ô vuông'), feedbackType=ref(''), characterComplete=ref(false), currentMistakes=ref(0);
let writer=null;
const activeCharacter=computed(()=>characters.value[characterIndex.value]||null);

async function reload(){ if(!classStore.selectedId)return; sets.value=await hanziApi.sets(classStore.selectedId); if(!sets.value.some(s=>s.id===activeSet.value?.id))activeSet.value=null; if(!activeSet.value&&sets.value.length)await selectSet(sets.value[0]); }
async function selectSet(set){ activeSet.value=set; characters.value=await hanziApi.characters(set.id); characterIndex.value=0; mode.value='learn'; }
async function createSet(){ if(!setForm.title.trim())return ElMessage.warning('Nhập tên bộ chữ'); await hanziApi.createSet({classId:classStore.selectedId,...setForm}); Object.assign(setForm,{title:'',description:''}); showSet.value=false; await reload(); }
function resetCharacterForm(){Object.assign(characterForm,{character:'',pinyin:'',meaning:'',note:'',example:'',strokeGifUrl:'',illustrationUrl:'',displayOrder:characters.value.length});}
function openCreateCharacter(){editingId.value=null;resetCharacterForm();showCharacter.value=true;}
function openEditCharacter(){const c=activeCharacter.value;if(!c)return;editingId.value=c.id;Object.assign(characterForm,{character:c.character,pinyin:c.pinyin||'',meaning:c.meaning||'',note:c.note||'',example:c.example||'',strokeGifUrl:c.stroke_gif_url||'',illustrationUrl:c.illustration_url||'',displayOrder:c.display_order||0});showCharacter.value=true;}
async function saveCharacter(){if(!characterForm.character.trim()||!characterForm.meaning.trim())return ElMessage.warning('Nhập chữ Hán và nghĩa');if(editingId.value)await hanziApi.updateCharacter(editingId.value,characterForm);else await hanziApi.createCharacter(activeSet.value.id,characterForm);showCharacter.value=false;await selectSet(activeSet.value);ElMessage.success('Đã lưu chữ Hán');}
async function removeCharacter(){await ElMessageBox.confirm(`Xóa chữ ${activeCharacter.value.character}?`,'Xác nhận xóa',{type:'warning'});await hanziApi.deleteCharacter(activeCharacter.value.id);await selectSet(activeSet.value);}
async function uploadMedia(file,field){if(!file.raw)return;uploading.value=true;try{const fd=new FormData();fd.append('file',file.raw);const result=await learningExtrasApi.uploadFlashcardMedia(fd);characterForm[field]=result.mediaUrl;}finally{uploading.value=false;}}
function pastedUrl(event){const html=event.clipboardData?.getData('text/html')||'';if(html){const doc=new DOMParser().parseFromString(html,'text/html');const src=doc.querySelector('img')?.getAttribute('src');if(/^https?:\/\//i.test(src||''))return src;}const text=(event.clipboardData?.getData('text/plain')||'').trim();return /^https?:\/\//i.test(text)?text:'';}
async function pasteMedia(event,field){const url=pastedUrl(event);if(url){event.preventDefault();characterForm[field]=url;return;}const item=[...(event.clipboardData?.items||[])].find(i=>i.type.startsWith('image/'));if(item){event.preventDefault();await uploadMedia({raw:item.getAsFile()},field);}}
function previousCharacter(){characterIndex.value=Math.max(0,characterIndex.value-1);}
async function finishLearningCharacter(){if(auth.isStudent)await hanziApi.saveProgress(activeCharacter.value.id,{learned:true});if(characterIndex.value<characters.value.length-1)characterIndex.value++;else openPractice();}
function openPractice(){mode.value='practice';characterIndex.value=0;nextTick(startQuiz);}
function makeWriter(){if(!writerTarget.value||!activeCharacter.value)return;writerTarget.value.innerHTML='';writer=HanziWriter.create(writerTarget.value,activeCharacter.value.character,{width:320,height:320,padding:18,showOutline:true,showCharacter:false,strokeColor:'#1b2b26',outlineColor:'#d9e5df',drawingColor:'#16856f',drawingWidth:10});}
function startQuiz(){makeWriter();characterComplete.value=false;currentMistakes.value=0;feedback.value='Viết nét đầu tiên';feedbackType.value='';writer?.quiz({showHintAfterMisses:1,highlightOnComplete:true,onMistake:()=>{currentMistakes.value++;feedback.value='Sai nét hoặc sai thứ tự — hãy viết lại nét này';feedbackType.value='error';},onCorrectStroke:data=>{feedback.value=`Đúng · còn ${data.strokesRemaining} nét`;feedbackType.value='success';},onComplete:async()=>{characterComplete.value=true;feedback.value=currentMistakes.value?'Đã viết đúng toàn bộ chữ':'Hoàn hảo · đúng ngay lần đầu';feedbackType.value='success';if(auth.isStudent)await hanziApi.saveProgress(activeCharacter.value.id,{learned:true,completed:true,mistakes:currentMistakes.value,attempts:1});}});}
function restartQuiz(){startQuiz();}
function showStrokeHint(){feedback.value='Đang minh họa thứ tự nét, sau đó bạn viết lại';feedbackType.value='hint';writer?.cancelQuiz();writer?.animateCharacter({onComplete:startQuiz});}
function nextPracticeCharacter(){if(characterIndex.value<characters.value.length-1){characterIndex.value++;nextTick(startQuiz);}else{ElMessage.success('Bạn đã hoàn thành cả bộ luyện chữ');mode.value='learn';characterIndex.value=0;reload();}}

watch(()=>classStore.selectedId,reload);watch([mode,characterIndex],()=>{if(mode.value==='practice')nextTick(startQuiz);});onMounted(reload);onBeforeUnmount(()=>writer?.cancelQuiz());
</script>

<style scoped>
.hanzi-page{max-width:1400px}.page-head,.panel-head,.learn-actions,.practice-actions,.manage-actions{display:flex;align-items:center}.page-head{justify-content:space-between;margin-bottom:16px}.page-head h2{margin:2px 0}.page-head p{margin:3px 0;color:#66756f}.eyebrow{color:#16856f!important;font-size:12px;font-weight:700}.layout{display:grid;grid-template-columns:280px 1fr;gap:16px;margin-top:14px}.set-row{border:0;border-bottom:1px solid #edf0ee;background:#fff;cursor:pointer;display:flex;justify-content:space-between;padding:12px;text-align:left;width:100%}.set-row span{display:flex;flex-direction:column;gap:4px}.set-row small,.set-row em{color:#718079;font-size:12px}.set-row.active{background:#e1f5ee;color:#0f6e56}.panel-head{justify-content:space-between}.mode-tabs{text-align:center;margin-bottom:18px}.learn-card{display:grid;grid-template-columns:minmax(220px,.8fr) 1.2fr;gap:24px}.character-info{text-align:center}.hanzi{font-size:100px;line-height:1.15}.character-info h3{font-size:22px}.character-info p{text-align:left;line-height:1.55}.visuals{display:flex;justify-content:center;gap:16px;flex-wrap:wrap}.visuals figure{margin:0;text-align:center}.visuals img{border:1px solid #e5e9e7;border-radius:12px;height:280px;max-width:340px;object-fit:contain}.visuals figcaption{color:#718079;font-size:12px;margin-top:6px}.learn-actions{grid-column:1/-1;justify-content:center;gap:14px;border-top:1px solid #edf0ee;padding-top:16px}.practice-card{text-align:center}.practice-copy{display:flex;flex-direction:column}.practice-copy strong{font-size:46px}.practice-copy small{color:#718079}.writer-wrap{background:repeating-linear-gradient(0deg,transparent 0 159px,#e6ece9 159px 160px),repeating-linear-gradient(90deg,transparent 0 159px,#e6ece9 159px 160px);border:2px solid #cddbd5;height:320px;margin:14px auto;width:320px}.writer-target{height:320px;width:320px}.feedback{min-height:24px;font-weight:600}.feedback.error{color:#d64545}.feedback.success{color:#16856f}.feedback.hint{color:#d88716}.practice-actions,.manage-actions{justify-content:center;gap:10px;margin-top:14px}.manage-actions{border-top:1px solid #edf0ee;padding-top:16px}.upload-button{margin-top:8px}.form-preview{border:1px solid #e5e9e7;border-radius:8px;display:block;margin-top:8px;max-height:130px;max-width:180px;object-fit:contain}@media(max-width:800px){.page-head{align-items:flex-start;flex-direction:column;gap:10px}.layout{grid-template-columns:1fr}.learn-card{grid-template-columns:1fr}.visuals img{height:auto;max-height:260px;max-width:100%}}
</style>
