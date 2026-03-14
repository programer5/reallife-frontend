<template>
  <div class="page">
    <section class="heroCard">
      <div class="heroTop">
        <div class="identity">
          <img v-if="avatarUrl" :src="avatarUrl" class="avatarImg" alt="avatar" />
          <div v-else class="avatar fallback">{{ initials }}</div>

          <div class="heroMeta">
            <div class="heroEyebrow">MY REALIFE</div>
            <div class="heroName">{{ form.name || me?.name || "사용자" }}</div>
            <div class="heroHandle">@{{ me?.handle || "user" }}</div>
            <div class="heroSub">
              프로필은 단순 소개가 아니라, 대화와 팔로우가 시작되는 첫 인상이야.
              Reminder 설정까지 맞춰두면 약속·할일 흐름을 더 자연스럽게 이어갈 수 있어.
            </div>
          </div>
        </div>

        <div class="heroActions">
          <button class="softBtn" type="button" @click="goMyPublicProfile" :disabled="!me?.handle">
            내 공개 프로필 보기
          </button>
          <button class="ghostBtn" type="button" @click="refreshAll" :disabled="loading">
            새로고침
          </button>
          <button class="dangerBtn" type="button" @click="onLogout" :disabled="loading">
            로그아웃
          </button>
        </div>
      </div>

      <div class="heroStats">
        <div class="heroStat">
          <strong>{{ publicProfile?.followerCount ?? 0 }}</strong>
          <span>팔로워</span>
        </div>
        <div class="heroStat">
          <strong>{{ publicProfile?.followingCount ?? 0 }}</strong>
          <span>팔로잉</span>
        </div>
        <div class="heroStat">
          <strong>{{ completionPercent }}%</strong>
          <span>프로필 완성도</span>
        </div>
      </div>
    </section>

    <section class="flowCard toneHistoryCard">
      <div class="flowHead">
        <div>
          <div class="title">오늘의 내 흐름</div>
          <div class="sub">프로필, Reminder, 다음 이동까지 어디부터 손보면 좋을지 빠르게 보여줘요.</div>
        </div>
      </div>

      <div class="flowGrid">
        <div class="flowItem">
          <div class="flowLabel">지금 먼저 볼 것</div>
          <div class="flowValue">{{ nextMoveTitle }}</div>
          <div class="flowHint">{{ flowPrimaryHint }}</div>
        </div>

        <div class="flowItem">
          <div class="flowLabel">왜 지금 중요한가</div>
          <div class="flowValue">{{ flowReasonTitle }}</div>
          <div class="flowHint">{{ flowReasonHint }}</div>
        </div>

        <div class="flowItem">
          <div class="flowLabel">어디로 이어질까</div>
          <div class="flowValue">{{ flowDestinationTitle }}</div>
          <div class="flowHint">{{ flowDestinationHint }}</div>
        </div>
      </div>

      <div class="flowPills">
        <span class="flowPill" :data-tone="completionPercent >= 100 ? 'good' : completionPercent >= 50 ? 'warn' : 'soft'">
          프로필 {{ completionPercent }}%
        </span>
        <span class="flowPill" :data-tone="reminderEnabledCount >= 2 ? 'good' : reminderEnabledCount === 1 ? 'warn' : 'soft'">
          Reminder {{ reminderEnabledCount }}/3
        </span>
        <span class="flowPill" :data-tone="publicProfile?.followerCount ? 'good' : 'soft'">
          팔로워 {{ publicProfile?.followerCount ?? 0 }}명
        </span>
        <span class="flowPill" :data-tone="me?.handle ? 'good' : 'soft'">
          공개 프로필 {{ me?.handle ? '준비됨' : '준비 전' }}
        </span>
      </div>
    </section>

    <section v-if="showOpsAccessDenied" class="noticeCard">
      <div class="noticeTop">
        <div>
          <div class="noticeTitle">운영 도구 접근이 제한돼 있어요</div>
          <div class="noticeBody">
            현재 계정은 프론트 운영자 허용 목록에 포함되지 않았어요.
            운영자 노출은 백엔드 권한이 아니라 프론트 env의
            <code>VITE_OPS_ALLOWED_EMAILS</code> / <code>VITE_OPS_ALLOWED_HANDLES</code> 기준으로 판단해요.
          </div>
        </div>
        <span class="noticeBadge">OPS DENIED</span>
      </div>

      <div class="noticeGrid">
        <div class="noticeItem">
          <div class="noticeLabel">현재 계정</div>
          <div class="noticeValue">{{ me?.email || "-" }}</div>
          <div class="noticeHint">@{{ me?.handle || "-" }}</div>
        </div>

        <div class="noticeItem">
          <div class="noticeLabel">허용 이메일 목록</div>
          <div class="noticeValue">{{ opsAllowedEmailsText }}</div>
          <div class="noticeHint">쉼표(,) 기준으로 비교해요.</div>
        </div>

        <div class="noticeItem">
          <div class="noticeLabel">허용 핸들 목록</div>
          <div class="noticeValue">{{ opsAllowedHandlesText }}</div>
          <div class="noticeHint">대소문자 구분 없이 비교해요.</div>
        </div>
      </div>

      <ol class="noticeSteps">
        <li>프론트 프로젝트의 <code>.env.local</code> 또는 <code>.env.production</code>에 운영자 이메일/핸들을 넣어요.</li>
        <li>예: <code>VITE_OPS_ALLOWED_EMAILS={{ me?.email || "seed@test.com" }}</code></li>
        <li>예: <code>VITE_OPS_ALLOWED_HANDLES={{ me?.handle || "seed_001" }}</code></li>
        <li>프론트를 재시작하거나 재빌드한 뒤 <code>/me</code>를 다시 열어요.</li>
      </ol>

      <div class="noticeActions">
        <button class="softBtn" type="button" @click="refreshAll" :disabled="loading">다시 확인</button>
        <button class="ghostBtn" type="button" @click="goOpsEnvGuide">설정 위치 보기</button>
      </div>

      <div class="noticeGuideGrid">
        <div class="noticeGuideItem">
          <div class="noticeLabel">설정 위치</div>
          <div class="noticeValue">{{ opsEnvFileHint }}</div>
          <div class="noticeHint">백엔드 <code>.env</code>가 아니라 프론트 Vite env 파일이에요.</div>
        </div>

        <div class="noticeGuideItem">
          <div class="noticeLabel">지금 추가하면 좋은 값</div>
          <div class="noticeValue">{{ opsEnvExample }}</div>
          <div class="noticeHint">현재 로그인 계정 기준으로 바로 복붙할 수 있게 보여줘요.</div>
        </div>
      </div>
    </section>

    <section v-if="isOpsUser" class="opsCard">
      <div class="opsHead">
        <div>
          <div class="title">운영 도구</div>
          <div class="sub">
            운영 대시보드, Slack 알림 테스트, 최근 운영 알림 이력까지 바로 확인할 수 있어요.
          </div>
        </div>
        <span class="opsBadge">OPS</span>
      </div>

      <div class="opsGrid">
        <button class="opsItem" type="button" @click="goOpsDashboard">
          <strong>운영 대시보드 열기</strong>
          <span>Health, Errors, Slack test, Alert history를 한 화면에서 확인해요.</span>
        </button>

        <button class="opsItem" type="button" @click="goOpsDashboard">
          <strong>Slack 연결 확인</strong>
          <span>운영 알림 테스트를 보내고 최근 운영 알림 이력까지 바로 검증할 수 있어요.</span>
        </button>

        <div class="opsInfo">
          <div class="opsInfoLabel">운영자 식별 기준</div>
          <div class="opsInfoValue">
            {{ me?.email || "-" }} / @{{ me?.handle || "-" }}
          </div>
          <div class="opsInfoHint">
            프론트 env의 <b>VITE_OPS_ALLOWED_EMAILS</b> 또는 <b>VITE_OPS_ALLOWED_HANDLES</b> 기준으로 노출돼요.
            현재는 <b>{{ opsMatchBasis }}</b> 기준으로 허용된 상태예요.
            대시보드 마감 단계에서는 health → failed alert → alert history 순으로 보는 흐름이 가장 빨라요.
          </div>
        </div>
      </div>
    </section>

    <section class="statusCard">
      <div class="statusHead">
        <div>
          <div class="title">지금 내 상태</div>
          <div class="sub">프로필과 Reminder 설정이 현재 어떤 준비 상태인지 한 번에 보여줘요.</div>
        </div>
      </div>

      <div class="statusGrid">
        <div class="statusItem">
          <div class="statusLabel">프로필 상태</div>
          <div class="statusValue">
            {{
              completionPercent >= 100
                  ? "완료"
                  : completionPercent >= 50
                      ? "거의 준비됨"
                      : "더 다듬는 중"
            }}
          </div>
          <div class="statusHint">
            {{
              completionPercent >= 100
                  ? "이제 공개 프로필과 DM 전환이 자연스러워요."
                  : "이름, 소개, 링크, 사진을 채우면 더 서비스답게 보여요."
            }}
          </div>
        </div>

        <div class="statusItem">
          <div class="statusLabel">Reminder 감각</div>
          <div class="statusValue">{{ reminderStatusTitle }}</div>
          <div class="statusHint">{{ reminderStatusDescription }}</div>
        </div>

        <div class="statusItem">
          <div class="statusLabel">다음 추천 행동</div>
          <div class="statusValue">{{ nextMoveTitle }}</div>
          <div class="statusHint">{{ nextMoveDescription }}</div>
        </div>
      </div>
    </section>

    <section class="priorityCard">
      <div class="priorityHead">
        <div>
          <div class="title">오늘의 우선 액션</div>
          <div class="sub">지금 이 화면에서 바로 끝낼 수 있는 한 가지를 먼저 추천해요.</div>
        </div>
        <span class="priorityBadge">{{ priorityBadge }}</span>
      </div>

      <div class="priorityBody">
        <div class="priorityMain">
          <div class="priorityLabel">지금 추천</div>
          <div class="priorityTitle">{{ nextMoveTitle }}</div>
          <div class="priorityHint">{{ nextMoveDescription }}</div>
        </div>

        <div class="priorityActions">
          <button v-if="completionPercent < 100" class="primaryBtn" type="button" @click="focusProfileEditor">프로필 바로 다듬기</button>
          <button v-else-if="reminderEnabledCount === 0" class="primaryBtn" type="button" @click="toggleBrowserNotify">브라우저 알림 켜기</button>
          <button v-else class="primaryBtn" type="button" @click="router.push('/inbox')">Connect로 이어가기</button>
          <button class="ghostBtn" type="button" @click="goMyPublicProfile" :disabled="!me?.handle">공개 프로필 보기</button>
        </div>
      </div>
    </section>

    <section class="progressCard">
      <div>
        <div class="title">프로필 완성도</div>
        <div class="sub">이름, 소개, 링크, 사진을 채우면 팔로우와 DM 전환이 더 자연스러워져요.</div>
      </div>

      <div class="progressSide">
        <div class="progressValue">{{ completionPercent }}%</div>
        <div class="progressBar">
          <span :style="{ width: completionPercent + '%' }"></span>
        </div>
      </div>

      <div class="checkGrid">
        <div
            v-for="item in completionItems"
            :key="item.key"
            class="checkItem"
            :data-done="item.done"
        >
          <span class="checkIcon">{{ item.done ? "✓" : "•" }}</span>
          <div>
            <div class="checkLabel">{{ item.label }}</div>
            <div class="checkHint">{{ item.hint }}</div>
          </div>
        </div>
      </div>
    </section>

    <section class="card settingsCard">
      <div class="sectionHead">
        <div>
          <div class="title">Reminder 설정</div>
          <div class="sub">
            약속·할일 리마인더를 어떤 방식으로 받을지 정해두면, Connect와 대화 흐름이 훨씬 실사용형으로 바뀌어요.
          </div>
        </div>
      </div>

      <div class="settingGrid">
        <button class="settingItem" type="button" @click="toggleBrowserNotify">
          <div class="settingText">
            <strong>브라우저 알림</strong>
            <span>다가오는 리마인더를 시스템 알림으로 먼저 알려줘요.</span>
          </div>
          <span class="settingState" :data-on="settings.pinRemindBrowserNotify">
            {{ settings.pinRemindBrowserNotify ? "ON" : "OFF" }}
          </span>
        </button>

        <button class="settingItem" type="button" @click="settings.togglePinRemindSound()">
          <div class="settingText">
            <strong>사운드</strong>
            <span>바로 확인이 필요할 때 소리로 존재감을 줘요.</span>
          </div>
          <span class="settingState" :data-on="settings.pinRemindSound">
            {{ settings.pinRemindSound ? "ON" : "OFF" }}
          </span>
        </button>

        <button class="settingItem" type="button" @click="settings.togglePinRemindVibrate()">
          <div class="settingText">
            <strong>진동</strong>
            <span>지원되는 기기에서 더 촉각적으로 알려줘요.</span>
          </div>
          <span class="settingState" :data-on="settings.pinRemindVibrate">
            {{ settings.pinRemindVibrate ? "ON" : "OFF" }}
          </span>
        </button>
      </div>

      <div class="settingFoot">
        <div class="settingFootTitle">현재 Reminder 구성</div>
        <div class="settingFootBody">
          {{ reminderStatusDescription }}
        </div>
      </div>
    </section>

    <section ref="profileEditorSection" class="card">
      <div class="sectionHead">
        <div>
          <div class="title">프로필 편집</div>
          <div class="sub">이름, 소개, 웹사이트, 사진을 한 번에 바꿀 수 있어요.</div>
        </div>
        <button class="primaryBtn" type="button" @click="saveProfile" :disabled="saving">
          {{ saving ? "저장 중..." : "저장" }}
        </button>
      </div>

      <div class="formGrid">
        <label class="label avatarCol">
          프로필 사진

          <div class="avatarPanel">
            <img v-if="avatarUrl" :src="avatarUrl" class="avatarLg" alt="avatar" />
            <div v-else class="avatarLg fallback">{{ initials }}</div>

            <div class="avatarBtns">
              <button class="softBtn" type="button" @click="onPickAvatar">사진 변경</button>
              <button class="ghostBtn" type="button" @click="clearAvatar" :disabled="saving">사진 제거</button>
            </div>

            <div class="microHint">정사각형 사진이 가장 자연스럽게 보여요.</div>
            <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onUploadAvatar" />
          </div>
        </label>

        <div class="fields">
          <label class="label">
            이름
            <input v-model.trim="form.name" class="input" maxlength="30" placeholder="표시될 이름" />
          </label>

          <label class="label">
            소개
            <textarea
                v-model.trim="form.bio"
                class="textarea"
                rows="4"
                maxlength="255"
                placeholder="예) 커피 좋아하고, 밤에 개발해요"
            ></textarea>
            <div class="count">{{ (form.bio || "").length }}/255</div>
          </label>

          <label class="label">
            웹사이트
            <input v-model.trim="form.website" class="input" placeholder="https://example.com" />
            <div class="microHint">블로그, 포트폴리오, 링크 모음 페이지도 좋아요.</div>
          </label>
        </div>
      </div>
    </section>

    <section class="card twoCol">
      <div>
        <div class="sectionHead compact">
          <div>
            <div class="title">공개 프로필 미리보기</div>
            <div class="sub">다른 사용자가 보게 될 모습이에요.</div>
          </div>
        </div>

        <div class="preview">
          <div class="previewName">{{ form.name || me?.name || "사용자" }}</div>
          <div class="previewHandle">@{{ me?.handle || "user" }}</div>

          <div v-if="form.bio" class="previewBio">{{ form.bio }}</div>
          <div v-else class="previewEmpty">
            소개를 적으면 다른 사람이 나를 더 쉽게 이해하고 팔로우/DM 전환도 자연스러워져요.
          </div>

          <a
              v-if="form.website"
              class="previewWebsite"
              :href="websiteUrl(form.website)"
              target="_blank"
              rel="noreferrer"
          >
            {{ form.website }}
          </a>
        </div>
      </div>

      <div>
        <div class="sectionHead compact">
          <div>
            <div class="title">바로 이어서 할 것</div>
            <div class="sub">프로필을 다듬은 뒤 RealLife 흐름으로 자연스럽게 이어가요.</div>
          </div>
        </div>

        <div class="nextList">
          <button class="nextItem" type="button" @click="router.push('/home')">
            <strong>Home으로 이동</strong>
            <span>피드에서 순간을 보고 댓글에서 액션을 시작해보세요.</span>
          </button>

          <button class="nextItem" type="button" @click="router.push('/inbox')">
            <strong>Connect 열기</strong>
            <span>리마인더와 대화 흐름을 보고 실제 행동으로 이어갈 수 있어요.</span>
          </button>

          <button class="nextItem" type="button" @click="goMyPublicProfile" :disabled="!me?.handle">
            <strong>공개 프로필 확인</strong>
            <span>팔로우/DM 버튼이 다른 사람에게 어떻게 보이는지 바로 확인해보세요.</span>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToastStore } from "@/stores/toast";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import { uploadImages } from "@/api/files";
