<!-- src/components/conversation/ConversationAiAssist.vue -->
<script setup>
import { computed, ref, watch } from "vue";
import { executeConversationAiAction, suggestConversationReplies } from "@/api/conversationAi";

const props = defineProps({
  conversationId: { type: String, default: "" },
  messageId: { type: [String, Number], default: "" },
  sourceText: { type: String, default: "" },
});

const emit = defineEmits(["quick-send", "action-done"]);

const loading = ref(false);
const actionLoading = ref("");
const error = ref("");
const doneMessage = ref("");
const replies = ref([]);
const actions = ref([]);
let timer = null;

const canSuggest = computed(() => !!props.conversationId && !!String(props.sourceText || "").trim());

function normalizeReplyPayload(data) {
  const rawReplies = Array.isArray(data?.replies) ? data.replies : [];
  const rawActions = Array.isArray(data?.actions) ? data.actions : [];
  replies.value = rawReplies.map((v) => String(v || "").trim()).filter(Boolean).slice(0, 3);
  actions.value = rawActions
    .map((a) => ({
      type: String(a?.type || "").trim(),
      label: String(a?.label || "").trim(),
      payload: a?.payload || {},
    }))
    .filter((a) => a.type && a.label)
    .slice(0, 3);
}

async function loadSuggestions() {
  if (!canSuggest.value) {
    replies.value = [];
    actions.value = [];
    error.value = "";
    return;
  }

  loading.value = true;
  error.value = "";
  doneMessage.value = "";
  try {
    const data = await suggestConversationReplies({
      conversationId: props.conversationId,
      messageId: props.messageId || null,
      text: props.sourceText,
    });
    normalizeReplyPayload(data);
  } catch (e) {
    error.value = "추천을 불러오지 못했어요";
    replies.value = ["확인했어", "좋아", "조금 이따 답할게"];
    actions.value = [];
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.conversationId, props.messageId, props.sourceText],
  () => {
    clearTimeout(timer);
    timer = setTimeout(loadSuggestions, 280);
  },
  { immediate: true }
);

async function runAction(action) {
  if (!action?.type || actionLoading.value) return;
  actionLoading.value = action.type;
  error.value = "";
  doneMessage.value = "";
  try {
    const result = await executeConversationAiAction({
      conversationId: props.conversationId,
      messageId: props.messageId || null,
      type: action.type,
      text: props.sourceText,
      payload: action.payload || {},
    });
    const targetUrl = String(result?.targetUrl || "");
    if (targetUrl && !targetUrl.startsWith("/")) {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    }
    doneMessage.value = result?.message || "처리했어요";
    emit("action-done", result);
  } catch (e) {
    error.value = "액션 실행에 실패했어요";
  } finally {
    actionLoading.value = "";
  }
}
</script>

<template>
  <section v-if="canSuggest" class="aiAssist" aria-label="AI 빠른 행동">
    <div class="aiAssist__head">
      <span class="aiAssist__spark">✨</span>
      <span>{{ loading ? "추천 중" : "바로 하기" }}</span>
    </div>

    <div v-if="actions.length" class="aiAssist__row">
      <button
        v-for="action in actions"
        :key="action.type + action.label"
        class="aiChip aiChip--action"
        type="button"
        :disabled="!!actionLoading"
        @click="runAction(action)"
      >
        {{ actionLoading === action.type ? "…" : action.label }}
      </button>
    </div>

    <div v-if="replies.length" class="aiAssist__row">
      <button
        v-for="reply in replies"
        :key="reply"
        class="aiChip"
        type="button"
        @click="emit('quick-send', reply)"
      >
        {{ reply }}
      </button>
    </div>

    <div v-if="doneMessage" class="aiAssist__done">{{ doneMessage }}</div>
    <div v-if="error" class="aiAssist__error">{{ error }}</div>
  </section>
</template>

<style scoped>
.aiAssist{margin:0 0 10px;padding:10px;border-radius:18px;border:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.035));display:grid;gap:8px;box-shadow:0 14px 40px rgba(0,0,0,.18)}
.aiAssist__head{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:950;color:color-mix(in oklab,var(--text) 88%,white)}
.aiAssist__spark{width:22px;height:22px;border-radius:999px;display:grid;place-items:center;background:color-mix(in oklab,var(--accent) 16%,rgba(255,255,255,.06))}
.aiAssist__row{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none}.aiAssist__row::-webkit-scrollbar{display:none}
.aiChip{flex:0 0 auto;min-height:34px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);color:var(--text);font-size:13px;font-weight:900;cursor:pointer;white-space:nowrap;transition:transform .14s ease,background .16s ease,border-color .16s ease}.aiChip:hover{transform:translateY(-1px);border-color:color-mix(in oklab,var(--accent) 26%,rgba(255,255,255,.10));background:color-mix(in oklab,var(--accent) 12%,rgba(255,255,255,.05))}.aiChip--action{background:color-mix(in oklab,var(--accent) 14%,rgba(255,255,255,.05));border-color:color-mix(in oklab,var(--accent) 30%,rgba(255,255,255,.12))}.aiChip:disabled{opacity:.55;cursor:wait;transform:none}.aiAssist__done{font-size:12px;font-weight:850;color:color-mix(in oklab,var(--success) 80%,white)}.aiAssist__error{font-size:12px;color:color-mix(in oklab,var(--danger) 80%,white)}
@media (max-width:640px){.aiAssist{border-radius:16px;padding:9px}.aiChip{min-height:32px;padding:0 11px;font-size:12px}}
</style>
