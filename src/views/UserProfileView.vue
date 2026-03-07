<!-- src/views/UserProfileView.vue -->
<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import RlButton from "@/components/ui/RlButton.vue";
import { fetchUserProfileByHandle, fetchUserProfileById, followUser, unfollowUser } from "@/api/users";
import { createDirectConversation } from "@/api/conversations";
import { getMe } from "@/api/me";
import { useToastStore } from "@/stores/toast";

const route = useRoute();
const router = useRouter();
const toast = useToastStore();

const handle = computed(() => (route.params.handle ? String(route.params.handle) : ""));
const userId = computed(() => (route.params.userId ? String(route.params.userId) : ""));
const loading = ref(false);
const error = ref("");
const profile = ref(null);
const me = ref(null);
const dmBusy = ref(false);
const followBusy = ref(false);

function pickInitial(p) {
  const s = String(p?.name || p?.handle || "").trim();
  return s ? s[0].toUpperCase() : "U";
}
function websiteUrl(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return "https://" + s;
}
const isMe = computed(() => !!me.value && !!profile.value && me.value.handle === profile.value.handle);
const followedByMe = ref(false);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    me.value = await getMe().catch(() => null);
    profile.value = handle.value ? await fetchUserProfileByHandle(handle.value) : await fetchUserProfileById(userId.value);
    followedByMe.value = !!profile.value?.followedByMe;
  } catch (e) {
    error.value = e?.response?.data?.message || "프로필을 불러오지 못했습니다.";
  } finally {
    loading.value = false;
  }
}

async function startDm() {
  const targetUserId = profile.value?.id;
  if (!targetUserId || dmBusy.value || isMe.value) return;
  dmBusy.value = true;
  try {
    const res = await createDirectConversation(targetUserId);
    const cid = res?.conversationId;
    if (!cid) throw new Error("no conversationId");
    router.push(`/inbox/conversations/${cid}`);
  } catch (e) {
    toast.error("실패", e?.response?.data?.message || "DM을 시작할 수 없어요.");
  } finally {
    dmBusy.value = false;
  }
}

async function toggleFollow() {
  const targetUserId = profile.value?.id;
  if (!targetUserId || followBusy.value || isMe.value) return;
  followBusy.value = true;
  const prev = followedByMe.value;
  const prevCount = Number(profile.value?.followerCount ?? 0);
  followedByMe.value = !prev;
  profile.value.followerCount = prev ? Math.max(0, prevCount - 1) : prevCount + 1;
  try {
    if (prev) await unfollowUser(targetUserId); else await followUser(targetUserId);
  } catch (e) {
    followedByMe.value = prev;
    profile.value.followerCount = prevCount;
    toast.error("실패", e?.response?.data?.message || "팔로우 상태를 바꾸지 못했어요.");
  } finally {
    followBusy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="page">
    <div class="topbar">
      <RlButton size="sm" variant="soft" @click="router.back()">←</RlButton>
      <div class="topTitle">프로필</div>
      <div class="topRight">
        <RlButton v-if="isMe" size="sm" variant="soft" @click="router.push('/me')">내 프로필 편집</RlButton>
        <template v-else>
          <RlButton size="sm" :variant="followedByMe ? 'soft' : 'primary'" @click="toggleFollow" :disabled="followBusy">
            {{ followedByMe ? '언팔로우' : '팔로우' }}
          </RlButton>
          <RlButton size="sm" variant="primary" @click="startDm" :disabled="dmBusy || !profile">메시지</RlButton>
        </template>
      </div>
    </div>

    <div v-if="loading" class="state">불러오는 중…</div>
    <div v-else-if="error" class="state err">{{ error }}</div>

    <div v-else-if="profile" class="card">
      <div class="hero">
        <div class="avatarWrap">
          <img v-if="profile.profileImageUrl" :src="profile.profileImageUrl" class="avatarImg" alt="avatar" />
          <div v-else class="avatar" aria-hidden="true">{{ pickInitial(profile) }}</div>
        </div>
        <div class="meta">
          <div class="name">{{ profile.name || 'User' }}</div>
          <div class="handle">@{{ profile.handle }}</div>
          <div class="chips">
            <span class="chip">팔로워 {{ profile.followerCount ?? 0 }}</span>
            <span class="chip">팔로잉 {{ profile.followingCount ?? 0 }}</span>
            <span v-if="followedByMe" class="chip chip--accent">서로 연결됨</span>
          </div>
        </div>
      </div>

      <div v-if="profile.bio" class="bio">{{ profile.bio }}</div>
      <div v-if="profile.website" class="links"><a class="link" :href="websiteUrl(profile.website)" target="_blank" rel="noreferrer">{{ profile.website }}</a></div>

      <div class="ctaBox">
        <div class="ctaTitle">RealLife에서 이 사용자와 이어가기</div>
        <div class="ctaSub">팔로우하면 공개 피드와 관계 기반 순간을 더 쉽게 볼 수 있고, 메시지로 바로 액션을 이어갈 수 있어요.</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page{padding:18px 14px 90px;max-width:880px;margin:0 auto}.topbar{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;margin-bottom:14px}.topTitle{font-weight:950;text-align:center}.topRight{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}.state{text-align:center;color:var(--muted);padding:18px 0}.state.err{color:color-mix(in oklab,var(--danger) 80%,white)}
.card{border:1px solid color-mix(in oklab,var(--border) 88%,transparent);background:color-mix(in oklab,var(--surface) 86%,transparent);box-shadow:0 18px 60px rgba(0,0,0,.28),0 1px 0 rgba(255,255,255,.06) inset;border-radius:var(--r-lg);padding:18px;backdrop-filter:blur(14px)}
.hero{display:flex;gap:14px;align-items:center;margin-bottom:16px}.avatarWrap{width:64px;height:64px}.avatarImg,.avatar{width:64px;height:64px;border-radius:22px;object-fit:cover;display:grid;place-items:center;background:linear-gradient(135deg,color-mix(in oklab,var(--accent) 76%, white),color-mix(in oklab,var(--success) 68%, white));color:#0b0f14;font-weight:950;font-size:22px}.meta{display:flex;flex-direction:column;gap:6px}.name{font-weight:950;font-size:18px}.handle{color:var(--muted);font-size:13px}.chips{display:flex;gap:8px;flex-wrap:wrap}.chip{padding:7px 10px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);font-size:12px}.chip--accent{border-color:color-mix(in oklab,var(--accent) 45%,var(--border));background:color-mix(in oklab,var(--accent) 14%,transparent)}
.bio{white-space:pre-wrap;line-height:1.55;color:color-mix(in oklab,var(--text) 92%, var(--muted));margin:12px 0 14px}.links{margin-bottom:14px}.link{display:inline-block;color:color-mix(in oklab,var(--accent) 88%,white);text-decoration:none;font-weight:900}.link:hover{text-decoration:underline}.ctaBox{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);border-radius:18px;padding:14px 16px}.ctaTitle{font-weight:900}.ctaSub{margin-top:6px;color:var(--muted);line-height:1.5;font-size:13px}
@media (max-width:640px){.topbar{grid-template-columns:auto 1fr}.topRight{grid-column:1 / -1}.hero{align-items:flex-start}}
</style>
