<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<template>
  <div class="card">
    <div class="title">로그인</div>
    <div class="hint">다음 단계에서 실제 로그인(/api/auth/login) 연결할게.</div>
    <button class="btn" @click="router.push('/inbox')">임시로 앱 들어가기</button>
  </div>
</template>

<style scoped>
.card {
  margin-top: 14px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  padding: 12px;
}
.title { font-weight: 900; margin-bottom: 8px; }
.hint { font-size: 12px; opacity: 0.7; margin-bottom: 10px; }
.btn{
  width: 100%;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.06);
  color: #e8e8ea;
  font-weight: 800;
  cursor: pointer;
}
</style>