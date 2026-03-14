
<template>
  <div class="page">
    <section class="hero cardSurface">
      <div>
        <div class="eyebrow">MY ACTIVITY</div>
        <h1 class="title">내 활동 보관함</h1>
        <p class="sub">내 액션, 내 캡슐, 내가 공유한 흐름을 한곳에서 다시 정리하는 공간이야.</p>
      </div>
    </section>

    <section class="tabs cardSurface">
      <button class="tab" :class="{ on: activeTab==='actions' }" @click="setTab('actions')">내 액션</button>
      <button class="tab" :class="{ on: activeTab==='capsules' }" @click="setTab('capsules')">내 캡슐</button>
      <button class="tab" :class="{ on: activeTab==='shares' }" @click="setTab('shares')">내 공유 목록</button>
    </section>

    <section class="panel cardSurface">
      <div class="panelHead">
        <div>
          <div class="panelTitle">{{ panelTitle }}</div>
          <div class="panelSub">{{ panelSub }}</div>
        </div>
        <ActivityFilterChips v-model="filter" :items="filterItems" />
      </div>

      <div v-if="loading" class="empty">불러오는 중…</div>
      <div v-else-if="!filteredItems.length" class="empty">조건에 맞는 항목이 없어요.</div>

      <div v-else class="list">
        <ActivityListCard
          v-for="item in filteredItems"
          :key="item.id"
          :title="item.title"
          :meta="item.meta"
          :sub="item.sub"
          :badge="item.badge"
          @open="openItem(item)"
        />
      </div>
    </section>

    <Teleport to="body">
      <div v-if="selected" class="overlay" @click.self="selected = null">
        <div class="detailSheet cardSurface">
          <div class="sheetEyebrow">DETAIL</div>
          <div class="sheetTitle">{{ selected.title || "제목 없음" }}</div>
          <div class="sheetMeta">{{ selected.meta }}</div>
          <div v-if="selected.sub" class="sheetSub">{{ selected.sub }}</div>
          <div class="sheetBlock">
            <div class="sheetBlockTitle">설명</div>
            <div class="sheetBlockText">{{ selected.detail || selected.sub || "추가 설명이 아직 없어요." }}</div>
          </div>
          <div class="sheetActions">
            <button class="ghostBtn" @click="selected = null">닫기</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { fetchMyActions, fetchMyCapsules, fetchMyShares } from "@/api/meActivity";
import ActivityFilterChips from "@/components/activity/ActivityFilterChips.vue";
import ActivityListCard from "@/components/activity/ActivityListCard.vue";

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const items = ref([]);
const filter = ref("all");
const selected = ref(null);

const activeTab = computed(() => {
  const t = String(route.query.tab || "actions");
  return ["actions", "capsules", "shares"].includes(t) ? t : "actions";
});
const panelTitle = computed(() => activeTab.value === "actions" ? "내 액션" : activeTab.value === "capsules" ? "내 캡슐" : "내 공유 목록");
const panelSub = computed(() => activeTab.value === "actions"
  ? "내가 만든 약속/할일/장소를 시간순으로 다시 훑어봐요."
  : activeTab.value === "capsules"
    ? "대기 중인 캡슐과 열린 캡슐을 나눠서 볼 수 있어요."
    : "피드에 공유한 액션과 흐름을 다시 확인해요."
);

const filterItems = computed(() => {
  if (activeTab.value === "actions") {
    return [
      { value: "all", label: "전체" },
      { value: "ACTIVE", label: "예정/진행" },
      { value: "DONE", label: "완료" },
      { value: "CANCELED", label: "취소" },
    ];
  }
  if (activeTab.value === "capsules") {
    return [
      { value: "all", label: "전체" },
      { value: "locked", label: "잠금" },
      { value: "opened", label: "열림" },
    ];
  }
  return [
    { value: "all", label: "전체" },
    { value: "ALL", label: "전체 공개" },
    { value: "FOLLOWERS", label: "팔로워" },
    { value: "PRIVATE", label: "나만" },
  ];
});

