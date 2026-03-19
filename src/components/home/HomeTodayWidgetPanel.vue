<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { fetchTodayWidget, fetchReminderSummary } from "../../api/home";

const router = useRouter();

const loading = ref(false);
const reminderLoading = ref(false);
const actions = ref([]);
const summary = ref({ total: 0, upcoming: 0, done: 0 });
const reminder = ref({ summary: { unreadCount: 0, unreadReminderCount: 0, todayReminderCount: 0 }, settings: { browserNotifyEnabled: false, soundEnabled: false, vibrateEnabled: false, settingsSource: 'SERVER' }, lead: null });
const permission = ref(typeof Notification === "undefined" ? "unsupported" : (Notification.permission || "default"));

const todayCards = computed(() => [...actions.value].slice(0, 6));
const nextAction = computed(() => todayCards.value[0] || null);
const hasBrowserToggleOn = computed(() => !!(reminder.value?.settings?.browserNotifyEnabled));
const permissionTone = computed(() => {
  if (permission.value === "granted" && hasBrowserToggleOn.value) return "ok";
  if (permission.value === "denied") return "danger";
  if (permission.value === "granted") return "warn";
  return "muted";
});
const permissionLabel = computed(() => {
  if (permission.value === "granted") return "브라우저 권한 허용";
  if (permission.value === "denied") return "브라우저 권한 차단";
  if (permission.value === "default") return "브라우저 권한 대기";
  return "브라우저 알림 미지원";
});
const reminderSettingLabel = computed(() => hasBrowserToggleOn.value ? "Me 리마인더 ON" : "Me 리마인더 OFF");
const reminderSettingsSourceLabel = computed(() => {
  const source = String(reminder.value?.settings?.settingsSource || 'SERVER').toUpperCase();
  return source === 'SERVER' ? '서버 설정 기준' : '동기화 상태';
});
const reminderStateSummary = computed(() => {
  if (permission.value === "granted" && hasBrowserToggleOn.value) return "브라우저 권한과 Me 리마인더 설정이 모두 켜져 있어요.";
  if (permission.value === "granted" && !hasBrowserToggleOn.value) return "브라우저 권한은 허용됐지만 서버에 저장된 Me 리마인더 설정에서 브라우저 알림이 꺼져 있어요.";
  if (permission.value === "default") return "브라우저 권한을 아직 묻지 않았어요. Me 설정과 함께 켜두면 좋아요.";
  if (permission.value === "denied") return "브라우저가 알림을 차단하고 있어요. 브라우저 설정에서 허용이 필요해요.";
  return "이 환경에서는 브라우저 알림이 지원되지 않아요.";
});
const reminderLeadText = computed(() => String(reminder.value?.lead?.body || "").trim() || "오늘 리마인더와 캡슐 알림이 생기면 여기에서 먼저 보여드릴게요.");
const reminderLeadCaption = computed(() => {
  const lead = reminder.value?.lead;
  if (!lead) return "새 알림이 생기면 가장 중요한 항목부터 정리해 보여줘요.";
  return `${reminderTypeLabel(lead.type)} · ${fmtDateTime(lead.createdAt)}`;
});
const reminderHint = computed(() => {
  if (permission.value === "granted" && !hasBrowserToggleOn.value) return "브라우저 자체는 허용됐지만 서버에 저장된 Me > Reminder 설정이 OFF라서 홈에서도 OFF로 안내해요.";
  if (permission.value === "denied") return "브라우저 설정에서 알림을 허용하면 캡슐 열림과 리마인더를 더 빨리 확인할 수 있어요.";
  if (permission.value === "default") return "브라우저 알림을 켜 두면 약속, 할일, 캡슐 열림 시점을 홈에서 더 빨리 확인할 수 있어요.";
  return "오늘 예정 액션과 알림 상태를 함께 보고 바로 대화로 이어가세요.";
});
const reminderCards = computed(() => ([
  { key: 'unread', label: '미확인 알림', value: Number(reminder.value?.summary?.unreadCount || 0) },
  { key: 'remind', label: '미확인 리마인더', value: Number(reminder.value?.summary?.unreadReminderCount || 0) },
  { key: 'today', label: '오늘 발생', value: Number(reminder.value?.summary?.todayReminderCount || 0) },
]));

