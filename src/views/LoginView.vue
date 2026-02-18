<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const onLogin = async () => {
  error.value = ''
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    router.push('/inbox')
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || '로그인 실패'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="card">
      <div class="brand">
        <div class="logo">R</div>
        <div>
          <div class="title">RealLife</div>
          <div class="subtitle">인박스에서 모든 소통을 한 번에</div>
        </div>
      </div>

      <div class="form">
        <label class="field">
          <div class="label">이메일</div>
          <input v-model="email" class="input" placeholder="seed@test.com" autocomplete="username" />
        </label>

        <label class="field">
          <div class="label">비밀번호</div>
          <input v-model="password" class="input" type="password" placeholder="••••••••" autocomplete="current-password" />
        </label>

        <button class="btn" :disabled="loading" @click="onLogin">
          <span v-if="!loading">로그인</span>
          <span v-else>로그인 중...</span>
        </button>

        <p v-if="error" class="err">{{ error }}</p>
      </div>

      <div class="divider">
        <span>또는</span>
      </div>

      <!-- 소셜 로그인은 "나중에" 붙이기 좋게 버튼만 미리 마련 -->
      <div class="social">
        <button class="socialBtn" disabled title="추후 구현">
          Google로 계속하기
        </button>
        <button class="socialBtn" disabled title="추후 구현">
          Naver로 계속하기
        </button>
        <button class="socialBtn" disabled title="추후 구현">
          Kakao로 계속하기
        </button>
      </div>

      <div class="foot">
        <a class="link" href="http://localhost/docs" target="_blank" rel="noreferrer">API 문서</a>
        <span class="dot">•</span>
        <span class="hint">개발중</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page{
  min-height: calc(100vh - 56px - 64px);
  display:flex;
  align-items:center;
  justify-content:center;
  padding: 16px;
}

.card{
  width: min(520px, 100%);
  background: radial-gradient(1200px 500px at 10% 0%, rgba(255,255,255,0.10), transparent 50%),
  rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 20px;
  padding: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.35);
}

.brand{
  display:flex;
  gap: 12px;
  align-items:center;
  margin-bottom: 14px;
}

.logo{
  width: 48px;
  height: 48px;
  border-radius: 18px;
  background: rgba(255,255,255,0.10);
  border: 1px solid rgba(255,255,255,0.14);
  display:flex;
  align-items:center;
  justify-content:center;
  font-weight: 900;
  font-size: 18px;
}

.title{
  font-weight: 950;
  letter-spacing: 0.2px;
  font-size: 18px;
}

.subtitle{
  font-size: 12px;
  opacity: 0.75;
  margin-top: 2px;
}

.form{ display:grid; gap: 12px; margin-top: 10px; }

.field{ display:grid; gap: 6px; }
.label{ font-size: 12px; opacity: 0.78; }

.input{
  width: 100%;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.18);
  color: #e8e8ea;
  outline: none;
}

.btn{
  width: 100%;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.16);
  background: rgba(255,255,255,0.08);
  color: #e8e8ea;
  font-weight: 900;
  cursor: pointer;
}
.btn:disabled{ opacity: 0.6; cursor: not-allowed; }

.err{
  margin: 0;
  color: #ff6b6b;
  font-size: 13px;
}

.divider{
  display:flex;
  align-items:center;
  gap: 10px;
  margin: 14px 0;
  opacity: 0.7;
  font-size: 12px;
}
.divider::before,
.divider::after{
  content:'';
  height: 1px;
  flex: 1;
  background: rgba(255,255,255,0.10);
}

.social{ display:grid; gap: 10px; }
.socialBtn{
  width: 100%;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.12);
  color: rgba(232,232,234,0.65);
  cursor: not-allowed;
}

.foot{
  display:flex;
  align-items:center;
  justify-content:center;
  gap: 8px;
  margin-top: 14px;
  font-size: 12px;
  opacity: 0.75;
}
.link{ color: inherit; }
.dot{ opacity: 0.6; }
.hint{ opacity: 0.7; }
</style>
