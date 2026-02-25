<!-- src/views/UserProfileView.vue -->
<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import RlButton from "@/components/ui/RlButton.vue";

import { fetchUserProfileByHandle, fetchUserProfileById } from "@/api/users";
import { createDirectConversation } from "@/api/conversations";
import { useToastStore } from "@/stores/toast";

const route = useRoute();
const router = useRouter();
const toast = useToastStore();

const handle = computed(() => (route.params.handle ? String(route.params.handle) : ""));
const userId = computed(() => (route.params.userId ? String(route.params.userId) : ""));

const loading = ref(false);
const error = ref("");
const profile = ref(null);

const dmBusy = ref(false);

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

async function load() {
  loading.value = true;
  error.value = "";
  try {
    if (handle.value) {
      profile.value = await fetchUserProfileByHandle(handle.value);
    } else if (userId.value) {
      profile.value = await fetchUserProfileById(userId.value);
    } else {
      error.value = "유저 정보가 없습니다.";
    }
  } catch (e) {
    error.value = e?.response?.data?.message || "프로필을 불러오지 못했습니다.";
  } finally {
    loading.value = false;
  }
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
  } catch (e) {
    toast.error("실패", e?.response?.data?.message || "DM을 시작할 수 없어요.");
  } finally {
    dmBusy.value = false;
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
        <RlButton size="sm" variant="primary" @click="startDm" :disabled="dmBusy || !profile">
          메시지 보내기
        </RlButton>
      </div>
    </div>

    <div v-if="loading" class="state">불러오는 중…</div>
    <div v-else-if="error" class="state err">{{ error }}</div>

    <div v-else-if="profile" class="card">
      <div class="hero">
        <div class="avatar" aria-hidden="true">{{ pickInitial(profile) }}</div>
        <div class="meta">
          <div class="name">{{ profile.name || "User" }}</div>
          <div class="handle">@{{ profile.handle }}</div>
        </div>
      </div>

      <div v-if="profile.bio" class="bio">{{ profile.bio }}</div>

      <div class="stats">
        <div class="stat">
          <div class="num">{{ profile.followerCount ?? 0 }}</div>
          <div class="label">Followers</div>
        </div>
        <div class="stat">
          <div class="num">{{ profile.followingCount ?? 0 }}</div>
          <div class="label">Following</div>
        </div>
      </div>

      <div v-if="profile.website" class="links">
        <a class="link" :href="websiteUrl(profile.website)" target="_blank" rel="noreferrer">
          {{ profile.website }}
        </a>
      </div>

      <div class="actions">
        <RlButton size="sm" variant="primary" @click="startDm" :disabled="dmBusy">
          DM 시작
        </RlButton>
        <RlButton size="sm" variant="soft" @click="router.push('/inbox/new')">
          새 DM에서 검색
        </RlButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page{padding:18px 14px 90px;max-width:760px;margin:0 auto}
.topbar{
  display:grid;
  grid-template-columns:auto 1fr auto;
  align-items:center;
  gap:10px;
  margin-bottom:14px;
}
.topTitle{font-weight:950;text-align:center}
.state{text-align:center;color:var(--muted);padding:18px 0}
.state.err{color:color-mix(in oklab,var(--danger) 80%,white)}

.card{
  border:1px solid color-mix(in oklab, var(--border) 88%, transparent);
  background:color-mix(in oklab, var(--surface) 86%, transparent);
  box-shadow:
      0 18px 60px rgba(0,0,0,.28),
      0 1px 0 rgba(255,255,255,.06) inset;
  border-radius: var(--r-lg);
  padding: 16px;
  backdrop-filter: blur(14px);
}

.hero{display:flex;gap:12px;align-items:center;margin-bottom:12px}
.avatar{
  width:52px;height:52px;border-radius:50%;
  display:grid;place-items:center;
  background:
      radial-gradient(18px 18px at 30% 30%, rgba(255,255,255,.22), transparent 60%),
      linear-gradient(135deg, color-mix(in oklab, var(--accent) 76%, white), color-mix(in oklab, var(--success) 68%, white));
  color:#0b0f14;
  font-weight:950;
}
.meta{display:flex;flex-direction:column;gap:4px}
.name{font-weight:950;font-size:16px}
.handle{color:var(--muted);font-size:12px}

.bio{
  white-space:pre-wrap;
  line-height:1.45;
  color:color-mix(in oklab, var(--text) 92%, var(--muted));
  margin: 10px 0 14px;
}

.stats{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px;
  margin-bottom: 12px;
}
.stat{
  border:1px solid color-mix(in oklab, var(--border) 88%, transparent);
  background: rgba(255,255,255,.03);
  border-radius: 14px;
  padding: 10px 12px;
}
.num{font-weight:950;font-size:16px}
.label{color:var(--muted);font-size:12px;margin-top:4px}

.links{margin: 8px 0 14px}
.link{
  display:inline-block;
  color: color-mix(in oklab, var(--accent) 88%, white);
  text-decoration:none;
  font-weight:900;
}
.link:hover{text-decoration:underline}

.actions{display:flex;gap:8px;flex-wrap:wrap}
</style>