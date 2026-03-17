<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import RlButton from "@/components/ui/RlButton.vue";

const props = defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
});
const emit = defineEmits(["refresh", "relay", "delete", "share"]);

const expanded = ref(false);
const selected = ref(null);
const mobileSheetOpen = ref(false);
const isMobile = ref(false);

const openedItems = computed(() => (props.items || []).filter((x) => x?.opened));
const lockedItems = computed(() => (props.items || []).filter((x) => !x?.opened));
const latestItem = computed(() => (props.items || [])[0] || null);
const visibleItems = computed(() => expanded.value ? (props.items || []).slice(0, 4) : (props.items || []).slice(0, 1));

function syncMobile() {
  if (typeof window === "undefined") return;
  isMobile.value = window.innerWidth <= 720;
  if (!isMobile.value) mobileSheetOpen.value = false;
}

onMounted(() => {
  syncMobile();
  window.addEventListener("resize", syncMobile, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", syncMobile);
});

function fmt(v) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

function suggest(kind) {
  if (!selected.value) return;
  emit("relay", {
    kind,
    text: selected.value.title || "열린 캡슐에서 이어진 액션",
    sourceLabel: "타임 캡슐",
    sourcePostPreview: selected.value.title || "",
    sourceRoute: "",
  });
  selected.value = null;
  mobileSheetOpen.value = false;
}

function openList() {
  if (isMobile.value) {
    mobileSheetOpen.value = true;
    return;
  }
  expanded.value = !expanded.value;
}

function closeList() {
  mobileSheetOpen.value = false;
}

function requestDelete(item) {
  if (!item?.capsuleId) return;
  emit("delete", item);
  selected.value = null;
}

function requestShare(item) {
  if (!item) return;
  emit("share", item);
  selected.value = null;
  mobileSheetOpen.value = false;
}
</script>

<template>
  <section class="capsulePanel rl-cardish" :class="{ mobile: isMobile }">
    <div class="capsuleTopline" :class="{ compact: isMobile }">
      <div class="capsuleHeadMain">
        <div class="capsuleEyebrow">TIME CAPSULE</div>
        <div class="capsuleTitle">이 대화의 타임 캡슐</div>
      </div>

      <div class="capsuleQuick">
        <span class="summaryPill"><strong>{{ openedItems.length }}</strong><span>열린 캡슐</span></span>
        <span class="summaryPill"><strong>{{ lockedItems.length }}</strong><span>대기 중</span></span>
      </div>

      <div class="capsuleHeadActions">
        <RlButton size="sm" variant="soft" @click="$emit('refresh')" :disabled="loading">
          {{ loading ? "새로고침 중…" : "새로고침" }}
        </RlButton>
        <RlButton size="sm" variant="ghost" @click="openList">
          {{ isMobile ? "보기" : (expanded ? "접기" : "펼치기") }}
        </RlButton>
      </div>
    </div>

    <template v-if="!isMobile">
      <div class="capsuleHint">캡슐은 입력창의 ⏳ 버튼으로 만들고, 열리면 바로 액션으로 이어갈 수 있어요.</div>

      <div class="capsuleBody">
        <div v-if="loading && !items.length" class="state">캡슐 목록을 불러오는 중…</div>
        <div v-else-if="!items.length" class="state">아직 타임 캡슐이 없어요.</div>
        <div v-else class="capsuleList" :class="{ compact: !expanded }">
          <article v-for="item in visibleItems" :key="item.capsuleId" class="capsuleCard" :data-opened="item.opened">
            <div class="capsuleRow">
              <div class="capsuleCardTitle">{{ item.title || "제목 없는 캡슐" }}</div>
              <span class="capsuleState">{{ item.opened ? '열림' : '잠금' }}</span>
            </div>
            <div class="capsuleMeta">열릴 시간 · {{ fmt(item.unlockAt) }}</div>
            <div v-if="item.openedAt" class="capsuleMeta">열린 시간 · {{ fmt(item.openedAt) }}</div>
            <div class="capsuleActions">
              <RlButton size="sm" variant="soft" @click="selected=item">상세 보기</RlButton>
              <RlButton v-if="item.opened" size="sm" variant="primary" @click="selected=item">액션 제안</RlButton>
              <RlButton v-if="item.opened" size="sm" variant="soft" @click="requestShare(item)">피드 공유</RlButton>
              <RlButton size="sm" variant="ghost" @click="requestDelete(item)">삭제</RlButton>
            </div>
          </article>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="capsuleCompactState capsuleCompactState--mobile">
        <template v-if="loading && !items.length">
          <span class="capsuleCompactLine">캡슐 목록을 불러오는 중…</span>
        </template>
        <template v-else-if="!items.length">
          <span class="capsuleCompactLine">아직 타임 캡슐이 없어요. ⏳ 버튼으로 바로 만들 수 있어요.</span>
        </template>
        <template v-else>
          <div class="capsuleCompactSummary">
            <span class="capsuleCompactTitle">{{ latestItem?.title || "최근 캡슐" }}</span>
            <span class="capsuleCompactMeta">
              {{ latestItem?.opened ? '열림' : '다음 열림' }} · {{ fmt(latestItem?.opened ? latestItem?.openedAt : latestItem?.unlockAt) }}
            </span>
          </div>
        </template>
      </div>
    </template>

    <Teleport to="body">
      <div v-if="isMobile && mobileSheetOpen" class="overlay" @click.self="closeList">
        <div class="mobileSheet rl-cardish">
          <div class="sheetHead">
            <div>
              <div class="sheetEyebrow">TIME CAPSULE</div>
              <div class="sheetTitle">캡슐 목록</div>
            </div>
            <RlButton size="sm" variant="ghost" @click="closeList">닫기</RlButton>
          </div>

          <div class="capsuleHint">대화 화면은 가리지 않고, 필요할 때만 여기서 캡슐을 확인하는 구조예요.</div>

          <div class="mobileSheetBody">
            <div v-if="loading && !items.length" class="state">캡슐 목록을 불러오는 중…</div>
            <div v-else-if="!items.length" class="state">아직 타임 캡슐이 없어요.</div>
            <div v-else class="capsuleList mobileList">
              <article v-for="item in items" :key="item.capsuleId" class="capsuleCard" :data-opened="item.opened">
                <div class="capsuleRow">
                  <div class="capsuleCardTitle">{{ item.title || "제목 없는 캡슐" }}</div>
                  <span class="capsuleState">{{ item.opened ? '열림' : '잠금' }}</span>
                </div>
                <div class="capsuleMeta">열릴 시간 · {{ fmt(item.unlockAt) }}</div>
                <div v-if="item.openedAt" class="capsuleMeta">열린 시간 · {{ fmt(item.openedAt) }}</div>
                <div class="capsuleActions">
                  <RlButton size="sm" variant="soft" @click="selected=item">상세 보기</RlButton>
                  <RlButton v-if="item.opened" size="sm" variant="primary" @click="selected=item">액션 제안</RlButton>
                  <RlButton v-if="item.opened" size="sm" variant="soft" @click="requestShare(item)">피드 공유</RlButton>
                  <RlButton size="sm" variant="ghost" @click="requestDelete(item)">삭제</RlButton>
                </div>
              </article>
            </div>
          </div>
        </div>
      </div>

      <div v-if="selected" class="overlay" @click.self="selected=null">
        <div class="sheet rl-cardish">
          <div class="sheetEyebrow">CAPSULE DETAIL</div>
          <div class="sheetTitle">{{ selected.title || "제목 없는 캡슐" }}</div>
          <div class="sheetMeta">열릴 시간 · {{ fmt(selected.unlockAt) }}</div>
          <div v-if="selected.openedAt" class="sheetMeta">열린 시간 · {{ fmt(selected.openedAt) }}</div>
          <div v-if="selected.opened" class="relayBox">
            <div class="relayTitle">열린 캡슐에서 바로 액션으로 이어가기</div>
            <div class="relayActions">
              <RlButton size="sm" variant="soft" @click="suggest('PROMISE')">약속 제안</RlButton>
              <RlButton size="sm" variant="soft" @click="suggest('TODO')">할일 제안</RlButton>
              <RlButton size="sm" variant="soft" @click="suggest('PLACE')">장소 제안</RlButton>
            </div>
          </div>
          <div class="sheetFoot">
            <RlButton v-if="selected?.opened" size="sm" variant="soft" @click="requestShare(selected)">피드 공유</RlButton>
            <RlButton size="sm" variant="ghost" @click="requestDelete(selected)">삭제</RlButton>
            <RlButton size="sm" variant="soft" @click="selected=null">닫기</RlButton>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.capsulePanel{margin-top:4px;padding:12px 14px;border-radius:20px;display:grid;gap:10px;background:linear-gradient(180deg,color-mix(in oklab,var(--surface) 88%, transparent),color-mix(in oklab,var(--surface-2) 86%, transparent));border:1px solid color-mix(in oklab,var(--border) 86%, transparent)}
.capsulePanel.mobile{gap:6px;padding:8px 10px}
.capsuleTopline{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center}
.capsuleTopline.compact{grid-template-columns:minmax(0,1fr) auto;row-gap:8px}
.capsuleHeadMain{display:grid;gap:4px;min-width:0}
.capsuleEyebrow{font-size:11px;font-weight:900;letter-spacing:.08em;color:var(--muted)}
.capsuleTitle{font-size:16px;font-weight:950}
.capsuleQuick{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.summaryPill{display:inline-flex;align-items:center;gap:8px;padding:7px 10px;border-radius:999px;border:1px solid color-mix(in oklab,var(--border) 82%, transparent);background:color-mix(in oklab,var(--surface) 82%, transparent)}
.summaryPill strong{font-size:13px}.summaryPill span{font-size:12px;color:var(--muted)}
.capsuleHeadActions{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap}
.capsuleHint{font-size:12px;color:var(--muted)}
.capsuleCompactState{display:grid;gap:2px;padding:8px 10px;border-radius:14px;border:1px solid color-mix(in oklab,var(--border) 80%, transparent);background:color-mix(in oklab,var(--surface) 80%, transparent);font-size:12px;color:var(--muted)}
.capsuleCompactState--mobile{padding:6px 8px;border-radius:12px;font-size:11px}
.capsuleCompactSummary{display:grid;gap:1px;min-width:0}
.capsuleCompactLine{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.capsuleCompactTitle{font-size:13px;font-weight:900;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.capsuleCompactMeta{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.state{padding:10px 8px;text-align:center;color:var(--muted)}
.capsuleList{display:grid;gap:8px;max-height:none;overflow:visible;padding-right:2px}
.capsuleCard{padding:12px;border-radius:16px;border:1px solid color-mix(in oklab,var(--border) 82%, transparent);background:color-mix(in oklab,var(--surface) 82%, transparent)}
.capsuleCard[data-opened="true"]{border-color:color-mix(in oklab,var(--accent) 35%, transparent);background:color-mix(in oklab,var(--accent) 10%, transparent)}
.capsuleRow{display:flex;align-items:center;justify-content:space-between;gap:10px}.capsuleCardTitle{font-size:13px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.capsuleState{font-size:11px;font-weight:900;color:var(--muted)}
.capsuleMeta{margin-top:6px;font-size:12px;color:var(--muted)}.capsuleActions{margin-top:10px;display:flex;gap:8px;flex-wrap:wrap}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(10px);display:grid;place-items:end center;padding:20px;z-index:90}
.mobileSheet{width:min(760px,100%);max-height:min(72dvh,720px);padding:18px;border-radius:24px 24px 18px 18px;display:grid;gap:12px;overflow:hidden}
.mobileSheetBody{overflow:auto;padding-right:2px}
.mobileList{padding-right:0}
.sheet{width:min(560px,100%);padding:18px;border-radius:24px;display:grid;gap:12px;place-self:center}
.sheetHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.sheetEyebrow{font-size:11px;font-weight:900;letter-spacing:.08em;color:var(--muted)}
.sheetTitle{font-size:22px;font-weight:950}.sheetMeta{font-size:13px;color:var(--muted)}
.relayBox{margin-top:8px;padding:14px;border-radius:18px;border:1px solid color-mix(in oklab,var(--accent) 28%, transparent);background:color-mix(in oklab,var(--accent) 10%, transparent)}
.relayTitle{font-size:13px;font-weight:900}.relayActions{margin-top:10px;display:flex;gap:8px;flex-wrap:wrap}.sheetFoot{display:flex;justify-content:flex-end}
@media (max-width:900px){.capsuleTopline{grid-template-columns:1fr}.capsuleHeadActions{justify-content:flex-start}}
@media (max-width:720px){.capsulePanel{padding:8px 10px}.capsuleTopline{grid-template-columns:minmax(0,1fr) auto;gap:8px}.capsuleHeadMain{gap:2px}.capsuleEyebrow{font-size:10px}.capsuleTitle{font-size:14px}.capsuleQuick{grid-column:1 / -1;gap:4px}.summaryPill{padding:5px 7px;gap:6px}.summaryPill strong{font-size:12px}.summaryPill span{font-size:11px}.capsuleHeadActions{gap:6px}.capsuleCompactMeta{font-size:11px}.mobileSheet{padding:16px 14px calc(14px + env(safe-area-inset-bottom))}}
</style>
