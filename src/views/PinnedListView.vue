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

  // 선택: 사용자가 "초기화 됐다"를 체감하게 포커스 이동
  nextTick(() => document.querySelector(".search")?.focus());
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
  const base = [{ value: "ALL", label: "전체" }];

  const map = {
    ACTIVE: "진행중",
    DONE: "완료",
    CANCELED: "취소",
    DISMISSED: "숨김",
  };

  const extra = availableStatuses.value
      .filter((s) => s && s !== "ALL")
      .map((s) => ({ value: s, label: map[s] || s }));

  // ACTIVE가 없으면 그래도 노출되게
  const existsActive = extra.some((x) => x.value === "ACTIVE");
  if (!existsActive) extra.unshift({ value: "ACTIVE", label: "진행중" });

  return base.concat(extra);
});

function normalize(s) {
  return String(s || "").toLowerCase().trim();
}

function safeTimeValue(s) {
  const t = Date.parse(s || "");
  return Number.isFinite(t) ? t : null;
}

const filteredPins = computed(() => {
  let arr = [...pins.value];

  // filter: status
  if (statusFilter.value !== "ALL") {
    arr = arr.filter((p) => String(p.status || "") === statusFilter.value);
  }

  // filter: has place/time
  if (onlyHasPlace.value) arr = arr.filter((p) => !!p.placeText);
  if (onlyHasTime.value) arr = arr.filter((p) => !!p.startAt);

  // filter: query
  const qq = normalize(q.value);
  if (qq) {
    arr = arr.filter((p) => {
      const t = normalize(p.title);
      const pl = normalize(p.placeText);
      return t.includes(qq) || pl.includes(qq);
    });
  }

  // sort
  if (sortKey.value === "CREATED_DESC") {
    arr.sort((a, b) => (safeTimeValue(b.createdAt) ?? 0) - (safeTimeValue(a.createdAt) ?? 0));
  } else if (sortKey.value === "CREATED_ASC") {
    arr.sort((a, b) => (safeTimeValue(a.createdAt) ?? 0) - (safeTimeValue(b.createdAt) ?? 0));
  } else if (sortKey.value === "START_ASC") {
    arr.sort((a, b) => (safeTimeValue(a.startAt) ?? 1e18) - (safeTimeValue(b.startAt) ?? 1e18));
  } else if (sortKey.value === "START_DESC") {
    arr.sort((a, b) => (safeTimeValue(b.startAt) ?? -1e18) - (safeTimeValue(a.startAt) ?? -1e18));
  } else if (sortKey.value === "TITLE_ASC") {
    arr.sort((a, b) => normalize(a.title).localeCompare(normalize(b.title)));
  }

  return arr;
});

const subtitleText = computed(() => {
  const total = pins.value.length;
  const shown = filteredPins.value.length;
  if (!total) return "핀을 저장하면 여기서 모아볼 수 있어요.";
  if (shown === total) return `총 ${total}개`;
  return `총 ${total}개 중 ${shown}개 표시`;
});

/** ====== flash pin (remind noti) ====== */
const flashPinId = ref("");
const pinEls = new Map();

function setPinEl(pinId, el) {
  if (!pinId) return;
  if (!el) {
    pinEls.delete(String(pinId));
  } else {
    pinEls.set(String(pinId), el);
  }
}

