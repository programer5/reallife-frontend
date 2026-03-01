<template>
  <div class="rl-page">
    <div class="rl-section">
      <section class="rl-card">
        <div class="rl-card__header">
          <div>
            <div class="rl-card__title">Me</div>
            <div class="rl-card__sub">프로필과 계정</div>
          </div>

          <RlButton size="sm" variant="danger" @click="onLogout" :loading="loading">
            로그아웃
          </RlButton>
        </div>

        <div class="pad">
          <div class="profile">
            <div class="avatarWrap">
              <img v-if="avatarUrl" :src="avatarUrl" class="avatar" alt="avatar" />
              <div v-else class="avatar fallback">{{ initials }}</div>
            </div>

            <div class="who">
              <div class="nameRow">
                <div class="name">{{ profile?.name || me?.name || "사용자" }}</div>
                <RlBadge tone="neutral">{{ me?.tier || me?.role || "NONE" }}</RlBadge>
              </div>
              <div class="handle">@{{ me?.handle || "seed_001" }}</div>
              <div class="meta">{{ followersText }}</div>

              <div class="btnRow">
                <RlButton size="sm" variant="soft" @click="onPickAvatar">사진 변경</RlButton>
                <RlButton size="sm" variant="ghost" @click="refreshAll">새로고침</RlButton>
              </div>

              <input
                  ref="fileInput"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="onUploadAvatar"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="rl-card">
        <div class="rl-card__header">
          <div>
            <div class="rl-card__title">한 줄 소개</div>
            <div class="rl-card__sub">프로필에 표시될 문장</div>
          </div>
          <RlButton size="sm" variant="primary" @click="saveProfile" :loading="saving">
            저장
          </RlButton>
        </div>

        <div class="pad">
          <input v-model="bio" class="rl-input" placeholder="예) 커피 좋아하고, 밤에 개발해요" />
        </div>
      </section>

      <section class="rl-card">
        <div class="rl-card__header">
          <div>
            <div class="rl-card__title">계정</div>
            <div class="rl-card__sub">로그인 정보</div>
          </div>
        </div>

        <div class="pad">
          <div class="kv">
            <div class="k">이메일</div>
            <div class="v">{{ me?.email || "-" }}</div>
          </div>
        </div>
      </section>
      <section class="rl-card">
        <div class="rl-card__header">
          <div>
            <div class="rl-card__title">알림</div>
            <div class="rl-card__sub">리마인드 알림 UX</div>
          </div>
        </div>

        <div class="pad">
          <div class="kv kv--toggle">
            <div class="k">PIN_REMIND 사운드</div>
            <label class="switch">
              <input
                  type="checkbox"
                  :checked="settings.pinRemindSound"
                  @change="settings.setPinRemindSound($event.target.checked)"
              />
              <span class="slider" aria-hidden="true"></span>
            </label>
          </div>

          <div class="kv kv--toggle">
            <div class="k">PIN_REMIND 진동</div>
            <label class="switch">
              <input
                  type="checkbox"
                  :checked="settings.pinRemindVibrate"
                  @change="settings.setPinRemindVibrate($event.target.checked)"
              />
              <span class="slider" aria-hidden="true"></span>
            </label>
          </div>

          <div class="kv kv--toggle">
            <div class="k">브라우저 알림</div>
            <label class="switch">
              <input
                  type="checkbox"
                  :checked="settings.pinRemindBrowserNotify"
                  @change="onToggleBrowserNotify"
              />
              <span class="slider" aria-hidden="true"></span>
            </label>
          </div>

          <RlButton
              size="sm"
              variant="soft"
              style="margin-top: 10px;"
              @click="requestBrowserNotifyPermission"
          >
            알림 권한 요청
          </RlButton>

          <div class="hint">
            다른 탭/화면을 보고 있을 때 PIN_REMIND가 오면 브라우저 알림을 띄워요.
          </div>

          <div class="hint">
            브라우저 정책 때문에 첫 클릭/키 입력 이후부터 소리가 날 수 있어요.
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import api from "@/lib/api.js";
import { useAuthStore } from "@/stores/auth.js";
import { useSettingsStore } from "@/stores/settings";

import RlBadge from "@/components/ui/RlBadge.vue";
import RlButton from "@/components/ui/RlButton.vue";

const router = useRouter();
const auth = useAuthStore();
const settings = useSettingsStore();

async function requestBrowserNotifyPermission() {
  try {
    if (!("Notification" in window)) {
      alert("이 브라우저는 알림을 지원하지 않아요.");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      alert("알림 권한이 허용되지 않았어요. 브라우저 설정에서 허용해 주세요.");
    }
  } catch {}
}

async function onToggleBrowserNotify(e) {
  const next = !!e.target.checked;

  // 끄는 건 그냥 끄기
  if (!next) {
    settings.setPinRemindBrowserNotify(false);
    return;
  }

  // 켜려면: 권한 체크
  if (!("Notification" in window)) {
    alert("이 브라우저는 알림을 지원하지 않아요.");
    settings.setPinRemindBrowserNotify(false);
    return;
  }

  // 권한이 없으면 요청
  if (Notification.permission !== "granted") {
    await requestBrowserNotifyPermission();
  }

  // 최종 권한 확인 후 반영
  if (Notification.permission === "granted") {
    settings.setPinRemindBrowserNotify(true);
  } else {
    settings.setPinRemindBrowserNotify(false);
  }
}

