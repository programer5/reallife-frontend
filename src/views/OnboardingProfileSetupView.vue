<!-- src/views/OnboardingProfileSetupView.vue -->
<template>
  <div class="page">
    <section class="card">
      <div class="head">
        <div class="eyebrow">WELCOME</div>
        <div class="title">처음 프로필을 조금만 정리해볼까요?</div>
        <div class="sub">RealLife에서는 대화가 실제 행동으로 이어져요. 이름, 소개, 사진만 정리하면 바로 시작할 수 있어요.</div>
      </div>

      <div class="hero">
        <div class="avatarWrap">
          <img v-if="previewUrl" :src="previewUrl" class="avatar" alt="profile" />
          <div v-else class="avatar fallback">{{ initials }}</div>
          <button class="avatarBtn" type="button" @click="pickAvatar">사진 선택</button>
          <input ref="fileInput" class="hidden" type="file" accept="image/*" @change="onUploadAvatar" />
        </div>

        <div class="heroMeta">
          <div class="heroName">{{ name || auth.me?.name || '사용자' }}</div>
          <div class="heroHandle">@{{ auth.me?.handle || 'user' }}</div>
          <div class="heroHint">지금 입력한 정보는 나중에 <b>내 프로필</b>에서 언제든 다시 바꿀 수 있어요.</div>
        </div>
      </div>

      <form class="form" @submit.prevent="onSave">
        <label class="label">
          이름
          <input v-model.trim="name" class="input" maxlength="30" placeholder="표시될 이름" />
        </label>

        <label class="label">
          소개
          <textarea v-model.trim="bio" class="textarea" rows="4" maxlength="160" placeholder="예) 커피 좋아하고, 밤에 개발해요"></textarea>
          <div class="count">{{ bio.length }}/160</div>
        </label>

        <label class="label">
          웹사이트
          <input v-model.trim="website" class="input" placeholder="https://example.com" />
        </label>

        <div class="actions">
          <button class="ghostBtn" type="button" @click="skip" :disabled="saving">지금은 건너뛰기</button>
          <button class="primaryBtn" :disabled="saving">{{ saving ? '저장 중...' : '저장하고 시작하기' }}</button>
        </div>

        <p v-if="error" class="err">{{ error }}</p>
      </form>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useToastStore } from "@/stores/toast";
import { uploadImages } from "@/api/files";
import { updateMyProfile } from "@/api/me";

const router = useRouter();
const auth = useAuthStore();
const toast = useToastStore();

const name = ref("");
const bio = ref("");
const website = ref("");
const fileInput = ref(null);
const previewUrl = ref("");
const profileImageFileId = ref(null);
const saving = ref(false);
const error = ref("");

const initials = computed(() => {
  const s = String(name.value || auth.me?.name || auth.me?.handle || 'U').trim();
  return s ? s[0].toUpperCase() : 'U';
});

onMounted(async () => {
  if (!auth.me) {
    try { await auth.ensureSession(); } catch { router.replace('/login'); return; }
  }
  name.value = auth.me?.name || '';
});

function pickAvatar() { fileInput.value?.click?.(); }

async function onUploadAvatar(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    previewUrl.value = URL.createObjectURL(file);
    const ids = await uploadImages([file]);
    profileImageFileId.value = ids?.[0] || null;
    toast.success('사진 준비 완료', '프로필 사진까지 같이 저장할 수 있어요.');
  } catch (err) {
    toast.error('업로드 실패', err?.response?.data?.message || '사진 업로드에 실패했어요.');
  }
}

async function onSave() {
  saving.value = true;
  error.value = '';
  try {
    await updateMyProfile({ name: name.value || null, bio: bio.value || null, website: website.value || null, profileImageFileId: profileImageFileId.value || null });
    await auth.ensureSession();
    toast.success('프로필 준비 완료', '이제 RealLife를 바로 시작할 수 있어요.');
    router.replace('/home');
  } catch (e) {
    error.value = e?.response?.data?.message || '프로필 저장에 실패했어요.';
  } finally {
    saving.value = false;
  }
}
function skip() { router.replace('/home'); }
</script>

<style scoped>
.page{min-height:100vh;display:grid;place-items:center;padding:24px}.card{width:min(760px,100%);padding:22px;border-radius:28px;border:1px solid var(--border);background:color-mix(in oklab,var(--surface) 92%,transparent);box-shadow:0 18px 60px rgba(0,0,0,.42)}.eyebrow{font-size:11px;font-weight:900;letter-spacing:.18em;color:var(--muted)}.title{margin-top:6px;font-size:28px;font-weight:950;line-height:1.15}.sub{margin-top:8px;color:var(--muted);line-height:1.6}.hero{display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:center;margin-top:18px;padding:16px;border-radius:20px;border:1px solid var(--border);background:color-mix(in oklab,var(--surface-2) 76%,transparent)}.avatarWrap{display:grid;gap:10px;justify-items:center}.avatar,.fallback{width:96px;height:96px;border-radius:26px;object-fit:cover}.fallback{display:grid;place-items:center;font-size:30px;font-weight:950;background:linear-gradient(135deg,color-mix(in oklab,var(--accent) 34%,transparent),color-mix(in oklab,var(--accent) 12%,transparent));border:1px solid color-mix(in oklab,var(--accent) 26%, var(--border))}.avatarBtn{height:38px;padding:0 12px;border-radius:12px;border:1px solid var(--border);background:transparent;color:var(--text);font-weight:800}.heroName{font-size:22px;font-weight:950}.heroHandle{margin-top:4px;color:var(--muted)}.heroHint{margin-top:10px;color:var(--muted);line-height:1.55}.form{display:grid;gap:14px;margin-top:18px}.label{display:grid;gap:8px;font-size:13px;color:var(--muted)}.input,.textarea{width:100%;border-radius:14px;border:1px solid var(--border);background:color-mix(in oklab,var(--surface-2) 88%,transparent);color:var(--text);padding:12px}.textarea{min-height:120px;resize:vertical}.count{justify-self:end;font-size:12px;color:var(--muted)}.actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}.primaryBtn,.ghostBtn{height:46px;padding:0 16px;border-radius:14px;font-weight:900}.primaryBtn{border:1px solid color-mix(in oklab,var(--accent) 40%, var(--border));background:color-mix(in oklab,var(--accent) 18%,transparent);color:var(--text)}.ghostBtn{border:1px solid var(--border);background:transparent;color:var(--text)}.err{color:color-mix(in oklab,var(--danger) 80%, white);font-size:13px}.hidden{display:none}@media (max-width:720px){.page{padding:16px}.card{padding:18px}.title{font-size:24px}.hero{grid-template-columns:1fr}.avatar,.fallback{width:84px;height:84px;border-radius:22px}.actions>*{flex:1 1 180px}}
</style>
