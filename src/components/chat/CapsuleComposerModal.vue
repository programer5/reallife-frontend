<!-- src/components/chat/CapsuleComposerModal.vue -->
<script setup>
const props = defineProps({
  open: { type: Boolean, default: false },
  titleText: { type: String, default: "" },
  unlockAt: { type: String, default: "" },
  saving: { type: Boolean, default: false },
});
function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
const minUnlockAt = toLocalInputValue(new Date(Date.now() + 60 * 1000));
const emit = defineEmits(["close", "save", "update:title-text", "update:unlock-at"]);
</script>

<template>
  <Teleport to="body">
    <div v-if="props.open" class="overlay" @click.self="emit('close')">
      <div class="sheet rl-cardish">
        <div class="eyebrow">TIME CAPSULE</div>
        <div class="head">나중에 열 메시지로 저장</div>
        <div class="sub">현재 입력한 메시지를 잠가두고, 지정한 시간이 되면 다시 열 수 있게 만들어요.</div>

        <label class="field">
          <span class="label">캡슐 제목</span>
          <input :value="props.titleText" maxlength="120" class="input" @input="emit('update:title-text', $event.target.value)" />
        </label>

        <label class="field">
          <span class="label">열릴 시간</span>
          <input :value="props.unlockAt" :min="minUnlockAt" type="datetime-local" class="input" @input="emit('update:unlock-at', $event.target.value)" />
        </label>

        <div class="actions">
          <button class="btn ghost" type="button" :disabled="props.saving" @click="emit('close')">닫기</button>
          <button class="btn primary" type="button" :disabled="props.saving || !props.unlockAt" @click="emit('save')">
            {{ props.saving ? "저장 중…" : "타임 캡슐 만들기" }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.48);backdrop-filter:blur(10px);display:grid;place-items:center;padding:20px;z-index:var(--z-modal)}
.sheet{width:min(560px,100%);padding:18px;border-radius:24px;display:grid;gap:12px}
.eyebrow{font-size:11px;font-weight:900;color:var(--muted);letter-spacing:.08em}
.head{font-size:22px;font-weight:950}
.sub{font-size:13px;color:var(--muted)}
.field{display:grid;gap:8px}
.label{font-size:12px;font-weight:900;color:var(--muted)}
.input{height:44px;border-radius:14px;border:1px solid var(--border);background:color-mix(in oklab,var(--surface-2) 90%,transparent);padding:0 12px;color:var(--text)}
.actions{display:flex;justify-content:flex-end;gap:8px}
.btn{height:40px;padding:0 14px;border-radius:999px;border:none;font-weight:900;cursor:pointer}
.btn.ghost{background:rgba(255,255,255,.08);color:var(--text)}
.btn.primary{background:var(--accent);color:var(--accent-contrast,#081018)}
</style>
