<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import RlButton from "@/components/ui/RlButton.vue";

const props = defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  highlightCapsuleId: { type: [String, Number], default: "" },
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

function isHighlighted(item) {
  return String(props.highlightCapsuleId || "") === String(item?.capsuleId || "");
}
</script>

<template>
  <section class="capsulePanel rl-cardish" :class="{ mobile: isMobile }">
    <template v-if="isMobile">
      <div class="capsuleMobileBar">
        <button class="capsuleMobileSummary" type="button" @click="openList">
          <span class="capsuleMobileLabel">⏳ 타임 캡슐</span>
          <span class="capsuleMobileCounts">열린 {{ openedItems.length }} · 대기 {{ lockedItems.length }}</span>
          <span class="capsuleMobileTitle">{{ latestItem?.title || "캡슐 보기" }}</span>
        </button>
        <div class="capsuleMobileActions">
          <RlButton size="sm" variant="ghost" @click="$emit('refresh')" :disabled="loading">
            {{ loading ? "…" : "↻" }}
          </RlButton>
          <RlButton size="sm" variant="soft" @click="openList">보기</RlButton>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="capsuleTopline">
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
            {{ expanded ? "접기" : "펼치기" }}
          </RlButton>
        </div>
      </div>

      <div class="capsuleHint">캡슐은 입력창의 ⏳ 버튼으로 만들고, 열리면 바로 액션으로 이어갈 수 있어요.</div>

      <div class="capsuleBody">
        <div v-if="loading && !items.length" class="state">캡슐 목록을 불러오는 중…</div>
        <div v-else-if="!items.length" class="state">아직 타임 캡슐이 없어요.</div>
        <div v-else class="capsuleList" :class="{ compact: !expanded }">
          <article v-for="item in visibleItems" :key="item.capsuleId" class="capsuleCard" :class="{ highlight: isHighlighted(item) }" :data-capsule-id="String(item.capsuleId || '')" :data-opened="item.opened">
            <div class="capsuleRow">
              <div class="capsuleCardTitle">{{ item.title || "제목 없는 캡슐" }}</div>
              <span class="capsuleState">{{ item.opened ? '열림' : '잠금' }}</span>
            </div>
            <div class="capsuleMeta">열릴 시간 · {{ fmt(item.unlockAt) }}</div>
            <div v-if="item.openedAt" class="capsuleMeta">열린 시간 · {{ fmt(item.openedAt) }}</div>
            <div class="capsuleActions">
              <span v-if="isHighlighted(item)" class="searchHitBadge">검색 결과</span>
              <RlButton size="sm" variant="soft" @click="selected=item">상세 보기</RlButton>
              <RlButton v-if="item.opened" size="sm" variant="primary" @click="selected=item">액션 제안</RlButton>
              <RlButton v-if="item.opened" size="sm" variant="soft" @click="requestShare(item)">피드 공유</RlButton>
              <RlButton size="sm" variant="ghost" @click="requestDelete(item)">삭제</RlButton>
            </div>
          </article>
        </div>
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
              <article v-for="item in items" :key="item.capsuleId" class="capsuleCard" :class="{ highlight: isHighlighted(item) }" :data-capsule-id="String(item.capsuleId || '')" :data-opened="item.opened">
                <div class="capsuleRow">
                  <div class="capsuleCardTitle">{{ item.title || "제목 없는 캡슐" }}</div>
                  <span class="capsuleState">{{ item.opened ? '열림' : '잠금' }}</span>
                </div>
                <div class="capsuleMeta">열릴 시간 · {{ fmt(item.unlockAt) }}</div>
                <div v-if="item.openedAt" class="capsuleMeta">열린 시간 · {{ fmt(item.openedAt) }}</div>
                <div class="capsuleActions">
                  <span v-if="isHighlighted(item)" class="searchHitBadge">검색 결과</span>
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
.capsulePanel.mobile{gap:0;padding:4px 6px}
.capsuleTopline{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center}
.capsuleHeadMain{display:grid;gap:4px;min-width:0}
.capsuleEyebrow{font-size:11px;font-weight:900;letter-spacing:.08em;color:var(--muted)}
.capsuleTitle{font-size:16px;font-weight:950}
.capsuleQuick{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.summaryPill{display:inline-flex;align-items:center;gap:8px;padding:7px 10px;border-radius:999px;border:1px solid color-mix(in oklab,var(--border) 82%, transparent);background:color-mix(in oklab,var(--surface) 82%, transparent)}
.summaryPill strong{font-size:13px}.summaryPill span{font-size:12px;color:var(--muted)}
.capsuleHeadActions{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap}
.capsuleHint{font-size:12px;color:var(--muted)}
.capsuleBody,.mobileSheetBody{display:grid;gap:10px}
.state{padding:16px;border:1px dashed color-mix(in oklab,var(--border) 80%, transparent);border-radius:16px;text-align:center;color:var(--muted)}
.capsuleList{display:grid;gap:10px}.capsuleList.compact .capsuleCard:not(:first-child){display:none}
.capsuleCard{display:grid;gap:8px;padding:12px;border-radius:18px;border:1px solid color-mix(in oklab,var(--border) 82%, transparent);background:color-mix(in oklab,var(--surface) 88%, transparent);scroll-margin-top:132px}
.capsuleCard[data-opened="true"]{border-color:color-mix(in oklab,var(--brand) 40%, var(--border));box-shadow:0 10px 28px rgba(59,130,246,.12)}
.capsuleCard.highlight{border-color:rgba(255,210,102,.62);box-shadow:0 0 0 1px rgba(255,210,102,.26),0 0 0 7px rgba(255,210,102,.10),0 10px 28px rgba(255,199,82,.10)}
.capsuleRow{display:flex;align-items:center;justify-content:space-between;gap:10px}.capsuleCardTitle{font-weight:800}.capsuleState{font-size:12px;color:var(--muted)}
.capsuleMeta{font-size:12px;color:var(--muted)}
.capsuleActions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.searchHitBadge{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;background:rgba(255,214,102,.16);border:1px solid rgba(255,214,102,.28);font-size:12px;font-weight:900;color:#ffd666}
.capsuleMobileBar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:center}
.capsuleMobileSummary{min-width:0;border:1px solid color-mix(in oklab,var(--border) 74%, transparent);background:color-mix(in oklab,var(--surface) 84%, transparent);border-radius:12px;padding:7px 10px;display:grid;grid-template-columns:auto auto 1fr;gap:8px;align-items:center;text-align:left}
.capsuleMobileHead,.capsuleMobileBody{display:none}
.capsuleMobileLabel{font-size:11px;font-weight:900;color:var(--text);white-space:nowrap}
.capsuleMobileCounts,.capsuleMobileHint{font-size:10px;color:var(--muted);white-space:nowrap}
.capsuleMobileTitle{font-size:12px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)}
.capsuleMobileActions{display:flex;gap:6px;align-items:center}
.overlay{position:fixed;inset:0;z-index:var(--z-sheet);background:rgba(4,8,18,.52);backdrop-filter:blur(8px);display:grid;place-items:end center;padding:18px}
.mobileSheet,.sheet{width:min(720px,100%);background:linear-gradient(180deg,color-mix(in oklab,var(--surface) 95%, transparent),color-mix(in oklab,var(--surface-2) 92%, transparent));border:1px solid color-mix(in oklab,var(--border) 86%, transparent);border-radius:24px;padding:18px;display:grid;gap:12px}
.mobileSheet{max-height:min(78vh,760px)}
.mobileSheetBody{overflow:auto;padding-right:2px}
.sheetHead{display:flex;align-items:center;justify-content:space-between;gap:12px}.sheetEyebrow{font-size:11px;font-weight:900;letter-spacing:.08em;color:var(--muted)}.sheetTitle{font-size:18px;font-weight:900}.sheetMeta{font-size:13px;color:var(--muted)}
.relayBox{display:grid;gap:10px;padding:12px;border-radius:16px;background:color-mix(in oklab,var(--surface) 86%, transparent);border:1px solid color-mix(in oklab,var(--border) 80%, transparent)}
.relayTitle{font-weight:800}.relayActions,.sheetFoot{display:flex;gap:8px;flex-wrap:wrap}
@media (max-width:720px){
  .capsuleMobileBar{grid-template-columns:minmax(0,1fr) auto}
  .capsuleMobileSummary{padding:7px 9px}
  .capsuleMobileLabel{font-size:10px}
  .capsuleMobileCounts,.capsuleMobileHint{font-size:9px}
  .capsuleMobileTitle{font-size:12px}
  .mobileSheet,.sheet{padding:16px 14px calc(14px + env(safe-area-inset-bottom));border-radius:22px}
}
</style>

<style scoped>
@media (max-width:720px){
  .capsuleMobileActions :deep(button){min-width:40px;height:38px;padding-inline:10px;border-radius:12px}
}
</style>
