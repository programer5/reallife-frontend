<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { fetchTodayWidget, fetchReminderSummary } from "../../api/home";

const router = useRouter();

const loading = ref(false);
const reminderLoading = ref(false);
const actions = ref([]);
const summary = ref({ total: 0, upcoming: 0, done: 0 });
const reminder = ref({
  summary: { unreadCount: 0, unreadReminderCount: 0, todayReminderCount: 0 },
  lead: null,
});
const permission = ref(typeof Notification === "undefined" ? "unsupported" : (Notification.permission || "default"));

const todayCards = computed(() => [...actions.value].slice(0, 6));
const reminderLeadText = computed(() => {
  const body = String(reminder.value?.lead?.body || "").trim();
  return body || "오늘 리마인더와 캡슐 알림이 생기면 여기에서 먼저 보여드릴게요.";
});
const permissionTone = computed(() => {
  if (permission.value === "granted") return "ok";
  if (permission.value === "denied") return "danger";
  return "muted";
});
const permissionLabel = computed(() => {
  if (permission.value === "granted") return "브라우저 알림 켜짐";
  if (permission.value === "denied") return "브라우저 알림 차단";
  if (permission.value === "default") return "브라우저 알림 대기";
  return "브라우저 알림 미지원";
});

function syncPermission() {
  permission.value = typeof Notification === "undefined" ? "unsupported" : (Notification.permission || "default");
}

