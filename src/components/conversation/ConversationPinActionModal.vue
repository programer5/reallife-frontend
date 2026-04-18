<script setup>
import RlButton from "@/components/ui/RlButton.vue";
import RlModal from "@/components/ui/RlModal.vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: "" },
  subtitle: { type: String, default: "" },
  pin: { type: Object, default: null },
  timeText: { type: String, default: "미정" },
  confirmVariant: { type: String, default: "primary" },
  confirmText: { type: String, default: "✓" },
  loading: { type: Boolean, default: false },
});

const emit = defineEmits(["close", "confirm"]);
</script>

<template>
  <RlModal
    :open="open"
    :title="title"
    :subtitle="subtitle"
    :blockClose="loading"
    :closeOnBackdrop="!loading"
    @close="emit('close')"
  >
    <div class="pinModalBody">
      <div class="pinModalLine">
        <span class="k">제목</span>
        <span class="v">{{ pin?.title || "약속" }}</span>
      </div>
      <div class="pinModalLine">
        <span class="k">📍 장소</span>
        <span class="v">{{ pin?.placeText || "미정" }}</span>
      </div>
      <div class="pinModalLine">
        <span class="k">시간</span>
        <span class="v">{{ timeText }}</span>
      </div>
    </div>

    <template #actions>
      <RlButton block :variant="confirmVariant" :loading="loading" @click="emit('confirm')">
        {{ confirmText }}
      </RlButton>
      <RlButton block variant="ghost" :disabled="loading" @click="emit('close')">✕</RlButton>
    </template>
  </RlModal>
</template>

<style scoped>
.pinModalBody{display:grid;gap:10px;padding:4px 0 2px}
.pinModalLine{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--border);border-radius:14px;background:color-mix(in oklab,var(--surface) 88%, transparent)}
.k{font-size:12px;font-weight:900;color:var(--muted);white-space:nowrap}
.v{font-size:13px;font-weight:800;color:var(--text);text-align:right;min-width:0}
@media (max-width: 640px){
  .pinModalBody{gap:8px}
  .pinModalLine{padding:8px 10px;border-radius:12px}
}
</style>
