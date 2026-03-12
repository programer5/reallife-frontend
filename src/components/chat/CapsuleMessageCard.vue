
<template>
<div class="capsule">
  <div class="capsule-title">⏳ 타임캡슐</div>
  <div class="capsule-body">
    <slot />
  </div>
</div>
</template>

<script setup>
</script>

<style scoped>
.capsule{
  border:1px dashed #aaa;
  padding:12px;
  border-radius:8px;
  background:#fafafa;
}
.capsule-title{
  font-weight:700;
  margin-bottom:6px;
}
</style>
