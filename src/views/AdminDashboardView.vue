<template>
  <div class="page">
    <section class="hero cardSurface">
      <div class="heroLeft">
        <div class="eyebrow">REALIFE OPS</div>
        <h1 class="title">Admin Dashboard</h1>
        <p class="sub">
          운영자가 지금 바로 봐야 하는 신호를 먼저 올리고, health / realtime / reminder / alerts / errors를
          한 화면에서 빠르게 스캔할 수 있게 구성했어요.
        </p>

        <div class="heroMeta">
          <span class="heroMetaChip">30초 자동 새로고침</span>
          <span class="heroMetaChip">서비스 {{ normalizedDashboard.service }}</span>
          <span class="heroMetaChip">버전 {{ normalizedDashboard.version }}</span>
        </div>
      </div>

      <div class="heroRight">
        <div class="heroStatusWrap">
          <div class="statusBadge" :data-status="normalizedDashboard.status">
            {{ normalizedDashboard.status }}
          </div>
          <div class="refreshMeta">
            <span>마지막 {{ lastLoadedText }}</span>
            <span>{{ fmtDateTime(normalizedDashboard.generatedAt) }}</span>
          </div>
        </div>

        <div class="heroButtons">
          <RlButton size="sm" variant="soft" @click="reloadAll" :loading="loading">
            새로고침
          </RlButton>
          <RlButton size="sm" variant="primary" @click="runAlertTest" :loading="alertTestLoading">
            Slack 테스트
          </RlButton>
        </div>
      </div>
    </section>

    <AsyncStatePanel
        v-if="loading && !dashboard"
        icon="⏳"
        title="운영 상태를 불러오는 중이에요"
        description="dashboard / health / realtime / reminder / alerts / errors를 한 번에 모으고 있어요."
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
        @primary="reloadAll"
    />

    <template v-else>
      <section v-if="selectedFailedContext" class="panel investigationPanel cardSurface">
        <div class="panelHead investigationHead">
          <div>
            <div class="panelTitle">현재 조사 중인 FAILED alert</div>
            <div class="panelSub">
              아래 운영 알림/서버 에러 중 관련 항목을 하이라이트해서 보여주고 있어요.
            </div>
          </div>

          <div class="investigationActions">
            <button type="button" class="opsActionBtn" @click="goToAlertHistory">
              관련 알림 보기
            </button>
            <button type="button" class="opsActionBtn" @click="goToErrors">
              관련 에러 보기
            </button>
            <button type="button" class="opsActionBtn opsActionBtn--danger" @click="clearFailedContext">
              조사 해제
            </button>
          </div>
        </div>

        <div class="investigationBody">
          <div class="investigationTitle">
            {{ selectedFailedContext.title || selectedFailedContext.alertKey || "FAILED ALERT" }}
          </div>
          <div class="opsAlertMetaRow">
            <span class="opsAlertChip">{{ selectedFailedContext.channel || "SLACK" }}</span>
            <span class="opsAlertChip" data-status="FAILED">{{ selectedFailedContext.status || "FAILED" }}</span>
            <span class="opsAlertChip" :data-level="selectedFailedContext.level">
              {{ selectedFailedContext.level || "WARNING" }}
            </span>
            <span v-if="selectedFailedContext.requestedBy" class="opsAlertChip">
              by {{ selectedFailedContext.requestedBy }}
            </span>
          </div>

          <div v-if="selectedFailedContext.alertKey" class="investigationKey">
            alertKey: {{ selectedFailedContext.alertKey }}
          </div>

          <div class="investigationText">
            {{ selectedFailedContext.body || "본문 없음" }}
          </div>

          <div class="investigationKeywords">
            <span class="investigationKeywordsLabel">매칭 키워드</span>
            <div class="investigationKeywordList">
              <span
                  v-for="keyword in focusKeywords"
                  :key="keyword"
                  class="investigationKeywordChip"
              >
                {{ keyword }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section v-if="failedAlertHistory.length" class="panel failedPinnedPanel cardSurface">
        <div class="panelHead failedPinnedHead">
          <div>
            <div class="panelTitle">FAILED alert 고정 섹션</div>
            <div class="panelSub">
              가장 먼저 봐야 하는 실패 알림만 위에 고정해서 보여주고, 바로 대응할 수 있게 했어요.
            </div>
          </div>

          <div class="failedPinnedHeadRight">
            <span class="anomalyCount">{{ failedAlertHistory.length }}건</span>

            <div class="failedActionBar">
              <button type="button" class="opsActionBtn" @click="runAlertTest">
                Slack 재테스트
              </button>
              <button type="button" class="opsActionBtn" @click="goToErrors">
                최근 에러 보기
              </button>
              <button type="button" class="opsActionBtn" @click="filterFailedAlerts">
                실패 알림만 보기
              </button>
            </div>
          </div>
        </div>

        <div class="failedPinnedList">
          <article
              v-for="item in failedAlertHistory"
              :key="item.id"
              class="failedPinnedCard"
              :data-active="selectedFailedContext?.id === item.id"
          >
            <div class="failedPinnedTop">
              <div>
                <strong class="failedPinnedTitle">{{ item.title || item.alertKey || "FAILED ALERT" }}</strong>
                <div class="opsAlertMetaRow">
                  <span class="opsAlertChip">{{ item.channel || "SLACK" }}</span>
                  <span class="opsAlertChip" data-status="FAILED">{{ item.status || "FAILED" }}</span>
                  <span class="opsAlertChip" :data-level="item.level">{{ item.level || "WARNING" }}</span>
                  <span v-if="item.requestedBy" class="opsAlertChip">by {{ item.requestedBy }}</span>
                </div>
              </div>
              <span class="opsAlertTime">{{ fmtDateTime(item.createdAt) }}</span>
            </div>

            <div v-if="item.alertKey" class="opsAlertKey">{{ item.alertKey }}</div>
            <div class="opsAlertBody">{{ item.body || "본문 없음" }}</div>

            <div class="failedCardActions">
              <button type="button" class="opsActionBtn opsActionBtn--danger" @click="inspectFailedAlert(item)">
                원인 확인
              </button>
              <button type="button" class="opsActionBtn" @click="runAlertTest">
                Slack 재테스트
              </button>
            </div>
          </article>
        </div>
      </section>

      <section class="priorityGrid">
        <article class="priorityCard cardSurface priorityCard--focus">
          <div class="priorityHead">
            <div>
              <div class="sectionEyebrow">OPS FOCUS</div>
              <div class="priorityTitle">지금 가장 먼저 볼 것</div>
            </div>
            <span class="priorityPill" :data-status="normalizedDashboard.status">
              {{ normalizedDashboard.status }}
            </span>
          </div>

          <div class="priorityMainText">{{ normalizedDashboard.insights.opsFocusTitle }}</div>
          <div class="prioritySubText">{{ normalizedDashboard.insights.opsFocusReason }}</div>

          <div class="priorityStats">
            <div class="priorityStat">
              <span>알림 실패</span>
              <strong>{{ failedCount }}</strong>
            </div>
            <div class="priorityStat">
              <span>최근 에러</span>
              <strong>{{ recentErrors.length }}</strong>
            </div>
            <div class="priorityStat">
              <span>실시간 상태</span>
              <strong>{{ normalizedDashboard.realtime.status }}</strong>
            </div>
          </div>
        </article>

        <article class="priorityCard cardSurface">
          <div class="priorityHead">
            <div>
              <div class="sectionEyebrow">SLACK TEST</div>
              <div class="priorityTitle">운영 알림 연결 확인</div>
            </div>
            <span class="priorityPill" :data-status="boolStatus(alertTestResult?.sent)">
              {{ alertTestResult ? (alertTestResult.sent ? "SENT" : "NOT_SENT") : "READY" }}
            </span>
          </div>

          <div class="signalGrid">
            <div class="signalItem">
              <span class="signalLabel">Channel</span>
              <strong>{{ alertTestResult?.channel || "SLACK" }}</strong>
            </div>
            <div class="signalItem">
              <span class="signalLabel">Enabled</span>
              <strong :data-status="boolStatus(alertTestResult?.enabled)">
                {{ boolText(alertTestResult?.enabled) }}
              </strong>
            </div>
            <div class="signalItem">
              <span class="signalLabel">Webhook</span>
              <strong :data-status="boolStatus(alertTestResult?.webhookConfigured)">
                {{ boolText(alertTestResult?.webhookConfigured) }}
              </strong>
            </div>
            <div class="signalItem">
              <span class="signalLabel">Checked</span>
              <strong>{{ fmtDateTime(alertTestResult?.checkedAt) }}</strong>
            </div>
          </div>

          <div v-if="alertTestResult" class="alertTestBox" :data-sent="alertTestResult.sent">
            <div class="alertTestTop">
              <strong>{{ alertTestResult.message }}</strong>
              <span>{{ alertTestResult.requestedBy || "ops" }}</span>
            </div>
            <div class="alertTestMeta">
              <span>{{ alertTestResult.application || "backend" }}</span>
              <span>{{ fmtDateTime(alertTestResult.checkedAt) }}</span>
            </div>
          </div>
          <div v-else class="empty">Slack 테스트는 아직 실행하지 않았어요.</div>
        </article>
      </section>

      <section class="grid2">
        <article class="panel recentNotificationsPanel cardSurface">
          <div class="panelHead">
            <div>
              <div class="panelTitle">최근 notification 5개</div>
              <div class="panelSub">운영자가 지금 실제 사용자 알림 흐름을 카드로 바로 볼 수 있게 정리했어요.</div>
            </div>
            <span class="anomalyCount">{{ recentNotificationCards.length }}건</span>
          </div>

          <div v-if="recentNotificationCards.length" class="recentNotificationList">
            <article
                v-for="item in recentNotificationCards"
                :key="item.id"
                class="recentNotificationCard"
                :data-read="item.read"
            >
              <div class="recentNotificationTop">
                <div class="recentNotificationTypeWrap">
                  <strong class="recentNotificationType">{{ item.type || "UNKNOWN" }}</strong>
                  <span class="recentNotificationReadChip" :data-read="item.read">
                    {{ item.read ? "READ" : "UNREAD" }}
                  </span>
                </div>
                <span class="recentNotificationTime">{{ fmtDateTime(item.createdAt) }}</span>
              </div>

              <div class="recentNotificationBody">
                {{ truncateText(item.body, 120) }}
              </div>

              <div class="recentNotificationMeta">
                <span class="recentNotificationMetaChip">user {{ shortUserId(item.userId) }}</span>
                <span class="recentNotificationMetaChip">{{ item.type }}</span>
              </div>
            </article>
          </div>
          <div v-else class="empty">최근 notification 데이터가 아직 없어요.</div>
        </article>

        <article v-if="anomalyList.length" class="panel anomalyPanel cardSurface">
          <div class="panelHead">
            <div>
              <div class="panelTitle">우선 대응이 필요한 이상 징후</div>
              <div class="panelSub">가장 위험하거나 운영자가 바로 확인해야 하는 이슈만 위로 올렸어요.</div>
            </div>
            <span class="anomalyCount">{{ anomalyList.length }}건</span>
          </div>

          <div class="anomalyList">
            <div
                v-for="item in anomalyList"
                :key="item.type"
                class="anomalyCard"
                :data-level="item.level"
            >
              <div class="anomalyTitleRow">
                <strong class="anomalyTitle">{{ item.title }}</strong>
                <span class="anomalyLevel" :data-level="item.level">{{ item.level.toUpperCase() }}</span>
              </div>
              <div class="anomalyDesc">{{ item.desc }}</div>
            </div>
          </div>
        </article>

        <article v-else class="panel cardSurface">
          <div class="panelHead">
            <div>
              <div class="panelTitle">이상 징후</div>
              <div class="panelSub">현재 감지된 이상 징후가 없어요.</div>
            </div>
          </div>
          <div class="empty">지금은 우선 대응이 필요한 이상 징후가 없습니다.</div>
        </article>
      </section>

      <section class="grid4">
        <article class="statCard cardSurface">
          <div class="label">SSE 연결</div>
          <div class="value">{{ normalizedDashboard.overview.activeSseConnections }}</div>
          <div class="hint">실시간 연결 수</div>
        </article>

        <article class="statCard cardSurface">
          <div class="label">미읽음 알림</div>
          <div class="value">{{ normalizedDashboard.overview.unreadNotifications }}</div>
          <div class="hint">전체 unread 기준</div>
        </article>

        <article class="statCard cardSurface">
          <div class="label">활성 핀</div>
          <div class="value">{{ normalizedDashboard.overview.activePins }}</div>
          <div class="hint">현재 진행 중 액션</div>
        </article>

        <article class="statCard cardSurface">
          <div class="label">오늘 알림</div>
          <div class="value">{{ normalizedDashboard.overview.todayCreatedNotifications }}</div>
          <div class="hint">최근 24시간 기준</div>
        </article>
      </section>

      <section class="grid3">
        <article class="panel cardSurface">
          <div class="panelHead">
            <div>
              <div class="panelTitle">Health Summary</div>
              <div class="panelSub">핵심 health 체크와 요약 메모를 함께 봐요.</div>
            </div>
            <span class="panelPill" :data-status="normalizedHealth.status">{{ normalizedHealth.status }}</span>
          </div>

          <div class="focusList compactList">
            <div class="focusRow">
              <span>Overall</span>
              <strong :data-status="normalizedHealth.status">{{ normalizedHealth.status }}</strong>
            </div>
            <div
                v-for="(status, key) in normalizedHealth.checks"
                :key="key"
                class="focusRow"
            >
              <span>{{ key }}</span>
              <strong :data-status="status">{{ status }}</strong>
            </div>
          </div>

          <ul v-if="normalizedDashboard.health.summaryNotes.length" class="summaryNotes">
            <li v-for="note in normalizedDashboard.health.summaryNotes" :key="note">{{ note }}</li>
          </ul>
          <div v-else class="empty">health summary note가 아직 없어요.</div>
        </article>

        <article class="panel cardSurface">
          <div class="panelHead">
            <div>
              <div class="panelTitle">Realtime 흐름</div>
              <div class="panelSub">SSE 연결과 마지막 이벤트 시각을 확인해요.</div>
            </div>
            <span class="panelPill" :data-status="normalizedDashboard.realtime.status">
              {{ normalizedDashboard.realtime.status }}
            </span>
          </div>

          <div class="focusList compactList">
            <div class="focusRow">
              <span>실시간 상태</span>
              <strong :data-status="normalizedDashboard.realtime.status">{{ normalizedDashboard.realtime.status }}</strong>
            </div>
            <div class="focusRow">
              <span>활성 SSE 연결</span>
              <strong>{{ normalizedDashboard.realtime.activeSseConnections }}</strong>
            </div>
            <div class="focusRow">
              <span>마지막 SSE 이벤트</span>
              <strong>{{ fmtDateTime(normalizedDashboard.realtime.lastSseEventSentAt) }}</strong>
            </div>
            <div class="focusRow">
              <span>health 체크 시각</span>
              <strong>{{ fmtDateTime(realtimeHealth?.serverTime || realtimeHealth?.checkedAt) }}</strong>
            </div>
          </div>
        </article>

        <article class="panel cardSurface">
          <div class="panelHead">
            <div>
              <div class="panelTitle">Reminder 흐름</div>
              <div class="panelSub">스케줄러 지연 여부를 빠르게 확인해요.</div>
            </div>
            <span class="panelPill" :data-status="normalizedDashboard.reminder.status">
              {{ normalizedDashboard.reminder.status }}
            </span>
          </div>

          <div class="focusList compactList">
            <div class="focusRow">
              <span>Reminder 상태</span>
              <strong :data-status="normalizedDashboard.reminder.status">{{ normalizedDashboard.reminder.status }}</strong>
            </div>
            <div class="focusRow">
              <span>마지막 실행</span>
              <strong>{{ fmtDateTime(normalizedDashboard.reminder.lastRunAt) }}</strong>
            </div>
            <div class="focusRow">
              <span>마지막 성공</span>
              <strong>{{ fmtDateTime(normalizedDashboard.reminder.lastSuccessAt) }}</strong>
            </div>
            <div class="focusRow">
              <span>최근 reminder 생성</span>
              <strong>{{ normalizedDashboard.health.recentReminderCreatedCount }}</strong>
            </div>
          </div>
        </article>
      </section>

      <section class="grid2">
        <article ref="alertHistorySection" class="panel cardSurface">
          <div class="panelHead panelHead--stackOnMobile">
            <div>
              <div class="panelTitle">
                최근 운영 알림 이력
                <span v-if="selectedFailedContext" class="sectionFocusLabel">관련 항목 하이라이트 중</span>
              </div>
              <div class="panelSub">
                실패 우선, 그 다음 위험 레벨 우선으로 빠르게 걸러볼 수 있게 했어요.
              </div>
            </div>

            <div class="filterChips">
              <button
                  v-for="option in alertFilterOptions"
                  :key="option.value"
                  type="button"
                  class="filterChip"
                  :data-active="selectedAlertFilter === option.value"
                  @click="selectedAlertFilter = option.value"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <div class="opsSummaryGrid">
            <div class="miniStat">
              <span class="miniLabel">전체</span>
              <strong class="miniValue">{{ alertHistory.length }}</strong>
            </div>
            <div class="miniStat">
              <span class="miniLabel">SENT</span>
              <strong class="miniValue">{{ sentCount }}</strong>
            </div>
            <div class="miniStat">
              <span class="miniLabel">FAILED</span>
              <strong class="miniValue">{{ failedCount }}</strong>
            </div>
            <div class="miniStat">
              <span class="miniLabel">HIGH LEVEL</span>
              <strong class="miniValue">{{ highLevelCount }}</strong>
            </div>
          </div>

          <div v-if="filteredAlertHistory.length" class="opsAlertList">
            <div
                v-for="item in filteredAlertHistory"
                :key="item.id"
                class="opsAlertItem"
                :data-status="item.status"
                :data-level="item.level"
                :data-related="isRelatedAlert(item)"
            >
              <div class="opsAlertTop">
                <div>
                  <strong class="opsAlertTitle">{{ item.title || item.alertKey || "운영 알림" }}</strong>
                  <div class="opsAlertMetaRow">
                    <span class="opsAlertChip">{{ item.channel || "SLACK" }}</span>
                    <span class="opsAlertChip" :data-status="item.status">{{ item.status || "UNKNOWN" }}</span>
                    <span class="opsAlertChip" :data-level="item.level">{{ item.level || "INFO" }}</span>
                    <span v-if="item.requestedBy" class="opsAlertChip">by {{ item.requestedBy }}</span>
                    <span
                        v-if="selectedFailedContext && isRelatedAlert(item)"
                        class="opsAlertChip opsAlertChip--related"
                    >
                      RELATED
                    </span>
                  </div>
                </div>
                <span class="opsAlertTime">{{ fmtDateTime(item.createdAt) }}</span>
              </div>

              <div v-if="item.alertKey" class="opsAlertKey">{{ item.alertKey }}</div>
              <div class="opsAlertBody">{{ item.body || "본문 없음" }}</div>
            </div>
          </div>
          <div v-else class="empty">선택한 필터에 해당하는 운영 알림 이력이 없어요.</div>
        </article>

        <article ref="errorsSection" class="panel cardSurface">
          <div class="panelHead">
            <div>
              <div class="panelTitle">
                최근 서버 에러
                <span v-if="selectedFailedContext" class="sectionFocusLabel">관련 항목 하이라이트 중</span>
              </div>
              <div class="panelSub">
                path / errorCode / traceId를 먼저 빠르게 확인할 수 있게 정리했어요.
              </div>
            </div>
          </div>

          <div v-if="sortedRecentErrors.length" class="errorList">
            <div
                v-for="item in sortedRecentErrors"
                :key="item.id"
                class="errorItem"
                :data-related="isRelatedError(item)"
            >
              <div class="errorTop">
                <strong>{{ item.errorCode || "ERROR" }}</strong>
                <span>{{ fmtDateTime(item.occurredAt) }}</span>
              </div>
              <div class="errorPath">{{ item.method }} {{ item.path }}</div>
              <div class="errorMessage">{{ item.message }}</div>
              <div v-if="item.traceId" class="errorTrace">traceId: {{ item.traceId }}</div>
              <div v-if="selectedFailedContext && isRelatedError(item)" class="relatedHint">
                현재 조사 중인 FAILED alert와 관련 가능성이 높은 에러예요.
              </div>
            </div>
          </div>
          <div v-else class="empty">최근 서버 에러가 없습니다.</div>
        </article>
      </section>

      <section class="grid2">
        <article class="panel cardSurface">
          <div class="panelHead">
            <div>
              <div class="panelTitle">전체 규모</div>
              <div class="panelSub">사용량과 데이터 규모를 운영 시점에서 간단히 봐요.</div>
            </div>
          </div>

          <div class="totalsGrid">
            <div class="totalCell">
              <span>Users</span>
              <strong>{{ normalizedDashboard.totals.users }}</strong>
            </div>
            <div class="totalCell">
              <span>Posts</span>
              <strong>{{ normalizedDashboard.totals.posts }}</strong>
            </div>
            <div class="totalCell">
              <span>Comments</span>
              <strong>{{ normalizedDashboard.totals.comments }}</strong>
            </div>
            <div class="totalCell">
              <span>Conversations</span>
              <strong>{{ normalizedDashboard.totals.conversations }}</strong>
            </div>
            <div class="totalCell">
              <span>Messages</span>
              <strong>{{ normalizedDashboard.totals.messages }}</strong>
            </div>
            <div class="totalCell">
              <span>Notifications</span>
              <strong>{{ normalizedDashboard.totals.notifications }}</strong>
            </div>
          </div>
        </article>

        <article class="panel cardSurface">
          <div class="panelHead">
            <div>
              <div class="panelTitle">알림 타입 분포</div>
              <div class="panelSub">최근 알림 중 어떤 유형이 많은지 비율로 확인해요.</div>
            </div>
          </div>

          <div v-if="notificationTypeCounts.length" class="typeCountList">
            <div v-for="item in notificationTypeCounts" :key="item.type" class="typeCountRow">
              <div class="typeCountLabel">
                <strong>{{ item.type }}</strong>
                <span>{{ item.count }}건</span>
              </div>
              <div class="typeCountBar">
                <span :style="{ width: `${Math.max(item.ratio || 0, 4)}%` }"></span>
              </div>
              <div class="typeCountRatio">{{ item.ratio }}%</div>
            </div>
          </div>
          <div v-else class="empty">알림 타입 집계가 아직 없어요.</div>
        </article>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, nextTick } from "vue";
