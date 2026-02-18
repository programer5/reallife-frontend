<script setup>
import { ref } from 'vue'
const q = ref('')
const recent = ['민수', '프로필', '알림', '이미지 업로드']
</script>

<template>
  <div class="wrap">
    <div class="card">
      <div class="title">탐색</div>
      <input class="input" v-model="q" placeholder="유저/게시글/해시태그 검색" />
      <div class="chips">
        <button class="chip" v-for="r in recent" :key="r" @click="q = r">{{ r }}</button>
      </div>
      <div class="hint">다음 단계에서 검색 API 연결 (나중에 ES 붙이면 여기가 핵심)</div>
    </div>
  </div>
</template>

<style scoped>
.wrap { display: grid; gap: 14px; }
.card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  padding: 12px;
}
.title { font-weight: 800; margin-bottom: 10px; }
.input{
  width: 100%;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.15);
  color: #e8e8ea;
  outline: none;
}
.chips{ display:flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.chip{
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.06);
  color: #e8e8ea;
  padding: 8px 10px;
  border-radius: 999px;
  cursor: pointer;
}
.hint{ margin-top: 10px; font-size: 12px; opacity: 0.7; }
</style>