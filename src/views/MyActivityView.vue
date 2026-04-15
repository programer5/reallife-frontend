<template>
  <div class="page">
    <section class="hero cardSurface">
      <div class="heroMain">
        <div>
          <div class="eyebrow">MY ACTIVITY</div>
          <h1 class="title">내 활동 보관함</h1>
          <p class="sub">내 액션, 내 캡슐, 내가 공유한 흐름을 한곳에서 다시 정리하고 바로 수정하거나 정리하는 공간이야.</p>
        </div>
        <button class="ghostBtn" type="button" @click="reload">새로고침</button>
      </div>

      <div class="heroStats">
        <div class="statChip">
          <strong>{{ summary.actions }}</strong>
          <span>내 액션</span>
        </div>
        <div class="statChip">
          <strong>{{ summary.capsules }}</strong>
          <span>내 캡슐</span>
        </div>
        <div class="statChip">
          <strong>{{ summary.shares }}</strong>
          <span>내 공유</span>
        </div>
      </div>
    </section>

    <section class="tabs cardSurface">
      <button class="tab" :class="{ on: activeTab === 'actions' }" @click="setTab('actions')">내 액션</button>
      <button class="tab" :class="{ on: activeTab === 'capsules' }" @click="setTab('capsules')">내 캡슐</button>
      <button class="tab" :class="{ on: activeTab === 'shares' }" @click="setTab('shares')">내 공유 목록</button>
    </section>

    <section class="panel cardSurface">
      <div class="panelHead">
        <div>
          <div class="panelTitle">{{ panelTitle }}</div>
          <div class="panelSub">{{ panelSub }}</div>
        </div>
        <ActivityFilterChips v-model="filter" :items="filterItems" />
      </div>

      <div v-if="loading" class="empty">불러오는 중…</div>
      <div v-else-if="!filteredItems.length" class="empty">조건에 맞는 항목이 없어요.</div>

      <div v-else class="list">
        <article v-for="item in filteredItems" :key="item.id" class="activityCard cardSurfaceLite">
          <div class="activityTop">
            <div>
              <div class="activityLabel">{{ item.sectionLabel }}</div>
              <div class="activityTitle">{{ item.title || '제목 없음' }}</div>
            </div>
            <div class="activityBadges">
              <span v-if="item.badge" class="badge">{{ item.badge }}</span>
              <span v-if="item.metaPill" class="metaPill">{{ item.metaPill }}</span>
            </div>
          </div>
          <div v-if="item.meta" class="activityMeta">{{ item.meta }}</div>
          <div v-if="item.sub" class="activitySub">{{ item.sub }}</div>
          <div class="activityFooter">
            <button class="detailBtn" type="button" @click="openItem(item)">상세 / 수정</button>
            <button class="ghostBtn small" type="button" @click="goToOrigin(item)">원본으로 이동</button>
            <button class="ghostBtn small" type="button" @click="duplicateToClipboard(item)">텍스트 복사</button>
          </div>
        </article>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="selected" class="overlay" @click.self="closeSheet">
        <div class="detailSheet cardSurface">
          <div class="sheetHead">
            <div>
              <div class="sheetEyebrow">{{ selected.sectionLabel }}</div>
              <div class="sheetTitle">{{ selected.title || '제목 없음' }}</div>
              <div class="sheetMeta">{{ selected.meta }}</div>
            </div>
            <button class="closeBtn" type="button" @click="closeSheet">닫기</button>
          </div>

          <template v-if="activeTab === 'actions'">
            <div class="sheetGrid">
              <label class="field">
                <span class="fieldLabel">제목</span>
                <input v-model.trim="editForm.title" class="fieldInput" type="text" maxlength="100" />
              </label>
              <label class="field">
                <span class="fieldLabel">장소</span>
                <input v-model.trim="editForm.placeText" class="fieldInput" type="text" maxlength="255" />
              </label>
              <label class="field">
                <span class="fieldLabel">시간</span>
                <input v-model="editForm.startAt" class="fieldInput" type="datetime-local" />
              </label>
              <label class="field">
                <span class="fieldLabel">리마인더</span>
                <select v-model.number="editForm.remindMinutes" class="fieldInput">
                  <option :value="0">알림 없음</option>
                  <option :value="5">5분 전</option>
                  <option :value="10">10분 전</option>
                  <option :value="30">30분 전</option>
                  <option :value="60">1시간 전</option>
                </select>
              </label>
            </div>
          </template>

          <template v-else-if="activeTab === 'capsules'">
            <div class="sheetGrid">
              <label class="field">
                <span class="fieldLabel">캡슐 제목</span>
                <input v-model.trim="editForm.title" class="fieldInput" type="text" maxlength="255" />
              </label>
              <label class="field">
                <span class="fieldLabel">열릴 시간</span>
                <input v-model="editForm.unlockAt" class="fieldInput" type="datetime-local" />
              </label>
            </div>
            <div class="sheetHint">이미 열린 캡슐은 시간보다 제목 정리 위주로 다루는 게 좋아.</div>
          </template>

          <template v-else>
            <div class="sheetGrid">
              <label class="field span2">
                <span class="fieldLabel">공유 글</span>
                <textarea v-model.trim="editForm.content" class="fieldTextarea" maxlength="2000"></textarea>
              </label>
              <label class="field">
                <span class="fieldLabel">공개 범위</span>
                <select v-model="editForm.visibility" class="fieldInput">
                  <option value="ALL">전체 공개</option>
                  <option value="FOLLOWERS">팔로워</option>
                  <option value="PRIVATE">나만 보기</option>
                </select>
              </label>
            </div>
          </template>

          <div class="sheetBlock">
            <div class="sheetBlockTitle">현재 정보</div>
            <div class="sheetBlockText">{{ selected.detail || selected.sub || '추가 설명이 아직 없어요.' }}</div>
          </div>

          <div class="sheetActions">
            <button class="ghostBtn" type="button" @click="goToOrigin(selected)" :disabled="saving || deleting">원본으로 이동</button>
            <button class="ghostBtn" type="button" @click="closeSheet" :disabled="saving">닫기</button>
            <button class="dangerBtn" type="button" @click="removeSelected" :disabled="saving || deleting">{{ deleting ? '삭제 중…' : '삭제' }}</button>
            <button class="primaryBtn" type="button" @click="saveSelected" :disabled="saving || deleting">{{ saving ? '저장 중…' : '수정 저장' }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { fetchMyActions, fetchMyCapsules, fetchMyShares } from "@/api/meActivity";
import { pinDelete, pinUpdate } from "@/api/pinsActions";
import { updateCapsule, deleteCapsule } from "@/api/capsules";
import { updatePost, deletePost } from "@/api/posts";
import { useToastStore } from "@/stores/toast";
import ActivityFilterChips from "@/components/activity/ActivityFilterChips.vue";

const route = useRoute();
const router = useRouter();
const toast = useToastStore();

const loading = ref(false);
const filter = ref("all");
const selected = ref(null);
const saving = ref(false);
const deleting = ref(false);
const rawCounts = reactive({ actions: 0, capsules: 0, shares: 0 });
const actions = ref([]);
const capsules = ref([]);
const shares = ref([]);
const editForm = reactive({
  title: "",
  placeText: "",
  startAt: "",
  remindMinutes: 60,
  unlockAt: "",
  content: "",
  visibility: "ALL",
});

const activeTab = computed(() => {
  const t = String(route.query.tab || "actions");
  return ["actions", "capsules", "shares"].includes(t) ? t : "actions";
});

const panelTitle = computed(() => activeTab.value === "actions" ? "내 액션" : activeTab.value === "capsules" ? "내 캡슐" : "내 공유 목록");
const panelSub = computed(() => activeTab.value === "actions"
  ? "약속, 할 일, 장소 제안을 다시 정리하고 바로 수정하거나 정리할 수 있어요."
  : activeTab.value === "capsules"
    ? "대기 중이거나 열린 캡슐을 시간 흐름대로 보고 제목과 열릴 시간을 정리할 수 있어요."
    : "피드에 올린 흐름을 다시 다듬고, 공개 범위를 조정하거나 정리할 수 있어요."
);

const summary = computed(() => ({
  actions: rawCounts.actions,
  capsules: rawCounts.capsules,
  shares: rawCounts.shares,
}));

const allItems = computed(() => activeTab.value === "actions" ? actions.value : activeTab.value === "capsules" ? capsules.value : shares.value);

const filterItems = computed(() => {
  if (activeTab.value === "actions") {
    return [
      { value: "all", label: "전체" },
      { value: "ACTIVE", label: "예정/진행" },
      { value: "DONE", label: "완료" },
      { value: "CANCELED", label: "취소" },
    ];
  }
  if (activeTab.value === "capsules") {
    return [
      { value: "all", label: "전체" },
      { value: "locked", label: "잠금" },
      { value: "opened", label: "열림" },
    ];
  }
  return [
    { value: "all", label: "전체" },
    { value: "ALL", label: "전체 공개" },
    { value: "FOLLOWERS", label: "팔로워" },
    { value: "PRIVATE", label: "나만" },
  ];
});

const filteredItems = computed(() => {
  if (filter.value === "all") return allItems.value;
  if (activeTab.value === "actions") return allItems.value.filter((x) => x.raw.status === filter.value);
  if (activeTab.value === "capsules") return allItems.value.filter((x) => (filter.value === "opened" ? x.raw.opened : !x.raw.opened));
  return allItems.value.filter((x) => x.raw.visibility === filter.value);
});

function setTab(tab) {
  filter.value = "all";
  selected.value = null;
  router.replace({ name: "my-activity", query: { tab } });
}

function formatDateText(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDatetimeLocal(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function remindMinutesFrom(startAt, remindAt) {
  if (!startAt || !remindAt) return 0;
  const s = new Date(startAt).getTime();
  const r = new Date(remindAt).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(r)) return 60;
  const diff = Math.round((s - r) / 60000);
  return [0, 5, 10, 30, 60].includes(diff) ? diff : 60;
}

function mapAction(x) {
  return {
    id: x.pinId || x.id,
    sectionLabel: "ACTION",
    title: x.title || "제목 없음",
    meta: [x.type, x.status].filter(Boolean).join(" · "),
    metaPill: x.type === "SCHEDULE" ? "약속/할일" : x.type,
    sub: [x.placeText, formatDateText(x.startAt)].filter(Boolean).join(" · "),
    detail: [x.placeText ? `장소 · ${x.placeText}` : "", x.startAt ? `시간 · ${formatDateText(x.startAt)}` : "", x.status ? `상태 · ${x.status}` : ""].filter(Boolean).join(""),
    badge: x.status,
    raw: x,
  };
}

function mapCapsule(x) {
  return {
    id: x.capsuleId || x.id,
    sectionLabel: "CAPSULE",
    title: x.title || "캡슐",
    meta: x.opened ? "열린 캡슐" : "잠금 캡슐",
    metaPill: x.opened ? "열림" : "대기",
    sub: x.unlockAt ? `열릴 시간 · ${formatDateText(x.unlockAt)}` : "열릴 시간이 아직 없어요.",
    detail: [x.unlockAt ? `열릴 시간 · ${formatDateText(x.unlockAt)}` : "", x.opened ? "상태 · 이미 열렸어요." : "상태 · 아직 잠겨 있어요."].filter(Boolean).join(""),
    badge: x.opened ? "열림" : "잠금",
    raw: x,
  };
}

function mapShare(x) {
  return {
    id: x.postId || x.id,
    sectionLabel: "SHARE",
    title: x.content || "내용 없음",
    meta: x.visibility || "ALL",
    metaPill: x.visibility === "FOLLOWERS" ? "팔로워" : x.visibility === "PRIVATE" ? "나만" : "전체 공개",
    sub: x.createdAt ? `공유 시각 · ${formatDateText(x.createdAt)}` : "",
    detail: [x.content || "", x.createdAt ? `공유 시각 · ${formatDateText(x.createdAt)}` : "", x.visibility ? `공개 범위 · ${x.visibility}` : ""].filter(Boolean).join(""),
    badge: x.visibility || "ALL",
    raw: x,
  };
}

function resetEditForm(item) {
  editForm.title = item?.raw?.title || "";
  editForm.placeText = item?.raw?.placeText || "";
  editForm.startAt = toDatetimeLocal(item?.raw?.startAt);
  editForm.remindMinutes = remindMinutesFrom(item?.raw?.startAt, item?.raw?.remindAt);
  editForm.unlockAt = toDatetimeLocal(item?.raw?.unlockAt);
  editForm.content = item?.raw?.content || "";
  editForm.visibility = item?.raw?.visibility || "ALL";
}

function openItem(item) {
  selected.value = item;
  resetEditForm(item);
}

function buildOriginTarget(item) {
  const raw = item?.raw || {};
  if (item?.sectionLabel === "ACTION") {
    if (!raw.conversationId) return null;
    const query = raw.pinId || item?.id ? { pinId: String(raw.pinId || item.id) } : undefined;
    return {
      name: "conversation-pins",
      params: { conversationId: String(raw.conversationId) },
      query,
    };
  }
  if (item?.sectionLabel === "CAPSULE") {
    if (!raw.conversationId) return null;
    const query = {};
    if (raw.messageId) query.mid = String(raw.messageId);
    if (raw.capsuleId || item?.id) query.capsuleId = String(raw.capsuleId || item.id);
    return {
      name: "conversation-detail",
      params: { conversationId: String(raw.conversationId) },
      query,
    };
  }
  if (item?.sectionLabel === "SHARE") {
    if (!raw.postId && !item?.id) return null;
    return { path: `/posts/${encodeURIComponent(String(raw.postId || item.id))}` };
  }
  return null;
}

async function goToOrigin(item) {
  const target = buildOriginTarget(item);
  if (!target) {
    toast.error("원본 이동 불가", "원본 화면으로 이동할 수 있는 정보가 아직 없어요.");
    return;
  }
  try {
    selected.value = null;
    await router.push(target);
  } catch {
    toast.error("이동 실패", "원본 화면으로 이동하지 못했어요.");
  }
}

function closeSheet() {
  if (saving.value || deleting.value) return;
  selected.value = null;
}

async function loadActions() {
  const res = await fetchMyActions();
  rawCounts.actions = (res.items || []).length;
  actions.value = (res.items || []).map(mapAction);
}

async function loadCapsules() {
  const res = await fetchMyCapsules();
  rawCounts.capsules = (res.items || []).length;
  capsules.value = (res.items || []).map(mapCapsule);
}

async function loadShares() {
  const res = await fetchMyShares();
  rawCounts.shares = (res.items || []).length;
  shares.value = (res.items || []).map(mapShare);
}

async function loadActiveTab() {
  loading.value = true;
  try {
    if (activeTab.value === "actions") await loadActions();
    else if (activeTab.value === "capsules") await loadCapsules();
    else await loadShares();
  } finally {
    loading.value = false;
  }
}

async function reload() {
  loading.value = true;
  try {
    await Promise.all([loadActions(), loadCapsules(), loadShares()]);
  } finally {
    loading.value = false;
  }
}

async function saveSelected() {
  if (!selected.value) return;
  saving.value = true;
  try {
    if (activeTab.value === "actions") {
      await pinUpdate(selected.value.id, {
        title: editForm.title,
        placeText: editForm.placeText,
        startAt: editForm.startAt || null,
        remindMinutes: editForm.remindMinutes,
      });
      toast.success("액션 수정 완료", "내 액션 정보를 업데이트했어요.");
      await loadActions();
      selected.value = actions.value.find((x) => String(x.id) === String(selected.value.id)) || null;
    } else if (activeTab.value === "capsules") {
      await updateCapsule(selected.value.id, {
        title: editForm.title,
        unlockAt: editForm.unlockAt || null,
      });
      toast.success("캡슐 수정 완료", "캡슐 제목과 시간을 정리했어요.");
      await loadCapsules();
      selected.value = capsules.value.find((x) => String(x.id) === String(selected.value.id)) || null;
    } else {
      await updatePost(selected.value.id, {
        content: editForm.content,
        visibility: editForm.visibility,
      });
      toast.success("공유 글 수정 완료", "공유 글 내용을 반영했어요.");
      await loadShares();
      selected.value = shares.value.find((x) => String(x.id) === String(selected.value.id)) || null;
    }
    if (selected.value) resetEditForm(selected.value);
  } catch (e) {
    toast.error("수정 실패", e?.response?.data?.message || "잠시 후 다시 시도해 주세요.");
  } finally {
    saving.value = false;
  }
}

async function removeSelected() {
  if (!selected.value) return;
  const label = activeTab.value === "actions" ? "액션" : activeTab.value === "capsules" ? "캡슐" : "공유 글";
  if (!window.confirm(`${label}을 삭제할까요? 이 작업은 되돌리기 어려워요.`)) return;
  deleting.value = true;
  try {
    const id = selected.value.id;
    if (activeTab.value === "actions") {
      await pinDelete(id);
      toast.success("액션 삭제 완료", "보관함 목록에서 정리했어요.");
      await loadActions();
    } else if (activeTab.value === "capsules") {
      await deleteCapsule(id);
      toast.success("캡슐 삭제 완료", "캡슐을 정리했어요.");
      await loadCapsules();
    } else {
      await deletePost(id);
      toast.success("공유 글 삭제 완료", "내 공유 목록에서 정리했어요.");
      await loadShares();
    }
    selected.value = null;
  } catch (e) {
    toast.error("삭제 실패", e?.response?.data?.message || "잠시 후 다시 시도해 주세요.");
  } finally {
    deleting.value = false;
  }
}

async function duplicateToClipboard(item) {
  const text = [item.title, item.sub, item.detail].filter(Boolean).join("");
  try {
    await navigator.clipboard.writeText(text);
    toast.success("텍스트 복사 완료", "활동 내용을 클립보드에 복사했어요.");
  } catch {
    toast.error("복사 실패", "브라우저에서 복사를 허용하지 않았어요.");
  }
}

watch(activeTab, async () => {
  filter.value = "all";
  selected.value = null;
  await loadActiveTab();
}, { immediate: true });
</script>

<style scoped>
.page{padding:20px 20px calc(96px + env(safe-area-inset-bottom));max-width:1120px;margin:0 auto;display:grid;gap:16px}
.cardSurface{border:1px solid rgba(255,255,255,.10);border-radius:24px;background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02));box-shadow:0 18px 46px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.04)}
.cardSurfaceLite{border:1px solid rgba(255,255,255,.08);border-radius:22px;background:rgba(255,255,255,.035)}
.hero{padding:20px;display:grid;gap:16px}
.heroMain{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap}
.eyebrow{font-size:11px;font-weight:900;letter-spacing:.18em;color:rgba(255,255,255,.58)}
.title{margin:6px 0 0;font-size:30px;line-height:1.05;font-weight:950;letter-spacing:-.04em}
.sub,.panelSub{font-size:14px;line-height:1.65;color:rgba(255,255,255,.74)}
.heroStats{display:flex;gap:10px;flex-wrap:wrap}.statChip{min-width:110px;padding:12px 14px;border-radius:18px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);display:grid;gap:4px}.statChip strong{font-size:20px;font-weight:950}.statChip span{font-size:12px;color:rgba(255,255,255,.66)}
.tabs{padding:10px;display:flex;gap:10px;flex-wrap:wrap}.tab{height:40px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);color:#fff;font-weight:900}.tab.on{background:rgba(255,255,255,.12)}
.panel{padding:18px}.panelHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.panelTitle{font-size:18px;font-weight:950}
.list{margin-top:12px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.empty{padding:24px 10px;color:rgba(255,255,255,.65)}
.activityCard{padding:16px;display:grid;gap:10px}.activityTop{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.activityLabel{font-size:11px;font-weight:900;letter-spacing:.14em;color:rgba(255,255,255,.52)}.activityTitle{margin-top:4px;font-size:16px;font-weight:950;line-height:1.4}.activityBadges{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.badge,.metaPill{padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);font-size:11px;font-weight:900;white-space:nowrap}.activityMeta{font-size:13px;color:rgba(255,255,255,.74)}.activitySub{font-size:13px;line-height:1.65;color:rgba(255,255,255,.64)}.activityFooter{display:flex;gap:8px;flex-wrap:wrap}
.detailBtn,.primaryBtn,.ghostBtn,.dangerBtn,.closeBtn{height:38px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.10);color:#fff;font-weight:900}
.detailBtn,.primaryBtn{background:linear-gradient(180deg, rgba(104,146,255,.36), rgba(104,146,255,.18))}.ghostBtn,.closeBtn{background:rgba(255,255,255,.04)}.dangerBtn{background:rgba(255,110,110,.16);border-color:rgba(255,110,110,.28)}.small{height:34px;padding:0 12px}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.58);backdrop-filter:blur(10px);display:grid;place-items:center;padding:20px;z-index:var(--z-modal)}
.detailSheet{width:min(720px,100%);padding:18px;display:grid;gap:14px}.sheetHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.sheetEyebrow{font-size:11px;font-weight:900;letter-spacing:.08em;color:rgba(255,255,255,.6)}.sheetTitle{font-size:24px;font-weight:950}.sheetMeta{margin-top:6px;font-size:13px;color:rgba(255,255,255,.72)}
.sheetGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.field{display:grid;gap:8px}.span2{grid-column:span 2}.fieldLabel{font-size:12px;font-weight:900;color:rgba(255,255,255,.7)}.fieldInput,.fieldTextarea{width:100%;border-radius:16px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);color:#fff;padding:12px 14px;outline:none}.fieldTextarea{min-height:140px;resize:vertical}.sheetHint{font-size:12px;color:rgba(255,255,255,.56)}
.sheetBlock{padding:12px;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03)}.sheetBlockTitle{font-size:12px;font-weight:900;color:rgba(255,255,255,.62)}.sheetBlockText{margin-top:8px;white-space:pre-line;font-size:13px;line-height:1.6;color:rgba(255,255,255,.78)}.sheetActions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
@media (max-width: 900px){.list{grid-template-columns:1fr}.sheetGrid{grid-template-columns:1fr}.span2{grid-column:auto}}
@media (max-width: 640px){.page{padding:16px 16px calc(92px + env(safe-area-inset-bottom))}.detailSheet{padding:16px;border-radius:22px;max-height:min(88vh,760px);overflow:auto}.sheetHead{display:grid}.sheetActions{display:grid;grid-template-columns:1fr 1fr}.sheetActions .primaryBtn{grid-column:span 2}.heroMain{display:grid}.heroStats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.statChip{min-width:0}}
</style>