async function scrollToPin(pinId) {
  await nextTick();
  const el = pinEls.get(String(pinId));
  if (el?.scrollIntoView) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

watch(
    () => route.query?.pinId,
    async (pinId) => {
      if (!pinId) return;
      flashPinId.value = String(pinId);
      await scrollToPin(pinId);

      // 2초 후 강조 제거
      setTimeout(() => {
        if (flashPinId.value === String(pinId)) flashPinId.value = "";
      }, 2000);
    },
    { immediate: true }
);

/** ====== load ====== */
async function load() {
  if (!conversationId.value) return;
  await pinsStore.refresh(conversationId.value, { size: 50 });
}

onMounted(async () => {
  // ✅ 알림으로 들어온 notiId가 있으면 읽음 처리
  const notiId = route.query?.notiId ? String(route.query.notiId) : "";
  if (notiId) {
    try {
      await readNotification(notiId);
      await notiStore.refresh?.(); // unread 상태/리스트 보정
    } catch {}
  }

  load();
});

/** ===== actions modal (UX 개선 버전) ===== */
const modalOpen = ref(false);
const modalPin = ref(null);
const busy = ref(false);

function goConversation(p) {
  // ✅ 카드 탭 = 대화 상세로 이동
  router.push(`/conversations/${conversationId.value}`);
}

function openManage(pin) {
  modalPin.value = pin;
  modalOpen.value = true;
}
function closeAction() {
  if (busy.value) return;
  modalOpen.value = false;
  modalPin.value = null;
}

async function performAction(action) {
  const p = modalPin.value;
  if (!p?.pinId) return;

  busy.value = true;

  try {
    if (action === "DONE") await pinDone(p.pinId);
    else if (action === "CANCELED") await pinCancel(p.pinId);
    else await pinDismiss(p.pinId);

    // 스토어에서 제거
    pinsStore.removePin(conversationId.value, p.pinId);

    // ✅ 여기서 먼저 모달 닫기
    modalOpen.value = false;
    modalPin.value = null;

    const msg =
        action === "DONE"
            ? "완료 처리했습니다."
            : action === "CANCELED"
                ? "취소 처리했습니다."
                : "숨김 처리했습니다.";

    toast.success?.("완료", msg);

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

function fmtRemind(pin) {
  if (!pin?.startAt || !pin?.remindAt) return "리마인드 없음";

  const s = Date.parse(pin.startAt);
  const r = Date.parse(pin.remindAt);
  if (!Number.isFinite(s) || !Number.isFinite(r)) return "리마인드 없음";

  const mins = Math.round((s - r) / 60000);
  if (mins === 60) return "1시간 전";
  if (mins === 30) return "30분 전";
  if (mins === 10) return "10분 전";
  if (mins === 5) return "5분 전";
  return "리마인드";
}
</script>

<template>
  <div class="page">
    <div class="container">
      <div class="topbar">
        <RlButton size="sm" variant="soft" @click="router.back()">←</RlButton>
        <div class="title">
          <div class="t1">📌 Pinned 전체</div>
          <div class="t2">{{ subtitleText }}</div>
        </div>
        <RlButton size="xs" variant="ghost" @click="load" :loading="loading">새로고침</RlButton>
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

          <button type="button" class="reset" @click.prevent.stop="resetFilters">초기화</button>
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
            @click="goConversation(p)"
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
              <RlButton
                  size="sm"
                  variant="soft"
                  :loading="busy"
                  @click.stop="openManage(p)"
              >
                관리
              </RlButton>
            </div>
          </div>

          <div class="meta">
            <div class="line">📍 {{ p.placeText || "장소 미정" }}</div>
            <div class="line">🕒 {{ fmtTime(p.startAt) }}</div>
            <div class="line">⏰ {{ fmtRemind(p) }}</div>
          </div>
        </div>
      </div>

      <!-- ✅ 관리 모달 -->
      <RlModal
          :open="modalOpen"
          title="핀 관리"
          subtitle="완료/취소/숨김 중 하나를 선택하세요."
          :blockClose="busy"
          :closeOnBackdrop="!busy"
          @close="closeAction"
      >
        <div class="mBody2">
          <div class="kv"><span class="k">제목</span><span class="v">{{ modalPin?.title || "약속" }}</span></div>
          <div class="kv"><span class="k">장소</span><span class="v">{{ modalPin?.placeText || "미정" }}</span></div>
          <div class="kv"><span class="k">시간</span><span class="v">{{ fmtTime(modalPin?.startAt) }}</span></div>
          <div class="kv"><span class="k">리마인드</span><span class="v">{{ fmtRemind(modalPin) }}</span></div>

          <div class="manageBtns">
            <RlButton block variant="soft" :loading="busy" @click="performAction('DONE')">완료</RlButton>
            <RlButton block variant="danger" :loading="busy" @click="performAction('CANCELED')">취소</RlButton>
            <RlButton block variant="ghost" :loading="busy" @click="performAction('DISMISSED')">숨김</RlButton>
          </div>
        </div>

        <template #actions>
          <RlButton block variant="ghost" :disabled="busy" @click="closeAction">닫기</RlButton>
        </template>
      </RlModal>
    </div>
  </div>
</template>

<style scoped>
.page {
  position: fixed;
  left: 0;
  right: 0;

  top: var(--app-header-h, 64px);
  bottom: var(--app-bottombar-h, 72px);

  overflow: auto;

  padding: 12px 12px 20px;

  /* ✅ width 제한 */
  max-width: 720px;
  margin: 0 auto;
}

/* ✅ 내용 폭 제한 + 중앙 정렬 */
.container{
  max-width: 720px;
  margin: 0 auto;
}

.topbar{
  position: sticky;
  top: 0;
  z-index: 2;

  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;

  padding: 6px 4px 14px;

  /* 카드 스타일 제거 */
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.title {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.t1{
  font-weight: 950;
  font-size: 15px;
  letter-spacing: .2px;
}

.t2 {
  font-size: 12px;
  color: var(--muted);
}

.controls {
  padding: 12px;
  border-radius: 18px;
  border: 1px solid color-mix(in oklab, var(--border) 85%, transparent);
  background: color-mix(in oklab, var(--surface) 86%, transparent);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06) inset;
  backdrop-filter: blur(10px);
}

.searchRow {
  display: flex;
  gap: 10px;
  align-items: center;
}

.search {
  flex: 1;
  height: 42px;
  border-radius: 14px;
  border: 1px solid color-mix(in oklab, var(--border) 85%, transparent);
  background: color-mix(in oklab, var(--surface) 92%, transparent);
  color: var(--text);
  padding: 0 12px;
  outline: none;
}

.select {
  height: 42px;
  border-radius: 14px;
  border: 1px solid color-mix(in oklab, var(--border) 85%, transparent);
  background: color-mix(in oklab, var(--surface) 92%, transparent);
  color: var(--text);
  padding: 0 10px;
}

.chips {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: transparent;
  padding: 8px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: var(--text);
}

.chip.on {
  border-color: rgba(255, 255, 255, 0.28);
}

.toggles {
  margin-top: 10px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.toggle {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: var(--muted);
}

.reset {
  margin-left: auto;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: transparent;
  color: var(--text);
  border-radius: 999px;
  padding: 8px 10px;
  font-size: 12px;
}

.state {
  margin-top: 12px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
}

.state.err {
  border-color: color-mix(in oklab, #ff6b6b 40%, transparent);
}

.list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty {
  padding: 14px;
  border-radius: 16px;
  border: 1px dashed rgba(255, 255, 255, 0.12);
  color: var(--muted);
  text-align: center;
}

.card {
  padding: 14px;
  border-radius: 18px;
  border: 1px solid color-mix(in oklab, var(--border) 85%, transparent);
  background: color-mix(in oklab, var(--surface) 86%, transparent);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06) inset;
  backdrop-filter: blur(10px);
  cursor: pointer;
}

.card--flash {
  outline: 2px solid color-mix(in oklab, var(--accent) 55%, transparent);
}

.rowTop {
  display: flex;
  align-items: center;
  gap: 10px;
}

.name {
  flex: 1;
  font-weight: 950;
  font-size: 13px;
  color: var(--text);
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.remindTag {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  opacity: 0.9;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.meta {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: color-mix(in oklab, var(--text) 82%, var(--muted));
}

.line {
  display: flex;
  gap: 8px;
  align-items: center;
}

.manageBtns {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mBody2 {
  padding: 8px 0 2px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.kv {
  display: flex;
  gap: 10px;
  font-size: 12px;
}

.k {
  width: 56px;
  color: var(--muted);
  font-weight: 900;
}

.v {
  flex: 1;
  color: var(--text);
}
</style>