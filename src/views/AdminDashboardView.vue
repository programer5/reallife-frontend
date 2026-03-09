<template>
  <div class="page">
    <section class="hero cardSurface">
      <div class="heroLeft">
        <div class="eyebrow">REALIFE OPS</div>
        <h1 class="title">Admin Dashboard</h1>
        <p class="sub">
          운영 상태, 실시간 연결, reminder 흐름, 최근 알림을 한 화면에서 확인할 수 있어요.
        </p>
      </div>

      <div class="heroRight">
        <div class="statusBadge" :data-status="normalizedDashboard.status">
          {{ normalizedDashboard.status }}
        </div>
        <RlButton size="sm" variant="soft" @click="load" :loading="loading">새로고침</RlButton>
      </div>
    </section>

    <AsyncStatePanel
        v-if="loading && !dashboard"
        icon="⏳"
        title="운영 상태를 불러오는 중이에요"
        description="DB, Redis, SSE, Reminder 상태를 모으고 있어요."
        tone="loading"
        :show-actions="false"
    />

    <AsyncStatePanel
        v-else-if="error"
        icon="⚠️"
        title="대시보드를 불러오지 못했어요"
        :description="error"
        tone="danger"
        primary-label="다시 시도"
        @primary="load"
    />

    <template v-else>
      <section class="grid4">
        <div class="statCard cardSurface">
          <div class="label">활성 SSE 연결</div>
          <div class="value">{{ normalizedDashboard.overview.activeSseConnections }}</div>
          <div class="hint">실시간 연결 상태</div>
        </div>

        <div class="statCard cardSurface">
          <div class="label">미확인 알림</div>
          <div class="value">{{ normalizedDashboard.overview.unreadNotifications }}</div>
          <div class="hint">전체 unread 기준</div>
        </div>

        <div class="statCard cardSurface">
          <div class="label">활성 핀</div>
          <div class="value">{{ normalizedDashboard.overview.activePins }}</div>
          <div class="hint">현재 진행 중 액션</div>
        </div>

        <div class="statCard cardSurface">
          <div class="label">오늘 생성 알림</div>
          <div class="value">{{ normalizedDashboard.overview.todayCreatedNotifications }}</div>
          <div class="hint">최근 24시간 기준</div>
        </div>
      </section>

      <section class="healthGrid">
        <div class="panel cardSurface">
          <div class="panelTitle">운영 Health</div>
          <div class="healthList">
            <div class="healthRow" v-for="(value, key) in normalizedDashboard.health.checks" :key="key">
              <span class="healthKey">{{ key }}</span>
              <span class="healthValue" :data-status="value">{{ value }}</span>
            </div>
          </div>
        </div>

        <div class="panel cardSurface">
          <div class="panelTitle">실시간/Reminder 타이밍</div>
          <div class="timingList">
            <div class="timingRow">
              <span>마지막 SSE 이벤트</span>
              <strong>{{ fmtDateTime(normalizedDashboard.health.lastSseEventSentAt) }}</strong>
            </div>
            <div class="timingRow">
              <span>마지막 Reminder 실행</span>
              <strong>{{ fmtDateTime(normalizedDashboard.health.lastReminderRunAt) }}</strong>
            </div>
            <div class="timingRow">
              <span>마지막 Reminder 성공</span>
              <strong>{{ fmtDateTime(normalizedDashboard.health.lastReminderSuccessAt) }}</strong>
            </div>
            <div class="timingRow">
              <span>최근 Reminder 생성 수</span>
              <strong>{{ normalizedDashboard.health.recentReminderCreatedCount }}</strong>
            </div>
            <div class="timingRow">
              <span>마지막 실행 이후 경과</span>
              <strong>{{ normalizedDashboard.health.minutesSinceLastReminderRun }}분</strong>
            </div>
          </div>
        </div>
      </section>

      <section class="grid3">
        <div class="miniCard cardSurface">
          <div class="label">Users</div>
          <div class="value">{{ normalizedDashboard.totals.users }}</div>
        </div>
        <div class="miniCard cardSurface">
          <div class="label">Posts</div>
          <div class="value">{{ normalizedDashboard.totals.posts }}</div>
        </div>
        <div class="miniCard cardSurface">
          <div class="label">Comments</div>
          <div class="value">{{ normalizedDashboard.totals.comments }}</div>
        </div>
        <div class="miniCard cardSurface">
          <div class="label">Conversations</div>
          <div class="value">{{ normalizedDashboard.totals.conversations }}</div>
        </div>
        <div class="miniCard cardSurface">
          <div class="label">Messages</div>
          <div class="value">{{ normalizedDashboard.totals.messages }}</div>
        </div>
        <div class="miniCard cardSurface">
          <div class="label">Notifications</div>
          <div class="value">{{ normalizedDashboard.totals.notifications }}</div>
        </div>
      </section>

      <section class="panel cardSurface">
        <div class="panelHead">
          <div>
            <div class="panelTitle">최근 알림</div>
            <div class="panelSub">운영자가 최근 흐름을 빠르게 볼 수 있는 요약이에요.</div>
          </div>
          <div class="generatedAt">생성 시각 {{ fmtDateTime(normalizedDashboard.generatedAt) }}</div>
        </div>

        <div v-if="normalizedDashboard.recent.notifications.length" class="recentList">
          <div v-for="item in normalizedDashboard.recent.notifications" :key="item.id" class="recentItem">
            <div class="recentTop">
              <span class="recentType">{{ item.type }}</span>
              <span class="recentTime">{{ fmtDateTime(item.createdAt) }}</span>
            </div>
            <div class="recentBody">{{ item.body }}</div>
            <div class="recentMeta">
              <span>User {{ shortId(item.userId) }}</span>
              <span :data-read="item.read">{{ item.read ? "읽음" : "미읽음" }}</span>
            </div>
          </div>
        </div>
        <div v-else class="empty">아직 최근 알림이 없어요.</div>
      </section>

      <section class="panel cardSurface">
        <div class="panelTitle">운영 메모</div>
        <ul class="notes">
          <li v-for="note in normalizedDashboard.notes" :key="note">{{ note }}</li>
        </ul>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import RlButton from "@/components/ui/RlButton.vue";
