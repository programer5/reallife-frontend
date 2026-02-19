<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

// ✅ 이미지 로고 사용
import logo from "@/assets/brand/logo.png";

const router = useRouter();
const auth = useAuthStore();

const email = ref("");
const password = ref("");
const loading = ref(false);
const error = ref("");
const showPw = ref(false);

const submit = async () => {
  error.value = "";
  loading.value = true;
  try {
    await auth.login(email.value.trim(), password.value);
    router.replace("/home");
  } catch (e) {
    error.value =
        e?.response?.data?.message ||
        "로그인에 실패했어요. 이메일/비밀번호를 확인해 주세요.";
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="page">
    <div class="card">
      <!-- Brand -->
      <div class="brand">
        <div class="brandMark" aria-hidden="true">
          <img :src="logo" alt="RealLife" class="brandImg" />
        </div>

        <div class="brandText">
          <div class="title">RealLife</div>
          <div class="subtitle">사람을 중심으로, 지금을 연결합니다.</div>
        </div>
      </div>

      <div class="divider"></div>

      <form class="form" @submit.prevent="submit">
        <label class="label">이메일</label>
        <div class="field">
          <span class="ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16v12H4V6Z" stroke="currentColor" stroke-width="1.7" />
              <path
                  d="M4 7l8 6 8-6"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
              />
            </svg>
          </span>
          <input
              v-model="email"
              class="input"
              type="email"
              autocomplete="email"
              placeholder="seed@test.com"
              required
          />
        </div>

        <label class="label">비밀번호</label>
        <div class="field">
          <span class="ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                  d="M7 11V8a5 5 0 0110 0v3"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
              />
              <path d="M6 11h12v9H6v-9Z" stroke="currentColor" stroke-width="1.7" />
              <path
                  d="M12 15v2"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
              />
            </svg>
          </span>

          <input
              v-model="password"
              class="input"
              :type="showPw ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="비밀번호"
              required
          />

          <button class="pwBtn" type="button" @click="showPw = !showPw">
            <span v-if="!showPw">보기</span><span v-else>숨김</span>
          </button>
        </div>

        <p v-if="error" class="err">{{ error }}</p>

        <!-- ✅ 버튼 “두 겹 느낌” 제거: 단일 레이어 버튼 -->
        <button class="cta" type="submit" :disabled="loading">
          <span v-if="!loading">로그인</span>
          <span v-else>로그인 중…</span>
        </button>

        <div class="hintRow">
          <span class="hint">계정이 없나요?</span>
          <span class="link">회원가입(추가 예정)</span>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: calc(100vh - 56px - 72px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.card {
  width: min(420px, 100%);
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: radial-gradient(
      900px 240px at 20% 0%,
      rgba(255, 255, 255, 0.1),
      transparent 55%
  ),
  rgba(255, 255, 255, 0.04);
  padding: 18px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ✅ 이미지 로고 배지 */
.brandMark {
  width: 48px;
  height: 48px;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.35);
  flex: 0 0 auto;
}
.brandImg {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.brandText {
  line-height: 1.15;
}
.title {
  font-size: 18px;
  font-weight: 950;
}
.subtitle {
  margin-top: 3px;
  font-size: 12px;
  opacity: 0.7;
}

.divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 14px 0;
}

.form {
  display: grid;
  gap: 10px;
}
.label {
  font-size: 12px;
  opacity: 0.75;
}

.field {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.18);
}

.field:focus-within {
  border-color: rgba(124, 156, 255, 0.55);
  box-shadow: 0 0 0 4px rgba(124, 156, 255, 0.12);
}

.ico {
  width: 20px;
  height: 20px;
  display: flex;
  opacity: 0.85;
}
.ico svg {
  width: 20px;
  height: 20px;
}

.input {
  flex: 1;
  border: 0;
  outline: none;
  background: transparent;
  color: #e8e8ea;
  font-size: 14px;
}

/* 보기 버튼도 단일 레이어로 */
.pwBtn {
  -webkit-appearance: none;
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(232, 232, 234, 0.9);
  padding: 8px 10px;
  border-radius: 12px;
  font-weight: 900;
  cursor: pointer;
}
.pwBtn:active {
  transform: translateY(1px);
}

.err {
  margin: 2px 0 0;
  color: #ff6b6b;
  font-size: 12px;
}

/* ✅ 로그인 버튼: “두 겹” 느낌 없애기 */
.cta {
  -webkit-appearance: none;
  appearance: none;
  margin-top: 4px;
  width: 100%;
  padding: 12px 14px;
  border-radius: 16px;

  /* 단일 배경 */
  background: rgba(255, 255, 255, 0.08);
  background-image: none;

  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: none;

  color: #e8e8ea;
  font-weight: 950;
  cursor: pointer;
  transition: transform 120ms ease, opacity 120ms ease, background 120ms ease,
  border-color 120ms ease;
}
.cta:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.18);
  transform: translateY(-1px);
}
.cta:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.hintRow {
  display: flex;
  justify-content: space-between;
  margin-top: 2px;
  font-size: 12px;
  opacity: 0.8;
}
.link {
  opacity: 0.95;
  font-weight: 900;
}
</style>