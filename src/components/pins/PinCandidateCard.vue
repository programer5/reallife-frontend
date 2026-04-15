<!-- src/components/pins/PinCandidateCard.vue -->
<script setup>
import { computed, ref, watch, nextTick } from "vue";
import RlButton from "@/components/ui/RlButton.vue";
import RlModal from "@/components/ui/RlModal.vue";

const props = defineProps({
  candidate: { type: Object, required: true },
  busy: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
});

const emit = defineEmits(["confirm", "dismiss"]);

function fmt(dt) {
  if (!dt) return "";
  const s = String(dt).replace("T", " ");
  return s.length >= 16 ? s.slice(0, 16) : s;
}

function toLocalInput(dt) {
  if (!dt) return "";
  const s = String(dt);
  if (s.includes("T")) return s.slice(0, 16);
  if (s.length >= 16) return s.slice(0, 10) + "T" + s.slice(11, 16);
  return "";
}

function fromLocalInput(v) {
  if (!v) return null;
  if (v.length === 16) return `${v}:00`;
  return v;
}

/* =========================
 * 타입 감지 / UI 톤
 * ========================= */
function inferCandidateKind(candidate) {
  const title = String(candidate?.title || "");
  const place = String(candidate?.placeText || "");
  const rawType = String(candidate?.type || candidate?.kind || "").toUpperCase();

  if (["PLACE", "LOCATION"].includes(rawType)) return "place";
  if (["TODO", "TASK"].includes(rawType)) return "todo";
  if (["PROMISE", "APPOINTMENT", "MEETING"].includes(rawType)) return "promise";

  if (place) return "place";
  if (/(할일|해야|작업|업무|정리|구매|체크|예약|준비|제출)/.test(title)) return "todo";
  if (/(장소|카페|식당|공원|역|출구|성수|방문)/.test(title)) return "place";
  return "promise";
}

const candidateKind = computed(() => inferCandidateKind(props.candidate));

const kindLabel = computed(() => {
  if (candidateKind.value === "todo") return "할일";
  if (candidateKind.value === "place") return "장소";
  return "약속";
});

const kindIcon = computed(() => {
  if (candidateKind.value === "todo") return "☑";
  if (candidateKind.value === "place") return "📍";
  return "📅";
});

const followupCopy = computed(() => {
  if (candidateKind.value === "todo") {
    return "저장하면 해야 할 일 흐름으로 이어지고, 대화에서 완료까지 관리할 수 있어요.";
  }
  if (candidateKind.value === "place") {
    return "저장하면 장소 메모로 이어지고, 대화에서 약속 장소로 자연스럽게 연결할 수 있어요.";
  }
  return "저장하면 약속 카드로 이어지고, 대화에서 시간·장소·완료 흐름까지 이어갈 수 있어요.";
});

/* =========================
 * Remind UX 개선 (칩 + 기억 + 없음)
 * ========================= */
const REMIND_KEY = "rl:lastRemindMinutes";

const REMIND_OPTIONS = [
  { label: "없음", value: 0 },
  { label: "5분 전", value: 5 },
  { label: "10분 전", value: 10 },
  { label: "30분 전", value: 30 },
  { label: "1시간 전", value: 60 },
];

const REMIND_QUICK = [
  { label: "없음", value: 0 },
  { label: "10분", value: 10 },
  { label: "30분", value: 30 },
];

function readLastRemind() {
  const v = Number(localStorage.getItem(REMIND_KEY));
  return Number.isFinite(v) ? v : null;
}
function writeLastRemind(v) {
  localStorage.setItem(REMIND_KEY, String(v));
}

function smartDefaultRemind(startAt) {
  try {
    const s = startAt ? Date.parse(startAt) : NaN;
    if (!Number.isFinite(s)) return 30;
    const diffMin = Math.max(0, Math.round((s - Date.now()) / 60000));

    if (diffMin <= 30) return 10;
    if (diffMin <= 90) return 30;
    return 60;
  } catch {
    return 30;
  }
}

function guessFromCandidate(candidate) {
  try {
    const s = candidate?.startAt ? Date.parse(candidate.startAt) : NaN;
    const r = candidate?.remindAt ? Date.parse(candidate.remindAt) : NaN;
    if (!Number.isFinite(s) || !Number.isFinite(r)) return null;

    const mins = Math.round((s - r) / 60000);
    return [0, 5, 10, 30, 60].includes(mins) ? mins : null;
  } catch {
    return null;
  }
}

