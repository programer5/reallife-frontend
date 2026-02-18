<script setup>
const feed = [
  { id: 1, author: '민수', time: '1시간 전', body: '오늘 찍은 사진!', img: true },
  { id: 2, author: '지연', time: '어제', body: '새 기능 테스트 중', img: false },
]
</script>

<template>
  <div class="wrap">
    <div class="card" v-for="p in feed" :key="p.id">
      <div class="meta">
        <div class="avatar">{{ p.author.slice(0,1) }}</div>
        <div class="meta__main">
          <div class="meta__name">{{ p.author }}</div>
          <div class="meta__time">{{ p.time }}</div>
        </div>
      </div>

      <div v-if="p.img" class="img"></div>

      <div class="body">{{ p.body }}</div>

      <div class="actions">
        <button class="ghost">👍</button>
        <button class="ghost">💬</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap { display: grid; gap: 14px; }
.card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  overflow: hidden;
}
.meta {
  display:flex; gap: 10px; align-items:center;
  padding: 12px;
}
.avatar{
  width: 34px; height: 34px; border-radius: 14px;
  background: rgba(255,255,255,0.10);
  display:flex; align-items:center; justify-content:center;
  font-weight: 800;
}
.meta__name { font-weight: 750; }
.meta__time { font-size: 12px; opacity: 0.7; }
.img { height: 220px; background: rgba(255,255,255,0.08); }
.body { padding: 12px; opacity: 0.9; }
.actions { display:flex; gap: 8px; padding: 0 12px 12px; }
.ghost {
  background: transparent;
  color: #e8e8ea;
  border: 1px solid rgba(255,255,255,0.14);
  padding: 8px 10px;
  border-radius: 12px;
  cursor: pointer;
}
</style>