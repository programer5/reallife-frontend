<script setup>
defineProps({
  size: { type: Number, default: 34 },      // px
  rounded: { type: Number, default: 12 },   // px
})
</script>

<template>
  <div class="mark" :style="{ width: size + 'px', height: size + 'px', borderRadius: rounded + 'px' }" aria-label="RealLife logo">
    <svg class="svg" viewBox="0 0 64 64" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="rl_g" x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#93B2FF"/>
          <stop offset="0.55" stop-color="#4B5CFF"/>
          <stop offset="1" stop-color="#2B2D8F"/>
        </linearGradient>
        <radialGradient id="rl_s" cx="0.28" cy="0.18" r="0.9">
          <stop offset="0" stop-color="white" stop-opacity="0.28"/>
          <stop offset="0.55" stop-color="white" stop-opacity="0.06"/>
          <stop offset="1" stop-color="white" stop-opacity="0"/>
        </radialGradient>
        <filter id="rl_shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#4B5CFF" flood-opacity="0.22"/>
        </filter>
      </defs>

      <!-- background -->
      <rect x="4" y="4" width="56" height="56" rx="18" fill="url(#rl_g)" filter="url(#rl_shadow)"/>
      <rect x="4" y="4" width="56" height="56" rx="18" fill="url(#rl_s)"/>

      <!-- monogram: RL (custom paths, not a font) -->
      <!-- R -->
      <path
          d="M22 18.5h11.4c6 0 10.2 3 10.2 8.2 0 3.6-2 6.1-5.2 7.3l5.8 11.5h-7.1l-5.1-10.3H29.2v10.3H22V18.5Zm7.2 6.2v7.8h4.9c2.7 0 4.3-1.3 4.3-3.9 0-2.5-1.6-3.9-4.3-3.9h-4.9Z"
          fill="rgba(255,255,255,0.92)"
      />
      <!-- L (subtle, tucked) -->
      <path
          d="M22 45.5h20.5v6H22v-6Z"
          fill="rgba(255,255,255,0.92)"
          opacity="0.9"
      />

      <!-- thin border -->
      <rect x="4.6" y="4.6" width="54.8" height="54.8" rx="17.4" fill="none" stroke="rgba(255,255,255,0.18)"/>
    </svg>
  </div>
</template>

<style scoped>
.mark{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  overflow:hidden;
  transform: translateZ(0);
}
.svg{
  width:100%;
  height:100%;
  display:block;
}
</style>