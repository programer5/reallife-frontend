<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import LogoMark from '../components/LogoMark.vue'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const showPw = ref(false)

const submit = async () => {
  error.value = ''
  loading.value = true
  try {
    await auth.login(email.value.trim(), password.value)
    router.replace('/home')
  } catch (e) {
    error.value = e?.response?.data?.message || '로그인에 실패했어요. 이메일/비밀번호를 확인해 주세요.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="card">
      <!-- Brand -->
      <div class="brand">
        <LogoMark :size="48" :rounded="18" />
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
              <path d="M4 6h16v12H4V6Z" stroke="currentColor" stroke-width="1.7"/>
              <path d="M4 7l8 6 8-6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            </svg>
          </span>
          <input v-model="email" class="input" type="email" autocomplete="email" placeholder="seed@test.com" required />
        </div>

        <label class="label">비밀번호</label>
        <div class="field">
          <span class="ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M7 11V8a5 5 0 0110 0v3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
              <path d="M6 11h12v9H6v-9Z" stroke="currentColor" stroke-width="1.7"/>
              <path d="M12 15v2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            </svg>
          </span>

          <input v-model="password" class="input" :type="showPw ? 'text' : 'password'" autocomplete="current-password" placeholder="비밀번호" required />

          <button class="pwBtn" type="button" @click="showPw = !showPw">
            <span v-if="!showPw">보기</span><span v-else>숨김</span>
          </button>
        </div>

        <p v-if="error" class="err">{{ error }}</p>

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
.page{
  min-height: calc(100vh - 56px - 72px);
  display:flex;
  align-items:center;
  justify-content:center;
  padding: 16px;
}

.card{
  width: min(420px, 100%);
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,0.10);
  background: radial-gradient(900px 240px at 20% 0%, rgba(255,255,255,0.10), transparent 55%),
  rgba(255,255,255,0.04);
  padding: 18px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.45);
}

.brand{
  display:flex;
  align-items:center;
  gap: 12px;
}

.brandText{ line-height: 1.15; }
.title{ font-size: 18px; font-weight: 950; }
.subtitle{ margin-top: 3px; font-size: 12px; opacity: 0.7; }

.divider{
  height: 1px;
  background: rgba(255,255,255,0.10);
  margin: 14px 0;
}

.form{ display:grid; gap: 10px; }
.label{ font-size: 12px; opacity: .75; }

.field{
  display:flex;
  align-items:center;
  gap: 10px;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.18);
}

.field:focus-within{
  border-color: rgba(124,156,255,0.55);
  box-shadow: 0 0 0 4px rgba(124,156,255,0.12);
}

.ico{ width: 20px; height: 20px; display:flex; opacity: .85; }
.ico svg{ width: 20px; height: 20px; }

.input{
  flex: 1;
  border: 0;
  outline: none;
  background: transparent;
  color: #e8e8ea;
  font-size: 14px;
}

.pwBtn{
  border: 0;
  background: rgba(255,255,255,0.06);
  color: rgba(232,232,234,0.9);
  padding: 8px 10px;
  border-radius: 12px;
  font-weight: 900;
  cursor: pointer;
}

.err{ margin: 2px 0 0; color: #ff6b6b; font-size: 12px; }

.cta{
  margin-top: 4px;
  width: 100%;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.14);
  background: radial-gradient(600px 200px at 20% 0%, rgba(255,255,255,0.16), transparent 60%),
  rgba(255,255,255,0.08);
  color: #e8e8ea;
  font-weight: 950;
  cursor: pointer;
  transition: transform 120ms ease, opacity 120ms ease;
}
.cta:hover{ transform: translateY(-1px); }
.cta:disabled{ opacity: 0.6; cursor: not-allowed; transform: none; }

.hintRow{
  display:flex;
  justify-content:space-between;
  margin-top: 2px;
  font-size: 12px;
  opacity: .8;
}
.link{ opacity: .95; font-weight: 900; }
</style>