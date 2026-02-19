<template>
  <button class="rl-row" :class="{ 'is-unread': unread }">
    <span class="rl-row__bar" aria-hidden="true"></span>

    <span class="rl-row__avatar" aria-hidden="true">
      <slot name="avatar">{{ avatarFallback }}</slot>
    </span>

    <span class="rl-row__main">
      <span class="rl-row__title">
        <slot name="title" />
      </span>
      <span class="rl-row__sub">
        <slot name="sub" />
      </span>
    </span>

    <span class="rl-row__right">
      <slot name="right" />
    </span>
  </button>
</template>

<script setup>
defineProps({
  unread: { type: Boolean, default: false },
  avatarFallback: { type: String, default: "•" },
});
</script>

<style scoped>
.rl-row{
  width:100%;
  display:flex;
  align-items:center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: rgba(255,255,255,.03);
  color: var(--text);
  text-align:left;
  position:relative;
  transition: transform .08s ease, background .12s ease, border-color .12s ease;
}
.rl-row:hover{
  background: rgba(255,255,255,.05);
  border-color: rgba(255,255,255,.12);
}
.rl-row:active{ transform: translateY(1px); }

.rl-row__bar{
  width: 4px; height: 22px;
  border-radius: 999px;
  background: transparent;
  flex: 0 0 auto;
}
.rl-row.is-unread .rl-row__bar{
  background: linear-gradient(180deg, var(--brand-1), var(--brand-4));
}

.rl-row__avatar{
  width: 40px; height: 40px;
  border-radius: 14px;
  display:flex; align-items:center; justify-content:center;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.08);
  flex: 0 0 auto;
  font-weight: 700;
  color: rgba(255,255,255,.85);
}

.rl-row__main{
  min-width: 0;
  display:flex;
  flex-direction:column;
  gap: 3px;
  flex: 1 1 auto;
}
.rl-row__title{
  font-size: 14px;
  font-weight: 650;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rl-row__sub{
  font-size: 12.5px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rl-row__right{
  flex: 0 0 auto;
  display:flex;
  align-items:flex-end;
  justify-content:flex-end;
  gap: 8px;
  color: var(--muted);
  font-size: 12px;
}
</style>