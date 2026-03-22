<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { unifiedSearch } from "@/api/search";
import RlButton from "@/components/ui/RlButton.vue";

const route = useRoute();
const router = useRouter();
const q = ref(String(route.query.q || ""));
const type = ref(String(route.query.type || "ALL").toUpperCase());
const conversationId = ref(route.query.conversationId ? String(route.query.conversationId) : "");
const loading = ref(false);
const error = ref("");
const payload = ref({ items: [], sections: [], meta: {} });
const recent = ref(loadRecent());
const types = [
  { value: "ALL", label: "전체" },
  { value: "MESSAGES", label: "메시지" },
  { value: "ACTIONS", label: "액션" },
  { value: "CAPSULES", label: "캡슐" },
  { value: "POSTS", label: "피드" },
];

function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem("rl:search:recent") || "[]");
  } catch {
    return [];
  }
}
function saveRecent(term) {
  const value = String(term || "").trim();
  if (!value) return;
  const next = [value, ...recent.value.filter((item) => item !== value)].slice(0, 6);
  recent.value = next;
  localStorage.setItem("rl:search:recent", JSON.stringify(next));
}

const sections = computed(() => Array.isArray(payload.value?.sections) ? payload.value.sections : []);
const items = computed(() => Array.isArray(payload.value?.items) ? payload.value.items : []);
const groupedItems = computed(() => {
  const map = new Map();
  for (const item of items.value) {
    const key = item?.type || 'ETC';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return Array.from(map.entries());
});
const contextLabel = computed(() => conversationId.value ? '이 대화 안에서 검색 중' : '전체 서비스 흐름에서 검색 중');
const contextDescription = computed(() => conversationId.value
  ? '메시지, 액션, 캡슐을 같은 검색 규칙으로 빠르게 찾아서 바로 행동으로 이어갈 수 있어요.'
  : '대화, 액션, 캡슐, 피드를 한 번에 훑고 바로 이동할 수 있게 설계했어요.');

async function runSearch() {
  const query = q.value.trim();
  if (!query) {
    payload.value = { items: [], sections: [], meta: {} };
    error.value = "";
    syncRoute();
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const res = await unifiedSearch({ q: query, type: type.value, conversationId: conversationId.value || null, limit: 6 });
    payload.value = res;
    saveRecent(query);
    syncRoute();
  } catch (e) {
    error.value = e?.response?.data?.message || '검색 결과를 가져오지 못했어요.';
  } finally {
    loading.value = false;
  }
}

function syncRoute() {
  const query = {};
  if (q.value.trim()) query.q = q.value.trim();
  if (type.value && type.value !== 'ALL') query.type = type.value;
  if (conversationId.value) query.conversationId = conversationId.value;
  router.replace({ path: '/search', query });
}

function setType(next) {
  type.value = next;
  runSearch();
}
function applyRecent(term) {
  q.value = term;
  runSearch();
}
function buildSearchRoute(item) {
  const link = String(item?.deepLink || "").trim();
  if (!link) return null;
  let path = link;
  let query = {};
  const [pathname, rawQuery] = link.split("?");
  path = pathname || link;
  if (rawQuery) {
    query = Object.fromEntries(new URLSearchParams(rawQuery).entries());
  }
  if (item?.type === 'MESSAGES') {
    query.mid = String(item?.anchorId || item?.id || '');
    query.fromSearch = '1';
    if (q.value.trim()) query.searchQ = q.value.trim();
  } else if (item?.type === 'ACTIONS') {
    query.pinId = String(item?.anchorId || item?.id || '');
    query.fromSearch = '1';
    if (q.value.trim()) query.searchQ = q.value.trim();
  } else if (item?.type === 'CAPSULES') {
    query.capsuleId = String(item?.anchorId || item?.id || '');
    query.fromSearch = '1';
    if (q.value.trim()) query.searchQ = q.value.trim();
  }
  return { path, query };
}
function openItem(item) {
  const target = buildSearchRoute(item);
  if (!target) return;
  router.push(target);
}
function typeLabel(value) {
  return types.find((item) => item.value === value)?.label || value;
}
function typeTone(value) {
  if (value === 'MESSAGES') return 'tone-message';
  if (value === 'ACTIONS') return 'tone-action';
  if (value === 'CAPSULES') return 'tone-capsule';
  if (value === 'POSTS') return 'tone-post';
  return '';
}

function relevanceLabel(score) {
  const value = Number(score || 0);
  if (value >= 1200) return '완전 일치에 가까움';
  if (value >= 850) return '정확히 맞는 결과';
  if (value >= 600) return '강하게 일치';
  if (value >= 320) return '연관도 높음';
  if (value > 0) return '연관 결과';
  return '기본 정렬';
}

function formatTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).replace('T', ' ').slice(0, 16);
  const now = Date.now();
  const diffMin = Math.max(0, Math.floor((now - d.getTime()) / 60000));
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

