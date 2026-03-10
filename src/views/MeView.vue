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

    <section v-if="showOpsAccessDenied" class="noticeCard">
      <div class="noticeTitle">운영 도구 접근이 제한돼 있어요</div>
      <div class="noticeBody">
        현재 계정은 프론트 운영자 허용 목록에 포함되지 않았어요.
        <code>VITE_OPS_ALLOWED_EMAILS</code> 또는 <code>VITE_OPS_ALLOWED_HANDLES</code> 설정을 확인해 주세요.
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

    <section class="progressCard">
      <div>
        <div class="title">프로필 완성도</div>
        <div class="sub">이름, 소개, 링크, 사진까지 채우면 팔로우와 DM 전환이 훨씬 자연스러워져요.</div>
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

    <section class="card">
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
import { computed, onMounted, reactive, ref } from "vue";
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

async function onUploadAvatar(e) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;

  try {
    avatarUrl.value = URL.createObjectURL(file);
    const ids = await uploadImages([file]);
    avatarFileId.value = ids?.[0] || null;
    toast.success("사진 준비 완료", "저장하면 새 프로필 사진으로 반영돼요.");
  } catch (err) {
    toast.error("업로드 실패", err?.response?.data?.message || "사진 업로드에 실패했어요.");
  }
}

function clearAvatar() {
  avatarUrl.value = "";
  avatarFileId.value = null;
}

async function saveProfile() {
  saving.value = true;

  try {
    await updateProfile({
      name: form.name || null,
      bio: form.bio || null,
      website: form.website || null,
      profileImageFileId: avatarFileId.value,
    });

    await refreshAll();
    toast.success("저장 완료", "내 프로필이 업데이트됐어요.");
  } catch (e) {
    toast.error("저장 실패", e?.response?.data?.message || "프로필을 저장하지 못했어요.");
  } finally {
    saving.value = false;
  }
}

function goMyPublicProfile() {
  if (me.value?.handle) {
    router.push(`/u/${encodeURIComponent(me.value.handle)}`);
  }
}

function goOpsDashboard() {
  router.push("/ops/dashboard");
}

async function onLogout() {
  loading.value = true;
  try {
    await auth.logoutCookie();
    router.replace("/login");
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  try {
    if (!auth.me) {
      await auth.ensureSession();
    }
  } catch {
    router.replace("/login");
    return;
  }

  await refreshAll();
});
</script>

<style scoped>
.page{max-width:960px;margin:0 auto;padding:18px 14px 100px;display:grid;gap:14px}
.heroCard,.card,.progressCard,.statusCard,.opsCard,.noticeCard{
  border:1px solid var(--border);
  border-radius:24px;
  background:color-mix(in oklab,var(--surface) 92%,transparent);
  box-shadow:0 14px 42px rgba(0,0,0,.18);
  padding:18px;
}

.heroTop{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
.identity{display:flex;gap:14px;align-items:center}
.avatarImg,.avatar,.avatarLg{
  object-fit:cover;
  background:rgba(255,255,255,.04);
  border:1px solid rgba(255,255,255,.10)
}
.avatarImg,.avatar{width:78px;height:78px;border-radius:24px}
.avatarLg{width:112px;height:112px;border-radius:28px}
.fallback{
  display:grid;
  place-items:center;
  font-size:30px;
  font-weight:950;
  background:linear-gradient(135deg,color-mix(in oklab,var(--accent) 34%,transparent),color-mix(in oklab,var(--accent) 12%,transparent))
}
.heroEyebrow{font-size:11px;font-weight:900;letter-spacing:.16em;color:var(--muted)}
.heroName{margin-top:4px;font-size:24px;font-weight:950}
.heroHandle{margin-top:2px;color:var(--muted)}
.heroSub{margin-top:8px;color:var(--muted);line-height:1.55;max-width:580px}
.heroActions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}

