<!-- src/views/OnboardingProfileSetupView.vue -->
<template>
  <div class="page">
    <section class="card">
      <div class="head">
        <div class="eyebrow">WELCOME</div>
        <div class="title">처음 프로필을 조금만 정리해볼까요?</div>
        <div class="sub">
          이름, 소개, 사진만 정리하면 다른 사람이 나를 더 쉽게 이해하고
          팔로우/DM을 자연스럽게 시작할 수 있어요.
        </div>
      </div>

      <div class="steps">
        <div class="step" :data-done="!!name.trim()">
          <span>1</span>
          <div>
            <strong>이름</strong>
            <small>피드와 대화에서 보여요.</small>
          </div>
        </div>
        <div class="step" :data-done="!!bio.trim()">
          <span>2</span>
          <div>
            <strong>소개</strong>
            <small>한두 줄로 분위기를 알려주세요.</small>
          </div>
        </div>
        <div class="step" :data-done="!!previewUrl">
          <span>3</span>
          <div>
            <strong>사진</strong>
            <small>팔로우 전환이 더 자연스러워져요.</small>
          </div>
        </div>
      </div>

      <div class="hero">
        <div class="avatarWrap">
          <img v-if="previewUrl" :src="previewUrl" class="avatar" alt="profile" />
          <div v-else class="avatar fallback">{{ initials }}</div>
          <button class="avatarBtn" type="button" @click="pickAvatar">사진 선택</button>
          <input ref="fileInput" class="hidden" type="file" accept="image/*" @change="onUploadAvatar" />
        </div>

        <div class="heroMeta">
          <div class="heroName">{{ name || auth.me?.name || "사용자" }}</div>
          <div class="heroHandle">@{{ auth.me?.handle || "user" }}</div>
          <div class="heroHint">
            지금 입력한 정보는 나중에 <b>내 프로필</b>에서 언제든 다시 바꿀 수 있어요.
          </div>
        </div>
      </div>

      <form class="form" @submit.prevent="onSave">
        <label class="label">
          이름
          <input v-model.trim="name" class="input" maxlength="30" placeholder="표시될 이름" />
        </label>

        <label class="label">
          소개
          <textarea
              v-model.trim="bio"
              class="textarea"
              rows="4"
              maxlength="160"
              placeholder="예) 커피 좋아하고, 밤에 개발해요"
          ></textarea>
          <div class="count">{{ bio.length }}/160</div>
        </label>

        <label class="label">
          웹사이트
          <input v-model.trim="website" class="input" placeholder="https://example.com" />
        </label>

        <div class="actions">
          <button class="ghostBtn" type="button" @click="skip" :disabled="saving">지금은 건너뛰기</button>
          <button class="primaryBtn" :disabled="saving">
            {{ saving ? "저장 중..." : "저장하고 시작하기" }}
          </button>
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
import { updateProfile } from "@/api/me";

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
  const s = String(name.value || auth.me?.name || auth.me?.handle || "U").trim();
  return s ? s[0].toUpperCase() : "U";
});

onMounted(async () => {
  if (!auth.me) {
    try {
      await auth.ensureSession();
    } catch {
      router.replace("/login");
      return;
    }
  }
  name.value = auth.me?.name || "";
});

function pickAvatar() {
  fileInput.value?.click?.();
}

async function onUploadAvatar(e) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;

  try {
    previewUrl.value = URL.createObjectURL(file);
    const ids = await uploadImages([file]);
    profileImageFileId.value = ids?.[0] || null;
    toast.success("사진 준비 완료", "프로필 사진까지 같이 저장할 수 있어요.");
  } catch (err) {
    toast.error("업로드 실패", err?.response?.data?.message || "사진 업로드에 실패했어요.");
  }
}

async function onSave() {
  saving.value = true;
  error.value = "";

  try {
    await updateProfile({
      name: name.value || null,
      bio: bio.value || null,
      website: website.value || null,
      profileImageFileId: profileImageFileId.value || null,
    });

    await auth.ensureSession();
    toast.success("프로필 준비 완료", "이제 RealLife를 바로 시작할 수 있어요.");
    router.replace("/home");
  } catch (e) {
    error.value = e?.response?.data?.message || "프로필 저장에 실패했어요.";
  } finally {
    saving.value = false;
  }
}

function skip() {
  router.replace("/home");
}
</script>

<style scoped>
.page{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at top, color-mix(in oklab,var(--accent) 10%, transparent), transparent 36%)}
.card{width:min(760px,100%);padding:24px;border-radius:28px;border:1px solid var(--border);background:color-mix(in oklab,var(--surface) 92%,transparent);box-shadow:0 22px 54px rgba(0,0,0,.22);display:grid;gap:18px}
.eyebrow{font-size:12px;font-weight:900;letter-spacing:.18em;color:var(--muted)}.title{margin-top:6px;font-size:30px;font-weight:950;letter-spacing:-.03em}.sub{margin-top:10px;color:var(--muted);line-height:1.6}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.step{display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid var(--border);border-radius:16px;background:color-mix(in oklab,var(--surface-2) 78%,transparent)}.step[data-done="true"]{border-color:color-mix(in oklab,var(--accent) 34%,var(--border));background:color-mix(in oklab,var(--accent) 10%,transparent)}.step span{width:24px;height:24px;border-radius:999px;display:grid;place-items:center;font-weight:900;background:rgba(255,255,255,.06)}.step strong{display:block}.step small{display:block;margin-top:3px;color:var(--muted);line-height:1.35}
.hero{display:grid;grid-template-columns:180px 1fr;gap:18px;align-items:center;padding:16px;border-radius:22px;border:1px solid var(--border);background:color-mix(in oklab,var(--surface-2) 76%,transparent)}
.avatarWrap{display:grid;justify-items:center;gap:10px}.avatar{width:132px;height:132px;border-radius:30px;object-fit:cover;border:1px solid rgba(255,255,255,.10)}.fallback{display:grid;place-items:center;font-size:42px;font-weight:950;background:linear-gradient(135deg,color-mix(in oklab,var(--accent) 36%,transparent),color-mix(in oklab,var(--accent) 12%,transparent))}
.avatarBtn{height:40px;padding:0 14px;border-radius:14px;border:1px solid color-mix(in oklab,var(--accent) 32%,var(--border));background:color-mix(in oklab,var(--accent) 14%,transparent);color:var(--text);font-weight:900}
.heroName{font-size:26px;font-weight:950}.heroHandle{margin-top:4px;color:var(--muted)}.heroHint{margin-top:10px;line-height:1.55;color:var(--muted)}
.form{display:grid;gap:14px}.label{display:grid;gap:8px;font-size:13px;color:var(--muted)}.input,.textarea{width:100%;border-radius:16px;border:1px solid var(--border);background:color-mix(in oklab,var(--surface-2) 86%,transparent);color:var(--text);padding:13px}.textarea{min-height:120px;resize:vertical}.count{justify-self:end;font-size:12px;color:var(--muted)}.actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:4px}.ghostBtn,.primaryBtn{height:46px;padding:0 16px;border-radius:16px;font-weight:900}.ghostBtn{border:1px solid var(--border);background:transparent;color:var(--text)}.primaryBtn{border:1px solid color-mix(in oklab,var(--accent) 40%,var(--border));background:color-mix(in oklab,var(--accent) 18%,transparent);color:var(--text)}.err{color:#ffb4b4}.hidden{display:none}
@media (max-width: 720px){.page{padding:14px}.card{padding:18px}.title{font-size:24px}.steps,.hero{grid-template-columns:1fr}.avatar{width:108px;height:108px;border-radius:24px}}
</style>