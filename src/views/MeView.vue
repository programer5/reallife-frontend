<template>
  <div class="rl-page">
    <div class="rl-section meGrid">
      <section class="rl-card heroCard">
        <div class="heroLeft">
          <div class="avatarWrap">
            <img v-if="avatarUrl" :src="avatarUrl" class="avatar" alt="avatar" />
            <div v-else class="avatar fallback">{{ initials }}</div>
            <button class="avatarEdit" type="button" @click="onPickAvatar">사진 변경</button>
            <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onUploadAvatar" />
          </div>

          <div class="heroMeta">
            <div class="name">{{ form.name || me?.name || '사용자' }}</div>
            <div class="handle">@{{ me?.handle || '-' }}</div>
            <div class="sub">{{ profile?.followerCount ?? 0 }} followers · {{ profile?.followingCount ?? 0 }} following</div>
            <div class="heroActions">
              <RlButton size="sm" variant="soft" @click="refreshAll">새로고침</RlButton>
              <RlButton size="sm" variant="ghost" @click="goPublicProfile">공개 프로필 보기</RlButton>
            </div>
          </div>
        </div>

        <div class="completionCard">
          <div class="completionLabel">프로필 완성도</div>
          <div class="completionValue">{{ completion }}%</div>
          <div class="completionBar"><span :style="{ width: completion + '%' }"></span></div>
          <div class="completionHint">이름, 소개, 웹사이트, 사진을 채우면 다른 사용자가 더 쉽게 나를 찾을 수 있어요.</div>
        </div>
      </section>

      <section class="rl-card formCard">
        <div class="rl-card__header">
          <div>
            <div class="rl-card__title">프로필 편집</div>
            <div class="rl-card__sub">소개, 링크, 사진을 지금 서비스 흐름에 맞게 다듬어요.</div>
          </div>
          <RlButton size="sm" variant="primary" @click="saveProfile" :loading="saving">저장</RlButton>
        </div>

        <div class="pad formGrid">
          <label class="field">
            <span>이름</span>
            <input v-model.trim="form.name" class="rl-input" maxlength="30" placeholder="예) 정민서" />
          </label>
          <label class="field field--full">
            <span>소개</span>
            <textarea v-model.trim="form.bio" class="rl-textarea" rows="4" maxlength="255" placeholder="예) 약속과 할 일을 실제 삶으로 연결하는 걸 좋아해요"></textarea>
          </label>
          <label class="field field--full">
            <span>웹사이트</span>
            <input v-model.trim="form.website" class="rl-input" maxlength="255" placeholder="예) https://example.com" />
          </label>
        </div>
      </section>

      <section class="rl-card sideCard">
        <div class="rl-card__header">
          <div>
            <div class="rl-card__title">계정 / 운영 체크</div>
            <div class="rl-card__sub">서비스 런칭 전 확인할 설정</div>
          </div>
          <RlButton size="sm" variant="danger" @click="onLogout" :loading="loading">로그아웃</RlButton>
        </div>
        <div class="pad">
          <div class="kv"><div class="k">이메일</div><div class="v">{{ me?.email || '-' }}</div></div>
          <div class="kv"><div class="k">핸들</div><div class="v">@{{ me?.handle || '-' }}</div></div>
          <div class="kv"><div class="k">Reminder</div><div class="v">브라우저 알림 / 사운드 / 진동은 설정 탭에서 관리</div></div>
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
import RlButton from "@/components/ui/RlButton.vue";
import { getMe, getMyProfile, updateMyProfile } from "@/api/me.js";

const router = useRouter();
const auth = useAuthStore();
const me = ref(null);
const profile = ref(null);
const form = ref({ name: "", bio: "", website: "" });
const avatarUrl = ref("");
const avatarFileId = ref(null);
const fileInput = ref(null);
const saving = ref(false);
const loading = ref(false);

const initials = computed(() => String(form.value.name || me.value?.name || 'R').trim().slice(0,1).toUpperCase());
const completion = computed(() => {
  let score = 0;
  if (form.value.name) score += 25;
  if (form.value.bio) score += 25;
  if (form.value.website) score += 25;
  if (avatarUrl.value) score += 25;
  return score;
});

async function refreshAll() {
  me.value = await getMe();
  if (me.value?.handle) {
    profile.value = await getMyProfile(me.value.handle);
    form.value = {
      name: profile.value?.name || me.value?.name || "",
      bio: profile.value?.bio || "",
      website: profile.value?.website || "",
    };
    avatarUrl.value = profile.value?.profileImageUrl || "";
  }
}

function onPickAvatar() {
  fileInput.value?.click();
}

async function onUploadAvatar(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.post('/api/files', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    avatarFileId.value = res.data?.fileId || res.data?.id || null;
    if (avatarFileId.value) {
      await saveProfile();
    }
  } finally {
    e.target.value = '';
  }
}

async function saveProfile() {
  saving.value = true;
  try {
    const payload = {
      name: form.value.name || undefined,
      bio: form.value.bio || '',
      website: form.value.website || '',
      profileImageFileId: avatarFileId.value || undefined,
    };
    profile.value = await updateMyProfile(payload);
    avatarUrl.value = profile.value?.profileImageUrl || avatarUrl.value;
  } finally {
    saving.value = false;
  }
}

function goPublicProfile() {
  if (me.value?.handle) router.push(`/u/${me.value.handle}`);
}

async function onLogout() {
  loading.value = true;
  try {
    await auth.logoutCookie();
    router.replace('/login');
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
.meGrid{display:grid;grid-template-columns:1.5fr 1fr;gap:16px}
.heroCard{display:grid;grid-template-columns:1fr 280px;gap:18px;padding:16px}
.heroLeft{display:flex;gap:16px;align-items:flex-start}
.avatarWrap{position:relative}.avatar,.fallback{width:96px;height:96px;border-radius:28px;object-fit:cover;display:grid;place-items:center;font-weight:950;font-size:34px;background:linear-gradient(135deg,var(--accent),var(--success));color:#0b0f14}.avatarEdit{position:absolute;left:0;right:0;bottom:-8px;margin:auto;width:max-content;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:rgba(5,10,20,.8);color:var(--text);font-size:12px;font-weight:900}.hidden{display:none}
.heroMeta{min-width:0}.name{font-size:24px;font-weight:950}.handle{margin-top:4px;color:var(--muted)}.sub{margin-top:8px;color:var(--muted)}.heroActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.completionCard{border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:14px;background:rgba(255,255,255,.03)}.completionLabel{font-size:12px;color:var(--muted);font-weight:900}.completionValue{font-size:34px;font-weight:950;margin-top:8px}.completionBar{height:10px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden;margin-top:10px}.completionBar span{display:block;height:100%;background:linear-gradient(90deg,var(--accent),var(--success));border-radius:999px}.completionHint{margin-top:12px;font-size:13px;color:var(--muted);line-height:1.5}
.formCard,.sideCard{padding-bottom:10px}.formGrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.field{display:grid;gap:8px}.field span{font-size:13px;color:var(--muted)}.field--full{grid-column:1 / -1}.rl-input,.rl-textarea{width:100%;border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.18);color:var(--text);border-radius:16px;padding:12px 14px}.rl-textarea{resize:vertical;min-height:120px}
.kv{display:grid;grid-template-columns:120px 1fr;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06)}.k{color:var(--muted)}.v{color:var(--text)}
@media (max-width:980px){.meGrid{grid-template-columns:1fr}.heroCard{grid-template-columns:1fr}.completionCard{order:2}.heroLeft{flex-direction:column;align-items:flex-start}.formGrid{grid-template-columns:1fr}}
</style>
