<template>
  <button
      class="rl-btn"
      :class="[
      `rl-btn--${variant}`,
      `rl-btn--${size}`,
      { 'is-loading': loading, 'is-block': block }
    ]"
      :disabled="disabled || loading"
      v-bind="$attrs"
  >
    <span v-if="loading" class="rl-btn__spinner" aria-hidden="true"></span>
    <span class="rl-btn__content"><slot /></span>
  </button>
</template>

<script setup>
defineProps({
  variant: { type: String, default: "soft" }, // primary | soft | ghost | danger
  size: { type: String, default: "md" },      // sm | md | lg
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
});
</script>

<style scoped>
/* ✅ “두 겹” 방지: 브라우저 기본/전역 오버레이 제거 */
.rl-btn{
  -webkit-appearance: none;
  appearance: none;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;

  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.14);

  background: rgba(255,255,255,.06);
  background-image: none !important; /* ✅ 그라데이션/오버레이 차단 */
  box-shadow: none !important;       /* ✅ 이중 그림자 차단 */

  color: rgba(255,255,255,.92);
  font-weight: 900;
  letter-spacing: .2px;

  cursor: pointer;
  user-select: none;

  transition: transform .08s ease, background .12s ease, border-color .12s ease, opacity .12s ease;
}

.rl-btn:hover{
  background: rgba(255,255,255,.08);
  border-color: rgba(255,255,255,.18);
}
.rl-btn:active{ transform: translateY(1px); }

.rl-btn:disabled{
  opacity: .55;
  cursor: not-allowed;
  transform: none;
}

/* block */
.rl-btn.is-block{ width: 100%; }

/* sizes */
.rl-btn--sm{ height: 34px; padding: 0 12px; font-size: 12.5px; border-radius: 12px; }
.rl-btn--md{ height: 40px; padding: 0 14px; font-size: 13.5px; }
.rl-btn--lg{ height: 46px; padding: 0 16px; font-size: 14.5px; border-radius: 16px; }

/* variants */
.rl-btn--ghost{
  background: transparent;
  background-image: none !important;
  border-color: rgba(255,255,255,.10);
}
.rl-btn--ghost:hover{ background: rgba(255,255,255,.05); }

.rl-btn--soft{
  background: rgba(255,255,255,.06);
  background-image: none !important;
}

.rl-btn--primary{
  /* 브랜드 컬러가 있으면 그걸 쓰고, 없으면 기본 그레이 */
  background: rgba(124,156,255,.22);
  background-image: none !important;
  border-color: rgba(124,156,255,.30);
}
.rl-btn--primary:hover{
  background: rgba(124,156,255,.28);
  border-color: rgba(124,156,255,.36);
}

.rl-btn--danger{
  background: rgba(255,107,107,.18);
  background-image: none !important;
  border-color: rgba(255,107,107,.26);
}
.rl-btn--danger:hover{
  background: rgba(255,107,107,.22);
  border-color: rgba(255,107,107,.32);
}

/* spinner */
.rl-btn__spinner{
  width: 14px; height: 14px;
  border-radius: 999px;
  border: 2px solid rgba(255,255,255,.25);
  border-top-color: rgba(255,255,255,.85);
  animation: spin .75s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.rl-btn__content{
  display:inline-flex;
  align-items:center;
  gap:8px;
}
</style>