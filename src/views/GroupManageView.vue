
<template>
  <div class="page">
    <section class="hero cardSurface">
      <div class="heroTopline">
        <button class="ghost backBtn" type="button" @click="router.back()">← 대화로</button>
        <button class="ghost" type="button" @click="router.push(`/inbox/conversations/${conversationId}`)">채팅 열기</button>
      </div>
      <div class="heroMain">
        <div class="heroIdentity">
          <div class="heroAvatar" v-if="coverPreviewUrl">
            <img :src="coverPreviewUrl" alt="" />
          </div>
          <div v-else class="heroAvatar heroAvatar--fallback">{{ heroInitial }}</div>
          <div>
            <div class="eyebrow">GROUP MANAGEMENT</div>
            <h1 class="title">{{ title || '그룹 관리' }}</h1>
            <p class="sub">그룹 이름, 대표 이미지, 멤버를 정리해서 행동이 이어지는 대화 흐름을 더 또렷하게 만들어요.</p>
          </div>
        </div>
        <div class="heroStats">
          <div class="heroStat"><strong>{{ members.length }}</strong><span>멤버</span></div>
          <div class="heroStat"><strong>{{ ownerMemberCount }}</strong><span>오너</span></div>
          <div class="heroStat"><strong>{{ memberOnlyCount }}</strong><span>일반 멤버</span></div>
        </div>
      </div>
    </section>

    <section class="cardSurface panel">
      <div class="sectionTitle">그룹 정보</div>
      <div class="ownerPill">현재 사용자 기준 오너만 수정/초대/제거 기능을 사용할 수 있어요.</div>
      <div class="formGrid">
        <label class="field">
          <span>그룹 이름</span>
          <input v-model.trim="title" class="input" placeholder="그룹 이름" />
        </label>
        <label class="field">
          <span>대표 이미지</span>
          <input ref="coverInputRef" class="srOnlyInput" type="file" accept="image/*" @change="onPickCover" />
          <div class="coverPickerRow">
            <button class="pickerBtn" type="button" @click="openCoverPicker">🖼 대표 이미지 선택</button>
            <span class="pickerHint">{{ coverFileName || (coverPreviewUrl ? "기존 이미지 사용 중" : "선택된 파일 없음") }}</span>
          </div>
        </label>
      </div>
      <div class="coverPreview" v-if="coverPreviewUrl">
        <img :src="coverPreviewUrl" alt="" />
      </div>
      <div class="actions">
        <button class="btn" :disabled="savingInfo" @click="saveInfo">{{ savingInfo ? "저장 중…" : "그룹 정보 저장" }}</button>
      </div>
    </section>

    <section class="cardSurface panel">
      <div class="sectionHead">
        <div>
          <div class="sectionTitle">멤버 목록</div>
          <div class="sectionSub">오너/멤버 구분을 함께 보여줘요.</div>
        </div>
        <button class="ghost" @click="loadMembers">새로고침</button>
      </div>
      <div class="memberList">
        <article v-for="m in members" :key="m.userId" class="memberCard">
          <div class="memberIdentity">
            <div class="memberAvatar">{{ memberInitial(m) }}</div>
            <div>
              <div class="memberRow">
                <div class="memberName">{{ m.nickname || m.handle || "사용자" }}</div>
                <span class="roleBadge" :class="{ owner: isOwner(m) }">{{ isOwner(m) ? "오너" : "멤버" }}</span>
              </div>
              <div class="memberMeta">@{{ m.handle || "unknown" }}</div>
            </div>
          </div>
          <button v-if="canRemove(m)" class="dangerGhost" @click="removeMemberItem(m)">제거</button>
        </article>
      </div>
    </section>

    <section class="cardSurface panel">
      <div class="sectionTitle">멤버 초대</div>
      <div class="sectionSub">핸들 검색으로 초대할 사람을 고를 수 있어요.</div>
      <div class="inviteRow inviteRow--search">
        <div class="searchFieldWrap searchFieldWrap--invite">
          <span class="searchIcon" aria-hidden="true"></span>
          <input v-model.trim="q" class="input input--withIcon inviteSearchInput" placeholder="핸들 또는 이름으로 멤버 검색" @keydown.enter.prevent="search" />
        </div>
        <button class="searchBtn" @click="search">검색</button>
      </div>
      <div class="searchList">
        <article v-for="u in results" :key="u.userId || u.id" class="memberCard">
          <div>
            <div class="memberName">{{ u.nickname || u.name || u.handle }}</div>
            <div class="memberMeta">@{{ u.handle || "" }}</div>
          </div>
          <button class="btn" :disabled="inviting" @click="invite(u)">초대</button>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { searchUsers } from "@/api/users";
import { fetchConversationMembers, inviteGroupMembers, removeGroupMember, updateGroupConversation } from "@/api/conversations";
import { uploadImages } from "@/api/files";
import { useConversationsStore } from "@/stores/conversations";
import { useToastStore } from "@/stores/toast";
import { useAuthStore } from "@/stores/auth";


