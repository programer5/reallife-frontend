<script setup>
</script>

<template>
  <div class="wrap">
    <section class="card">
      <div class="head">
        <div class="avatar">M</div>
        <div class="main">
          <div class="name">내 페이지</div>
          <div class="sub">프로필/설정 중심</div>
        </div>
      </div>

      <div class="grid">
        <button class="tile">프로필 편집</button>
        <button class="tile">계정/보안</button>
        <button class="tile">세션 관리</button>
        <button class="tile">로그아웃</button>
      </div>

      <div class="hint">
        다음 단계에서: 실제 /api/me 연결 + 프로필 이미지 업로드/썸네일 표시로 바꿔줄게.
      </div>
    </section>
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
.head{ display:flex; gap: 10px; align-items:center; margin-bottom: 10px; }
.avatar{
  width: 44px; height: 44px; border-radius: 16px;
  background: rgba(255,255,255,0.10);
  display:flex; align-items:center; justify-content:center;
  font-weight: 900;
}
.name{ font-weight: 900; }
.sub{ font-size: 12px; opacity: 0.7; }
.grid{ display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
.tile{
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.06);
  color: #e8e8ea;
  padding: 14px 12px;
  border-radius: 14px;
  cursor: pointer;
  text-align: left;
  font-weight: 700;
}
.hint{ margin-top: 10px; font-size: 12px; opacity: 0.7; }
</style>