const filteredItems = computed(() => {
  if (filter.value === "all") return items.value;
  if (activeTab.value === "actions") return items.value.filter((x) => x.rawStatus === filter.value);
  if (activeTab.value === "capsules") return items.value.filter((x) => (filter.value === "opened" ? x.opened : !x.opened));
  return items.value.filter((x) => x.rawVisibility === filter.value);
});

function setTab(tab) {
  filter.value = "all";
  router.replace({ name: "my-activity", query: { tab } });
}

function openItem(item) {
  selected.value = item;
}

async function load() {
  loading.value = true;
  try {
    if (activeTab.value === "actions") {
      const res = await fetchMyActions();
      items.value = (res.items || []).map((x) => ({
        id: x.pinId || x.id,
        title: x.title,
        meta: [x.type, x.status].filter(Boolean).join(" · "),
        sub: [x.placeText, x.startAt].filter(Boolean).join(" · "),
        detail: [x.placeText, x.startAt, x.status].filter(Boolean).join("\n"),
        badge: x.status,
        rawStatus: x.status,
      }));
    } else if (activeTab.value === "capsules") {
      const res = await fetchMyCapsules();
      items.value = (res.items || []).map((x) => ({
        id: x.capsuleId || x.id,
        title: x.title,
        meta: x.opened ? "열림" : "잠금",
        sub: x.unlockAt ? `열릴 시간 · ${x.unlockAt}` : "",
        detail: x.unlockAt ? `열릴 시간 · ${x.unlockAt}` : "",
        badge: x.opened ? "열림" : "잠금",
        opened: !!x.opened,
      }));
    } else {
      const res = await fetchMyShares();
      items.value = (res.items || []).map((x) => ({
        id: x.postId || x.id,
        title: x.content,
        meta: x.visibility || "ALL",
        sub: x.createdAt ? `공유 시각 · ${x.createdAt}` : "",
        detail: x.content || "",
        badge: x.visibility || "ALL",
        rawVisibility: x.visibility || "ALL",
      }));
    }
  } finally {
    loading.value = false;
  }
}

watch(activeTab, () => {
  filter.value = "all";
  load();
}, { immediate: true });
</script>

<style scoped>
.page{padding:20px 20px calc(96px + env(safe-area-inset-bottom));max-width:1120px;margin:0 auto;display:grid;gap:16px}.cardSurface{border:1px solid rgba(255,255,255,.10);border-radius:24px;background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02));box-shadow:0 18px 46px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.04)}.hero{padding:20px}.eyebrow{font-size:11px;font-weight:900;letter-spacing:.18em;color:rgba(255,255,255,.58)}.title{margin:6px 0 0;font-size:30px;line-height:1.05;font-weight:950;letter-spacing:-.04em}.sub,.panelSub{font-size:14px;line-height:1.65;color:rgba(255,255,255,.74)}.tabs{padding:10px;display:flex;gap:10px;flex-wrap:wrap}.tab{height:40px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);color:#fff;font-weight:900}.tab.on{background:rgba(255,255,255,.12)}.panel{padding:18px}.panelHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.panelTitle{font-size:18px;font-weight:950}.list{margin-top:12px;display:grid;gap:10px}.empty{padding:24px 10px;color:rgba(255,255,255,.65)}.overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(10px);display:grid;place-items:center;padding:20px;z-index:90}.detailSheet{width:min(560px,100%);padding:18px;display:grid;gap:10px}.sheetEyebrow{font-size:11px;font-weight:900;letter-spacing:.08em;color:rgba(255,255,255,.6)}.sheetTitle{font-size:22px;font-weight:950}.sheetMeta{font-size:13px;color:rgba(255,255,255,.72)}.sheetSub{font-size:13px;color:rgba(255,255,255,.62)}.sheetBlock{margin-top:8px;padding:12px;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03)}.sheetBlockTitle{font-size:12px;font-weight:900;color:rgba(255,255,255,.62)}.sheetBlockText{margin-top:8px;white-space:pre-line;font-size:13px;line-height:1.6;color:rgba(255,255,255,.78)}.sheetActions{display:flex;justify-content:flex-end}.ghostBtn{height:38px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);color:#fff;font-weight:900}
</style>
