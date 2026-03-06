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
  if (!query) { items.value = []; nextCursor.value = null; hasNext.value = false; return; }
  loading.value = true; error.value = "";
  try {
    const params = { q: query, size: 20 };
    if (!reset && nextCursor.value) params.cursor = nextCursor.value;
    const res = await api.get("/api/users/search", { params });
    const data = res.data || {};
    const newItems = Array.isArray(data.items) ? data.items : [];
    items.value = reset ? newItems : [...items.value, ...newItems];
    nextCursor.value = data.nextCursor ?? null;
    hasNext.value = !!data.hasNext;
  } catch (e) {
    error.value = e?.response?.data?.message || "검색에 실패했어요.";
  } finally { loading.value = false; }
}

async function openDirectChat(user) {
  const targetUserId = user?.userId;
  if (!targetUserId) return;
  try {
    const res = await api.post("/api/conversations/direct", { targetUserId });
    const conversationId = res.data?.conversationId;
    if (conversationId) { router.push(`/chat/${conversationId}`); return; }
  } catch {}
  error.value = "대화를 열 수 없어요. 잠시 후 다시 시도해 주세요.";
}

function goProfile(user) {
  if (user?.handle) router.push(`/u/${encodeURIComponent(user.handle)}`);
  else if (user?.userId) router.push(`/u/id/${encodeURIComponent(user.userId)}`);
}

function onInput() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runSearch({ reset: true }), 250);
}
watch(q, onInput);
onMounted(async () => { await auth.ensureSession(); });
</script>

<template>
  <div class="rl-page">
    <div class="rl-section">
      <section class="rl-card">
        <div class="rl-card__header">
          <div>
            <div class="rl-card__title">탐색</div>
            <div class="rl-card__sub">유저를 검색하고 프로필을 본 뒤 대화를 시작하세요</div>
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
                <button class="identity" @click="goProfile(u)">
                  <div class="avatar" aria-hidden="true">
                    <span v-if="pickInitial(u)">{{ pickInitial(u) }}</span>
                    <svg v-else viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5Z"/></svg>
                  </div>
                  <div>
                    <div class="titleRow">
                      <strong>{{ u.name || u.handle }}</strong>
                      <RlBadge v-if="u.isFollowing" tone="brand">팔로잉</RlBadge>
                    </div>
                    <div class="sub">@{{ u.handle }} · 팔로워 {{ u.followerCount ?? 0 }}</div>
                  </div>
                </button>
              </template>

              <template #right>
                <div class="rightBtns">
                  <RlButton size="sm" variant="soft" @click="goProfile(u)">프로필</RlButton>
                  <RlButton size="sm" variant="primary" @click="openDirectChat(u)">대화</RlButton>
                </div>
              </template>
            </RlRow>

            <div class="moreWrap" v-if="hasNext">
              <RlButton size="sm" variant="soft" @click="runSearch({ reset: false })" :loading="loading">더 보기</RlButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.pad{padding:16px}.searchBox{margin-bottom:12px}.searchInput{width:100%;height:46px;border-radius:14px;border:1px solid var(--border);padding:0 14px;background:color-mix(in oklab,var(--surface-2) 84%,transparent);color:var(--text)}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.chip{height:34px;padding:0 12px;border-radius:999px;border:1px solid var(--border);background:transparent;color:var(--text)}
.err{margin-bottom:12px;color:color-mix(in oklab,var(--danger) 80%, white)}.empty{padding:24px 0;color:var(--muted);text-align:center}.list{display:grid;gap:10px}.item{border:1px solid var(--border);border-radius:16px;padding:10px 12px;background:color-mix(in oklab,var(--surface) 92%, transparent)}
.identity{display:flex;align-items:center;gap:12px;background:none;border:none;color:inherit;padding:0;text-align:left;cursor:pointer}.avatar{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:color-mix(in oklab,var(--accent) 16%, transparent);font-weight:900}.titleRow{display:flex;align-items:center;gap:8px}.sub{margin-top:4px;font-size:12px;color:var(--muted)}.rightBtns{display:flex;gap:8px;flex-wrap:wrap}.moreWrap{display:flex;justify-content:center;padding-top:6px}
@media (max-width:640px){.rightBtns{width:100%;justify-content:flex-end}}
</style>
