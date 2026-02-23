<!-- src/views/LoginView.vue -->
<template>
  <div class="wrap">
    <div class="card" role="region" aria-label="Login">
      <div class="head">
        <div class="logo">RealLife</div>
        <div class="sub">로그인 후 실시간 피드와 메시지를 확인하세요.</div>
      </div>

      <form class="form" @submit.prevent="onSubmit">
        <label class="label">
          아이디/이메일
          <input
              class="input"
              v-model.trim="usernameOrEmail"
              autocomplete="username"
              inputmode="email"
              placeholder="username or email"
          />
        </label>

        <label class="label">
          비밀번호
          <input
              class="input"
              v-model="password"
              type="password"
              autocomplete="current-password"
              placeholder="password"
          />
        </label>

        <button class="btn" :disabled="auth.loading || !canSubmit">
          {{ auth.loading ? "로그인 중..." : "로그인" }}
        </button>

        <p v-if="auth.error" class="err" role="alert">{{ auth.error }}</p>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useToastStore } from "../stores/toast";

const router = useRouter();
const auth = useAuthStore();
const toast = useToastStore();

const usernameOrEmail = ref("");
const password = ref("");

const canSubmit = computed(() => usernameOrEmail.value.length > 0 && password.value.length > 0);

async function onSubmit() {
  if (!canSubmit.value) return;
  try {
    await auth.loginCookie({ usernameOrEmail: usernameOrEmail.value, password: password.value });
    toast.success("로그인 성공", "환영합니다!");
    router.replace("/home");
  } catch (e) {
    toast.error("로그인 실패", "아이디/비밀번호를 확인해주세요.");
  }
}
</script>

<style scoped>
.wrap {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.card {
  width: min(420px, 100%);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  background: color-mix(in oklab, var(--surface) 92%, transparent);
  backdrop-filter: blur(12px);
  padding: 18px;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.42);
}

.head {
  margin-bottom: 14px;
}

.logo {
  font-size: 22px;
  font-weight: 950;
  letter-spacing: 0.2px;
}

.sub {
  margin-top: 6px;
  font-size: 13px;
  color: var(--muted);
}

.form {
  display: grid;
  gap: 12px;
}

.label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: var(--muted);
}

.input {
  height: 44px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: color-mix(in oklab, var(--surface-2) 88%, transparent);
  color: var(--text);
  padding: 0 12px;
}

.btn {
  height: 46px;
  border-radius: var(--r-md);
  border: 1px solid color-mix(in oklab, var(--accent) 40%, var(--border));
  background: color-mix(in oklab, var(--accent) 18%, transparent);
  color: var(--text);
  font-weight: 950;
}

.btn:disabled {
  opacity: 0.55;
}

.err {
  margin: 2px 0 0;
  color: color-mix(in oklab, var(--danger) 80%, white);
  font-size: 13px;
}
</style>