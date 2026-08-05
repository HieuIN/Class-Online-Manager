<template>
  <div class="ai-agent">
    <button class="agent-launcher" aria-label="Mở Ctalk AI" @click="open=!open"><el-icon><ChatDotRound /></el-icon><span>Ctalk AI</span></button>
    <section v-if="open" class="agent-panel">
      <header><div><b>Ctalk AI</b><small>Trợ lý {{ roleName }} · {{ pageName }}</small></div><button @click="open=false">×</button></header>
      <div ref="messageList" class="agent-messages">
        <div v-if="!messages.length" class="agent-welcome"><div class="agent-orb">AI</div><b>Xin chào {{ auth.user?.fullName || '' }}!</b><p>{{ welcomeText }}</p><div class="quick-grid"><button v-for="item in quickPrompts" :key="item" @click="send(item)">{{ item }}</button></div></div>
        <div v-for="(message,index) in messages" :key="index" :class="['agent-message',message.role]">
          <div>{{ message.content }}</div>
          <button v-if="message.navigate" class="navigate-action" @click="navigate(message.navigate.path)">{{ message.navigate.label }} →</button>
          <div v-if="message.draft&&message.draft.type!=='NONE'" class="draft-card"><small>BẢN NHÁP · {{ message.draft.type }}</small><b>{{ message.draft.title }}</b><p>{{ message.draft.content }}</p><em>Hãy kiểm tra trước khi sử dụng.</em></div>
          <div v-if="message.suggestions?.length" class="suggestions"><button v-for="suggestion in message.suggestions.slice(0,3)" :key="suggestion" @click="send(suggestion)">{{ suggestion }}</button></div>
        </div>
        <div v-if="loading" class="agent-message assistant typing"><i></i><i></i><i></i></div>
      </div>
      <div v-if="cooldownSeconds>0" class="quota-wait">⏳ Gemini đang tạm giới hạn lượt dùng · Thử lại sau {{ cooldownText }}</div>
      <footer><textarea v-model="input" rows="2" maxlength="4000" :disabled="cooldownSeconds>0" :placeholder="cooldownSeconds>0?'Vui lòng chờ hết thời gian giới hạn...':placeholder" @keydown.enter.exact.prevent="send()"></textarea><button :disabled="loading||cooldownSeconds>0||!input.trim()" @click="send()">{{ cooldownSeconds>0?cooldownText:'Gửi' }}</button></footer>
      <div class="agent-disclaimer">AI có thể nhầm. Nội dung và thao tác quan trọng cần được kiểm tra.</div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ChatDotRound } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { aiAgentApi } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useClassStore } from '@/stores/class';

const auth=useAuthStore(),classStore=useClassStore(),route=useRoute(),router=useRouter();
const open=ref(false),input=ref(''),loading=ref(false),messageList=ref(null);
const cooldownSeconds=ref(0);let cooldownTimer=null;
const storageKey=computed(()=>`ctalk-ai-agent:${auth.user?.id||'guest'}`);
const messages=ref([]);
const roleName=computed(()=>({STUDENT:'học tập',TEACHER:'giáo viên',ADMIN:'quản trị'}[auth.role]||''));
const pageName=computed(()=>String(route.meta?.title||route.path));
const welcomeText=computed(()=>auth.isStudent?'Mình có thể giải thích bài, gợi ý luyện tập và nhắc việc cần làm.':auth.isTeacher?'Mình có thể hỗ trợ soạn bản nháp, phân tích lớp và hướng dẫn thao tác.':'Mình có thể hỗ trợ tổng hợp vận hành và hướng dẫn quản trị.');
const quickPrompts=computed(()=>auth.isStudent?['Hôm nay tôi cần làm gì?','Giải thích cách dùng trang này','Tạo 5 câu luyện tập']:auth.isTeacher?['Tóm tắt lớp đang chọn','Tạo bản nháp Quiz','Hướng dẫn dùng trang này']:['Tóm tắt tình hình hệ thống','Có việc gì cần kiểm tra?','Hướng dẫn trang này']);
const placeholder=computed(()=>auth.isStudent?'Hỏi bài hoặc hỏi cách sử dụng...':'Yêu cầu phân tích hoặc tạo bản nháp...');
const cooldownText=computed(()=>{const minutes=Math.floor(cooldownSeconds.value/60),seconds=cooldownSeconds.value%60;return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;});