.heroStats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
.heroStat{
  padding:12px;
  border:1px solid var(--border);
  border-radius:16px;
  background:color-mix(in oklab,var(--surface-2) 80%,transparent);
  display:grid;gap:4px
}
.heroStat strong{font-size:18px}
.heroStat span{font-size:12px;color:var(--muted)}

.noticeCard{
  border-color:color-mix(in oklab,var(--warning) 40%,var(--border));
  background:color-mix(in oklab,var(--warning) 10%,transparent);
}
.noticeTitle{font-size:16px;font-weight:950}
.noticeBody{margin-top:8px;color:var(--muted);line-height:1.6}
.noticeBody code{font-size:12px}

.opsCard{
  border-color:color-mix(in oklab,var(--accent) 38%,var(--border));
  background:
      linear-gradient(180deg,color-mix(in oklab,var(--accent) 10%,transparent),transparent 70%),
      color-mix(in oklab,var(--surface) 92%,transparent);
}
.opsHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.opsBadge{
  min-width:58px;height:34px;padding:0 12px;border-radius:999px;
  display:grid;place-items:center;font-weight:950;
  border:1px solid color-mix(in oklab,var(--accent) 38%,var(--border));
  background:color-mix(in oklab,var(--accent) 16%,transparent);
}
.opsGrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:14px}
.opsItem,.opsInfo{
  text-align:left;
  padding:14px;
  border-radius:18px;
  border:1px solid var(--border);
  background:color-mix(in oklab,var(--surface-2) 78%,transparent);
}
.opsItem{display:grid;gap:6px;color:var(--text)}
.opsItem strong{font-size:15px}
.opsItem span{font-size:13px;line-height:1.55;color:var(--muted)}
.opsInfoLabel{font-size:12px;font-weight:900;color:var(--muted)}
.opsInfoValue{margin-top:6px;font-size:14px;font-weight:900;word-break:break-all}
.opsInfoHint{margin-top:8px;font-size:12px;line-height:1.5;color:var(--muted)}

.statusHead{margin-bottom:12px}
.statusGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.statusItem{
  padding:14px;
  border-radius:18px;
  border:1px solid var(--border);
  background:color-mix(in oklab,var(--surface-2) 76%,transparent);
  display:grid;
  gap:6px;
}
.statusLabel{font-size:12px;font-weight:900;color:var(--muted)}
.statusValue{font-size:18px;font-weight:950;line-height:1.25}
.statusHint{font-size:12.5px;color:var(--muted);line-height:1.5}

.progressCard{display:grid;gap:14px}
.progressSide{display:grid;gap:8px}
.progressValue{font-size:28px;font-weight:950;letter-spacing:-.03em}
.progressBar{
  height:12px;border-radius:999px;
  background:color-mix(in oklab,var(--surface-2) 80%,transparent);
  border:1px solid var(--border);
  overflow:hidden
}
.progressBar span{
  display:block;height:100%;border-radius:inherit;
  background:linear-gradient(90deg,color-mix(in oklab,var(--accent) 80%,white),color-mix(in oklab,var(--accent) 28%,transparent))
}
.checkGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.checkItem{
  display:flex;gap:10px;align-items:flex-start;padding:12px;border-radius:16px;
  border:1px solid var(--border);background:color-mix(in oklab,var(--surface-2) 76%,transparent)
}
.checkItem[data-done="true"]{
  border-color:color-mix(in oklab,var(--accent) 34%,var(--border));
  background:color-mix(in oklab,var(--accent) 10%,transparent)
}
.checkIcon{
  width:24px;height:24px;border-radius:999px;display:grid;place-items:center;
  font-weight:950;background:rgba(255,255,255,.06)
}
.checkLabel{font-weight:900}
.checkHint{margin-top:3px;font-size:12px;color:var(--muted);line-height:1.45}

.sectionHead{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:14px}
.title{font-size:18px;font-weight:950}
.sub{margin-top:4px;color:var(--muted);line-height:1.5}
.compact{margin-bottom:10px}

