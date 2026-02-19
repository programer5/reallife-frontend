<script setup>
import { onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import api from "@/lib/api.js";
import { useAuthStore } from "@/stores/auth.js";

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

function setQuery(v) {
  q.value = v;
}

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
    const params = { q: query, size: 20 };
    if (!reset && nextCursor.value) params.cursor = nextCursor.value;

    const res = await api.get("/api/users/search", { params });

    const data = res.data || {};
    const newItems = Array.isArray(data.items) ? data.items : [];

    if (reset) items.value = newItems;
    else items.value = [...items.value, ...newItems];

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
    const res = await api.post("/api/conversations/direct", { targetUserId });
    const conversationId = res.data?.conversationId;
    if (conversationId) {
      router.push(`/chat/${conversationId}`);
      return;
    }
  } catch (e) {}
  error.value = "대화를 열 수 없어요. 잠시 후 다시 시도해 주세요.";
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
  <div class="rl-page">
    <div class="rl-section">
      <section class="rl-card">
        <div class="rl-card__header">
          <div>
            <div class="rl-card__title">탐색</div>
            <div class="rl-card__sub">유저를 검색하고 바로 대화를 시작하세요</div>
          </div>

          <div class="headerRight">
            <RlButton size="sm" variant="soft" @click="runSearch({ reset: true })" :disabled="!q.trim()">
              검색
            </RlButton>
          </div>
        </div>

        <div class="pad">
          <div class="searchBox">
            <input
              class="searchInput"
              v-model="q"
              placeholder="이름 또는 핸들로 검색 (예: seed)"
              autocomplete="off"
            />
          </div>

          <div class="chips">
            <button class="chip" v-for="r in recent" :key="r" @click="setQuery(r)">
              {{ r }}
            </button>
          </div>

          <div v-if="error" class="err">{{ error }}</div>

          <div v-if="loading" class="empty">검색 중…</div>
          <div v-else-if="!q.trim()" class="empty">검색어를 입력해 주세요.</div>
          <div v-else-if="!items.length" class="empty">검색 결과가 없어요.</div>

          <div v-else class="list">
            <RlRow v-for="u in items" :key="u.userId" class="item">
              <template #left>
                <div class="avatar" aria-hidden="true">
                  <span v-if="pickInitial(u)">{{ pickInitial(u) }}</span>
                  <svg v-else viewBox="0 0 24 24" width="18" height="18">
                    <path
                      fill="currentColor"
                      d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2-8 4.5V21h16v-2.5C20 16 16.42 14 12 14Z"
                    />
                  </svg>
                </div>
              </template>

              <template #default>
                <div class="main">
                  <div class="title">
                    <span class="nm">{{ u.name || "User" }}</span>
                    <span class="hd">@{{ u.handle || "-" }}</span>
                  </div>
                  <div class="sub">
                    {{ u.followerCount ?? 0 }} followers
                    <span class="dot">•</span>
                    rank {{ u.rank ?? "-" }}
                  </div>
                </div>
              </template>

              <template #right>
                <div class="rightCol">
                  <RlBadge :tone="u.isFollowing ? 'success' : 'neutral'">
                    {{ u.isFollowing ? "following" : "" }}
                  </RlBadge>
                  <RlButton size="sm" variant="primary" @click="openDirectChat(u)">
                    대화
                  </RlButton>
                </div>
              </template>
            </RlRow>

            <div class="moreRow">
              <RlButton v-if="hasNext" variant="soft" size="sm" @click="runSearch({ reset: false })" :loading="loading">
                더 보기
              </RlButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.pad { padding: 14px 16px 16px; }
.headerRight { display:flex; align-items:center; gap: 10px; }

.searchBox{ margin-bottom: 10px; }
.searchInput{
  width: 100%;
  height: 42px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.18);
  color: rgba(255,255,255,.92);
  padding: 0 14px;
  outline: none;
}
.searchInput:focus{
  border-color: rgba(124,156,255,.45);
  box-shadow: 0 0 0 4px rgba(124,156,255,.12);
}

.chips{ display:flex; gap: 8px; flex-wrap: wrap; margin: 8px 0 10px; }
.chip{
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  padding: 8px 10px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 800;
  font-size: 12.5px;
}

.err{ color: #ff6b6b; font-size: 12.5px; margin: 6px 0 0; }
.empty{ opacity: .7; font-size: 13px; padding: 10px 2px; }

.list{ display:flex; flex-direction:column; gap: 10px; margin-top: 10px; }
.item{ padding: 10px 12px; border-radius: 16px; border: 1px solid rgba(255,255,255,.08); background: rgba(0,0,0,.10); }

.avatar{
  width: 34px; height: 34px; border-radius: 14px;
  display:grid; place-items:center;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.10);
  font-weight: 900;
  color: rgba(255,255,255,.82);
}

.main{ display:flex; flex-direction:column; gap: 3px; min-width: 0; }
.title{ display:flex; gap: 8px; align-items:baseline; min-width:0; }
.nm{ font-weight: 950; font-size: 13.5px; }
.hd{ opacity: .75; font-size: 12.5px; }
.sub{ opacity: .7; font-size: 12.5px; }
.dot{ margin: 0 6px; opacity: .55; }

.rightCol{ display:flex; flex-direction:column; gap: 8px; align-items:flex-end; }
.moreRow{ display:flex; justify-content:center; margin-top: 12px; }
</style>