import AsyncStatePanel from "@/components/ui/AsyncStatePanel.vue";
import { fetchAdminDashboard } from "@/api/admin";
import { useToastStore } from "@/stores/toast";

const toast = useToastStore();

const loading = ref(false);
const error = ref("");
const dashboard = ref(null);

const normalizedDashboard = computed(() => {
  const raw = dashboard.value || {};

  return {
    status: raw?.status || "UNKNOWN",
    service: raw?.service || "reallife-backend",
    version: raw?.version || "unknown",
    activeProfiles: Array.isArray(raw?.activeProfiles) ? raw.activeProfiles : [],
    generatedAt: raw?.generatedAt || null,

    overview: {
      activeSseConnections: Number(raw?.overview?.activeSseConnections || 0),
      unreadNotifications: Number(raw?.overview?.unreadNotifications || 0),
      activePins: Number(raw?.overview?.activePins || 0),
      todayCreatedNotifications: Number(raw?.overview?.todayCreatedNotifications || 0),
      todayCreatedMessages: Number(raw?.overview?.todayCreatedMessages || 0),
      todayCreatedPosts: Number(raw?.overview?.todayCreatedPosts || 0),
    },

    health: {
      checks: raw?.health?.checks || {},
      lastSseEventSentAt: raw?.health?.lastSseEventSentAt || null,
      lastReminderRunAt: raw?.health?.lastReminderRunAt || null,
      lastReminderSuccessAt: raw?.health?.lastReminderSuccessAt || null,
      recentReminderCreatedCount: Number(raw?.health?.recentReminderCreatedCount || 0),
      minutesSinceLastReminderRun: Number(raw?.health?.minutesSinceLastReminderRun || 0),
    },

    totals: {
      users: Number(raw?.totals?.users || 0),
      posts: Number(raw?.totals?.posts || 0),
      comments: Number(raw?.totals?.comments || 0),
      conversations: Number(raw?.totals?.conversations || 0),
      messages: Number(raw?.totals?.messages || 0),
      activePins: Number(raw?.totals?.activePins || 0),
      notifications: Number(raw?.totals?.notifications || 0),
    },

    recent: {
      notifications: Array.isArray(raw?.recent?.notifications) ? raw.recent.notifications : [],
    },

    notes: Array.isArray(raw?.notes) ? raw.notes : [],
  };
});

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const res = await fetchAdminDashboard();
    dashboard.value = res || {};
  } catch (e) {
    error.value = e?.response?.data?.message || "운영 대시보드를 불러오지 못했어요.";
    toast.error?.("대시보드 로드 실패", error.value);
  } finally {
    loading.value = false;
  }
}

function fmtDateTime(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("ko-KR");
}

