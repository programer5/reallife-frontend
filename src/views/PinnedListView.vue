<!-- src/views/PinnedListView.vue -->
<script setup>
import { computed, onMounted, ref, watch, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";

import RlButton from "@/components/ui/RlButton.vue";
import RlModal from "@/components/ui/RlModal.vue";

import { useConversationPinsStore } from "@/stores/conversationPins";
import { pinDone, pinCancel, pinDismiss } from "@/api/pinsActions";
import { useToastStore } from "@/stores/toast";
import { readNotification } from "@/api/notifications";
import { useNotificationsStore } from "@/stores/notifications";

const route = useRoute();
const router = useRouter();
const notiStore = useNotificationsStore();
const toast = useToastStore();
const pinsStore = useConversationPinsStore();

const conversationId = computed(() => String(route.params.conversationId || ""));

const loading = computed(() => pinsStore.loading);
const error = computed(() => pinsStore.error);
const pins = computed(() => pinsStore.getPins(conversationId.value));

/** ====== controls ====== */
const q = ref(""); // search query
const statusFilter = ref("ALL"); // ALL | ACTIVE | DONE | CANCELED | DISMISSED
const onlyHasPlace = ref(false);
const onlyHasTime = ref(false);

const sortKey = ref("CREATED_DESC"); // CREATED_DESC | CREATED_ASC | START_ASC | START_DESC | TITLE_ASC

const sortOptions = [
  { value: "CREATED_DESC", label: "최신 저장순" },
  { value: "CREATED_ASC", label: "오래된 저장순" },
  { value: "START_ASC", label: "일정 빠른순" },
  { value: "START_DESC", label: "일정 늦은순" },
  { value: "TITLE_ASC", label: "제목 A→Z" },
];

function resetFilters() {
  q.value = "";
  statusFilter.value = "ALL";
  onlyHasPlace.value = false;
  onlyHasTime.value = false;
  sortKey.value = "CREATED_DESC";
}

const availableStatuses = computed(() => {
  const set = new Set();
  for (const p of pins.value) {
    if (p?.status) set.add(String(p.status));
  }
  // ✅ 현재 API는 ACTIVE만 내려오지만, 혹시 서버 확장되면 자동 대응
  const arr = Array.from(set);
  return arr.length ? arr : ["ACTIVE"];
});

const statusChips = computed(() => {
  // ✅ 실제로 존재하는 status만 칩으로 보여줌 (불필요한 DONE/CANCELED 칩 숨김)
  const list = availableStatuses.value;
  const chips = [{ value: "ALL", label: "전체" }];
  for (const s of list) {
    if (s === "ACTIVE") chips.push({ value: "ACTIVE", label: "ACTIVE" });
    else if (s === "DONE") chips.push({ value: "DONE", label: "DONE" });
    else if (s === "CANCELED") chips.push({ value: "CANCELED", label: "CANCELED" });
    else if (s === "DISMISSED") chips.push({ value: "DISMISSED", label: "DISMISSED" });
    else chips.push({ value: s, label: s });
  }
  return chips;
});

function safeLower(v) {
  return String(v || "").toLowerCase();
}

function toTimeMs(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  return t;
}

function createdMs(p) {
  return toTimeMs(p?.createdAt) ?? 0;
}
function startMs(p) {
  return toTimeMs(p?.startAt); // null 가능
}

function applySort(list) {
  const key = sortKey.value;

  const arr = [...list];

  if (key === "CREATED_DESC") {
    arr.sort((a, b) => createdMs(b) - createdMs(a));
    return arr;
  }
  if (key === "CREATED_ASC") {
    arr.sort((a, b) => createdMs(a) - createdMs(b));
    return arr;
  }
  if (key === "START_ASC") {
    // startAt 없는 건 맨 뒤
    arr.sort((a, b) => {
      const ta = startMs(a);
      const tb = startMs(b);
      if (ta == null && tb == null) return createdMs(b) - createdMs(a);
      if (ta == null) return 1;
      if (tb == null) return -1;
      return ta - tb;
    });
    return arr;
  }
  if (key === "START_DESC") {
    // startAt 없는 건 맨 뒤
    arr.sort((a, b) => {
      const ta = startMs(a);
      const tb = startMs(b);
      if (ta == null && tb == null) return createdMs(b) - createdMs(a);
      if (ta == null) return 1;
      if (tb == null) return -1;
      return tb - ta;
    });
    return arr;
  }
  if (key === "TITLE_ASC") {
    arr.sort((a, b) => safeLower(a?.title).localeCompare(safeLower(b?.title)));
    return arr;
  }

  return arr;
}

const filteredPins = computed(() => {
  const list = Array.isArray(pins.value) ? pins.value : [];
  const qq = safeLower(q.value).trim();

  let out = list;

  // status
  if (statusFilter.value !== "ALL") {
    out = out.filter((p) => String(p?.status || "") === String(statusFilter.value));
  }

  // place/time toggles
  if (onlyHasPlace.value) {
    out = out.filter((p) => !!String(p?.placeText || "").trim());
  }
  if (onlyHasTime.value) {
    out = out.filter((p) => !!p?.startAt);
  }

  // search (title + place)
  if (qq) {
    out = out.filter((p) => {
      const title = safeLower(p?.title);
      const place = safeLower(p?.placeText);
      return title.includes(qq) || place.includes(qq);
    });
  }

  // sort
  return applySort(out);
});

const totalCount = computed(() => pins.value.length);
const filteredCount = computed(() => filteredPins.value.length);

const subtitleText = computed(() => {
  if (totalCount.value === filteredCount.value) return `총 ${totalCount.value}개`;
  return `총 ${totalCount.value}개 · 필터 ${filteredCount.value}개`;
});

/** ====== load ====== */
async function load() {
  if (!conversationId.value) return;
  // 서버 max 50으로 쓰는게 안전 (기존 코드 유지)
  await pinsStore.refresh(conversationId.value, { size: 50 });
}

/** ===== focus specific pin (by query pinId) ===== */
const flashPinId = ref(""); // 현재 반짝일 pinId
const pinElMap = new Map(); // pinId -> element

function setPinEl(pinId, el) {
  const k = String(pinId || "");
  if (!k) return;
  if (el) pinElMap.set(k, el);
  else pinElMap.delete(k);
}

async function focusPinFromQuery() {
  const qPinId = route.query?.pinId ? String(route.query.pinId) : "";
  if (!qPinId) return;

  // DOM 렌더 후 요소 확보
  await nextTick();

  const el = pinElMap.get(qPinId);
  if (!el) return;

  el.scrollIntoView({ behavior: "smooth", block: "center" });

  flashPinId.value = qPinId;
  setTimeout(() => {
    if (flashPinId.value === qPinId) flashPinId.value = "";
  }, 2000);
  // ✅ 처리 끝났으면 URL query 정리
  router.replace({ query: {} });
}

// pinId 쿼리가 바뀌거나, 목록이 다시 렌더될 때도 재시도
watch(
    [() => route.query?.pinId, () => filteredPins.value.length],
    () => focusPinFromQuery(),
    { immediate: true }
);

onMounted(async () => {
  // ✅ pins 화면을 열었으면 리마인드 배지는 자동 해제
  pinsStore.clearRemindBadge?.(conversationId.value);

  // ✅ 토스트 딥링크로 넘어온 notiId가 있으면 읽음 처리
  const notiId = route.query?.notiId ? String(route.query.notiId) : "";
  if (notiId) {
    try {
      await readNotification(notiId);
      await notiStore.refresh?.(); // unread 상태/리스트 보정
    } catch {}
  }

  // 기존 로딩
  load();
});

/** ===== actions modal ===== */
const modalOpen = ref(false);
const modalAction = ref("DONE"); // DONE | CANCELED | DISMISSED
const modalPin = ref(null);
const busy = ref(false);

function openAction(action, pin) {
  modalAction.value = action;
  modalPin.value = pin;
  modalOpen.value = true;
}
function closeAction() {
  if (busy.value) return;
  modalOpen.value = false;
  modalPin.value = null;
}

const modalTitle = computed(() => {
  if (modalAction.value === "DONE") return "✅ 핀 완료";
  if (modalAction.value === "CANCELED") return "❌ 핀 취소";
  return "🙈 핀 숨김";
});

const modalSubtitle = computed(() => {
  if (modalAction.value === "DONE") return "이 핀을 완료 처리할까요? (대화방 전체에 적용)";
  if (modalAction.value === "CANCELED") return "이 핀을 취소 처리할까요? (대화방 전체에 적용)";
  return "이 핀을 내 화면에서 숨길까요? (상대방은 그대로 보일 수 있어요)";
});

const confirmText = computed(() => {
  if (modalAction.value === "DONE") return "완료 처리";
  if (modalAction.value === "CANCELED") return "취소 처리";
  return "숨김 처리";
});

const confirmVariant = computed(() => {
  if (modalAction.value === "DONE") return "primary";
  if (modalAction.value === "CANCELED") return "danger";
  return "ghost";
});

async function confirm() {
  const p = modalPin.value;
  if (!p?.pinId) return;

  busy.value = true;
  try {
    if (modalAction.value === "DONE") await pinDone(p.pinId);
    else if (modalAction.value === "CANCELED") await pinCancel(p.pinId);
    else await pinDismiss(p.pinId);

    // ✅ 낙관적으로 즉시 제거
    pinsStore.removePin(conversationId.value, p.pinId);

    toast.success?.("완료", "처리했습니다.");
    closeAction();
  } catch (e) {
    toast.error?.("실패", e?.response?.data?.message || "잠시 후 다시 시도해주세요.");
  } finally {
    busy.value = false;
  }
}

function fmtTime(s) {
  if (!s) return "시간 미정";
  return String(s).replace("T", " ").slice(0, 16);
}
</script>

<template>
  <div class="page">
    <div class="topbar">
      <RlButton size="sm" variant="soft" @click="router.back()">←</RlButton>
      <div class="title">
        <div class="t1">📌 Pinned 전체</div>
        <div class="t2">{{ subtitleText }}</div>
      </div>
      <RlButton size="sm" variant="soft" @click="load" :loading="loading">새로고침</RlButton>
    </div>

    <!-- ✅ controls -->
    <div class="controls">
      <div class="searchRow">
        <input
            class="search"
            v-model="q"
            placeholder="제목/장소 검색…"
            autocomplete="off"
        />
        <select class="select" v-model="sortKey">
          <option v-for="o in sortOptions" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </select>
      </div>

      <div class="chips">
        <button
            v-for="c in statusChips"
            :key="c.value"
            type="button"
            class="chip"
            :class="{ on: statusFilter === c.value }"
            @click="statusFilter = c.value"
        >
          {{ c.label }}
        </button>
      </div>

      <div class="toggles">
        <label class="toggle">
          <input type="checkbox" v-model="onlyHasTime" />
          <span>시간 있는 핀만</span>
        </label>
        <label class="toggle">
          <input type="checkbox" v-model="onlyHasPlace" />
          <span>장소 있는 핀만</span>
        </label>

        <button type="button" class="reset" @click="resetFilters">초기화</button>
      </div>
    </div>

    <div v-if="error" class="state err">{{ error }}</div>
    <div v-else-if="loading && !pins.length" class="state">불러오는 중…</div>

    <div v-else class="list">
      <div v-if="!filteredPins.length" class="empty">
        조건에 맞는 핀이 없어요.
      </div>

      <div
          v-for="p in filteredPins"
          :key="p.pinId"
          class="card"
          :data-pin-id="String(p.pinId)"
          :ref="(el) => setPinEl(p.pinId, el)"
          :class="{ 'card--flash': flashPinId === String(p.pinId) }"
      >
        <div class="rowTop">
          <div class="name">
            {{ p.title || "약속" }}
            <span v-if="flashPinId === String(p.pinId)" class="remindTag">리마인드 도착</span>
          </div>

          <div class="actions">
            <RlButton size="sm" variant="soft" :loading="busy" @click="openAction('DONE', p)">완료</RlButton>
            <RlButton size="sm" variant="danger" :loading="busy" @click="openAction('CANCELED', p)">취소</RlButton>
            <RlButton size="sm" variant="ghost" :loading="busy" @click="openAction('DISMISSED', p)">숨김</RlButton>
          </div>
        </div>

        <div class="meta">
          <div class="line">📍 {{ p.placeText || "장소 미정" }}</div>
          <div class="line">🕒 {{ fmtTime(p.startAt) }}</div>
        </div>
      </div>
    </div>

    <RlModal
        :open="modalOpen"
        :title="modalTitle"
        :subtitle="modalSubtitle"
        :blockClose="busy"
        :closeOnBackdrop="!busy"
        @close="closeAction"
    >
      <div class="mBody2">
        <div class="kv"><span class="k">제목</span><span class="v">{{ modalPin?.title || "약속" }}</span></div>
        <div class="kv"><span class="k">장소</span><span class="v">{{ modalPin?.placeText || "미정" }}</span></div>
        <div class="kv"><span class="k">시간</span><span class="v">{{ fmtTime(modalPin?.startAt) }}</span></div>
      </div>

      <template #actions>
        <RlButton block :variant="confirmVariant" :loading="busy" @click="confirm">{{ confirmText }}</RlButton>
        <RlButton block variant="ghost" :disabled="busy" @click="closeAction">닫기</RlButton>
      </template>
    </RlModal>
  </div>
</template>

<style scoped>
.page{padding:18px 14px 90px;max-width:760px;margin:0 auto}
.topbar{
  display:grid;
  grid-template-columns:auto 1fr auto;
  align-items:center;
  gap:10px;
  margin-bottom:12px;
}
.title{display:flex;flex-direction:column;align-items:center;gap:2px}
.t1{font-weight:950;text-align:center}
.t2{font-size:12px;color:var(--muted)}

.state{text-align:center;color:var(--muted);padding:18px 0}
.state.err{color:color-mix(in oklab,var(--danger) 80%,white)}

.controls{
  border:1px solid color-mix(in oklab, var(--border) 70%, transparent);
  border-radius: var(--r-lg);
  background: color-mix(in oklab, var(--surface) 86%, transparent);
  padding: 12px;
  display:grid;
  gap: 10px;
  margin-bottom: 12px;
}

.searchRow{
  display:grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items:center;
}
.search{
  height: 42px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: color-mix(in oklab, var(--surface) 88%, transparent);
  color: var(--text);
  padding: 0 12px;
  outline: none;
}
.search:focus{
  border-color: color-mix(in oklab, var(--accent) 55%, var(--border));
}

.select{
  height: 42px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: color-mix(in oklab, var(--surface) 88%, transparent);
  color: var(--text);
  padding: 0 10px;
}

.chips{
  display:flex;
  gap: 8px;
  flex-wrap: wrap;
}
.chip{
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
  background: transparent;
  color: var(--text);
  font-weight: 900;
  font-size: 12px;
  cursor: pointer;
}
.chip.on{
  border-color: color-mix(in oklab, var(--accent) 55%, var(--border));
  background: color-mix(in oklab, var(--accent) 14%, transparent);
}

.toggles{
  display:flex;
  gap: 12px;
  align-items:center;
  flex-wrap: wrap;
}
.toggle{
  display:flex;
  gap: 8px;
  align-items:center;
  font-size: 12px;
  color: color-mix(in oklab, var(--text) 92%, var(--muted));
}
.toggle input{accent-color: var(--accent)}
.reset{
  margin-left:auto;
  height: 34px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font-weight: 900;
  font-size: 12px;
  cursor:pointer;
}

.list{display:grid;gap:10px}
.empty{
  text-align:center;
  color:var(--muted);
  border:1px dashed color-mix(in oklab,var(--border) 70%,transparent);
  border-radius: var(--r-lg);
  padding: 18px 12px;
}

.card{
  border:1px solid color-mix(in oklab, var(--border) 88%, transparent);
  background:color-mix(in oklab, var(--surface) 86%, transparent);
  box-shadow:
      0 18px 60px rgba(0,0,0,.28),
      0 1px 0 rgba(255,255,255,.06) inset;
  border-radius: var(--r-lg);
  padding: 14px;
  backdrop-filter: blur(14px);
}
.rowTop{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
}
.name{font-weight:950;font-size:14px}
.actions{display:flex;gap:6px;flex-wrap:wrap}
.meta{margin-top:10px;display:grid;gap:6px}
.line{font-size:12px;color:color-mix(in oklab, var(--text) 92%, var(--muted))}

.mBody2{display:flex;flex-direction:column;gap:8px;padding:10px 0 2px}
.kv{display:flex;justify-content:space-between;gap:10px;font-size:12px}
.k{color:var(--muted);font-weight:800}
/* ✅ focus flash */
.card--flash{
  animation: pinFlash 1s ease;
}
@keyframes pinFlash{
  0%   { box-shadow: 0 0 0 0 color-mix(in oklab, var(--accent) 0%, transparent); }
  30%  { box-shadow: 0 0 0 8px color-mix(in oklab, var(--accent) 22%, transparent); }
  100% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--accent) 0%, transparent); }
}
.remindTag{
  display:inline-block;
  margin-left:8px;
  padding:2px 8px;
  border-radius:999px;
  font-size:11px;
  line-height:1.6;
  background: color-mix(in oklab, var(--accent) 18%, transparent);
  border: 1px solid color-mix(in oklab, var(--accent) 35%, transparent);
  vertical-align: middle;
}
</style>