function actionTone(item) {
  const status = String(item?.status || "").toUpperCase();
  if (status === "DONE") return "done";
  if (status === "CANCELED") return "canceled";
  return "schedule";
}
function actionKindLabel(item) {
  const status = String(item?.status || "").toUpperCase();
  if (status === "DONE") return "완료";
  if (status === "CANCELED") return "취소";
  return "예정";
}
function fmtTime(value) {
  if (!value) return "시간 미정";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "시간 미정";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtMeta(item) {
  const bits = [];
  if (item?.placeText) bits.push(`📍 ${item.placeText}`);
  if (item?.remindAt) bits.push(`⏰ ${fmtTime(item.remindAt)}`);
  return bits.join(" · ") || "원본 대화에서 바로 이어가 보세요.";
}
function openAction(item) {
  const conversationId = item?.conversationId;
  const pinId = item?.pinId;
  if (conversationId && pinId) {
    router.push({ path: `/inbox/conversations/${conversationId}/pins`, query: { pinId } });
    return;
  }
  if (conversationId) {
    router.push(`/inbox/conversations/${conversationId}`);
    return;
  }
  router.push({ name: "my-activity", query: { tab: "actions" } });
}
function openReminderHub() {
  if (reminder.value?.lead?.conversationId) {
    router.push(`/inbox/conversations/${reminder.value.lead.conversationId}`);
    return;
  }
  router.push("/inbox");
}
function requestBrowserNotifications() {
  if (typeof Notification === "undefined" || !Notification.requestPermission) return;
  Notification.requestPermission().finally(() => syncPermission());
}

async function loadToday() {
  loading.value = true;
  try {
    const res = await fetchTodayWidget();
    summary.value = {
      total: Number(res?.summary?.total || 0),
      upcoming: Number(res?.summary?.upcoming || 0),
      done: Number(res?.summary?.done || 0),
    };
    actions.value = Array.isArray(res?.items) ? res.items : [];
  } catch {
    summary.value = { total: 0, upcoming: 0, done: 0 };
    actions.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadReminder() {
  reminderLoading.value = true;
  try {
    const res = await fetchReminderSummary();
    reminder.value = {
      summary: {
        unreadCount: Number(res?.summary?.unreadCount || 0),
        unreadReminderCount: Number(res?.summary?.unreadReminderCount || 0),
        todayReminderCount: Number(res?.summary?.todayReminderCount || 0),
      },
      lead: res?.lead || null,
    };
  } catch {
    reminder.value = { summary: { unreadCount: 0, unreadReminderCount: 0, todayReminderCount: 0 }, lead: null };
  } finally {
    reminderLoading.value = false;
  }
}

onMounted(async () => {
  syncPermission();
  await Promise.all([loadToday(), loadReminder()]);
});
</script>

<template>
  <section class="todayWidget cardSurface">
    <div class="todayWidget__hero">
      <div>
        <div class="todayWidget__eyebrow">TODAY · REALIFE FLOW</div>
        <h2 class="todayWidget__title">오늘 해야 할 흐름을 먼저 보고,<br />바로 행동으로 이어가세요</h2>
        <p class="todayWidget__sub">오늘 예정된 약속·할일을 먼저 보고 대화로 돌아가면 실제 행동으로 이어지기 쉬워요.</p>
      </div>
      <button class="todayWidget__all" type="button" @click="router.push({ name: 'my-activity', query: { tab: 'actions' } })">내 액션 전체 보기</button>
    </div>

    <div class="todayWidget__summaryBar">
      <span class="todayStat"><strong>{{ summary.total }}</strong><em>오늘 일정</em></span>
      <span class="todayStat"><strong>{{ summary.upcoming }}</strong><em>남은 일정</em></span>
      <span class="todayStat"><strong>{{ summary.done }}</strong><em>완료</em></span>
    </div>

    <div class="todayWidget__shell">
      <div class="todayWidget__main cardSurface">
        <div class="todayWidget__sectionHead">
          <div>
            <div class="todayWidget__sectionEyebrow">TODAY ACTION</div>
            <div class="todayWidget__sectionTitle">오늘 예정 액션</div>
          </div>
          <span class="todayWidget__mini">최대 6개</span>
        </div>

        <div v-if="loading" class="todayWidget__empty">오늘 액션을 불러오는 중이에요.</div>
        <div v-else-if="!todayCards.length" class="todayWidget__empty">오늘 예정된 액션이 아직 없어요. 대화에서 약속이나 할 일을 만들면 여기에 바로 보여요.</div>
        <div v-else class="todayWidget__list">
          <button v-for="item in todayCards" :key="item.pinId || item.title" class="todayActionCard" :class="`todayActionCard--${actionTone(item)}`" type="button" @click="openAction(item)">
            <div class="todayActionCard__timeRail">
              <div class="todayActionCard__time">{{ fmtTime(item.startAt) }}</div>
              <div class="todayActionCard__badge">{{ actionKindLabel(item) }}</div>
            </div>
            <div class="todayActionCard__content">
              <div class="todayActionCard__title">{{ item.title || '제목 없는 액션' }}</div>
              <div class="todayActionCard__meta">{{ fmtMeta(item) }}</div>
            </div>
            <div class="todayActionCard__cta">원본 보기</div>
          </button>
        </div>
      </div>

      <aside class="todayWidget__side cardSurface">
        <div class="todayWidget__sectionHead todayWidget__sectionHead--top">
          <div>
            <div class="todayWidget__sectionEyebrow">REMINDER · NOTIFICATION</div>
            <div class="todayWidget__sectionTitle">오늘 알림 상태</div>
          </div>
          <span class="permissionBadge" :data-tone="permissionTone">{{ permissionLabel }}</span>
        </div>

        <div class="reminderSummaryGrid">
          <div class="reminderStatCard">
            <strong>{{ reminder.summary.unreadReminderCount }}</strong>
            <span>읽지 않은 리마인더</span>
          </div>
          <div class="reminderStatCard">
            <strong>{{ reminder.summary.unreadCount }}</strong>
            <span>전체 미확인 알림</span>
          </div>
          <div class="reminderStatCard reminderStatCard--wide">
            <strong>{{ reminder.summary.todayReminderCount }}</strong>
            <span>오늘 발생한 리마인더</span>
          </div>
        </div>

        <div class="reminderLead">
          <div class="reminderLead__label">지금 가장 먼저 볼 알림</div>
          <div class="reminderLead__body">{{ reminderLoading ? '알림 상태를 불러오는 중이에요.' : reminderLeadText }}</div>
        </div>

        <div class="notificationGuide">
          <span class="notificationGuide__dot"></span>
          <span v-if="permission === 'denied'">브라우저 설정에서 알림을 다시 허용하면 캡슐 열림과 리마인더를 더 빨리 확인할 수 있어요.</span>
          <span v-else-if="permission === 'default'">브라우저 알림을 켜 두면 약속, 할일, 캡슐 열림 시점을 홈에서 더 빨리 확인할 수 있어요.</span>
          <span v-else>오늘 예정 액션과 알림 상태를 함께 보고 바로 대화로 이어가세요.</span>
        </div>

        <div class="notificationActions">
          <button class="todayWidget__ghostBtn" type="button" @click="openReminderHub">Inbox에서 보기</button>
          <button v-if="permission !== 'granted' && permission !== 'unsupported'" class="todayWidget__accentBtn" type="button" @click="requestBrowserNotifications">브라우저 알림 켜기</button>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.todayWidget{display:grid;gap:16px;padding:18px;border-radius:28px}
.todayWidget__hero{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
.todayWidget__eyebrow,.todayWidget__sectionEyebrow{font-size:11px;font-weight:900;letter-spacing:.14em;color:rgba(255,255,255,.56)}
.todayWidget__title{margin:6px 0 0;font-size:34px;line-height:1.06;font-weight:980;letter-spacing:-.05em;max-width:12ch}
.todayWidget__sub{margin:12px 0 0;max-width:56ch;font-size:14px;line-height:1.65;color:rgba(255,255,255,.72)}
.todayWidget__all,.todayWidget__ghostBtn,.todayWidget__accentBtn{min-height:42px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;font-weight:900;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.todayWidget__accentBtn{background:color-mix(in oklab,var(--accent) 16%, rgba(255,255,255,.06));border-color:color-mix(in oklab,var(--accent) 38%, rgba(255,255,255,.12))}
.todayWidget__summaryBar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.todayStat{padding:14px 16px;border-radius:20px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);display:grid;gap:4px}
.todayStat strong{font-size:22px;font-weight:980}.todayStat em{font-style:normal;font-size:12px;color:rgba(255,255,255,.62)}
.todayWidget__shell{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(320px,.9fr);gap:14px;align-items:start}
.todayWidget__main,.todayWidget__side{padding:16px;border-radius:24px;background:linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.02));display:grid;gap:14px}
.todayWidget__sectionHead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.todayWidget__sectionHead--top{align-items:center}
.todayWidget__sectionTitle{margin-top:4px;font-size:20px;font-weight:950;letter-spacing:-.03em}.todayWidget__mini{font-size:12px;color:rgba(255,255,255,.58);font-weight:800}
.todayWidget__empty{padding:18px;border-radius:20px;border:1px dashed rgba(255,255,255,.12);color:rgba(255,255,255,.72);line-height:1.65;background:rgba(255,255,255,.02)}
.todayWidget__list{display:grid;gap:10px}
.todayActionCard{display:grid;grid-template-columns:110px minmax(0,1fr) auto;gap:14px;padding:14px 16px;border-radius:22px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);color:#fff;text-align:left;cursor:pointer;transition:transform .16s ease,border-color .18s ease}
.todayActionCard:hover{transform:translateY(-1px);border-color:color-mix(in oklab,var(--accent) 34%, rgba(255,255,255,.14))}
.todayActionCard__timeRail{display:grid;gap:8px;align-content:start}.todayActionCard__time{font-size:24px;font-weight:980;letter-spacing:-.04em}.todayActionCard__badge{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:0 10px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.06);font-size:12px;font-weight:900}
.todayActionCard__content{display:grid;gap:6px;min-width:0}.todayActionCard__title{font-size:17px;font-weight:950;line-height:1.35;word-break:keep-all;overflow-wrap:anywhere}.todayActionCard__meta{font-size:12px;line-height:1.6;color:rgba(255,255,255,.66)}.todayActionCard__cta{align-self:end;font-size:12px;font-weight:900;color:rgba(255,255,255,.72);white-space:nowrap}
.todayActionCard--schedule{box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--accent) 18%, transparent)}.todayActionCard--done{opacity:.9}.todayActionCard--canceled{opacity:.72}
.permissionBadge{min-height:30px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.08);display:inline-flex;align-items:center;font-size:12px;font-weight:900;background:rgba(255,255,255,.05)}
.permissionBadge[data-tone="ok"]{background:rgba(34,197,94,.14);border-color:rgba(34,197,94,.28)}.permissionBadge[data-tone="danger"]{background:rgba(244,63,94,.14);border-color:rgba(244,63,94,.28)}
.reminderSummaryGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.reminderStatCard{padding:14px;border-radius:18px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);display:grid;gap:4px}.reminderStatCard strong{font-size:22px;font-weight:980}.reminderStatCard span{font-size:12px;color:rgba(255,255,255,.62);line-height:1.5}.reminderStatCard--wide{grid-column:1 / -1}
.reminderLead{padding:14px;border-radius:18px;border:1px solid color-mix(in oklab,var(--accent) 26%, rgba(255,255,255,.1));background:color-mix(in oklab,var(--accent) 10%, rgba(255,255,255,.03));display:grid;gap:8px}.reminderLead__label{font-size:11px;font-weight:900;letter-spacing:.08em;color:rgba(255,255,255,.6)}.reminderLead__body{font-size:14px;line-height:1.65;color:rgba(255,255,255,.9)}
.notificationGuide{display:flex;gap:10px;align-items:flex-start;font-size:12px;line-height:1.65;color:rgba(255,255,255,.68)}.notificationGuide__dot{width:10px;height:10px;border-radius:999px;margin-top:6px;background:color-mix(in oklab,var(--accent) 42%, rgba(255,255,255,.26));flex:0 0 auto}
.notificationActions{display:flex;gap:10px;flex-wrap:wrap}
@media (max-width:1180px){.todayWidget__hero{display:grid}.todayWidget__all{justify-self:start}.todayWidget__shell{grid-template-columns:1fr}}
@media (max-width:860px){.todayWidget{padding:16px}.todayWidget__title{font-size:28px;max-width:none}}
@media (max-width:520px){.todayWidget{padding:14px}.todayWidget__title{font-size:24px}.todayWidget__summaryBar{gap:8px}.todayStat{padding:12px 10px}.todayActionCard{grid-template-columns:82px 1fr;gap:10px;padding:13px 12px}.todayActionCard__cta{grid-column:2 / 3;justify-self:start}.reminderSummaryGrid{grid-template-columns:1fr 1fr}.notificationActions{display:grid;grid-template-columns:1fr;gap:8px}.todayWidget__all,.todayWidget__ghostBtn,.todayWidget__accentBtn{width:100%}.permissionBadge{justify-self:start}}
</style>