function shortId(v) {
  const s = String(v || "");
  return s ? s.slice(0, 8) : "-";
}

onMounted(load);
</script>

<style scoped>
.page{max-width:1200px;margin:0 auto;padding:18px 14px 110px;display:grid;gap:14px}
.cardSurface{
  border:1px solid color-mix(in oklab,var(--border) 88%,transparent);
  border-radius:24px;
  background:color-mix(in oklab,var(--surface) 88%,transparent);
  box-shadow:0 18px 60px rgba(0,0,0,.24),0 1px 0 rgba(255,255,255,.05) inset;
  backdrop-filter:blur(14px);
}
.hero{padding:18px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.eyebrow{font-size:11px;font-weight:900;letter-spacing:.15em;color:var(--muted)}
.title{margin:6px 0 0;font-size:28px;font-weight:950}
.sub{margin:8px 0 0;color:var(--muted);line-height:1.55}
.heroRight{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.statusBadge{
  min-width:88px;height:38px;padding:0 14px;border-radius:999px;
  display:inline-flex;align-items:center;justify-content:center;
  border:1px solid var(--border);font-weight:950;
  background:rgba(255,255,255,.04)
}
.statusBadge[data-status="UP"]{border-color:color-mix(in oklab,var(--success) 44%,var(--border));background:color-mix(in oklab,var(--success) 12%,transparent)}
.statusBadge[data-status="DEGRADED"]{border-color:color-mix(in oklab,var(--warning) 44%,var(--border));background:color-mix(in oklab,var(--warning) 12%,transparent)}
.statusBadge[data-status="DOWN"]{border-color:color-mix(in oklab,var(--danger) 44%,var(--border));background:color-mix(in oklab,var(--danger) 12%,transparent)}

.grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.statCard,.miniCard,.panel{padding:16px}
.label{font-size:12px;color:var(--muted);font-weight:900}
.value{margin-top:8px;font-size:28px;font-weight:950;letter-spacing:-.03em}
.hint{margin-top:6px;font-size:12px;color:var(--muted)}

.healthGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.panelTitle{font-size:18px;font-weight:950}
.panelSub{margin-top:4px;font-size:13px;color:var(--muted)}
.healthList,.timingList{margin-top:12px;display:grid;gap:10px}
.healthRow,.timingRow{
  display:flex;justify-content:space-between;gap:12px;align-items:center;
  padding:12px;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04)
}
.healthKey{font-weight:900;text-transform:capitalize}
.healthValue{
  min-width:88px;height:32px;padding:0 10px;border-radius:999px;
  display:inline-flex;align-items:center;justify-content:center;
  border:1px solid var(--border);font-size:12px;font-weight:950;background:rgba(255,255,255,.04)
}
.healthValue[data-status="UP"]{border-color:color-mix(in oklab,var(--success) 44%,var(--border));background:color-mix(in oklab,var(--success) 12%,transparent)}
.healthValue[data-status="DEGRADED"]{border-color:color-mix(in oklab,var(--warning) 44%,var(--border));background:color-mix(in oklab,var(--warning) 12%,transparent)}
.healthValue[data-status="DOWN"]{border-color:color-mix(in oklab,var(--danger) 44%,var(--border));background:color-mix(in oklab,var(--danger) 12%,transparent)}

.panelHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
.generatedAt{font-size:12px;color:var(--muted)}
.recentList{margin-top:12px;display:grid;gap:10px}
.recentItem{padding:14px;border-radius:18px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035)}
.recentTop,.recentMeta{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
.recentType{font-size:12px;font-weight:950;color:color-mix(in oklab,var(--accent) 78%,white)}
.recentTime{font-size:12px;color:var(--muted)}
.recentBody{margin-top:8px;line-height:1.55}
.recentMeta{margin-top:8px;font-size:12px;color:var(--muted)}
.recentMeta span[data-read="false"]{color:color-mix(in oklab,var(--warning) 80%,white)}
.notes{margin:10px 0 0;padding-left:18px;color:var(--muted);line-height:1.6}
.empty{margin-top:12px;color:var(--muted)}

@media (max-width:1024px){
  .grid4{grid-template-columns:repeat(2,minmax(0,1fr))}
  .grid3{grid-template-columns:repeat(2,minmax(0,1fr))}
  .healthGrid{grid-template-columns:1fr}
}
@media (max-width:680px){
  .page{padding:14px 12px 100px}
  .hero{flex-direction:column}
  .grid4,.grid3{grid-template-columns:1fr}
  .title{font-size:24px}
}
</style>