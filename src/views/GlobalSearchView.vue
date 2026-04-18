<script setup>
import { onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth.js";
import { searchUsers, followUser, unfollowUser } from "@/api/users";
import { createDirectConversation } from "@/api/conversations";

import RlButton from "@/components/ui/RlButton.vue";
import RlRow from "@/components/ui/RlRow.vue";

const router = useRouter();
const auth = useAuthStore();
const q = ref("");
const loading = ref(false);
const error = ref("");
const items = ref([]);
const nextCursor = ref(null);
const hasNext = ref(false);
let debounceTimer = null;

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
    const data = await searchUsers({
      q: query,
      cursor: !reset ? nextCursor.value : null,
      size: 20,
    });

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
    if (prev) await unfollowUser(user.userId);
    else await followUser(user.userId);
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
onMounted(async () => {
  await auth.ensureSession();
});
</script>

<template>
  <div class="rl-page searchPage">
    <div class="rl-section searchSection">
      <section class="rl-card searchCard">
        <div class="searchRow">
          <input
            class="searchInput"
            v-model="q"
            placeholder="이름 또는 핸들"
            autocomplete="off"
          />
          <RlButton size="sm" variant="soft" @click="runSearch({ reset: true })" :disabled="!q.trim()">
            검색
          </RlButton>
        </div>
      </section>

      <section class="rl-card resultCard">
        <div v-if="error" class="err">{{ error }}</div>
        <div v-else-if="loading" class="empty">검색 중…</div>
        <div v-else-if="!q.trim()" class="empty">검색어를 입력해 주세요.</div>
        <div v-else-if="!items.length" class="empty">검색 결과가 없어요.</div>

        <div v-else class="list">
          <RlRow v-for="u in items" :key="u.userId" class="item">
            <template #left>
              <button class="avatar" type="button" @click="openProfile(u)">
                <span v-if="pickInitial(u)">{{ pickInitial(u) }}</span>
                <svg v-else viewBox="0 0 24 24" width="18" height="18">
                  <path
                    fill="currentColor"
                    d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2-8 4.5V21h16v-2.5C20 16 16.42 14 12 14Z"
                  />
                </svg>
              </button>
            </template>

            <template #default>
              <div class="main" @click="openProfile(u)">
                <div class="title">
                  <span class="nm">{{ u.name || 'User' }}</span>
                  <span class="hd">@{{ u.handle || '-' }}</span>
                </div>
                <div class="sub">
                  {{ u.followerCount ?? 0 }} followers
                </div>
              </div>
            </template>

            <template #right>
              <div class="miniActions">
                <RlButton size="sm" variant="soft" @click="openProfile(u)">프로필</RlButton>
                <RlButton size="sm" :variant="u.isFollowing ? 'ghost' : 'primary'" @click="toggleFollow(u)">
                  {{ u.isFollowing ? '언팔' : '팔로우' }}
                </RlButton>
                <RlButton size="sm" variant="primary" @click="openDirectChat(u)">대화</RlButton>
              </div>
            </template>
          </RlRow>

          <div class="moreRow">
            <RlButton
              v-if="hasNext"
              variant="soft"
              size="sm"
              @click="runSearch({ reset: false })"
              :loading="loading"
            >
              더 보기
            </RlButton>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.searchPage {
  padding-bottom: 28px;
}

.searchSection {
  display: grid;
  gap: 14px;
}

.searchCard,
.resultCard {
  overflow: hidden;
}

.searchCard {
  padding: 14px;
}

.searchRow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.searchInput {
  min-width: 0;
  height: 46px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.04);
  color: var(--text);
  padding: 0 14px;
  font-size: 14px;
  outline: none;
}

.searchInput:focus {
  border-color: color-mix(in oklab, var(--accent) 35%, rgba(255,255,255,.16));
  box-shadow: 0 0 0 4px color-mix(in oklab, var(--accent) 16%, transparent);
}

.resultCard {
  padding: 8px;
}

.list {
  display: grid;
  gap: 8px;
}

.item {
  border-radius: 18px;
  padding: 10px 12px;
}

.avatar {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.05);
  color: var(--text);
  display: grid;
  place-items: center;
  font-weight: 900;
  cursor: pointer;
}

.main {
  cursor: pointer;
  display: grid;
  gap: 4px;
}

.title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.nm {
  font-size: 14px;
  font-weight: 900;
}

.hd,
.sub {
  color: var(--muted);
  font-size: 12px;
}

.miniActions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.moreRow {
  display: flex;
  justify-content: center;
  padding: 6px 0 0;
}

.empty,
.err {
  min-height: 220px;
  display: grid;
  place-items: center;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
}

.err {
  color: #ff9d9d;
}

@media (max-width: 720px) {
  .searchRow {
    grid-template-columns: 1fr;
  }

  .miniActions {
    justify-content: flex-start;
  }
}
</style>