import { fetchMe, updateProfile } from "@/api/me";
import { fetchUserProfileByHandle } from "@/api/users";

const route = useRoute();
const router = useRouter();
const toast = useToastStore();
const auth = useAuthStore();
const settings = useSettingsStore();

const me = ref(null);
const publicProfile = ref(null);
const avatarUrl = ref("");
const avatarFileId = ref(undefined);
const fileInput = ref(null);
const profileEditorSection = ref(null);
const loading = ref(false);
const saving = ref(false);

const form = reactive({
  name: "",
  bio: "",
  website: "",
});

function parseCsv(value) {
  return String(value || "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
}

const opsAllowedEmails = parseCsv(import.meta.env.VITE_OPS_ALLOWED_EMAILS);
const opsAllowedHandles = parseCsv(import.meta.env.VITE_OPS_ALLOWED_HANDLES);

const isOpsUser = computed(() => {
  const email = String(me.value?.email || "").trim().toLowerCase();
  const handle = String(me.value?.handle || "").trim().toLowerCase();

  if (opsAllowedEmails.length && email && opsAllowedEmails.includes(email)) {
    return true;
  }

  if (opsAllowedHandles.length && handle && opsAllowedHandles.includes(handle)) {
    return true;
  }

  return false;
});

const showOpsAccessDenied = computed(() => route.query.denied === "ops");

const opsAllowedEmailsText = computed(() => {
  return opsAllowedEmails.length ? opsAllowedEmails.join(", ") : "설정 없음";
});

const opsAllowedHandlesText = computed(() => {
  return opsAllowedHandles.length ? opsAllowedHandles.join(", ") : "설정 없음";
});

const opsMatchBasis = computed(() => {
  const email = String(me.value?.email || "").trim().toLowerCase();
  const handle = String(me.value?.handle || "").trim().toLowerCase();

  if (opsAllowedEmails.length && email && opsAllowedEmails.includes(email)) {
    return "email";
  }

  if (opsAllowedHandles.length && handle && opsAllowedHandles.includes(handle)) {
    return "handle";
  }

  return "unknown";
});

const opsEnvFileHint = computed(() => {
  return "vue-front/.env.local 또는 vue-front/.env.production";
});

const opsEnvExample = computed(() => {
  const email = me.value?.email || "seed@test.com";
  const handle = me.value?.handle || "seed_001";
  return `VITE_OPS_ALLOWED_EMAILS=${email} / VITE_OPS_ALLOWED_HANDLES=${handle}`;
});

const initials = computed(() => {

  const raw = String(form.name || me.value?.name || me.value?.handle || "R").trim();
  return raw ? raw[0].toUpperCase() : "R";
});

const completionItems = computed(() => ([
  {
    key: "name",
    label: "이름",
    hint: "대화와 프로필에서 가장 먼저 보여요.",
    done: !!String(form.name || me.value?.name || "").trim(),
  },
  {
    key: "bio",
    label: "소개",
    hint: "나를 설명하는 한두 줄이에요.",
    done: !!String(form.bio || "").trim(),
  },
  {
    key: "website",
    label: "링크",
    hint: "블로그나 포트폴리오를 연결할 수 있어요.",
    done: !!String(form.website || "").trim(),
  },
  {
    key: "avatar",
    label: "프로필 사진",
    hint: "팔로우와 DM 전환이 더 자연스러워져요.",
    done: !!String(avatarUrl.value || publicProfile.value?.profileImageUrl || "").trim(),
  },
]));

const completionPercent = computed(() => {
  const total = completionItems.value.length || 1;
  const done = completionItems.value.filter((item) => item.done).length;
  return Math.round((done / total) * 100);
});

const reminderEnabledCount = computed(() => {
  let count = 0;
  if (settings.pinRemindBrowserNotify) count += 1;
  if (settings.pinRemindSound) count += 1;
  if (settings.pinRemindVibrate) count += 1;
  return count;
});

const reminderStatusTitle = computed(() => {
  if (reminderEnabledCount.value === 3) return "완전 준비됨";
  if (reminderEnabledCount.value === 2) return "잘 맞춰짐";
  if (reminderEnabledCount.value === 1) return "기본 준비";
  return "아직 조용함";
});

const reminderStatusDescription = computed(() => {
  if (reminderEnabledCount.value === 3) {
    return "브라우저 알림, 사운드, 진동이 모두 켜져 있어서 다가오는 액션을 놓칠 가능성이 가장 낮아요.";
  }
  if (reminderEnabledCount.value === 2) {
    return "대부분의 리마인더 상황에 대응할 수 있어요. 자주 놓치는 편이면 나머지 한 가지도 켜두면 좋아요.";
  }
  if (reminderEnabledCount.value === 1) {
    return "기본 알림은 받을 수 있지만, 더 확실한 체감이 필요하면 사운드나 진동을 추가해 보세요.";
  }
  return "아직 모든 리마인더가 조용한 상태예요. 최소 한 가지는 켜두면 실사용성이 훨씬 좋아져요.";
});

const nextMoveTitle = computed(() => {
  if (completionPercent.value < 100) return "프로필 마무리";
  if (reminderEnabledCount.value === 0) return "Reminder 켜기";
  return "Connect로 이어가기";
});

const nextMoveDescription = computed(() => {
  if (completionPercent.value < 100) {
    return "프로필 사진이나 소개만 채워도 공개 프로필 완성도가 크게 올라가요.";
  }
  if (reminderEnabledCount.value === 0) {
    return "약속·할일 흐름을 놓치지 않으려면 브라우저 알림부터 켜두는 게 좋아요.";
  }
  return "이제 Home이나 Connect에서 실제 행동 흐름을 더 자연스럽게 이어갈 수 있어요.";
});

const flowPrimaryHint = computed(() => {
  if (completionPercent.value < 100) return "소개, 링크, 사진 중 비어 있는 항목부터 채우면 첫인상이 가장 빨리 좋아져요.";
  if (reminderEnabledCount.value === 0) return "리마인더를 켜두면 약속과 할일 흐름을 놓칠 가능성이 크게 줄어요.";
  return "이제 프로필 준비는 충분하니 Home이나 Connect에서 실제 상호작용으로 이어가면 좋아요.";
});

const flowReasonTitle = computed(() => {
  if (completionPercent.value < 100) return "첫인상 보강";
  if (reminderEnabledCount.value === 0) return "실사용 준비";
  return "행동으로 전환";
});

const flowReasonHint = computed(() => {
  if (completionPercent.value < 100) return "프로필이 채워질수록 팔로우와 DM 전환이 더 자연스러워져요.";
  if (reminderEnabledCount.value === 0) return "Reminder가 꺼져 있으면 다가오는 액션을 놓치기 쉬워요.";
  return "이제는 화면 정리보다 실제 대화와 액션을 이어가는 쪽의 체감이 더 커요.";
});

const flowDestinationTitle = computed(() => {
  if (completionPercent.value < 100) return "프로필 편집";
  if (reminderEnabledCount.value === 0) return "Reminder 설정";
  return "Connect / Home";
});

const flowDestinationHint = computed(() => {
  if (completionPercent.value < 100) return "이 화면 아래 프로필 편집 섹션에서 바로 정리할 수 있어요.";
  if (reminderEnabledCount.value === 0) return "이 화면의 Reminder 설정에서 브라우저 알림부터 먼저 켜보세요.";
  return "Connect에서 대화를 이어가거나 Home에서 새로운 흐름을 시작하면 좋아요.";
});

const priorityBadge = computed(() => {
  if (completionPercent.value < 100) return "PROFILE";
  if (reminderEnabledCount.value === 0) return "REMINDER";
  return "READY";
});

function websiteUrl(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  return /^(http|https):\/\//i.test(s) ? s : `https://${s}`;
}

async function toggleBrowserNotify() {
  if (!settings.pinRemindBrowserNotify && typeof Notification !== "undefined" && Notification.permission === "default") {
    try {
      const perm = await Notification.requestPermission();
      settings.setPinRemindBrowserNotify(perm === "granted");
      if (perm !== "granted") {
        toast.info("알림 권한 필요", "브라우저 알림을 켜려면 알림 권한이 필요해요.");
      }
      return;
    } catch {}
  }

  if (!settings.pinRemindBrowserNotify && typeof Notification !== "undefined" && Notification.permission === "denied") {
    toast.info("브라우저 설정 필요", "브라우저 알림이 차단돼 있어요. 설정에서 허용해 주세요.");
    return;
  }

  settings.togglePinRemindBrowserNotify();
}

async function focusProfileEditor() {
  await nextTick();
  profileEditorSection.value?.scrollIntoView?.({ behavior: "smooth", block: "start" });
}

async function refreshAll() {
  loading.value = true;

  try {
    me.value = await fetchMe();
    auth.me = me.value;

    if (me.value?.handle) {
      publicProfile.value = await fetchUserProfileByHandle(me.value.handle);
    } else {
      publicProfile.value = null;
    }

    form.name = publicProfile.value?.name || me.value?.name || "";
    form.bio = publicProfile.value?.bio || "";
    form.website = publicProfile.value?.website || "";
    avatarUrl.value = publicProfile.value?.profileImageUrl || "";
    avatarFileId.value = undefined;
  } catch (e) {
    toast.error("불러오기 실패", e?.response?.data?.message || "내 프로필을 불러오지 못했어요.");
  } finally {
    loading.value = false;
  }
}

function onPickAvatar() {
  fileInput.value?.click?.();
}

async function onUploadAvatar(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  try {
    saving.value = true;
    const uploaded = await uploadImages([file]);
    const first = uploaded?.[0];

    if (!first?.id) {
      throw new Error("파일 업로드 결과가 올바르지 않아요.");
    }

    avatarFileId.value = first.id;
    avatarUrl.value = first.url || avatarUrl.value;
    toast.success("사진 업로드 완료", "저장 버튼을 누르면 프로필에 반영돼요.");
  } catch (e) {
    toast.error("사진 업로드 실패", e?.response?.data?.message || e?.message || "사진 업로드에 실패했어요.");
  } finally {
    saving.value = false;
    if (event?.target) event.target.value = "";
  }
}

function clearAvatar() {
  avatarFileId.value = null;
  avatarUrl.value = "";
}

async function saveProfile() {
  try {
    saving.value = true;

    const payload = {
      name: String(form.name || "").trim(),
      bio: String(form.bio || "").trim(),
      website: String(form.website || "").trim(),
    };

    if (avatarFileId.value === null) {
      payload.profileImageFileId = null;
    } else if (avatarFileId.value) {
      payload.profileImageFileId = avatarFileId.value;
    }

    await updateProfile(payload);
    toast.success("저장 완료", "프로필이 업데이트됐어요.");
    await refreshAll();
  } catch (e) {
    toast.error("저장 실패", e?.response?.data?.message || "프로필 저장에 실패했어요.");
  } finally {
    saving.value = false;
  }
}

function goOpsEnvGuide() {
  window.alert(`프론트 env 설정 위치:
${opsEnvFileHint.value}

예시:
VITE_OPS_ALLOWED_EMAILS=${me.value?.email || "seed@test.com"}
VITE_OPS_ALLOWED_HANDLES=${me.value?.handle || "seed_001"}

변경 후 프론트 재시작 또는 재빌드가 필요해요.`);
}

function goMyPublicProfile() {
  if (!me.value?.handle) return;
  router.push(`/u/${me.value.handle}`);
}

function goOpsDashboard() {
  router.push("/ops/dashboard");
}

async function onLogout() {
  try {
    loading.value = true;
    await auth.logoutCookie();
    router.replace("/login");
  } catch (e) {
    toast.error("로그아웃 실패", e?.response?.data?.message || "로그아웃에 실패했어요.");
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await refreshAll();
});
</script>

<style scoped>
.page{
  display:grid;
  gap:18px;
  padding:20px 16px 40px;
}
.card,
.heroCard,
.noticeCard,
.opsCard,
.statusCard,
.progressCard{
  border:1px solid var(--border);
  border-radius:24px;
  background:var(--surface);
  box-shadow:0 12px 28px rgba(0,0,0,.08);
}
.card{
  padding:20px;
}
.heroCard{
  padding:22px;
  display:grid;
  gap:18px;
}
.heroTop{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:20px;
}
.identity{
  display:flex;
  gap:16px;
  align-items:center;
}
.avatarImg,
.avatar{
  width:72px;
  height:72px;
  border-radius:50%;
  object-fit:cover;
  flex:0 0 auto;
}
.avatar,
.avatarLg.fallback{
  display:grid;
  place-items:center;
  background:linear-gradient(135deg, rgba(125,92,255,.18), rgba(255,84,126,.16));
  font-weight:800;
  color:var(--text);
}
.heroMeta{
  display:grid;
  gap:4px;
}
.heroEyebrow{
  font-size:12px;
  letter-spacing:.12em;
  color:var(--muted);
  font-weight:800;
}
.heroName{
  font-size:28px;
  font-weight:900;
  line-height:1.1;
}
.heroHandle{
  font-size:14px;
  color:var(--muted);
}
.heroSub{
  margin-top:6px;
  max-width:680px;
  color:var(--text);
  opacity:.84;
  line-height:1.6;
}
.heroActions{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}
.heroStats{
  display:grid;
  grid-template-columns:repeat(3, minmax(0,1fr));
  gap:12px;
}
.heroStat{
  padding:14px 16px;
  border-radius:18px;
  border:1px solid var(--border);
  background:color-mix(in oklab, var(--surface) 88%, white 12%);
  display:grid;
  gap:4px;
}
.heroStat strong{
  font-size:24px;
}
.heroStat span{
  color:var(--muted);
  font-size:13px;
}
.flowCard,
.priorityCard{
  padding:20px;
  display:grid;
  gap:16px;
}
.toneHistoryCard{
  border:1px solid color-mix(in oklab, var(--border) 84%, transparent);
  background:linear-gradient(180deg, rgba(255,255,255,.038), rgba(255,255,255,.018));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.04);
}
.flowGrid{
  display:grid;
  grid-template-columns:repeat(3, minmax(0,1fr));
  gap:12px;
  align-items:stretch;
}
.flowItem{
  padding:16px;
  border-radius:18px;
  border:1px solid rgba(255,255,255,.07);
  background:color-mix(in oklab, var(--surface) 90%, white 10%);
  display:grid;
  gap:6px;
  min-height:126px;
  align-content:start;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.035);
}
.flowLabel{
  font-size:12px;
  color:var(--muted);
  font-weight:800;
}
.flowValue{
  font-size:18px;
  font-weight:900;
}
.flowHint{
  color:var(--muted);
  line-height:1.55;
}
.flowPills{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}
.flowPill{
  padding:8px 12px;
  border-radius:999px;
  font-size:12px;
  font-weight:800;
  border:1px solid var(--border);
  background:color-mix(in oklab, var(--surface) 90%, white 10%);
}
.flowPill[data-tone="good"]{
  border-color:rgba(70,208,127,.28);
  background:rgba(70,208,127,.12);
  color:#46d07f;
}
.flowPill[data-tone="warn"]{
  border-color:rgba(255,184,0,.28);
  background:rgba(255,184,0,.12);
  color:#ffb800;
}
.priorityHead{
  display:flex;
  justify-content:space-between;
  gap:14px;
  align-items:flex-start;
}
.priorityBadge{
  border-radius:999px;
  padding:8px 12px;
  font-size:12px;
  font-weight:900;
  border:1px solid rgba(125,92,255,.28);
  background:rgba(125,92,255,.12);
  color:#7d5cff;
  white-space:nowrap;
}
.priorityBody{
  display:flex;
  justify-content:space-between;
  gap:16px;
  align-items:center;
  flex-wrap:wrap;
}
.priorityMain{
  display:grid;
  gap:6px;
}
.priorityLabel{
  font-size:12px;
  color:var(--muted);
  font-weight:800;
}
.priorityTitle{
  font-size:22px;
  font-weight:900;
}
.priorityHint{
  color:var(--muted);
  line-height:1.6;
  max-width:720px;
}
.priorityActions{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}
.noticeCard{
  padding:20px;
  border-color:rgba(255,140,0,.34);
  background:linear-gradient(180deg, rgba(255,140,0,.08), rgba(255,140,0,.03));
  display:grid;
  gap:16px;
}
.noticeTop{
  display:flex;
  justify-content:space-between;
  gap:12px;
  align-items:flex-start;
}
.noticeTitle{
  font-size:20px;
  font-weight:900;
}
.noticeBody{
  margin-top:6px;
  line-height:1.65;
  color:var(--text);
  opacity:.88;
}
.noticeBadge{
  border:1px solid rgba(255,140,0,.38);
  color:#ff9800;
  background:rgba(255,140,0,.12);
  border-radius:999px;
  padding:8px 12px;
  font-size:12px;
  font-weight:900;
  white-space:nowrap;
}
.noticeGrid{
  display:grid;
  grid-template-columns:repeat(3, minmax(0,1fr));
  gap:12px;
}
.noticeItem{
  padding:14px 16px;
  border-radius:18px;
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.04);
  display:grid;
  gap:6px;
}
.noticeLabel{
  font-size:12px;
  color:var(--muted);
  font-weight:800;
}
.noticeValue{
  font-weight:800;
  word-break:break-word;
}
.noticeHint{
  font-size:12px;
  color:var(--muted);
}
.noticeSteps{
  margin:0;
  padding-left:18px;
  display:grid;
  gap:8px;
  line-height:1.6;
}
.noticeActions{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}
.noticeGuideGrid{
  display:grid;
  grid-template-columns:repeat(2, minmax(0,1fr));
  gap:12px;
}
.noticeGuideItem{
  padding:14px 16px;
  border-radius:18px;
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.04);
  display:grid;
  gap:6px;
}
.opsCard{
  padding:20px;
  display:grid;
  gap:16px;
}
.opsHead,
.statusHead{
  display:flex;
  justify-content:space-between;
  gap:16px;
  align-items:flex-start;
}
.title{
  font-size:20px;
  font-weight:900;
}
.sub{
  margin-top:4px;
  color:var(--muted);
  line-height:1.55;
}
.opsBadge{
  border-radius:999px;
  padding:8px 12px;
  font-size:12px;
  font-weight:900;
  border:1px solid rgba(70,208,127,.28);
  background:rgba(70,208,127,.12);
  color:#46d07f;
}
.opsGrid{
  display:grid;
  grid-template-columns:repeat(3, minmax(0,1fr));
  gap:12px;
}
.opsItem,
.opsInfo,
.statusItem,
.checkItem,
.settingItem,
.nextItem{
  border:1px solid var(--border);
  background:color-mix(in oklab, var(--surface) 90%, white 10%);
  border-radius:18px;
}
.opsItem{
  padding:16px;
  display:grid;
  gap:8px;
  text-align:left;
  cursor:pointer;
}
.opsItem strong{
  font-size:16px;
}
.opsItem span{
  color:var(--muted);
  line-height:1.55;
}
.opsInfo{
  padding:16px;
  display:grid;
  gap:8px;
}
.opsInfoLabel,
.statusLabel,
.settingFootTitle{
  font-size:12px;
  color:var(--muted);
  font-weight:800;
}
.opsInfoValue,
.statusValue{
  font-size:18px;
  font-weight:900;
}
.opsInfoHint,
.statusHint,
.settingFootBody{
  color:var(--muted);
  line-height:1.55;
}
.statusCard{
  padding:20px;
  display:grid;
  gap:14px;
}
.statusGrid{
  display:grid;
  grid-template-columns:repeat(3, minmax(0,1fr));
  gap:12px;
}
.statusItem{
  padding:16px;
  display:grid;
  gap:6px;
}
.progressCard{
  padding:20px;
  display:grid;
  gap:16px;
}
.progressSide{
  display:grid;
  gap:8px;
}
.progressValue{
  font-size:28px;
  font-weight:900;
}
.progressBar{
  height:12px;
  border-radius:999px;
  background:rgba(255,255,255,.08);
  overflow:hidden;
}
.progressBar span{
  display:block;
  height:100%;
  border-radius:999px;
  background:linear-gradient(90deg, #7d5cff, #ff547e);
}
.checkGrid{
  display:grid;
  grid-template-columns:repeat(2, minmax(0,1fr));
  gap:12px;
}
.checkItem{
  padding:14px 16px;
  display:flex;
  gap:12px;
  align-items:flex-start;
}
.checkItem[data-done="true"]{
  border-color:rgba(70,208,127,.28);
  background:rgba(70,208,127,.08);
}
.checkIcon{
  width:24px;
  height:24px;
  border-radius:50%;
  display:grid;
  place-items:center;
  font-weight:900;
  background:rgba(255,255,255,.08);
}
.checkLabel{
  font-weight:800;
}
.checkHint{
  margin-top:4px;
  color:var(--muted);
  font-size:13px;
  line-height:1.5;
}
.settingsCard{
  display:grid;
  gap:16px;
}
.sectionHead{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
}
.sectionHead.compact{
  margin-bottom:12px;
}
.settingGrid{
  display:grid;
  grid-template-columns:repeat(3, minmax(0,1fr));
  gap:12px;
}
.settingItem{
  padding:16px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  cursor:pointer;
}
.settingText{
  display:grid;
  gap:6px;
  text-align:left;
}
.settingText span{
  color:var(--muted);
  line-height:1.5;
}
.settingState{
  min-width:56px;
  text-align:center;
  border-radius:999px;
  padding:8px 10px;
  border:1px solid var(--border);
  font-size:12px;
  font-weight:900;
}
.settingState[data-on="true"]{
  border-color:rgba(70,208,127,.28);
  background:rgba(70,208,127,.12);
  color:#46d07f;
}
.settingFoot{
  padding:14px 16px;
  border-radius:18px;
  border:1px solid var(--border);
  background:rgba(255,255,255,.03);
}
.formGrid{
  display:grid;
  grid-template-columns:260px minmax(0,1fr);
  gap:18px;
}
.avatarCol{
  display:grid;
  gap:12px;
}
.avatarPanel{
  padding:16px;
  border-radius:18px;
  border:1px solid var(--border);
  background:rgba(255,255,255,.03);
  display:grid;
  gap:12px;
  justify-items:center;
}
.avatarLg{
  width:132px;
  height:132px;
  border-radius:50%;
  object-fit:cover;
}
.avatarBtns{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
}
.hidden{
  display:none;
}
.fields{
  display:grid;
  gap:14px;
}
.label{
  display:grid;
  gap:8px;
  font-weight:800;
}
.input,
.textarea{
  width:100%;
  border-radius:14px;
  border:1px solid var(--border);
  background:rgba(255,255,255,.04);
  color:var(--text);
  padding:12px 14px;
  font:inherit;
}
.textarea{
  resize:vertical;
}
.count,
.microHint{
  font-size:12px;
  color:var(--muted);
}
.twoCol{
  display:grid;
  grid-template-columns:repeat(2, minmax(0,1fr));
  gap:18px;
}
.preview{
  border:1px solid var(--border);
  border-radius:18px;
  padding:16px;
  background:rgba(255,255,255,.03);
  display:grid;
  gap:8px;
}
.previewName{
  font-size:22px;
  font-weight:900;
}
.previewHandle,
.previewEmpty{
  color:var(--muted);
}
.previewBio{
  line-height:1.65;
}
.previewWebsite{
  color:#8eb8ff;
  word-break:break-all;
}
.nextList{
  display:grid;
  gap:12px;
}
.nextItem{
  padding:16px;
  display:grid;
  gap:8px;
  text-align:left;
  cursor:pointer;
}
.nextItem span{
  color:var(--muted);
  line-height:1.55;
}
.primaryBtn,
.softBtn,
.ghostBtn,
.dangerBtn{
  border:none;
  border-radius:14px;
  padding:12px 16px;
  font-weight:800;
  cursor:pointer;
}
.primaryBtn{
  background:linear-gradient(135deg, #7d5cff, #ff547e);
  color:#fff;
}
.softBtn{
  background:rgba(125,92,255,.14);
  color:#d8d0ff;
}
.ghostBtn{
  background:rgba(255,255,255,.06);
  color:var(--text);
}
.dangerBtn{
  background:rgba(255,93,93,.14);
  color:#ff8d8d;
}
@media (max-width: 980px){
  .heroTop,
  .sectionHead,
  .opsHead,
  .statusHead{
    flex-direction:column;
  }
  .heroStats,
  .noticeGrid,
  .noticeGuideGrid,
  .opsGrid,
  .statusGrid,
  .checkGrid,
  .settingGrid,
  .twoCol,
  .formGrid{
    grid-template-columns:1fr;
  }
}

.flowGrid--vault{grid-template-columns:repeat(3,minmax(0,1fr))}
.flowItem--button{text-align:left;cursor:pointer}
@media (max-width: 860px){.flowGrid--vault{grid-template-columns:1fr}}
</style>
@media (max-width: 860px){
  .heroTop,
  .priorityBody,
  .noticeTop,
  .opsHead,
  .statusHead,
  .sectionHead{
    flex-direction:column;
  }
  .flowGrid,
  .statusGrid,
  .heroStats,
  .noticeGrid,
  .noticeGuideGrid,
  .opsGrid,
  .twoCol{
    grid-template-columns:1fr;
  }
}