const me = ref(null);       // /api/me
const profile = ref(null);  // /api/users/{handle}

const bio = ref("");
const avatarUrl = ref("");

// ✅ 사진이 한 번 업로드되면 fileId를 기억해두고,
// 저장 버튼 눌러도 그 값이 날아가지 않게 유지
const avatarFileId = ref(null);

const saving = ref(false);
const loading = ref(false);

const fileInput = ref(null);

const initials = computed(() => {
  const name = profile.value?.name || me.value?.name || "R";
  return String(name).trim().slice(0, 1).toUpperCase();
});

const followersText = computed(() => {
  const n = profile.value?.followerCount ?? me.value?.followerCount ?? 0;
  return `${n} followers`;
});

async function refreshAll() {
  const meRes = await api.get("/api/me");
  me.value = meRes.data;

  if (me.value?.handle) {
    const pRes = await api.get(`/api/users/${me.value.handle}`);
    profile.value = pRes.data;

    bio.value = profile.value?.bio || "";
    avatarUrl.value = profile.value?.profileImageUrl || "";

    // ✅ 서버가 profileImageFileId를 내려주는 경우가 있으면 동기화
    if (profile.value?.profileImageFileId) {
      avatarFileId.value = profile.value.profileImageFileId;
    }
  }
}

function onPickAvatar() {
  fileInput.value?.click();
}

async function onUploadAvatar(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    // 1) 업로드: POST /api/files => { fileId, url... }
    const form = new FormData();
    form.append("file", file);

    const up = await api.post("/api/files", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const fileId = up.data?.fileId;
    if (!fileId) throw new Error("fileId missing");

    // ✅ 기억해두기 (저장 눌러도 유지)
    avatarFileId.value = fileId;

    // 2) 프로필 업데이트: PATCH /api/me/profile
    await api.patch("/api/me/profile", {
      bio: bio.value || "",
      website: profile.value?.website || "",
      profileImageFileId: fileId,
    });

    // 3) 새 프로필 재조회
    await refreshAll();
  } catch (err) {
    console.error(err);
  } finally {
    e.target.value = "";
  }
}

async function saveProfile() {
  saving.value = true;
  try {
    // ✅ 핵심: 사진을 바꾸지 않았으면 profileImageFileId를 "보내지 않는다"
    const payload = {
      bio: bio.value || "",
      website: profile.value?.website || "",
    };

    // 사진을 변경한 적(업로드)이 있으면 그때만 포함
    if (avatarFileId.value) {
      payload.profileImageFileId = avatarFileId.value;
    }

    await api.patch("/api/me/profile", payload);
    await refreshAll();
  } finally {
    saving.value = false;
  }
}

async function onLogout() {
  loading.value = true;
  try {
    await auth.logout();
    router.replace("/login");
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await auth.ensureSession();
  await refreshAll();
});
</script>

<style scoped>
.pad { padding: 14px 16px 16px; }

.profile{ display:flex; gap: 14px; align-items:flex-start; }
.avatarWrap{ flex: 0 0 auto; }
.avatar{
  width: 74px; height: 74px;
  border-radius: 22px;
  object-fit: cover;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.04);
}
.fallback{ display:grid; place-items:center; font-weight: 800; color: rgba(255,255,255,.9); }

.who{ flex: 1 1 auto; min-width: 0; }

.nameRow{ display:flex; align-items:center; gap: 10px; }
.name{ font-size: 18px; font-weight: 800; letter-spacing: .2px; }
.handle{ margin-top: 3px; color: var(--muted); font-size: 13px; }
.meta{ margin-top: 8px; color: var(--faint); font-size: 12.5px; }

.btnRow{ margin-top: 10px; display:flex; gap: 10px; flex-wrap: wrap; }

.kv{ display:flex; justify-content:space-between; align-items:center; gap: 12px; padding: 10px 2px; }
.k{ color: var(--muted); font-size: 13px; }
.v{ color: var(--text); font-size: 13px; }

.hidden{ display:none; }
.kv--toggle{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 14px;
}

.switch{
  position: relative;
  width: 46px;
  height: 28px;
  display:inline-block;
}

.switch input{ display:none; }

.slider{
  position:absolute;
  inset:0;
  border-radius: 999px;
  background: rgba(255,255,255,.10);
  border: 1px solid rgba(255,255,255,.14);
  transition: background .15s ease;
}

.slider::after{
  content:"";
  position:absolute;
  width:22px;
  height:22px;
  left:3px;
  top:2px;
  border-radius:999px;
  background:white;
  transition: transform .15s ease;
}

.switch input:checked + .slider::after{
  transform: translateX(18px);
}

.hint{
  margin-top:10px;
  font-size:12.5px;
  color:var(--muted);
}
</style>