const remindMinutes = ref(30);

watch(
    () => props.candidate,
    (c) => {
      const last = readLastRemind();
      const guessed = guessFromCandidate(c);
      const smart = smartDefaultRemind(c?.startAt);

      const next =
          last !== null && [0, 5, 10, 30, 60].includes(last)
              ? last
              : guessed !== null
                  ? guessed
                  : smart;

      remindMinutes.value = next;
    },
    { immediate: true }
);

watch(
    () => remindMinutes.value,
    (v) => {
      if ([0, 5, 10, 30, 60].includes(v)) writeLastRemind(v);
    }
);

const remindLabel = computed(() => {
  const opt = REMIND_OPTIONS.find((o) => o.value === remindMinutes.value);
  return opt?.label || "30분 전";
});

const overrideRemindMinutesToSend = computed(() => {
  return [0, 5, 10, 30, 60].includes(remindMinutes.value) ? remindMinutes.value : 30;
});

/* =========================
 * Edit Modal
 * ========================= */
const editOpen = ref(false);

const title = ref("");
const placeText = ref("");
const startAtLocal = ref("");

const canSave = computed(() => true);

function openEdit() {
  title.value = props.candidate?.title || "";
  placeText.value = props.candidate?.placeText || "";
  startAtLocal.value = toLocalInput(props.candidate?.startAt || "");
  editOpen.value = true;
}

function closeEdit() {
  if (props.busy) return;
  editOpen.value = false;
}

function confirmDefault() {
  emit("confirm", {
    candidateId: props.candidate?.candidateId,
    overrideTitle: null,
    overridePlaceText: null,
    overrideStartAt: null,
    overrideRemindMinutes: overrideRemindMinutesToSend.value,
  });
}

async function confirmEdited() {
  const el = document.activeElement;
  if (el && typeof el.blur === "function") el.blur();
  await nextTick();

  emit("confirm", {
    candidateId: props.candidate?.candidateId,
    overrideTitle: title.value.trim() ? title.value.trim() : null,
    overridePlaceText: placeText.value.trim() ? placeText.value.trim() : null,
    overrideStartAt: fromLocalInput(startAtLocal.value),
    overrideRemindMinutes: overrideRemindMinutesToSend.value,
  });

  editOpen.value = false;
}

watch(
    () => props.busy,
    (b) => {
      if (b) return;
    }
);
</script>

<template>
  <div class="wrap" :data-kind="candidateKind" :data-compact="props.compact ? 'true' : 'false'">
    <div class="top">
      <div class="titleRow">
        <div class="titleWrap">
          <span class="typeIcon" :data-kind="candidateKind">{{ kindIcon }}</span>
          <div class="title">{{ candidate?.title || "약속" }}</div>
        </div>
        <span class="kindPill" :data-kind="candidateKind">{{ kindLabel }}</span>
      </div>

      <div class="meta">
        <span v-if="candidate?.startAt">🕒 {{ fmt(candidate.startAt) }}</span>
        <span v-if="candidate?.placeText">📍 {{ candidate.placeText }}</span>
        <span v-if="!candidate?.startAt && !candidate?.placeText" class="muted">
          (세부 정보 없음)
        </span>
      </div>

      <div v-if="!props.compact" class="followupHint">{{ followupCopy }}</div>
    </div>

    <div class="remindSlim">
      <span class="remindSlimLabel">리마인드</span>

      <div class="remindQuick">
        <button
            v-for="o in REMIND_QUICK"
            :key="o.value"
            type="button"
            class="chip"
            :class="{ on: remindMinutes === o.value }"
            :disabled="busy"
            @click="remindMinutes = o.value"
        >
          {{ o.label }}
        </button>

        <button class="chip more" type="button" :disabled="busy" @click="openEdit">
          {{ props.compact ? "편집" : "더보기" }}
        </button>
      </div>
    </div>

    <div class="actionsSlim" :class="{ 'actionsSlim--compact': props.compact }">
      <RlButton size="sm" variant="soft" :loading="busy" @click="confirmDefault">
        저장
      </RlButton>

      <RlButton size="sm" variant="ghost" :disabled="busy" @click="openEdit">
        수정…
      </RlButton>

      <RlButton size="sm" variant="ghost" :disabled="busy" @click="emit('dismiss', candidate)">
        무시
      </RlButton>
    </div>

    <RlModal
        :open="editOpen"
        title="📌 핀 저장 전 수정"
        subtitle="제목/시간/장소를 수정한 뒤 저장할 수 있어요."
        :blockClose="busy"
        :closeOnBackdrop="!busy"
        @close="closeEdit"
    >
      <div class="editBody">
        <label class="field">
          <div class="label">제목</div>
          <input
              v-model="title"
              class="input"
              placeholder="예: 홍대에서 저녁 약속"
              :disabled="busy"
          />
        </label>

        <label class="field">
          <div class="label">시간</div>
          <input
              v-model="startAtLocal"
              class="input"
              type="datetime-local"
              :disabled="busy"
          />
        </label>

        <label class="field">
          <div class="label">장소</div>
          <input
              v-model="placeText"
              class="input"
              placeholder="예: 홍대입구 3번 출구"
              :disabled="busy"
          />
        </label>

        <div class="remindRow">
          <div class="remindLabel">리마인드</div>
          <div class="remindChips">
            <button
                v-for="o in REMIND_OPTIONS"
                :key="o.value"
                type="button"
                class="chip"
                :class="{ on: remindMinutes === o.value }"
                :disabled="busy"
                @click="remindMinutes = o.value"
            >
              {{ o.label }}
            </button>
          </div>
        </div>
      </div>

      <template #actions>
        <RlButton block variant="soft" :loading="busy" :disabled="!canSave" @click="confirmEdited">
          수정 내용으로 저장 · {{ remindLabel }}
        </RlButton>
        <RlButton block variant="ghost" :disabled="busy" @click="closeEdit">
          닫기
        </RlButton>
      </template>
    </RlModal>
  </div>