const route = useRoute();
const router = useRouter();
const convStore = useConversationsStore();
const toast = useToastStore();
const auth = useAuthStore();

const conversationId = String(route.params.conversationId || "");
const title = ref("");
const members = ref([]);
const results = ref([]);
const q = ref("");
const savingInfo = ref(false);
const inviting = ref(false);
const coverImageFileId = ref(null);
const coverPreviewUrl = ref("");
const coverInputRef = ref(null);
const coverFileName = ref("");

function currentConversation() {
  return (convStore.items || []).find((c) => String(c.conversationId) === String(conversationId)) || null;
}
function ownerId() {
  return String(currentConversation()?.ownerId || "");
}
function isOwner(member) {
  return String(member?.userId || "") === ownerId();
}
function canRemove(member) {
  const meId = String(auth.me?.userId || auth.me?.id || "");
  return String(member?.userId || "") !== meId && !isOwner(member);
}
const ownerMemberCount = computed(() => members.value.filter((m) => isOwner(m)).length);
const memberOnlyCount = computed(() => Math.max(0, members.value.length - ownerMemberCount.value));
const heroInitial = computed(() => {
  const source = String(title.value || currentConversation()?.conversationTitle || "G").trim();
  return source ? source[0].toUpperCase() : "G";
});
function memberInitial(member) {
  const source = String(member?.nickname || member?.handle || "U").trim();
  return source ? source[0].toUpperCase() : "U";
}
async function loadMembers() {
  const res = await fetchConversationMembers(conversationId);
  members.value = Array.isArray(res?.items) ? res.items : [];
  const conv = currentConversation();
  title.value = conv?.conversationTitle || conv?.title || title.value || "";
  coverPreviewUrl.value = conv?.coverImageUrl || coverPreviewUrl.value || "";
  if (!coverPreviewUrl.value) coverFileName.value = "";
}

function openCoverPicker() {
  coverInputRef.value?.click?.();
}

async function onPickCover(e) {
  const file = e?.target?.files?.[0];
  if (!file) return;
  try {
    const ids = await uploadImages([file]);
    coverImageFileId.value = ids?.[0] || null;
    coverPreviewUrl.value = URL.createObjectURL(file);
    coverFileName.value = file.name || "";
    toast.success?.("대표 이미지 준비", "저장 버튼을 누르면 그룹 정보에 반영돼요.");
  } catch (err) {
    toast.error?.("이미지 업로드 실패", err?.response?.data?.message || "잠시 후 다시 시도해주세요.");
  }
}
async function saveInfo() {
  savingInfo.value = true;
  try {
    await updateGroupConversation(conversationId, { title: title.value, coverImageFileId: coverImageFileId.value });
    await convStore.refresh?.();
    toast.success?.("그룹 정보 저장", "그룹 이름/대표 이미지를 반영했어요.");
    router.back();
  } catch (err) {
    toast.error?.("저장 실패", err?.response?.data?.message || "잠시 후 다시 시도해주세요.");
  } finally {
    savingInfo.value = false;
  }
}
async function search() {
  if (!q.value) { results.value = []; return; }
  try {
    const res = await searchUsers({ q: q.value, size: 10 });
    results.value = res.items || [];
  } catch {
    results.value = [];
  }
}
async function invite(user) {
  inviting.value = true;
  try {
    const userId = user?.userId || user?.id;
    await inviteGroupMembers(conversationId, [userId]);
    await loadMembers();
    toast.success?.("멤버 초대", "그룹 멤버에 추가했어요.");
  } catch (err) {
    toast.error?.("초대 실패", err?.response?.data?.message || "잠시 후 다시 시도해주세요.");
  } finally {
    inviting.value = false;
  }
}
async function removeMemberItem(member) {
  try {
    await removeGroupMember(conversationId, member.userId);
    await loadMembers();
    toast.success?.("멤버 제거", "그룹에서 제거했어요.");
  } catch (err) {
    toast.error?.("제거 실패", err?.response?.data?.message || "잠시 후 다시 시도해주세요.");
  }
}
onMounted(loadMembers);
</script>

