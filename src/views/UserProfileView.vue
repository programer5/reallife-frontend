<!-- src/views/UserProfileView.vue -->
<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import RlButton from "@/components/ui/RlButton.vue";
import AsyncStatePanel from "@/components/ui/AsyncStatePanel.vue";
import { fetchUserProfileByHandle, fetchUserProfileById, followUser, unfollowUser } from "@/api/users";
import { createDirectConversation } from "@/api/conversations";
import { useToastStore } from "@/stores/toast";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const toast = useToastStore();
const auth = useAuthStore();
const handle = computed(() => (route.params.handle ? String(route.params.handle) : ""));
const userId = computed(() => (route.params.userId ? String(route.params.userId) : ""));
const loading = ref(false);
const error = ref("");
const profile = ref(null);
const dmBusy = ref(false);
const followBusy = ref(false);
const isMe = computed(() => String(profile.value?.id || '') === String(auth.me?.id || ''));
const isFollowing = computed(() => !!profile.value?.followedByMe);

function pickInitial(p) { const s = String(p?.name || p?.handle || "").trim(); return s ? s[0].toUpperCase() : "U"; }
function websiteUrl(u) { const s = String(u || "").trim(); if (!s) return ""; return /^(http|https):\/\//i.test(s) ? s : `https://${s}`; }
async function load() {
  loading.value = true; error.value = "";
  try {
    if (handle.value) profile.value = await fetchUserProfileByHandle(handle.value);
    else if (userId.value) profile.value = await fetchUserProfileById(userId.value);
    else error.value = "유저 정보가 없습니다.";
  } catch (e) {
    error.value = e?.response?.data?.message || "프로필을 불러오지 못했습니다.";
  } finally { loading.value = false; }
}
async function startDm() {
  const targetUserId = profile.value?.id;
  if (!targetUserId || dmBusy.value) return;
  dmBusy.value = true;
  try {
    const res = await createDirectConversation(targetUserId);
    const cid = res?.conversationId;
    if (!cid) throw new Error("no conversationId");
    router.push(`/inbox/conversations/${cid}`);
  } catch (e) { toast.error("실패", e?.response?.data?.message || "DM을 시작할 수 없어요."); }
  finally { dmBusy.value = false; }
}
async function toggleFollow() {
  const targetUserId = profile.value?.id;
  if (!targetUserId || followBusy.value || isMe.value) return;
  followBusy.value = true;
  const prev = !!profile.value.followedByMe;
  const prevCount = Number(profile.value.followerCount || 0);
  try {
    profile.value.followedByMe = !prev;
    profile.value.followerCount = Math.max(0, prevCount + (prev ? -1 : 1));
    if (prev) await unfollowUser(targetUserId); else await followUser(targetUserId);
    toast.success(prev ? '언팔로우 완료' : '팔로우 완료', prev ? '이제 이 사용자의 글이 덜 보일 수 있어요.' : '이제 이 사용자의 공개 글이 피드에서 더 잘 보여요.');
  } catch (e) {
    profile.value.followedByMe = prev; profile.value.followerCount = prevCount;
    toast.error('실패', e?.response?.data?.message || '팔로우 상태를 바꾸지 못했어요.');
  } finally { followBusy.value = false; }
}
onMounted(load);
</script>
<template>
  <div class="page">
    <div class="topbar">
      <RlButton size="sm" variant="soft" @click="router.back()">←</RlButton>
      <div class="topTitle">프로필</div>
      <RlButton size="sm" variant="soft" @click="load" :disabled="loading">새로고침</RlButton>
    </div>
    <AsyncStatePanel v-if="loading" mode="loading" title="프로필을 불러오는 중이에요" description="잠시만 기다리면 사용자 정보를 보여드릴게요." />
    <AsyncStatePanel v-else-if="error" mode="error" title="프로필을 불러오지 못했어요" :description="error" action-label="다시 불러오기" @action="load" />
    <div v-else-if="profile" class="card">
      <div class="hero">
        <img v-if="profile.profileImageUrl" :src="profile.profileImageUrl" class="avatarImg" alt="avatar" />
        <div v-else class="avatar">{{ pickInitial(profile) }}</div>
        <div class="meta">
          <div class="nameRow">
            <div>
              <div class="name">{{ profile.name || 'User' }}</div>
              <div class="handle">@{{ profile.handle }}</div>
            </div>
            <span v-if="isFollowing" class="pill">팔로잉</span>
          </div>
          <div v-if="profile.bio" class="bio">{{ profile.bio }}</div>
          <div v-else class="emptyText">아직 소개가 없어요.</div>
          <a v-if="profile.website" class="website" :href="websiteUrl(profile.website)" target="_blank" rel="noreferrer">{{ profile.website }}</a>
        </div>
      </div>
      <div class="stats">
        <div class="stat"><strong>{{ profile.followerCount ?? 0 }}</strong><span>팔로워</span></div>
        <div class="stat"><strong>{{ profile.followingCount ?? 0 }}</strong><span>팔로잉</span></div>
      </div>
      <div class="hintBox">
        <div class="hintTitle">RealLife 흐름</div>
        <div class="hintText">이 사용자의 공개 게시글에서 댓글을 시작하고, 대화로 이어가며 실제 약속이나 할 일을 만들 수 있어요.</div>
      </div>
      <div class="actions">
        <RlButton v-if="isMe" size="sm" variant="primary" @click="router.push('/me')">내 프로필 편집</RlButton>
        <RlButton v-else size="sm" :variant="isFollowing ? 'soft' : 'primary'" @click="toggleFollow" :disabled="followBusy">{{ followBusy ? '처리 중...' : isFollowing ? '언팔로우' : '팔로우' }}</RlButton>
        <RlButton v-if="!isMe" size="sm" variant="primary" @click="startDm" :disabled="dmBusy">{{ dmBusy ? '여는 중...' : 'DM 시작' }}</RlButton>
        <RlButton size="sm" variant="soft" @click="router.push('/inbox/new')">새 DM에서 검색</RlButton>
      </div>
    </div>
  </div>
</template>
<style scoped>
.page{padding:18px 14px 96px;max-width:760px;margin:0 auto}.topbar{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;margin-bottom:14px}.topTitle{font-weight:950;text-align:center}.card{display:grid;gap:14px;padding:18px;border:1px solid var(--border);border-radius:24px;background:color-mix(in oklab,var(--surface) 92%, transparent);box-shadow:0 12px 42px rgba(0,0,0,.18)}.hero{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:start}.avatar,.avatarImg{width:80px;height:80px;border-radius:24px;object-fit:cover}.avatar{display:grid;place-items:center;background:linear-gradient(135deg,color-mix(in oklab,var(--accent) 38%, transparent),color-mix(in oklab,var(--accent) 12%, transparent));font-size:28px;font-weight:950}.nameRow{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.name{font-size:22px;font-weight:950}.handle{margin-top:4px;color:var(--muted)}.pill{height:28px;padding:0 10px;border-radius:999px;border:1px solid color-mix(in oklab,var(--accent) 38%, var(--border));display:grid;place-items:center;font-size:12px;font-weight:900;background:color-mix(in oklab,var(--accent) 12%, transparent)}.bio{margin-top:10px;line-height:1.65}.emptyText{margin-top:10px;color:var(--muted)}.website{display:inline-block;margin-top:10px;color:var(--text)}.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.stat{padding:12px;border:1px solid var(--border);border-radius:16px;background:color-mix(in oklab,var(--surface-2) 78%, transparent);display:grid;gap:4px}.stat strong{font-size:18px}.stat span{font-size:12px;color:var(--muted)}.hintBox{padding:14px;border-radius:18px;border:1px solid var(--border);background:color-mix(in oklab,var(--surface-2) 76%, transparent)}.hintTitle{font-size:12px;font-weight:900;letter-spacing:.14em;color:var(--muted)}.hintText{margin-top:8px;line-height:1.6;color:var(--text)}.actions{display:flex;gap:8px;flex-wrap:wrap}@media (max-width:640px){.hero{grid-template-columns:1fr}.avatar,.avatarImg{width:72px;height:72px;border-radius:20px}.name{font-size:20px}.stats{grid-template-columns:1fr}}
</style>
