<!-- src/views/PinnedListView.vue -->
<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import RlButton from "@/components/ui/RlButton.vue";
import RlModal from "@/components/ui/RlModal.vue";

import { useConversationPinsStore } from "@/stores/conversationPins";
import { pinDone, pinCancel, pinDismiss } from "@/api/pinsActions";
import { useToastStore } from "@/stores/toast";

const route = useRoute();
const router = useRouter();
const toast = useToastStore();
const pinsStore = useConversationPinsStore();

const conversationId = computed(() => String(route.params.conversationId || ""));

const loading = computed(() => pinsStore.loading);
const error = computed(() => pinsStore.error);
const pins = computed(() => pinsStore.getPins(conversationId.value));

async function load() {
  if (!conversationId.value) return;
  await pinsStore.refresh(conversationId.value, { size: 50 });
}

onMounted(load);

// ===== actions modal =====
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

    // ✅ 낙관적으로 즉시 제거 (SSE로도 제거될 것)
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
      <div class="title">📌 Pinned 전체</div>
      <RlButton size="sm" variant="soft" @click="load" :loading="loading">새로고침</RlButton>
    </div>

    <div v-if="error" class="state err">{{ error }}</div>
    <div v-else-if="loading && !pins.length" class="state">불러오는 중…</div>

    <div v-else class="list">
      <div v-if="!pins.length" class="empty">
        ACTIVE 핀이 없어요.
      </div>

      <div v-for="p in pins" :key="p.pinId" class="card">
        <div class="rowTop">
          <div class="name">{{ p.title || "약속" }}</div>

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
  margin-bottom:14px;
}
.title{font-weight:950;text-align:center}
.state{text-align:center;color:var(--muted);padding:18px 0}
.state.err{color:color-mix(in oklab,var(--danger) 80%,white)}

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
.v{color:var(--text);font-weight:900}
</style>