</template>

<style scoped>
.wrap{
  margin-top: 8px;
  padding: 12px 12px 11px;
  border-radius: 16px;
  border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
  background: color-mix(in oklab, var(--surface) 86%, transparent);
  box-shadow: 0 1px 0 rgba(255,255,255,.06) inset;
  backdrop-filter: blur(10px);
  color: var(--text);
}

.wrap[data-kind="promise"]{
  border-color: color-mix(in oklab, #6e9cff 28%, var(--border));
  box-shadow: 0 1px 0 rgba(255,255,255,.06) inset, 0 0 0 1px rgba(110,156,255,.04);
}
.wrap[data-kind="todo"]{
  border-color: color-mix(in oklab, #ffd466 28%, var(--border));
  box-shadow: 0 1px 0 rgba(255,255,255,.06) inset, 0 0 0 1px rgba(255,212,102,.04);
}
.wrap[data-kind="place"]{
  border-color: color-mix(in oklab, #4dd0a4 28%, var(--border));
  box-shadow: 0 1px 0 rgba(255,255,255,.06) inset, 0 0 0 1px rgba(77,208,164,.04);
}

.top{
  display:flex;
  flex-direction:column;
  gap:6px;
}

.wrap[data-compact="true"]{
  margin-top: 6px;
  padding: 10px 10px 9px;
  border-radius: 14px;
  backdrop-filter: blur(8px);
}

.wrap[data-compact="true"] .top{gap:5px}
.wrap[data-compact="true"] .titleRow{gap:8px}
.wrap[data-compact="true"] .titleWrap{gap:7px}
.wrap[data-compact="true"] .typeIcon{width:22px;height:22px;font-size:11px}
.wrap[data-compact="true"] .title{font-size:12px;line-height:1.32}
.wrap[data-compact="true"] .kindPill{min-height:22px;padding:0 8px;font-size:10px}
.wrap[data-compact="true"] .meta{gap:8px;font-size:11px}
.wrap[data-compact="true"] .remindSlim{margin-top:2px}
.wrap[data-compact="true"] .remindSlimLabel{font-size:10px;letter-spacing:.12em}
.wrap[data-compact="true"] .remindQuick{gap:6px}
.wrap[data-compact="true"] .chip{padding:6px 9px;font-size:11px}
.wrap[data-compact="true"] .actionsSlim{margin-top:2px;gap:6px}
.wrap[data-compact="true"] .actionsSlim :deep(button){min-height:28px}
.wrap[data-compact="true"] .actionsSlim :deep(.rl-btn){min-height:28px;padding:0 10px;border-radius:12px;font-size:11px}


.titleRow{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:10px;
  flex-wrap:wrap;
}

.titleWrap{
  display:flex;
  align-items:center;
  gap:8px;
  min-width:0;
}

.typeIcon{
  width:24px;
  height:24px;
  border-radius:999px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  font-size:12px;
  border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.04);
  flex:0 0 auto;
}
.typeIcon[data-kind="promise"]{
  border-color: rgba(110,156,255,.28);
  background: rgba(82,127,255,.16);
}
.typeIcon[data-kind="todo"]{
  border-color: rgba(255,212,102,.26);
  background: rgba(255,212,102,.14);
}
.typeIcon[data-kind="place"]{
  border-color: rgba(77,208,164,.26);
  background: rgba(77,208,164,.14);
}

.title{
  font-weight: 950;
  font-size: 13px;
  color: var(--text);
  line-height: 1.35;
  word-break: break-word;
}

.kindPill{
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.04);
  font-size: 11px;
  font-weight: 900;
  flex:0 0 auto;
}
.kindPill[data-kind="promise"]{
  border-color: rgba(110,156,255,.28);
  background: rgba(82,127,255,.16);
  color: #cfe0ff;
}
.kindPill[data-kind="todo"]{
  border-color: rgba(255,212,102,.26);
  background: rgba(255,212,102,.14);
  color: #ffe8a3;
}
.kindPill[data-kind="place"]{
  border-color: rgba(77,208,164,.26);
  background: rgba(77,208,164,.14);
  color: #c9f7e9;
}

.meta{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  font-size: 12px;
  color: color-mix(in oklab, var(--text) 82%, var(--muted));
}
.muted{ opacity: .65; }

.followupHint{
  font-size: 12px;
  line-height: 1.5;
  color: color-mix(in oklab, var(--text) 76%, var(--muted));
}

.actions{
  margin-top: 10px;
  display:flex;
  gap:8px;
  flex-wrap: wrap;
}

.remindRow{
  padding: 8px 0 2px;
  display:flex;
  flex-direction:column;
  gap:8px;
}
.remindLabel{
  font-size:12px;
  font-weight: 900;
  color: var(--muted);
}
.remindChips{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
}
.chip{
  border:1px solid rgba(255,255,255,.12);
  background:transparent;
  padding:8px 10px;
  border-radius:999px;
  font-size:12px;
  color: var(--text);
  white-space: nowrap;
}
.chip.on{
  border-color: rgba(255,255,255,.28);
}
.chip:disabled{
  opacity:.5;
}

.editBody{
  padding: 8px 0 2px;
  display:flex;
  flex-direction:column;
  gap:10px;
}
.field{
  display:flex;
  flex-direction:column;
  gap:6px;
}
.label{
  font-size: 12px;
  font-weight: 900;
  color: var(--muted);
}
.input{
  width: 100%;
  height: 44px;
  border-radius: 16px;
  border: 1px solid color-mix(in oklab, var(--border) 85%, transparent);
  background: color-mix(in oklab, var(--surface) 92%, transparent);
  color: var(--text);
  padding: 0 12px;
  outline: none;
}
.input:focus{
  border-color: color-mix(in oklab, var(--accent) 60%, var(--border));
}

.remindSlim{
  margin-top: 10px;
  display:flex;
  align-items:flex-start;
  justify-content: space-between;
  gap: 10px;
}

.remindSlimLabel{
  font-size: 12px;
  font-weight: 900;
  color: var(--muted);
  white-space: nowrap;
  padding-top: 8px;
}

.remindQuick{
  display:flex;
  gap: 8px;
  overflow-x:auto;
  flex-wrap:nowrap;
  justify-content:flex-end;
  padding-bottom:2px;
  scrollbar-width:none;
  -ms-overflow-style:none;
}
.remindQuick::-webkit-scrollbar{
  display:none;
}

.chip.more{
  opacity: .85;
}

.actionsSlim{
  margin-top: 12px;
  display:flex;
  align-items:center;
  gap: 8px;
  flex-wrap: wrap;
}

.dismissLink{
  margin-left: auto;
  border: none;
  background: transparent;
  color: color-mix(in oklab, var(--text) 70%, var(--muted));
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  opacity: .8;
}
.dismissLink:hover{
  opacity: 1;
  text-decoration: underline;
}
.dismissLink:disabled{
  opacity: .4;
  cursor: not-allowed;
}

@media (max-width: 640px){
  .titleRow{
    align-items:flex-start;
  }

  .remindSlim{
    flex-direction:column;
    align-items:stretch;
  }

  .remindSlimLabel{
    padding-top:0;
  }

  .actionsSlim{
    align-items:center;
  }

  .dismissLink{
    margin-left:0;
  }
}
</style>