import RlButton from "@/components/ui/RlButton.vue";
import AsyncStatePanel from "@/components/ui/AsyncStatePanel.vue";
import {
  fetchAdminDashboard,
  fetchAdminErrors,
  fetchAdminHealth,
  fetchAdminRealtimeHealth,
  fetchAdminReminderHealth,
  fetchOpsAlertHistory,
  sendOpsAlertTest,
} from "@/api/admin";
import { useToastStore } from "@/stores/toast";

const toast = useToastStore();

const loading = ref(false);
const error = ref("");
const dashboard = ref(null);
const health = ref(null);
const realtimeHealth = ref(null);
const reminderHealth = ref(null);
const recentErrors = ref([]);
const alertHistory = ref([]);
const alertTestLoading = ref(false);
const alertTestResult = ref(null);
const lastLoadedAt = ref(null);
const selectedAlertFilter = ref("all");
const selectedFailedContext = ref(null);
const errorsSection = ref(null);
const alertHistorySection = ref(null);

let timerId = null;

const alertFilterOptions = [
  { value: "all", label: "전체" },
  { value: "failed", label: "FAILED" },
  { value: "warning", label: "WARNING+" },
  { value: "sent", label: "SENT" },
];

const normalizedDashboard = computed(() => {
  const source = dashboard.value || {};
  return {
    status: source.status || "UNKNOWN",
    service: source.service || "backend",
    version: source.version || "-",
    generatedAt: source.generatedAt || null,
    overview: {
      activeSseConnections: source.overview?.activeSseConnections ?? 0,
      unreadNotifications: source.overview?.unreadNotifications ?? 0,
      activePins: source.overview?.activePins ?? 0,
      todayCreatedNotifications: source.overview?.todayCreatedNotifications ?? 0,
      todayCreatedMessages: source.overview?.todayCreatedMessages ?? 0,
      todayCreatedPosts: source.overview?.todayCreatedPosts ?? 0,
    },
    health: {
      summaryNotes: Array.isArray(source.health?.summaryNotes) ? source.health.summaryNotes : [],
      recentReminderCreatedCount: source.health?.recentReminderCreatedCount ?? 0,
    },
    recent: {
      notifications: Array.isArray(source.recent?.notifications) ? source.recent.notifications : [],
    },
    insights: {
      notificationTypeCounts: Array.isArray(source.insights?.notificationTypeCounts)
          ? source.insights.notificationTypeCounts
          : [],
      opsFocusTitle: source.insights?.opsFocusTitle || "현재 주목 포인트 없음",
      opsFocusReason: source.insights?.opsFocusReason || "대시보드 데이터가 아직 충분하지 않아요.",
      realtimeHealth: source.insights?.realtimeHealth || "UNKNOWN",
      reminderHealth: source.insights?.reminderHealth || "UNKNOWN",
    },
    realtime: {
      status: source.insights?.realtimeHealth || realtimeHealth.value?.status || "UNKNOWN",
      activeSseConnections:
          source.overview?.activeSseConnections ?? realtimeHealth.value?.activeSseConnections ?? 0,
      lastSseEventSentAt:
          source.health?.lastSseEventSentAt || realtimeHealth.value?.lastSseEventSentAt || null,
    },
    reminder: {
      status: source.insights?.reminderHealth || reminderHealth.value?.status || "UNKNOWN",
      lastRunAt: source.health?.lastReminderRunAt || reminderHealth.value?.lastRunAt || null,
      lastSuccessAt: source.health?.lastReminderSuccessAt || reminderHealth.value?.lastSuccessAt || null,
    },
    totals: {
      users: source.totals?.users ?? 0,
      posts: source.totals?.posts ?? 0,
      comments: source.totals?.comments ?? 0,
      conversations: source.totals?.conversations ?? 0,
      messages: source.totals?.messages ?? 0,
      notifications: source.totals?.notifications ?? 0,
    },
  };
});

