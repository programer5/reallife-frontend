
<!-- src/components/chat/GroupMemberChip.vue -->
<script setup>
const props = defineProps({
  member: { type: Object, required: true },
  removable: { type: Boolean, default: false },
});
const emit = defineEmits(["remove"]);

function label(member) {
  return member?.nickname || member?.name || member?.handle || "멤버";
}
</script>

<template>
  <div class="chip">
    <span class="name">{{ label(member) }}</span>
    <span v-if="member?.handle" class="handle">@{{ member.handle }}</span>
    <button v-if="removable" type="button" class="remove" @click="emit('remove')">×</button>
  </div>
</template>

<style scoped>
.chip{display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;border:1px solid color-mix(in oklab,var(--accent) 28%, transparent);background:color-mix(in oklab,var(--accent) 10%, transparent);max-width:100%}
.name{font-size:12px;font-weight:900}
.handle{font-size:11px;color:var(--muted)}
.remove{width:22px;height:22px;border-radius:999px;border:none;background:rgba(255,255,255,.08);color:var(--text);cursor:pointer}
</style>
