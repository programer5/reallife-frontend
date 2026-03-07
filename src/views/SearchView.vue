<script setup>
import { onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth.js";
import { searchUsers, followUser, unfollowUser } from "@/api/users";
import { createDirectConversation } from "@/api/conversations";

import RlButton from "@/components/ui/RlButton.vue";
import RlRow from "@/components/ui/RlRow.vue";
import RlBadge from "@/components/ui/RlBadge.vue";

const router = useRouter();
const auth = useAuthStore();
const q = ref("");
const loading = ref(false);
const error = ref("");
const items = ref([]);
const nextCursor = ref(null);
const hasNext = ref(false);
const recent = ref(["민수", "지연", "seed", "test"]);
let debounceTimer = null;

function setQuery(v) { q.value = v; }
function pickInitial(u) {
  const raw = String((u?.name || u?.handle || "")).trim();
  if (!raw) return "";
  const ch = raw[0];
  if (ch === "." || ch === "-" || ch === "_") return "";
  return ch.toUpperCase();
}

async function runSearch({ reset = true } = {}) {
  const query = q.value.trim();
  if (!query) {
    items.value = [];
    nextCursor.value = null;
    hasNext.value = false;
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const data = await searchUsers({ q: query, cursor: !reset ? nextCursor.value : null, size: 20 });
    if (reset) items.value = data.items || [];
    else items.value = [...items.value, ...(data.items || [])];
    nextCursor.value = data.nextCursor ?? null;
    hasNext.value = !!data.hasNext;
  } catch (e) {
    error.value = e?.response?.data?.message || "검색에 실패했어요.";
  } finally {
    loading.value = false;
  }
}

async function openDirectChat(user) {
  const targetUserId = user?.userId;
  if (!targetUserId) return;
  try {
    const res = await createDirectConversation(targetUserId);
    const conversationId = res?.conversationId;
    if (conversationId) {
      router.push(`/inbox/conversations/${conversationId}`);
      return;
    }
  } catch {}
  error.value = "대화를 열 수 없어요. 잠시 후 다시 시도해 주세요.";
}

function openProfile(user) {
  if (user?.handle) router.push(`/u/${user.handle}`);
}

async function toggleFollow(user) {
  const prev = !!user.isFollowing;
  const prevCount = Number(user.followerCount ?? 0);
  user.isFollowing = !prev;
  user.followerCount = prev ? Math.max(0, prevCount - 1) : prevCount + 1;
  try {
    if (prev) await unfollowUser(user.userId); else await followUser(user.userId);
  } catch (e) {
    user.isFollowing = prev;
    user.followerCount = prevCount;
    error.value = e?.response?.data?.message || "팔로우 상태를 바꾸지 못했어요.";
  }
}

function onInput() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runSearch({ reset: true }), 250);
}
watch(q, () => onInput());
onMounted(async () => { await auth.ensureSession(); });
</script>

<template>
  <div class="rl-page">
    <div class="rl-section">
      <section class="rl-card">
        <div class="rl-card__header">
          <div>
            <div class="rl-card__title">탐색</div>
            <div class="rl-card__sub">유저를 검색하고, 프로필을 보고, 바로 팔로우하거나 대화를 시작하세요</div>
          </div>
          <div class="headerRight">
            <RlButton size="sm" variant="soft" @click="runSearch({ reset: true })" :disabled="!q.trim()">검색</RlButton>
          </div>
        </div>

        <div class="pad">
          <div class="searchBox">
            <input class="searchInput" v-model="q" placeholder="이름 또는 핸들로 검색 (예: seed)" autocomplete="off" />
          </div>

          <div class="chips">
            <button class="chip" v-for="r in recent" :key="r" @click="setQuery(r)">{{ r }}</button>
          </div>

          <div v-if="error" class="err">{{ error }}</div>
          <div v-if="loading" class="empty">검색 중…</div>
          <div v-else-if="!q.trim()" class="empty">검색어를 입력해 주세요.</div>
          <div v-else-if="!items.length" class="empty">검색 결과가 없어요.</div>

          <div v-else class="list">
            <RlRow v-for="u in items" :key="u.userId" class="item">
              <template #left>
                <button class="avatar" type="button" @click="openProfile(u)">
                  <span v-if="pickInitial(u)">{{ pickInitial(u) }}</span>
                  <svg v-else viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2-8 4.5V21h16v-2.5C20 16 16.42 14 12 14Z"/></svg>
                </button>
              </template>
              <template #default>
                <div class="main" @click="openProfile(u)">
                  <div class="title"><span class="nm">{{ u.name || 'User' }}</span><span class="hd">@{{ u.handle || '-' }}</span></div>
                  <div class="sub">{{ u.followerCount ?? 0 }} followers <span class="dot">•</span> rank {{ u.rank ?? '-' }}</div>
                </div>
              </template>
              <template #right>
                <div class="rightCol">
                  <RlBadge :tone="u.isFollowing ? 'success' : 'neutral'">{{ u.isFollowing ? 'following' : '' }}</RlBadge>
                  <div class="miniActions">
                    <RlButton size="sm" variant="soft" @click="openProfile(u)">프로필</RlButton>
                    <RlButton size="sm" :variant="u.isFollowing ? 'ghost' : 'primary'" @click="toggleFollow(u)">{{ u.isFollowing ? '언팔' : '팔로우' }}</RlButton>
                    <RlButton size="sm" variant="primary" @click="openDirectChat(u)">대화</RlButton>
                  </div>
                </div>
              </template>
            </RlRow>
            <div class="moreRow">
              <RlButton v-if="hasNext" variant="soft" size="sm" @click="runSearch({ reset: false })" :loading="loading">더 보기</RlButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.pad{padding:14px 16px 16px}.headerRight{display:flex;align-items:center;gap:10px}.searchBox{margin-bottom:10px}.searchInput{width:100%;height:44px;border-radius:16px;border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.18);color:rgba(255,255,255,.92);padding:0 14px;outline:none}.searchInput:focus{border-color:rgba(124,156,255,.45);box-shadow:0 0 0 4px rgba(124,156,255,.12)}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 10px}.chip{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:rgba(255,255,255,.92);padding:8px 10px;border-radius:999px;cursor:pointer;font-weight:800;font-size:12.5px}
.err{color:#ff6b6b;font-size:12.5px;margin:6px 0 0}.empty{opacity:.7;font-size:13px;padding:10px 2px}.list{display:flex;flex-direction:column;gap:10px;margin-top:10px}.item{padding:10px 12px;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.10)}
.avatar{width:38px;height:38px;border-radius:14px;display:grid;place-items:center;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);font-weight:900;color:rgba(255,255,255,.82);cursor:pointer}.main{display:flex;flex-direction:column;gap:3px;min-width:0;cursor:pointer}.title{display:flex;gap:8px;align-items:baseline;min-width:0}.nm{font-weight:950;font-size:13.5px}.hd{opacity:.75;font-size:12.5px}.sub{opacity:.7;font-size:12.5px}.dot{margin:0 6px;opacity:.55}.rightCol{display:flex;flex-direction:column;gap:8px;align-items:flex-end}.miniActions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.moreRow{display:flex;justify-content:center;margin-top:12px}
@media (max-width:720px){.miniActions{display:grid;grid-template-columns:1fr 1fr;gap:6px}.rightCol{align-items:stretch}}
</style>