const normalizedHealth = computed(() => ({
  status: health.value?.status || normalizedDashboard.value.status || "UNKNOWN",
  checks: health.value?.checks || {},
}));

const notificationTypeCounts = computed(() => normalizedDashboard.value.insights.notificationTypeCounts || []);

const recentNotificationCards = computed(() => {
  return normalizedDashboard.value.recent.notifications.slice(0, 5);
});

const focusKeywords = computed(() => {
  if (!selectedFailedContext.value) return [];

  const raw = [
    selectedFailedContext.value.alertKey,
    selectedFailedContext.value.title,
    selectedFailedContext.value.body,
    selectedFailedContext.value.level,
    selectedFailedContext.value.channel,
  ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

  const tokens = raw
      .replace(/[^a-z0-9가-힣/_:-]+/gi, " ")
      .split(/\s+/)
      .map((v) => v.trim())
      .filter(Boolean)
      .filter((v) => v.length >= 3)
      .filter((v) => !["failed", "warning", "danger", "slack", "alert", "ops", "the", "and"].includes(v));

  return [...new Set(tokens)].slice(0, 8);
});

const lastLoadedText = computed(() => {
  if (!lastLoadedAt.value) return "불러오기 전";

  const diffMs = Date.now() - new Date(lastLoadedAt.value).getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSec < 10) return "방금 전";
  if (diffSec < 60) return `${diffSec}초 전`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;

  return fmtDateTime(lastLoadedAt.value);
});