function syncPermission() {
  permission.value = typeof Notification === "undefined" ? "unsupported" : (Notification.permission || "default");
}
function typeLabel(type) {
  const t = String(type || "").toUpperCase();
  if (t === "PROMISE") return "약속";
  if (t === "TODO") return "할일";
  if (t === "PLACE") return "장소";
  return "액션";
}
function statusLabel(status) {
  const t = String(status || "").toUpperCase();
  if (t === "DONE") return "완료";
  if (t === "CANCELED") return "취소";
  return "예정";
}
function actionTone(item) {
  const status = String(item?.status || "").toUpperCase();
  if (status === "DONE") return "done";
  if (status === "CANCELED") return "canceled";
  const type = String(item?.type || "").toUpperCase();
  if (type === "PROMISE") return "promise";
  if (type === "TODO") return "todo";
  return "place";
}
function reminderTypeLabel(type) {
  const t = String(type || "").toUpperCase();
  if (t === "PIN_REMIND") return "리마인더";
  if (t === "MESSAGE_RECEIVED") return "메시지";
  if (t === "COMMENT_CREATED" || t === "POST_COMMENT") return "댓글";
  return "알림";
}
function fmtTime(value) {
  if (!value) return "시간 미정";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "시간 미정";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtDateTime(value) {
  if (!value) return "방금";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "방금";
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${fmtTime(value)}`;
}
function fmtMeta(item) {
  const bits = [typeLabel(item?.type)];
  if (item?.placeText) bits.push(`📍 ${item.placeText}`);
  if (item?.remindAt) bits.push(`⏰ ${fmtTime(item.remindAt)}`);
  return bits.join(" · ");
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
function openReminderSettings() {
  router.push({ name: 'me' });
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
      settings: {
        browserNotifyEnabled: !!(res?.settings?.browserNotifyEnabled),
        soundEnabled: !!(res?.settings?.soundEnabled),
        vibrateEnabled: !!(res?.settings?.vibrateEnabled),
        settingsSource: String(res?.settings?.settingsSource || 'SERVER'),
      },
      lead: res?.lead || null,
    };
  } catch {
    reminder.value = { summary: { unreadCount: 0, unreadReminderCount: 0, todayReminderCount: 0 }, settings: { browserNotifyEnabled: false, soundEnabled: false, vibrateEnabled: false, settingsSource: 'SERVER' }, lead: null };
  } finally {
    reminderLoading.value = false;
  }
}
async function refreshAll() {
  syncPermission();
  await Promise.all([loadToday(), loadReminder()]);
}

onMounted(async () => {
  syncPermission();
  await refreshAll();
});
</script>

<template>
  <section class="todayWidget cardSurface">
    <div class="todayWidget__hero">
      <div class="todayWidget__heroCopy">
        <div class="todayWidget__eyebrow">TODAY · REALIFE FLOW</div>
        <h2 class="todayWidget__title">오늘 해야 할 흐름을 먼저 보고,<br />바로 행동으로 이어가세요</h2>
        <p class="todayWidget__sub">오늘 예정된 약속·할일을 먼저 보고 대화로 돌아가면 실제 행동으로 이어지기 쉬워요.</p>
        <div class="todayWidget__chips">
          <span class="todayWidget__chip">오늘 일정 {{ summary.total }}</span>
          <span class="todayWidget__chip">남은 일정 {{ summary.upcoming }}</span>
          <span class="todayWidget__chip">완료 {{ summary.done }}</span>
        </div>
      </div>
      <div class="todayWidget__heroAside">
        <div class="todayWidget__eyebrow">NEXT STEP</div>
        <div class="todayWidget__nextTitle">{{ nextAction ? (nextAction.title || '예정된 액션') : '오늘 일정이 비어 있어요' }}</div>
        <div class="todayWidget__nextMeta">{{ nextAction ? `${fmtTime(nextAction.startAt)} · ${fmtMeta(nextAction)}` : '대화에서 약속이나 할 일을 만들면 여기에 바로 보여요.' }}</div>
        <div class="todayWidget__heroActions">
          <button class="todayWidget__ghostBtn" type="button" @click="refreshAll">새로고침</button>
          <button class="todayWidget__accentBtn" type="button" @click="router.push({ name: 'my-activity', query: { tab: 'actions' } })">내 액션 전체 보기</button>
        </div>
      </div>
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
          <button v-for="item in todayCards" :key="item.pinId || `${item.title}-${item.startAt}`" class="todayActionCard" :class="`todayActionCard--${actionTone(item)}`" type="button" @click="openAction(item)">
            <div class="todayActionCard__rail"></div>
            <div class="todayActionCard__timeBlock">
              <div class="todayActionCard__time">{{ fmtTime(item.startAt) }}</div>
              <div class="todayActionCard__state">{{ statusLabel(item.status) }}</div>
            </div>
            <div class="todayActionCard__content">
              <div class="todayActionCard__titleRow">
                <div class="todayActionCard__title">{{ item.title || '제목 없는 액션' }}</div>
                <span class="todayActionCard__kind">{{ typeLabel(item.type) }}</span>
              </div>
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

        <div class="reminderStateBox">
          <div class="reminderStateRow">
            <span class="reminderStateKey">브라우저</span>
            <span class="reminderStateValue">{{ permissionLabel }}</span>
          </div>
          <div class="reminderStateRow">
            <span class="reminderStateKey">Me 설정</span>
            <span class="reminderStateValue">{{ reminderSettingLabel }}</span>
          </div>
          <div class="reminderStateRow">
            <span class="reminderStateKey">사운드</span>
            <span class="reminderStateValue">{{ reminder.value?.settings?.soundEnabled ? 'ON' : 'OFF' }}</span>
          </div>
          <div class="reminderStateRow">
            <span class="reminderStateKey">진동</span>
            <span class="reminderStateValue">{{ reminder.value?.settings?.vibrateEnabled ? 'ON' : 'OFF' }}</span>
          </div>
          <div class="reminderStateHint">{{ reminderStateSummary }}</div>
        </div>

        <div class="reminderSummaryGrid">
          <div v-for="card in reminderCards" :key="card.key" class="reminderStatCard">
            <div class="reminderStatCard__value">{{ card.value }}</div>
            <div class="reminderStatCard__label">{{ card.label }}</div>
          </div>
        </div>

        <div class="reminderLead cardSurface">
          <div class="reminderLead__eyebrow">대표 알림</div>
          <div class="reminderLead__body">{{ reminderLoading ? '알림 요약을 불러오는 중이에요.' : reminderLeadText }}</div>
          <div class="reminderLead__caption">{{ reminderLeadCaption }}</div>
        </div>

        <div class="reminderHint">{{ reminderHint }}</div>

        <div class="todayWidget__heroActions todayWidget__heroActions--side">
          <button class="todayWidget__ghostBtn" type="button" @click="openReminderHub">Inbox에서 보기</button>
          <button v-if="permission === 'default'" class="todayWidget__accentBtn" type="button" @click="requestBrowserNotifications">브라우저 알림 켜기</button>
          <button v-else-if="!hasBrowserToggleOn" class="todayWidget__accentBtn" type="button" @click="openReminderSettings">Reminder 설정 보기</button>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.cardSurface{border:1px solid color-mix(in oklab,var(--border) 86%,transparent);background:color-mix(in oklab,var(--surface) 88%,transparent);box-shadow:0 20px 60px rgba(0,0,0,.26), inset 0 1px 0 rgba(255,255,255,.05);backdrop-filter:blur(14px)}
.todayWidget{padding:18px;border-radius:28px;display:grid;gap:16px}
.todayWidget__hero{display:grid;grid-template-columns:1.08fr .92fr;gap:14px;align-items:stretch}
.todayWidget__heroCopy,.todayWidget__heroAside{padding:18px;border-radius:24px;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.06)}
.todayWidget__eyebrow,.todayWidget__sectionEyebrow,.reminderLead__eyebrow{font-size:11px;font-weight:900;letter-spacing:.14em;color:var(--muted)}
.todayWidget__title{margin:8px 0 0;font-size:36px;line-height:1.06;font-weight:950}
.todayWidget__sub{margin:12px 0 0;color:var(--muted);line-height:1.65}
.todayWidget__chips{margin-top:14px;display:flex;gap:8px;flex-wrap:wrap}
.todayWidget__chip,.todayWidget__mini,.permissionBadge{display:inline-flex;align-items:center;min-height:30px;padding:0 11px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);font-size:12px;font-weight:900}
.permissionBadge[data-tone="ok"]{background:color-mix(in oklab,var(--success) 16%,transparent);border-color:color-mix(in oklab,var(--success) 44%,transparent)}
.permissionBadge[data-tone="warn"]{background:color-mix(in oklab,var(--warning) 16%,transparent);border-color:color-mix(in oklab,var(--warning) 44%,transparent)}
.permissionBadge[data-tone="danger"]{background:color-mix(in oklab,var(--danger) 16%,transparent);border-color:color-mix(in oklab,var(--danger) 44%,transparent)}
.todayWidget__nextTitle{margin-top:10px;font-size:20px;font-weight:950;line-height:1.3}
.todayWidget__nextMeta{margin-top:8px;color:var(--muted);line-height:1.55}
.todayWidget__heroActions{margin-top:16px;display:flex;gap:10px;flex-wrap:wrap}
.todayWidget__ghostBtn,.todayWidget__accentBtn{min-height:42px;border-radius:14px;padding:0 14px;font-weight:900;border:1px solid rgba(255,255,255,.08)}
.todayWidget__ghostBtn{background:rgba(255,255,255,.04);color:var(--text)}
.todayWidget__accentBtn{background:linear-gradient(180deg,color-mix(in oklab,var(--accent) 28%,transparent),color-mix(in oklab,var(--surface) 92%,transparent));color:var(--text)}
.todayWidget__shell{display:grid;grid-template-columns:1.12fr .88fr;gap:14px}
.todayWidget__main,.todayWidget__side{padding:16px;border-radius:24px;display:grid;gap:12px}
.todayWidget__sectionHead{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.todayWidget__sectionTitle{margin-top:4px;font-size:22px;font-weight:950}
.todayWidget__empty{padding:16px;border-radius:18px;background:rgba(255,255,255,.04);color:var(--muted);line-height:1.55}
.todayWidget__list{display:grid;gap:10px}
.todayActionCard{position:relative;width:100%;display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:14px 16px 14px 18px;border-radius:20px;text-align:left;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04)}
.todayActionCard__rail{position:absolute;left:0;top:10px;bottom:10px;width:4px;border-radius:999px;background:rgba(255,255,255,.18)}
.todayActionCard--promise .todayActionCard__rail{background:color-mix(in oklab,var(--accent) 80%,white)}
.todayActionCard--todo .todayActionCard__rail{background:color-mix(in oklab,var(--warning) 78%,white)}
.todayActionCard--place .todayActionCard__rail{background:color-mix(in oklab,var(--success) 76%,white)}
.todayActionCard--done .todayActionCard__rail{background:color-mix(in oklab,var(--success) 76%,white)}
.todayActionCard--canceled .todayActionCard__rail{background:color-mix(in oklab,var(--danger) 76%,white)}
.todayActionCard__timeBlock{min-width:72px}
.todayActionCard__time{font-size:22px;font-weight:950}
.todayActionCard__state{font-size:12px;color:var(--muted);font-weight:900}
.todayActionCard__titleRow{display:flex;justify-content:space-between;gap:10px;align-items:center}
.todayActionCard__title{font-size:16px;font-weight:950;line-height:1.35}
.todayActionCard__kind{font-size:12px;font-weight:900;color:var(--muted)}
.todayActionCard__meta{margin-top:4px;color:var(--muted);font-size:13px;line-height:1.5}
.todayActionCard__cta{font-size:12px;font-weight:900;color:color-mix(in oklab,var(--accent) 78%,white)}
.reminderStateBox{padding:14px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);display:grid;gap:8px}
.reminderStateRow{display:flex;justify-content:space-between;gap:12px;font-size:13px}
.reminderStateKey{color:var(--muted);font-weight:800}
.reminderStateValue{font-weight:900}
.reminderStateHint{font-size:12px;color:var(--muted);line-height:1.55}
.reminderSummaryGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.reminderStatCard{padding:14px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}
.reminderStatCard__value{font-size:22px;font-weight:950}
.reminderStatCard__label{margin-top:4px;font-size:12px;color:var(--muted);font-weight:800}
.reminderLead{padding:14px;border-radius:18px;display:grid;gap:8px}
.reminderLead__body{font-size:14px;font-weight:900;line-height:1.6}
.reminderLead__caption,.reminderHint{font-size:12px;color:var(--muted);line-height:1.6}
.todayWidget__heroActions--side{margin-top:2px}
@media (max-width:960px){.todayWidget__hero,.todayWidget__shell{grid-template-columns:1fr}.todayWidget__title{font-size:30px}}
@media (max-width:640px){.todayWidget{padding:14px;border-radius:22px}.todayWidget__heroCopy,.todayWidget__heroAside,.todayWidget__main,.todayWidget__side{padding:14px;border-radius:18px}.todayWidget__title{font-size:26px}.todayActionCard{grid-template-columns:1fr;gap:8px}.todayActionCard__cta{justify-self:flex-start}.reminderSummaryGrid{grid-template-columns:1fr 1fr 1fr}.todayWidget__heroActions{display:grid;grid-template-columns:1fr}.todayWidget__ghostBtn,.todayWidget__accentBtn{width:100%}}
</style>