const restore=()=>{try{messages.value=JSON.parse(localStorage.getItem(storageKey.value)||'[]').slice(-30);}catch{messages.value=[];}};
watch(storageKey,restore,{immediate:true});
watch(messages,value=>localStorage.setItem(storageKey.value,JSON.stringify(value.slice(-30))),{deep:true});
const scroll=()=>nextTick(()=>{if(messageList.value)messageList.value.scrollTop=messageList.value.scrollHeight;});
const startCooldown=seconds=>{cooldownSeconds.value=Math.max(1,Number(seconds)||300);if(cooldownTimer)clearInterval(cooldownTimer);cooldownTimer=setInterval(()=>{cooldownSeconds.value=Math.max(0,cooldownSeconds.value-1);if(!cooldownSeconds.value){clearInterval(cooldownTimer);cooldownTimer=null;}},1000);};
const send=async preset=>{const text=String(preset||input.value).trim();if(!text||loading.value||cooldownSeconds.value>0)return;input.value='';messages.value.push({role:'user',content:text});loading.value=true;scroll();try{const history=messages.value.slice(-9,-1).map(m=>({role:m.role,content:m.content}));const result=await aiAgentApi.chat({message:text,path:route.path,classId:classStore.selectedId||null,history});messages.value.push({role:'assistant',content:result.reply||'Mình chưa tạo được câu trả lời.',suggestions:result.rateLimited?[]:(result.suggestions||[]),navigate:result.navigate,draft:result.draft});if(result.rateLimited)startCooldown(result.retryAfterSeconds);}catch(error){messages.value.push({role:'assistant',content:error.response?.data?.message||'AI Agent đang bận. Vui lòng thử lại sau.'});ElMessage.error('Không thể kết nối AI Agent');}finally{loading.value=false;scroll();}};
const navigate=path=>{router.push(path);open.value=false;};
onUnmounted(()=>{if(cooldownTimer)clearInterval(cooldownTimer);});
</script>

<style scoped>
.quota-wait{background:#fff5dc;border-top:1px solid #efd69a;color:#8a6316;font-size:12px;font-weight:700;padding:9px 12px;text-align:center}
.agent-launcher{align-items:center;background:#087f67;border:0;border-radius:999px;bottom:24px;box-shadow:0 12px 30px rgba(8,70,57,.28);color:#fff;cursor:pointer;display:flex;font-weight:800;gap:8px;padding:13px 17px;position:fixed;right:24px;z-index:2050}.agent-launcher:hover{background:#066b57;transform:translateY(-1px)}.agent-panel{background:var(--surface);border:1px solid var(--border);border-radius:16px;bottom:82px;box-shadow:0 24px 60px rgba(20,42,34,.24);display:flex;flex-direction:column;height:min(680px,calc(100dvh - 110px));overflow:hidden;position:fixed;right:24px;width:min(410px,calc(100vw - 32px));z-index:2050}.agent-panel header{align-items:center;background:linear-gradient(135deg,#087f67,#115f51);color:#fff;display:flex;justify-content:space-between;padding:15px 17px}.agent-panel header div{display:flex;flex-direction:column}.agent-panel header small{opacity:.78}.agent-panel header button{background:transparent;border:0;color:#fff;cursor:pointer;font-size:25px}.agent-messages{display:flex;flex:1;flex-direction:column;gap:11px;overflow-y:auto;padding:15px}.agent-welcome{align-items:center;display:flex;flex-direction:column;text-align:center}.agent-welcome p{color:var(--ink-500);line-height:1.5}.agent-orb{align-items:center;background:#ddf4ec;border-radius:50%;color:#087f67;display:flex;font-weight:900;height:48px;justify-content:center;margin-bottom:8px;width:48px}.quick-grid,.suggestions{display:flex;flex-wrap:wrap;gap:7px;justify-content:center}.quick-grid button,.suggestions button{background:var(--surface);border:1px solid var(--border-strong);border-radius:999px;color:var(--brand-700);cursor:pointer;font-size:12px;padding:7px 10px}.agent-message{display:flex;flex-direction:column;gap:8px;max-width:88%}.agent-message>div:first-child{border-radius:12px;line-height:1.55;padding:10px 12px;white-space:pre-wrap}.agent-message.user{align-self:flex-end}.agent-message.user>div:first-child{background:#087f67;color:#fff}.agent-message.assistant{align-self:flex-start}.agent-message.assistant>div:first-child{background:var(--surface-soft);color:var(--ink-900)}.navigate-action{align-self:flex-start;background:transparent;border:0;color:#087f67;cursor:pointer;font-weight:800;padding:0}.draft-card{background:#fff9e9;border:1px solid #efdba6;border-radius:10px;display:flex;flex-direction:column;gap:5px;padding:10px}.draft-card small{color:#9b6d13}.draft-card p{margin:3px 0;white-space:pre-wrap}.draft-card em{color:#796d56;font-size:11px}.typing{align-items:center;background:var(--surface-soft);border-radius:12px;display:flex!important;flex-direction:row;padding:12px}.typing i{animation:pulse 1s infinite;background:#7e918a;border-radius:50%;height:6px;width:6px}.typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}@keyframes pulse{50%{opacity:.25;transform:translateY(-3px)}}.agent-panel footer{border-top:1px solid var(--border);display:flex;gap:8px;padding:11px}.agent-panel textarea{background:var(--surface);border:1px solid var(--border-strong);border-radius:10px;color:var(--ink-900);flex:1;font:inherit;outline:none;padding:9px;resize:none}.agent-panel footer button{background:#087f67;border:0;border-radius:9px;color:#fff;font-weight:800;padding:0 14px}.agent-panel footer button:disabled{opacity:.45}.agent-disclaimer{color:var(--ink-400);font-size:10px;padding:0 12px 9px;text-align:center}@media(max-width:600px){.agent-launcher{bottom:16px;right:16px}.agent-panel{border-radius:14px 14px 0 0;bottom:0;height:85dvh;left:0;right:0;width:100%}}
</style>