watch(() => route.query, (query) => {
  const nextQ = String(query.q || '');
  const nextType = String(query.type || 'ALL').toUpperCase();
  const nextConversationId = query.conversationId ? String(query.conversationId) : '';
  if (nextQ !== q.value) q.value = nextQ;
  if (nextType !== type.value) type.value = nextType;
  if (nextConversationId !== conversationId.value) conversationId.value = nextConversationId;
}, { deep: true });

onMounted(() => {
  if (q.value.trim()) runSearch();
});
</script>

<template>
  <div class="rl-page searchPage">
    <section class="searchHero rl-card">
      <div class="searchHero__copy">
        <div class="searchHero__eyebrow">Search Hub</div>
        <h1>찾고 바로 행동하는 검색</h1>
        <p>{{ contextDescription }}</p>
      </div>
      <div class="searchHero__meta">
        <div class="contextPill">{{ contextLabel }}</div>
        <div class="metaGrid">
          <div v-for="section in sections" :key="section.type" class="metaCard">
            <span>{{ typeLabel(section.type) }}</span>
            <strong>{{ section.count }}</strong>
          </div>
        </div>
      </div>
    </section>

    <section class="searchShell rl-card">
      <div class="searchBar">
        <input v-model.trim="q" class="searchInput" placeholder="메시지, 액션, 캡슐, 피드를 검색해 보세요" @keydown.enter.prevent="runSearch" />
        <RlButton size="sm" variant="primary" @click="runSearch">검색</RlButton>
      </div>

      <div class="typeChips">
        <button v-for="item in types" :key="item.value" class="typeChip" :class="{ on: type === item.value }" type="button" @click="setType(item.value)">{{ item.label }}</button>
      </div>

      <div class="recentRow" v-if="recent.length">
        <span class="recentLabel">최근 검색</span>
        <button v-for="term in recent" :key="term" class="recentChip" type="button" @click="applyRecent(term)">{{ term }}</button>
      </div>

      <div v-if="error" class="feedback feedback--error">{{ error }}</div>
      <div v-else-if="loading" class="feedback">검색 중…</div>
      <div v-else-if="!q.trim()" class="feedback">검색어를 입력하면 메시지·액션·캡슐·피드를 한 번에 보여줘요.</div>
      <div v-else-if="!items.length" class="feedback">검색 결과가 없어요. 검색어를 조금 더 짧게 바꾸거나 필터를 바꿔보세요.</div>

      <div v-else class="results">
        <section v-for="[groupType, group] in groupedItems" :key="groupType" class="resultGroup">
          <div class="resultGroup__head">
            <strong>{{ typeLabel(groupType) }}</strong>
            <span>{{ group.length }}개</span>
          </div>
          <button v-for="item in group" :key="`${item.type}-${item.id}`" class="resultCard" :class="typeTone(item.type)" type="button" @click="openItem(item)">
            <div class="resultCard__top">
              <span class="resultBadge">{{ item.badge || typeLabel(item.type) }}</span>
              <span class="resultTime">{{ formatTime(item.createdAt) }}</span>
            </div>
            <div class="resultTitle">{{ item.title }}</div>
            <div class="resultSnippet">{{ item.snippet }}</div>
            <div v-if="item.highlight && item.highlight !== item.snippet" class="resultHighlight">포착된 키워드 · {{ item.highlight }}</div>
            <div class="resultMeta">
              <span>{{ item.secondary }}</span>
              <span v-if="item.relevance != null" class="resultScore">{{ relevanceLabel(item.relevance) }} · {{ item.relevance }}</span>
              <span class="resultArrow">열기 →</span>
            </div>
          </button>
        </section>
      </div>
    </section>
  </div>