.settingsCard{display:grid;gap:12px}
.settingGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.settingItem{
  text-align:left;display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:14px;border-radius:18px;border:1px solid var(--border);
  background:color-mix(in oklab,var(--surface-2) 76%,transparent);color:var(--text)
}
.settingText{display:grid;gap:4px}
.settingText strong{font-size:15px}
.settingText span{font-size:12.5px;line-height:1.45;color:var(--muted)}
.settingState{
  min-width:58px;height:34px;padding:0 12px;border-radius:999px;display:grid;place-items:center;
  font-weight:900;border:1px solid var(--border);background:rgba(255,255,255,.04)
}
.settingState[data-on="true"]{
  background:color-mix(in oklab,var(--accent) 16%,transparent);
  border-color:color-mix(in oklab,var(--accent) 38%,var(--border))
}
.settingFoot{
  padding:13px 14px;border-radius:16px;border:1px solid var(--border);
  background:color-mix(in oklab,var(--surface-2) 78%,transparent)
}
.settingFootTitle{font-size:12px;font-weight:900;color:var(--muted)}
.settingFootBody{margin-top:6px;font-size:13px;line-height:1.5;color:var(--text)}

.formGrid{display:grid;grid-template-columns:260px 1fr;gap:18px}
.label{display:grid;gap:8px;font-size:13px;color:var(--muted)}
.avatarPanel{display:grid;gap:12px;justify-items:start}
.avatarBtns{display:flex;gap:8px;flex-wrap:wrap}
.fields{display:grid;gap:14px}
.input,.textarea{
  width:100%;border-radius:14px;border:1px solid var(--border);
  background:color-mix(in oklab,var(--surface-2) 88%,transparent);color:var(--text);padding:12px
}
.textarea{min-height:120px;resize:vertical}
.count{justify-self:end;font-size:12px;color:var(--muted)}
.microHint{font-size:12px;color:var(--muted);line-height:1.45}

.twoCol{display:grid;grid-template-columns:1.1fr .9fr;gap:14px}
.preview{
  padding:14px;border:1px solid var(--border);border-radius:18px;
  background:color-mix(in oklab,var(--surface-2) 76%,transparent)
}
.previewName{font-size:20px;font-weight:950}
.previewHandle{margin-top:4px;color:var(--muted)}
.previewBio{margin-top:10px;line-height:1.6}
.previewWebsite{display:inline-block;margin-top:10px;color:var(--text)}
.previewEmpty{margin-top:10px;color:var(--muted)}

.nextList{display:grid;gap:10px}
.nextItem{
  text-align:left;padding:14px;border-radius:18px;border:1px solid var(--border);
  background:color-mix(in oklab,var(--surface-2) 76%,transparent);display:grid;gap:5px;color:var(--text)
}
.nextItem strong{font-size:15px}
.nextItem span{font-size:13px;line-height:1.5;color:var(--muted)}

.primaryBtn,.softBtn,.ghostBtn,.dangerBtn{
  height:42px;padding:0 14px;border-radius:14px;font-weight:900
}
.primaryBtn{
  border:1px solid color-mix(in oklab,var(--accent) 40%, var(--border));
  background:color-mix(in oklab,var(--accent) 18%,transparent);color:var(--text)
}
.softBtn{
  border:1px solid var(--border);
  background:color-mix(in oklab,var(--surface-2) 82%,transparent);color:var(--text)
}
.ghostBtn{border:1px solid var(--border);background:transparent;color:var(--text)}
.dangerBtn{
  border:1px solid color-mix(in oklab,var(--danger) 42%, var(--border));
  background:color-mix(in oklab,var(--danger) 10%, transparent);color:var(--text)
}
.hidden{display:none}

@media (max-width:820px){
  .heroTop{flex-direction:column}
  .heroActions{justify-content:flex-start}
  .heroStats,.statusGrid,.opsGrid,.formGrid,.twoCol,.checkGrid,.settingGrid{grid-template-columns:1fr}
  .avatarLg{width:96px;height:96px;border-radius:22px}
}
</style>