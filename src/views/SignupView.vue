<!-- src/views/SignupView.vue -->
<template>
  <div class="wrap">
    <div class="card" role="region" aria-label="Signup">
      <div class="head">
        <div class="logo">RealLife</div>
        <div class="sub">새 계정을 만들고 대화가 실제 행동으로 이어지는 흐름을 바로 시작해보세요.</div>
      </div>

      <form class="form" @submit.prevent="onSubmit">
        <label class="label">
          이름
          <input class="input" v-model.trim="name" autocomplete="name" placeholder="이름" />
        </label>

        <label class="label">
          아이디
          <div class="inlineRow">
            <input class="input" v-model.trim="handle" autocomplete="username" placeholder="handle" @blur="checkHandle" />
            <button type="button" class="softBtn" @click="checkHandle" :disabled="checkingHandle || !handle.trim()">
              {{ checkingHandle ? '확인 중...' : '중복 확인' }}
            </button>
          </div>
          <div v-if="handleMessage" class="hint" :data-ok="handleOk">{{ handleMessage }}</div>
        </label>

        <label class="label">
          이메일
          <input class="input" v-model.trim="email" autocomplete="email" inputmode="email" placeholder="email@example.com" />
        </label>

        <label class="label">
          비밀번호
          <input class="input" v-model="password" type="password" autocomplete="new-password" placeholder="비밀번호" />
        </label>

        <label class="label">
          비밀번호 확인
          <input class="input" v-model="passwordConfirm" type="password" autocomplete="new-password" placeholder="비밀번호 다시 입력" />
        </label>

        <button class="btn" :disabled="busy || !canSubmit">{{ busy ? '가입 중...' : '가입하고 시작하기' }}</button>

        <p v-if="error" class="err" role="alert">{{ error }}</p>
      </form>

      <div class="foot">
        <span>이미 계정이 있나요?</span>
        <RouterLink class="link" to="/login">로그인</RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useRouter, RouterLink } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useToastStore } from "@/stores/toast";
import { existsHandle, signUp } from "@/api/users";

const router = useRouter();
const auth = useAuthStore();
const toast = useToastStore();

const name = ref("");
const handle = ref("");
const email = ref("");
const password = ref("");
const passwordConfirm = ref("");

const busy = ref(false);
const checkingHandle = ref(false);
const handleOk = ref(false);
const handleMessage = ref("");
const error = ref("");

const handlePattern = /^[a-zA-Z0-9_\.]{3,20}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const canSubmit = computed(() => {
  return name.value.trim().length >= 2
    && handlePattern.test(handle.value.trim())
    && emailPattern.test(email.value.trim())
    && password.value.length >= 6
    && password.value === passwordConfirm.value;
});

async function checkHandle() {
  const v = handle.value.trim();
  if (!v) return;
  if (!handlePattern.test(v)) {
    handleOk.value = false;
    handleMessage.value = "아이디는 3~20자, 영문/숫자/._ 만 사용할 수 있어요.";
    return;
  }

  checkingHandle.value = true;
  try {
    const exists = await existsHandle(v);
    handleOk.value = !exists;
    handleMessage.value = exists ? "이미 사용 중인 아이디예요." : "사용 가능한 아이디예요.";
  } catch {
    handleOk.value = false;
    handleMessage.value = "중복 확인에 실패했어요. 잠시 후 다시 시도해 주세요.";
  } finally {
    checkingHandle.value = false;
  }
}

async function onSubmit() {
  error.value = "";
  if (!canSubmit.value) {
    error.value = "입력값을 다시 확인해 주세요.";
    return;
  }
  if (!handleOk.value) {
    await checkHandle();
    if (!handleOk.value) {
      error.value = handleMessage.value || "아이디 중복 확인이 필요해요.";
      return;
    }
  }

  busy.value = true;
  try {
    await signUp({ email: email.value.trim(), handle: handle.value.trim(), password: password.value, name: name.value.trim() });
    await auth.loginCookie({ usernameOrEmail: email.value.trim(), password: password.value });
    toast.success("가입 완료", "프로필을 조금만 더 설정하면 바로 시작할 수 있어요.");
    router.replace("/welcome/profile");
  } catch (e) {
    error.value = e?.response?.data?.message || "회원가입에 실패했어요.";
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.card { width: min(520px, 100%); border: 1px solid var(--border); border-radius: var(--r-lg); background: color-mix(in oklab, var(--surface) 92%, transparent); backdrop-filter: blur(12px); padding: 18px; box-shadow: 0 18px 60px rgba(0,0,0,.42); }
.head { margin-bottom: 14px; }
.logo { font-size: 22px; font-weight: 950; letter-spacing: .2px; }
.sub { margin-top: 6px; font-size: 13px; color: var(--muted); line-height: 1.5; }
.form { display: grid; gap: 12px; }
.label { display: grid; gap: 6px; font-size: 13px; color: var(--muted); }
.input { width: 100%; height: 44px; border-radius: var(--r-md); border: 1px solid var(--border); background: color-mix(in oklab, var(--surface-2) 88%, transparent); color: var(--text); padding: 0 12px; }
.inlineRow { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
.softBtn { height: 44px; border-radius: var(--r-md); border: 1px solid var(--border); background: color-mix(in oklab, var(--surface-2) 84%, transparent); color: var(--text); padding: 0 12px; font-weight: 800; }
.btn { height: 46px; border-radius: var(--r-md); border: 1px solid color-mix(in oklab, var(--accent) 40%, var(--border)); background: color-mix(in oklab, var(--accent) 18%, transparent); color: var(--text); font-weight: 950; }
.btn:disabled,.softBtn:disabled { opacity: .55; }
.hint { font-size: 12px; color: color-mix(in oklab, var(--danger) 80%, white); }
.hint[data-ok="true"] { color: color-mix(in oklab, var(--success, #22c55e) 80%, white); }
.err { margin: 2px 0 0; color: color-mix(in oklab, var(--danger) 80%, white); font-size: 13px; }
.foot { margin-top: 14px; display: flex; justify-content: center; gap: 8px; font-size: 13px; color: var(--muted); }
.link { color: var(--text); font-weight: 800; text-decoration: none; }
@media (max-width: 640px) { .card { padding: 16px; } .inlineRow { grid-template-columns: 1fr; } }
</style>