</template>

<style scoped>
.searchPage{display:grid;gap:14px}.searchHero,.searchShell{padding:18px}.searchHero{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.9fr);gap:16px;background:linear-gradient(180deg,rgba(18,22,38,.96),rgba(9,12,22,.92));border:1px solid rgba(255,255,255,.08);border-radius:26px}.searchHero__eyebrow{font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(145,170,255,.82)}.searchHero h1{margin:6px 0 8px;font-size:clamp(26px,3vw,34px)}.searchHero p{margin:0;color:rgba(255,255,255,.72);line-height:1.6}.contextPill{display:inline-flex;align-items:center;gap:8px;min-height:34px;padding:0 14px;border-radius:999px;background:rgba(111,138,255,.16);border:1px solid rgba(111,138,255,.22);font-weight:800}.metaGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}.metaCard{padding:12px 14px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);display:grid;gap:4px}.metaCard span{font-size:12px;color:rgba(255,255,255,.64)}.metaCard strong{font-size:22px}.searchShell{display:grid;gap:12px}.searchBar{display:flex;gap:10px}.searchInput{flex:1;min-height:50px;border-radius:18px;border:1px solid rgba(255,255,255,.12);background:rgba(10,14,24,.82);color:#fff;padding:0 16px;outline:none}.searchInput:focus{border-color:rgba(126,154,255,.48);box-shadow:0 0 0 4px rgba(126,154,255,.14)}.typeChips,.recentRow{display:flex;gap:8px;flex-wrap:wrap}.typeChip,.recentChip{min-height:38px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);color:#fff;font-weight:800}.typeChip.on{background:rgba(104,133,255,.2);border-color:rgba(104,133,255,.34)}.recentLabel{display:inline-flex;align-items:center;font-size:12px;font-weight:800;color:rgba(255,255,255,.58);padding-right:4px}.feedback{padding:18px;border-radius:18px;background:rgba(255,255,255,.03);border:1px dashed rgba(255,255,255,.12);color:rgba(255,255,255,.7)}.feedback--error{color:#ff9b9b;border-color:rgba(255,107,107,.28);background:rgba(90,10,18,.22)}.results{display:grid;gap:14px}.resultGroup{display:grid;gap:10px}.resultGroup__head{display:flex;align-items:center;justify-content:space-between;color:rgba(255,255,255,.7)}.resultCard{display:grid;gap:10px;text-align:left;padding:16px;border-radius:22px;border:1px solid rgba(255,255,255,.09);background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.025));color:#fff}.resultCard__top,.resultMeta{display:flex;align-items:center;justify-content:space-between;gap:10px}.resultBadge{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.08);font-size:12px;font-weight:800}.resultTime,.resultMeta{font-size:12px;color:rgba(255,255,255,.58)}.resultScore{display:inline-flex;align-items:center;padding:0 8px;min-height:24px;border-radius:999px;background:rgba(255,255,255,.06);font-weight:800}.resultTitle{font-size:16px;font-weight:900}.resultSnippet{font-size:13px;line-height:1.55;color:rgba(255,255,255,.78)}.resultHighlight{font-size:12px;color:rgba(255,227,145,.9)}.resultArrow{color:rgba(145,170,255,.9);font-weight:800}.tone-message .resultBadge{background:rgba(84,196,255,.16)}.tone-action .resultBadge{background:rgba(120,255,166,.16)}.tone-capsule .resultBadge{background:rgba(255,202,96,.16)}.tone-post .resultBadge{background:rgba(255,128,189,.16)}
@media (max-width: 820px){.searchHero{grid-template-columns:1fr}.searchBar{flex-direction:column}.typeChip,.recentChip{min-height:36px;padding:0 12px}}
</style>
