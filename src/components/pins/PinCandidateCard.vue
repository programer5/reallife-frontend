<!-- src/components/pins/PinCandidateCard.vue -->
<script setup>
import { computed, ref, watch } from "vue";
import RlButton from "@/components/ui/RlButton.vue";
import RlModal from "@/components/ui/RlModal.vue";

const props = defineProps({
  candidate: { type: Object, required: true },
  busy: { type: Boolean, default: false },
});

const emit = defineEmits(["confirm", "dismiss"]);

function fmt(dt) {
  if (!dt) return "";
  const s = String(dt).replace("T", " ");
  return s.length >= 16 ? s.slice(0, 16) : s;
}

function toLocalInput(dt) {
  // "YYYY-MM-DDTHH:mm" 형식으로 맞춤
  if (!dt) return "";
  const s = String(dt);
  if (s.includes("T")) return s.slice(0, 16);
  // "YYYY-MM-DD HH:mm" -> "YYYY-MM-DDTHH:mm"
  if (s.length >= 16) return s.slice(0, 10) + "T" + s.slice(11, 16);
  return "";
}

function fromLocalInput(v) {
  // "YYYY-MM-DDTHH:mm" -> ISO-ish "YYYY-MM-DDTHH:mm:00"
  if (!v) return null;
  if (v.length === 16) return `${v}:00`;
  return v;
}

const editOpen = ref(false);

const title = ref("");
const placeText = ref("");
const startAtLocal = ref("");

const remindMinutes = ref(60);

const REMIND_OPTIONS = [
  { label: "5분 전", value: 5 },
  { label: "10분 전", value: 10 },
  { label: "30분 전", value: 30 },
  { label: "1시간 전", value: 60 },
];

function guessRemindMinutes(candidate) {
  try {
    const s = candidate?.startAt ? Date.parse(candidate.startAt) : NaN;
    const r = candidate?.remindAt ? Date.parse(candidate.remindAt) : NaN;
    const diff = Math.round((s - r) / 60000);
    if ([5, 10, 30, 60].includes(diff)) return diff;
  } catch {}
  return 60;
}

const canSave = computed(() => {
  // 제목은 빈값이면 서버가 기본값 처리하도록 null로 보내도 되지만,
  // UX상 제목은 최소 1자 권장. 다만 강제하진 않음.
  return true;
});

function openEdit() {
  title.value = props.candidate?.title || "";
  placeText.value = props.candidate?.placeText || "";
  startAtLocal.value = toLocalInput(props.candidate?.startAt || "");

  // ✅ NEW: 후보가 가지고 있던 remindAt이 있으면 그걸 기반으로 기본 선택
  remindMinutes.value = guessRemindMinutes(props.candidate);

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
    overrideRemindMinutes: remindMinutes.value, // ✅ NEW
  });
}

function confirmEdited() {
  emit("confirm", {
    candidateId: props.candidate?.candidateId,
    overrideTitle: title.value.trim() ? title.value.trim() : null,
    overridePlaceText: placeText.value.trim() ? placeText.value.trim() : null,
    overrideStartAt: fromLocalInput(startAtLocal.value),
    overrideRemindMinutes: remindMinutes.value, // ✅ NEW
  });
  editOpen.value = false;
}

watch(
    () => props.busy,
    (b) => {
      // 저장 중이면 닫히지 않게 유지
      if (b) return;
    }
);
</script>

<template>
  <div class="wrap">
    <div class="top">
      <div class="title">📌 {{ candidate?.title || "약속" }}</div>

      <div class="meta">
        <span v-if="candidate?.startAt">🕒 {{ fmt(candidate.startAt) }}</span>
        <span v-if="candidate?.placeText">📍 {{ candidate.placeText }}</span>
        <span v-if="!candidate?.startAt && !candidate?.placeText" class="muted">
          (세부 정보 없음)
        </span>
      </div>
    </div>

    <div class="editBody" style="padding: 8px 0 2px;">
      <label class="field">
        <div class="label">리마인드</div>
        <select v-model.number="remindMinutes" class="input">
          <option v-for="o in REMIND_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </select>
      </label>
    </div>

    <div class="actions">
      <RlButton size="sm" variant="soft" :loading="busy" @click="confirmDefault">
        핀으로 저장
      </RlButton>

      <RlButton size="sm" variant="ghost" :disabled="busy" @click="openEdit">
        수정 후 저장
      </RlButton>

      <RlButton size="sm" variant="ghost" :disabled="busy" @click="emit('dismiss', candidate)">
        무시
      </RlButton>
    </div>

    <!-- ✅ 수정 모달 -->
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
      </div>

      <template #actions>
        <RlButton block variant="soft" :loading="busy" :disabled="!canSave" @click="confirmEdited">
          수정 내용으로 저장
        </RlButton>
        <RlButton block variant="ghost" :disabled="busy" @click="closeEdit">
          닫기
        </RlButton>
      </template>
    </RlModal>
  </div>
</template>

<style scoped>
/* ✅ ConversationDetailView premium 톤 유지 */
.wrap{
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 16px;

  border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
  background: color-mix(in oklab, var(--surface) 86%, transparent);

  box-shadow: 0 1px 0 rgba(255,255,255,.06) inset;
  backdrop-filter: blur(10px);
  color: var(--text);
}

.top{ display:flex; flex-direction:column; gap:4px; }

.title{
  font-weight: 950;
  font-size: 13px;
  color: var(--text);
}

.meta{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  font-size: 12px;
  color: color-mix(in oklab, var(--text) 82%, var(--muted));
}
.muted{ opacity: .65; }

.actions{
  margin-top: 10px;
  display:flex;
  gap:8px;
  flex-wrap: wrap;
}

/* modal form */
.editBody{ padding: 8px 0 2px; display:flex; flex-direction:column; gap:10px; }
.field{ display:flex; flex-direction:column; gap:6px; }
.label{ font-size: 12px; font-weight: 900; color: var(--muted); }
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
</style>