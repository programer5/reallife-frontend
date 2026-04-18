<script setup>
import RlButton from "@/components/ui/RlButton.vue";
import RlModal from "@/components/ui/RlModal.vue";

defineProps({
  open: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  titleText: { type: String, default: "" },
  startAtLocal: { type: String, default: "" },
  remindMinutes: { type: Number, default: 60 },
  placeText: { type: String, default: "" },
  remindOptions: { type: Array, default: () => [] },
});

const emit = defineEmits([
  "close",
  "save",
  "update:title-text",
  "update:start-at-local",
  "update:remind-minutes",
  "update:place-text",
]);
</script>

<template>
  <RlModal
    :open="open"
    title="✎ 핀 수정"
    :blockClose="loading"
    :closeOnBackdrop="!loading"
    @close="emit('close')"
  >
    <div class="pinEditBody">
      <label class="pinEditField">
        <div class="pinEditLabel">제목</div>
        <input
          class="pinEditInput"
          :value="titleText"
          placeholder="예: 홍대에서 저녁 약속"
          :disabled="loading"
          @input="emit('update:title-text', $event.target.value)"
        />
      </label>

      <label class="pinEditField">
        <div class="pinEditLabel">시간</div>
        <input
          class="pinEditInput"
          :value="startAtLocal"
          type="datetime-local"
          :disabled="loading"
          @input="emit('update:start-at-local', $event.target.value)"
        />
      </label>

      <label class="pinEditField">
        <div class="pinEditLabel">⏰</div>
        <select
          class="pinEditInput"
          :value="remindMinutes"
          :disabled="loading"
          @change="emit('update:remind-minutes', Number($event.target.value))"
        >
          <option v-for="o in remindOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>

      <label class="pinEditField">
        <div class="pinEditLabel">📍</div>
        <input
          class="pinEditInput"
          :value="placeText"
          placeholder="예: 홍대입구 3번출구 / 회사 앞 / ○○ 술집"
          :disabled="loading"
          @input="emit('update:place-text', $event.target.value)"
        />
      </label>
    </div>

    <template #actions>
      <RlButton block variant="primary" :loading="loading" @click="emit('save')">✓</RlButton>
      <RlButton block variant="ghost" :disabled="loading" @click="emit('close')">✕</RlButton>
    </template>
  </RlModal>
</template>

<style scoped>
.pinEditBody{padding:10px 0 2px}
.pinEditField{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
.pinEditLabel{font-size:12px;font-weight:900;color:var(--muted)}
.pinEditInput{width:100%;height:44px;border-radius:14px;border:1px solid var(--border);background:color-mix(in oklab, var(--surface) 86%, transparent);color:var(--text);padding:0 12px}
@media (max-width: 640px){
  .pinEditBody{padding-top:8px}
  .pinEditField{gap:5px;margin-bottom:8px}
  .pinEditInput{height:40px;border-radius:12px;padding:0 10px}
}
</style>