const sentCount = computed(() =>
    alertHistory.value.filter((item) => String(item.status || "").toUpperCase() === "SENT").length
);

const failedCount = computed(() =>
    alertHistory.value.filter((item) => String(item.status || "").toUpperCase() === "FAILED").length
);

const highLevelCount = computed(() =>
    alertHistory.value.filter((item) => {
      const level = String(item.level || "").toUpperCase();
      return level === "WARNING" || level === "DANGER";
    }).length
);

const failedAlertHistory = computed(() => {
  return [...alertHistory.value]
      .filter((item) => String(item.status || "").toUpperCase() === "FAILED")
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5);
});

const filteredAlertHistory = computed(() => {
  const sorted = [...alertHistory.value].sort((a, b) => {
    const statusA = String(a.status || "").toUpperCase() === "FAILED" ? 0 : 1;
    const statusB = String(b.status || "").toUpperCase() === "FAILED" ? 0 : 1;
    if (statusA !== statusB) return statusA - statusB;

    const levelRank = { DANGER: 0, WARNING: 1, INFO: 2, UNKNOWN: 3 };
    const levelA = levelRank[String(a.level || "UNKNOWN").toUpperCase()] ?? 3;
    const levelB = levelRank[String(b.level || "UNKNOWN").toUpperCase()] ?? 3;
    if (levelA !== levelB) return levelA - levelB;

    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  switch (selectedAlertFilter.value) {
    case "failed":
      return sorted.filter((item) => String(item.status || "").toUpperCase() === "FAILED");
    case "warning":
      return sorted.filter((item) => {
        const level = String(item.level || "").toUpperCase();
        return level === "WARNING" || level === "DANGER";
      });
    case "sent":
      return sorted.filter((item) => String(item.status || "").toUpperCase() === "SENT");
    default:
      return sorted;
  }
});

const sortedRecentErrors = computed(() => {
  return [...recentErrors.value].sort(
      (a, b) => new Date(b.occurredAt || 0).getTime() - new Date(a.occurredAt || 0).getTime()
  );
});

const anomalyList = computed(() => {
  const items = [];

  if (normalizedDashboard.value.status === "DOWN") {
    items.push({
      type: "overall-down",
      level: "danger",
      title: "전체 운영 상태가 DOWN 이에요",
      desc: "health / realtime / reminder 중 하나 이상이 심각한 상태예요. 즉시 원인 확인이 필요해요.",
    });
  } else if (normalizedDashboard.value.status === "DEGRADED") {
    items.push({
      type: "overall-degraded",
      level: "warning",
      title: "전체 운영 상태가 DEGRADED 예요",
      desc: "서비스는 살아 있지만 일부 지표가 좋지 않아요. health summary와 최근 alert를 먼저 확인하세요.",
    });
  }

  if (normalizedDashboard.value.realtime.status !== "UP") {
    items.push({
      type: "realtime",
      level: normalizedDashboard.value.realtime.status === "DOWN" ? "danger" : "warning",
      title: "SSE 실시간 상태가 정상이 아니에요",
      desc: `현재 realtime 상태는 ${normalizedDashboard.value.realtime.status} 이에요. 마지막 이벤트 시각과 활성 연결 수를 확인하세요.`,
    });
  }

  if (normalizedDashboard.value.reminder.status !== "UP") {
    items.push({
      type: "reminder",
      level: normalizedDashboard.value.reminder.status === "DOWN" ? "danger" : "warning",
      title: "Reminder scheduler 상태가 정상이 아니에요",
      desc: `현재 reminder 상태는 ${normalizedDashboard.value.reminder.status} 이에요. 마지막 실행/성공 시각을 먼저 보세요.`,
    });
  }

  if (failedCount.value > 0) {
    items.push({
      type: "failed-alert",
      level: "warning",
      title: "최근 운영 알림 실패가 있어요",
      desc: `FAILED 이력이 ${failedCount.value}건 있어요. Slack webhook 또는 payload를 점검하세요.`,
    });
  }

  if (recentErrors.value.length > 0) {
    items.push({
      type: "recent-errors",
      level: "warning",
      title: "최근 서버 에러가 수집됐어요",
      desc: `최근 서버 에러가 ${recentErrors.value.length}건 있어요. path / errorCode / traceId부터 확인하세요.`,
    });
  }

  return items;
});

function fmtDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function boolText(value) {
  if (value === undefined || value === null) return "-";
  return value ? "YES" : "NO";
}

function boolStatus(value) {
  if (value === undefined || value === null) return "UNKNOWN";
  return value ? "UP" : "DOWN";
}

function shortUserId(value) {
  const text = String(value || "");
  if (!text) return "-";
  if (text.length <= 8) return text;
  return `${text.slice(0, 8)}…`;
}

function truncateText(value, max = 120) {
  const text = String(value || "").trim();
  if (!text) return "본문 없음";
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function normalizeComparableText(value) {
  return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9가-힣/_:-]+/gi, " ");
}

function isRelatedByKeywords(targetText) {
  if (!selectedFailedContext.value) return false;
  const normalized = normalizeComparableText(targetText);
  if (!normalized.trim()) return false;
  return focusKeywords.value.some((keyword) => normalized.includes(keyword));
}

function isRelatedAlert(item) {
  if (!selectedFailedContext.value) return false;
  if (selectedFailedContext.value.id === item.id) return true;

  const keyA = String(selectedFailedContext.value.alertKey || "").trim().toLowerCase();
  const keyB = String(item.alertKey || "").trim().toLowerCase();
  if (keyA && keyB && keyA === keyB) return true;

  return isRelatedByKeywords([
    item.title,
    item.body,
    item.alertKey,
    item.level,
    item.channel,
  ].join(" "));
}

function isRelatedError(item) {
  if (!selectedFailedContext.value) return false;

  return isRelatedByKeywords([
    item.errorCode,
    item.message,
    item.path,
    item.method,
    item.traceId,
  ].join(" "));
}

async function scrollToRef(targetRef) {
  await nextTick();
  targetRef?.value?.scrollIntoView?.({ behavior: "smooth", block: "start" });
}

async function goToErrors() {
  await scrollToRef(errorsSection);
}

async function goToAlertHistory() {
  await scrollToRef(alertHistorySection);
}

async function filterFailedAlerts() {
  selectedAlertFilter.value = "failed";
  await goToAlertHistory();
}

async function inspectFailedAlert(item) {
  selectedFailedContext.value = item;
  selectedAlertFilter.value = "failed";
  toast.info(
      "실패 알림 조사 시작",
      item?.title || item?.alertKey || "관련 알림과 에러를 하이라이트해서 보여줘요."
  );
  await goToErrors();
}

function clearFailedContext() {
  selectedFailedContext.value = null;
}

async function reloadAll() {
  loading.value = true;
  error.value = "";

  try {
    const [dashboardRes, healthRes, realtimeRes, reminderRes, errorsRes, historyRes] = await Promise.all([
      fetchAdminDashboard(),
      fetchAdminHealth(),
      fetchAdminRealtimeHealth(),
      fetchAdminReminderHealth(),
      fetchAdminErrors(),
      fetchOpsAlertHistory(),
    ]);

    dashboard.value = dashboardRes;
    health.value = healthRes;
    realtimeHealth.value = realtimeRes;
    reminderHealth.value = reminderRes;
    recentErrors.value = Array.isArray(errorsRes) ? errorsRes : [];
    alertHistory.value = Array.isArray(historyRes) ? historyRes : [];
    lastLoadedAt.value = new Date().toISOString();

    if (selectedFailedContext.value) {
      const refreshed = alertHistory.value.find((item) => item.id === selectedFailedContext.value.id);
      if (refreshed) {
        selectedFailedContext.value = refreshed;
      } else {
        selectedFailedContext.value = null;
      }
    }
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || "운영 데이터를 불러오지 못했어요.";
  } finally {
    loading.value = false;
  }
}

async function runAlertTest() {
  alertTestLoading.value = true;

  try {
    const result = await sendOpsAlertTest();
    alertTestResult.value = result;
    toast.success("Slack 테스트 전송", result?.message || "운영 알림 테스트를 전송했어요.");
    await reloadAll();
  } catch (e) {
    const message = e?.response?.data?.message || e?.message || "Slack 테스트 전송에 실패했어요.";
    toast.error("Slack 테스트 실패", message);
  } finally {
    alertTestLoading.value = false;
  }
}

onMounted(async () => {
  await reloadAll();
  timerId = window.setInterval(reloadAll, 30000);
});

onBeforeUnmount(() => {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
});
</script>

<style scoped>
.page{
  display:grid;
  gap:18px;
  padding:20px 16px 40px;
}
.cardSurface{
  border:1px solid var(--border);
  border-radius:24px;
  background:
      radial-gradient(circle at top right, rgba(124,156,255,.10), transparent 28%),
      linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.015)),
      var(--surface);
  box-shadow:0 14px 34px rgba(0,0,0,.14);
}
.hero{
  padding:24px;
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:18px;
}
.heroLeft{ display:grid; gap:10px; }
.eyebrow,
.sectionEyebrow{
  font-size:12px;
  font-weight:900;
  letter-spacing:.12em;
  color:var(--muted);
}
.title{
  margin:0;
  font-size:34px;
  line-height:1.08;
}
.sub,
.panelSub,
.hint,
.empty,
.anomalyDesc,
.opsAlertBody,
.errorMessage,
.summaryNotes,
.alertTestMeta,
.investigationText{
  color:var(--muted);
  line-height:1.6;
}
.heroMeta{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
}
.heroMetaChip,
.filterChip,
.opsAlertChip,
.priorityPill,
.panelPill,
.statusBadge,
.anomalyLevel,
.anomalyCount,
.recentNotificationReadChip,
.recentNotificationMetaChip,
.investigationKeywordChip,
.sectionFocusLabel{
  border-radius:999px;
  border:1px solid var(--border);
  padding:7px 11px;
  font-size:12px;
  font-weight:900;
  background:rgba(255,255,255,.04);
}
.heroRight{
  display:grid;
  gap:12px;
  justify-items:end;
}
.heroStatusWrap{ display:grid; gap:8px; justify-items:end; }
.statusBadge[data-status="UP"],
.panelPill[data-status="UP"],
.priorityPill[data-status="UP"],
strong[data-status="UP"]{
  color:var(--success);
}
.statusBadge[data-status="DEGRADED"],
.panelPill[data-status="DEGRADED"],
.priorityPill[data-status="DEGRADED"],
strong[data-status="DEGRADED"]{
  color:var(--warning);
}
.statusBadge[data-status="DOWN"],
.panelPill[data-status="DOWN"],
.priorityPill[data-status="DOWN"],
strong[data-status="DOWN"]{
  color:var(--danger);
}
.refreshMeta{
  display:grid;
  gap:2px;
  text-align:right;
  font-size:12px;
  color:var(--muted);
}
.heroButtons{ display:flex; gap:8px; flex-wrap:wrap; }
.priorityGrid,
.grid4,
.grid3,
.grid2{
  display:grid;
  gap:12px;
}
.priorityGrid{ grid-template-columns:1.15fr .85fr; }
.grid4{ grid-template-columns:repeat(4, minmax(0,1fr)); }
.grid3{ grid-template-columns:repeat(3, minmax(0,1fr)); }
.grid2{ grid-template-columns:repeat(2, minmax(0,1fr)); }
.priorityCard,
.panel,
.statCard{
  padding:18px;
}
.priorityCard,
.panel{
  display:grid;
  gap:14px;
}
.priorityCard--focus{
  border-color:color-mix(in oklab, var(--accent) 36%, var(--border));
  background:
      radial-gradient(circle at top right, color-mix(in oklab, var(--accent) 22%, transparent), transparent 30%),
      linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.018)),
      var(--surface);
}
.priorityHead,
.panelHead,
.opsAlertTop,
.errorTop,
.alertTestTop,
.anomalyTitleRow,
.failedPinnedTop,
.recentNotificationTop,
.investigationHead{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
}
.priorityTitle,
.panelTitle{
  font-size:20px;
  font-weight:900;
}
.sectionFocusLabel{
  margin-left:8px;
  color:var(--accent);
}
.investigationPanel{
  border-color:color-mix(in oklab, var(--accent) 34%, var(--border));
  background:
      radial-gradient(circle at top right, color-mix(in oklab, var(--accent) 14%, transparent), transparent 35%),
      linear-gradient(180deg, rgba(124,156,255,.08), rgba(124,156,255,.03)),
      var(--surface);
}
.investigationActions{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
}
.investigationBody{
  display:grid;
  gap:10px;
}
.investigationTitle{
  font-size:18px;
  font-weight:950;
}
.investigationKey{
  font-size:12px;
  color:var(--muted);
  word-break:break-all;
}
.investigationKeywords{
  display:grid;
  gap:8px;
}
.investigationKeywordsLabel{
  font-size:12px;
  color:var(--muted);
  font-weight:800;
}
.investigationKeywordList{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
}
.failedPinnedHead{
  align-items:flex-start;
}
.failedPinnedHeadRight{
  display:grid;
  gap:10px;
  justify-items:end;
}
.failedActionBar{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  justify-content:flex-end;
}
.opsActionBtn{
  border:1px solid var(--border);
  background:rgba(255,255,255,.05);
  color:var(--text);
  border-radius:12px;
  padding:10px 12px;
  font-weight:800;
  font-size:13px;
  cursor:pointer;
}
.opsActionBtn--danger{
  border-color:color-mix(in oklab, var(--danger) 36%, var(--border));
  background:color-mix(in oklab, var(--danger) 10%, transparent);
  color:var(--danger);
}
.priorityMainText{
  font-size:24px;
  font-weight:950;
  line-height:1.28;
}
.prioritySubText{
  color:var(--muted);
  line-height:1.6;
}
.priorityStats,
.signalGrid,
.opsSummaryGrid,
.totalsGrid{
  display:grid;
  gap:10px;
}
.priorityStats{ grid-template-columns:repeat(3, minmax(0,1fr)); }
.signalGrid{ grid-template-columns:repeat(2, minmax(0,1fr)); }
.opsSummaryGrid{ grid-template-columns:repeat(4, minmax(0,1fr)); }
.totalsGrid{ grid-template-columns:repeat(3, minmax(0,1fr)); }
.priorityStat,
.signalItem,
.focusRow,
.miniStat,
.totalCell,
.typeCountRow,
.errorItem,
.opsAlertItem,
.alertTestBox,
.failedPinnedCard,
.recentNotificationCard{
  border:1px solid var(--border);
  border-radius:18px;
  background:rgba(255,255,255,.035);
}
.priorityStat,
.signalItem,
.miniStat,
.totalCell{
  padding:14px 15px;
  display:grid;
  gap:6px;
}
.priorityStat span,
.signalLabel,
.label,
.miniLabel,
.totalCell span{
  color:var(--muted);
  font-size:12px;
  font-weight:800;
}
.priorityStat strong,
.miniValue,
.value,
.totalCell strong{
  font-size:26px;
  font-weight:950;
}
.statCard{ display:grid; gap:8px; }
.focusList,
.opsAlertList,
.errorList,
.typeCountList,
.anomalyList,
.failedPinnedList,
.recentNotificationList{
  display:grid;
  gap:12px;
}
.compactList .focusRow{ min-height:48px; }
.focusRow,
.typeCountRow{
  padding:12px 14px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
}
.summaryNotes{
  margin:0;
  padding-left:18px;
}
.anomalyPanel{
  border-color:rgba(255,120,0,.34);
  background:
      radial-gradient(circle at top right, rgba(255,140,0,.10), transparent 30%),
      linear-gradient(180deg, rgba(255,120,0,.08), rgba(255,120,0,.03)),
      var(--surface);
}
.failedPinnedPanel{
  border-color:rgba(255,93,93,.34);
  background:
      radial-gradient(circle at top right, rgba(255,93,93,.12), transparent 34%),
      linear-gradient(180deg, rgba(255,93,93,.08), rgba(255,93,93,.03)),
      var(--surface);
}
.failedPinnedCard{
  padding:14px 16px;
  border-color:color-mix(in oklab, var(--danger) 34%, var(--border));
  background:color-mix(in oklab, var(--danger) 8%, transparent);
}
.failedPinnedCard[data-active="true"]{
  box-shadow:0 0 0 2px color-mix(in oklab, var(--accent) 40%, transparent);
}
.failedPinnedTitle{
  font-size:16px;
  font-weight:950;
}
.failedCardActions{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  margin-top:12px;
}
.recentNotificationsPanel{
  min-height:100%;
}
.recentNotificationCard{
  padding:14px 16px;
}
.recentNotificationCard[data-read="false"]{
  border-color:color-mix(in oklab, var(--accent) 34%, var(--border));
  background:color-mix(in oklab, var(--accent) 8%, transparent);
}
.recentNotificationTypeWrap{
  display:flex;
  gap:8px;
  align-items:center;
  flex-wrap:wrap;
}
.recentNotificationType{
  font-size:15px;
  font-weight:900;
}
.recentNotificationReadChip[data-read="false"]{
  border-color:color-mix(in oklab, var(--warning) 34%, var(--border));
  background:color-mix(in oklab, var(--warning) 10%, transparent);
  color:var(--warning);
}
.recentNotificationReadChip[data-read="true"]{
  border-color:color-mix(in oklab, var(--success) 34%, var(--border));
  background:color-mix(in oklab, var(--success) 10%, transparent);
  color:var(--success);
}
.recentNotificationBody{
  margin-top:10px;
  line-height:1.6;
}
.recentNotificationMeta{
  margin-top:10px;
  display:flex;
  gap:8px;
  flex-wrap:wrap;
}
.recentNotificationTime,
.opsAlertTime,
.errorTrace,
.opsAlertKey{
  color:var(--muted);
  font-size:12px;
}
.anomalyCard{
  padding:14px 15px;
  border-radius:18px;
  border:1px solid rgba(255,255,255,.10);
}
.anomalyCard[data-level="warning"]{
  border-color:#f6c344;
  background:rgba(246,195,68,.12);
}
.anomalyCard[data-level="danger"]{
  border-color:#ff5d5d;
  background:rgba(255,93,93,.14);
}
.anomalyLevel[data-level="warning"]{ color:var(--warning); }
.anomalyLevel[data-level="danger"]{ color:var(--danger); }
.filterChips{ display:flex; gap:8px; flex-wrap:wrap; }
.filterChip{ cursor:pointer; }
.filterChip[data-active="true"]{
  background:color-mix(in oklab, var(--accent) 18%, transparent);
  border-color:color-mix(in oklab, var(--accent) 34%, var(--border));
}
.opsAlertItem,
.errorItem{
  padding:14px 16px;
}
.opsAlertItem[data-status="FAILED"]{
  border-color:color-mix(in oklab, var(--danger) 34%, var(--border));
  background:color-mix(in oklab, var(--danger) 8%, transparent);
}
.opsAlertItem[data-level="WARNING"]{
  box-shadow:inset 0 0 0 1px color-mix(in oklab, var(--warning) 24%, transparent);
}
.opsAlertItem[data-level="DANGER"]{
  box-shadow:inset 0 0 0 1px color-mix(in oklab, var(--danger) 24%, transparent);
}
.opsAlertItem[data-related="true"],
.errorItem[data-related="true"]{
  border-color:color-mix(in oklab, var(--accent) 44%, var(--border));
  box-shadow:0 0 0 2px color-mix(in oklab, var(--accent) 28%, transparent);
  background:color-mix(in oklab, var(--accent) 8%, transparent);
}
.relatedHint{
  margin-top:10px;
  font-size:12px;
  color:var(--accent);
  font-weight:800;
}
.opsAlertTitle,
.errorPath{
  font-weight:900;
}
.opsAlertMetaRow{
  margin-top:8px;
  display:flex;
  gap:8px;
  flex-wrap:wrap;
}
.opsAlertChip[data-status="SENT"]{
  border-color:color-mix(in oklab, var(--success) 36%, var(--border));
  background:color-mix(in oklab, var(--success) 10%, transparent);
}
.opsAlertChip[data-status="FAILED"]{
  border-color:color-mix(in oklab, var(--danger) 36%, var(--border));
  background:color-mix(in oklab, var(--danger) 10%, transparent);
}
.opsAlertChip[data-level="WARNING"]{
  border-color:color-mix(in oklab, var(--warning) 36%, var(--border));
  background:color-mix(in oklab, var(--warning) 10%, transparent);
}
.opsAlertChip[data-level="DANGER"]{
  border-color:color-mix(in oklab, var(--danger) 36%, var(--border));
  background:color-mix(in oklab, var(--danger) 10%, transparent);
}
.opsAlertChip--related{
  border-color:color-mix(in oklab, var(--accent) 36%, var(--border));
  background:color-mix(in oklab, var(--accent) 10%, transparent);
  color:var(--accent);
}
.alertTestBox[data-sent="true"]{
  border-color:color-mix(in oklab, var(--success) 36%, var(--border));
  background:color-mix(in oklab, var(--success) 8%, transparent);
}
.typeCountRow{
  grid-template-columns:minmax(0, 1fr) minmax(140px, 1.2fr) auto;
}
.typeCountLabel{
  display:grid;
  gap:4px;
}
.typeCountLabel span,
.typeCountRatio{
  color:var(--muted);
  font-size:12px;
}
.typeCountBar{
  height:10px;
  border-radius:999px;
  background:rgba(255,255,255,.06);
  overflow:hidden;
}
.typeCountBar span{
  display:block;
  height:100%;
  border-radius:999px;
  background:linear-gradient(90deg, rgba(124,156,255,.85), rgba(124,156,255,.38));
}
@media (max-width: 1180px){
  .grid4,
  .grid3,
  .opsSummaryGrid,
  .totalsGrid{
    grid-template-columns:repeat(2, minmax(0,1fr));
  }
  .priorityGrid,
  .grid2{
    grid-template-columns:1fr;
  }
}
@media (max-width: 780px){
  .hero,
  .priorityHead,
  .panelHead,
  .opsAlertTop,
  .errorTop,
  .alertTestTop,
  .anomalyTitleRow,
  .failedPinnedTop,
  .recentNotificationTop,
  .investigationHead,
  .failedPinnedHead{
    flex-direction:column;
  }
  .heroRight,
  .heroStatusWrap,
  .failedPinnedHeadRight{
    justify-items:start;
  }
  .failedActionBar,
  .investigationActions{
    justify-content:flex-start;
  }
  .priorityStats,
  .signalGrid,
  .grid4,
  .grid3,
  .grid2,
  .opsSummaryGrid,
  .totalsGrid{
    grid-template-columns:1fr;
  }
  .typeCountRow{
    grid-template-columns:1fr;
    align-items:flex-start;
  }
}
</style>