<style scoped>
.page{
  padding:20px 20px calc(96px + env(safe-area-inset-bottom));
  max-width:1120px;
  margin:0 auto;
  display:grid;
  gap:16px;
}
.cardSurface{
  border:1px solid rgba(255,255,255,.10);
  border-radius:24px;
  background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02));
  box-shadow:0 18px 46px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.04);
}
.hero,.panel{padding:18px}
.heroTopline,.sectionHead,.actions,.inviteRow{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}
.heroMain{margin-top:14px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:start}
.heroIdentity{display:flex;gap:14px;align-items:center}
.heroAvatar{width:64px;height:64px;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);display:grid;place-items:center;font-size:24px;font-weight:950}
.heroAvatar img{width:100%;height:100%;object-fit:cover}
.heroAvatar--fallback{color:#fff}
.heroStats{display:grid;grid-template-columns:repeat(3,minmax(88px,1fr));gap:10px}
.heroStat{padding:12px;border-radius:18px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);display:grid;gap:4px;text-align:center}
.heroStat strong{font-size:24px;line-height:1;font-weight:950}
.heroStat span{font-size:12px;color:rgba(255,255,255,.68)}
.eyebrow{font-size:11px;font-weight:900;letter-spacing:.18em;color:rgba(255,255,255,.58)}
.title{margin:6px 0 0;font-size:30px;line-height:1.05;font-weight:950;letter-spacing:-.04em}
.sub,.sectionSub,.memberMeta{font-size:13px;color:rgba(255,255,255,.72)}
.ownerPill{margin-top:10px;padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);font-size:12px;color:rgba(255,255,255,.74)}
.sectionTitle{font-size:18px;font-weight:950}
.formGrid{margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px}
.field{display:grid;gap:8px}
.field span{font-size:12px;font-weight:900;color:rgba(255,255,255,.64)}
.srOnlyInput{position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;overflow:hidden}
.coverPickerRow{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.pickerBtn,.searchBtn{height:44px;padding:0 14px;border-radius:14px;border:1px solid rgba(255,255,255,.10);background:linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.04));color:#fff;font-weight:900;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
.pickerBtn{min-width:164px;justify-content:center;display:inline-flex;align-items:center;gap:8px}
.pickerHint{font-size:12px;color:rgba(255,255,255,.72)}
.searchFieldWrap{position:relative;flex:1 1 280px;min-width:0}
.searchFieldWrap--invite{max-width:460px}
.inviteRow--search{margin-top:12px;justify-content:flex-start;align-items:flex-end;gap:12px}
.searchIcon{position:absolute;left:16px;top:50%;transform:translateY(-50%);width:15px;height:15px;pointer-events:none;opacity:.78}
.searchIcon::before{content:"";position:absolute;left:0;top:0;width:9px;height:9px;border:2px solid rgba(255,255,255,.68);border-radius:999px}
.searchIcon::after{content:"";position:absolute;right:0;bottom:0;width:6px;height:2px;border-radius:999px;background:rgba(255,255,255,.68);transform:rotate(45deg);transform-origin:center}
.input--withIcon{padding-left:48px}
.inviteSearchInput{height:46px;line-height:46px}
.inviteSearchInput::placeholder{color:rgba(255,255,255,.44)}
.searchBtn{min-width:96px}
.input{height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#fff;padding:0 12px}
.coverPreview{margin-top:12px;width:120px;height:120px;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03)}
.coverPreview img{width:100%;height:100%;object-fit:cover}
.memberList,.searchList{margin-top:12px;display:grid;gap:10px}
.memberCard{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03)}
.memberIdentity{display:flex;align-items:center;gap:12px;min-width:0}
.memberAvatar{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:rgba(95,129,255,.18);border:1px solid rgba(95,129,255,.26);font-size:16px;font-weight:950}
.memberRow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.memberName{font-size:14px;font-weight:900}.roleBadge{padding:4px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.10);font-size:11px;font-weight:900}.roleBadge.owner{background:rgba(84,126,255,.16);border-color:rgba(84,126,255,.32)}
.btn,.ghost,.dangerGhost{height:40px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.10);color:#fff;font-weight:900}.btn{background:rgba(84,126,255,.24)}.ghost{background:rgba(255,255,255,.04)}.dangerGhost{background:rgba(255,120,120,.08);border-color:rgba(255,120,120,.22)}
.searchBtn{border-radius:999px;background:rgba(84,126,255,.22);display:inline-flex;align-items:center;justify-content:center;white-space:nowrap}
.backBtn{min-width:96px}
@media (max-width:860px){
  .formGrid,.heroMain{grid-template-columns:1fr}
  .heroStats{grid-template-columns:repeat(3,minmax(0,1fr))}
}
@media (max-width:640px){
  .page{padding:14px 14px calc(92px + env(safe-area-inset-bottom))}
  .hero,.panel{padding:16px}
  .heroIdentity{align-items:flex-start}
  .heroAvatar{width:56px;height:56px;border-radius:18px}
  .title{font-size:24px}
  .memberCard{align-items:flex-start;flex-direction:column}
  .dangerGhost,.btn,.ghost,.searchBtn{width:100%;justify-content:center}
  .inviteRow{display:grid;grid-template-columns:1fr;gap:10px}
  .inviteRow--search{margin-top:14px;align-items:stretch}
  .searchFieldWrap,.searchFieldWrap--invite{width:100%;max-width:none}
  .input,.inviteSearchInput{width:100%}
  .coverPickerRow{display:grid;grid-template-columns:1fr;align-items:stretch}
  .pickerBtn{width:100%}
  .pickerHint{padding:0 4px}
}
</style>
