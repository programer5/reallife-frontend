<script setup>
import RlButton from "@/components/ui/RlButton.vue";

const props = defineProps({
  pendingAction: { type: Object, required: true },
  primed: { type: Boolean, default: false },
  highlight: { type: Boolean, default: false },
  sourceMeta: { type: String, default: "" },
  sourcePreview: { type: String, default: "" },
  canOpenSource: { type: Boolean, default: false },
});

const emit = defineEmits(["quick-send", "prime", "open-source", "close"]);

function pendingKindLabel(kind) {
  if (kind === "PROMISE") return "📅 약속";
  if (kind === "TODO") return "✅ 할일";
  return "📍 장소";
}
</script>

<template>
  <div class="pendingBridge" :class="{ 'pendingBridge--highlight': highlight }">
    <div class="pbHead">
      <div>
        <div class="pbEyebrow">{{ sourceMeta }}</div>
        <div class="pbTitle">댓글에서 가져온 액션</div>
        <div class="pbSub">
          <span class="pbKind">{{ pendingKindLabel(pendingAction.kind) }}</span>
          <span class="pbQuote">“{{ pendingAction.text }}”</span>
        </div>
      </div>
      <span v-if="primed" class="pbReady">입력 준비됨</span>
    </div>
    <div v-if="sourcePreview" class="pbSourcePreview">원문: {{ sourcePreview }}</div>
    <div class="pbHint">바로 보내면 이 대화의 ✨ 제안 Dock으로 이어집니다.</div>
    <div class="pbActions">
      <RlButton size="sm" variant="primary" @click="emit('quick-send')">바로 보내고 제안 열기</RlButton>
      <RlButton size="sm" variant="soft" @click="emit('prime')">입력창에 넣기</RlButton>
      <RlButton v-if="canOpenSource" size="sm" variant="soft" @click="emit('open-source')">원문 보기</RlButton>
      <RlButton size="sm" variant="ghost" @click="emit('close')">닫기</RlButton>
    </div>
  </div>
</template>

<style scoped>
.pendingBridge{
  margin: 0 0 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
  background: color-mix(in oklab, var(--card) 70%, transparent);
  box-shadow: 0 8px 18px rgba(0,0,0,0.10);
}
.pendingBridge--highlight{
  box-shadow: 0 12px 28px rgba(86, 180, 255, 0.18);
  border-color: color-mix(in oklab, var(--accent) 50%, var(--border));
}
.pbHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.pbEyebrow{font-size:11px;font-weight:800;letter-spacing:.02em;color:color-mix(in oklab, var(--accent) 74%, white)}
.pbTitle{margin-top:3px;font-weight:800;font-size:13px;letter-spacing:-0.2px}
.pbSub{margin-top:4px;display:flex;gap:8px;align-items:center;color:color-mix(in oklab, var(--text) 90%, transparent);font-size:12px;min-width:0}
.pbKind{font-weight:800;flex:none}
.pbQuote{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.pbReady{display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:999px;border:1px solid color-mix(in oklab, var(--accent) 48%, transparent);background:color-mix(in oklab, var(--accent) 14%, transparent);font-size:11px;font-weight:900;color:color-mix(in oklab, var(--accent) 82%, white)}
.pbSourcePreview{margin-top:7px;font-size:12px;line-height:1.45;color:color-mix(in oklab, var(--text) 72%, transparent)}
.pbHint{margin-top:8px;font-size:12px;color:color-mix(in oklab, var(--text) 72%, transparent)}
.pbActions{margin-top:8px;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
@media (max-width: 640px){
  .pbHead{flex-direction:column}
  .pbActions{justify-content:flex-start}
}
</style>
