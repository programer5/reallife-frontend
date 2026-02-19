<template>
  <header class="header">
    <div class="left" @click="goHome" role="button" tabindex="0">
      <div class="brandMark" aria-hidden="true">
        <img :src="logo" alt="RealLife" class="brandImg" />
      </div>

      <div class="brandText">
        <div class="brandName">RealLife</div>
        <div class="brandSub">{{ subtitle }}</div>
      </div>
    </div>

    <div class="right">
      <button class="iconBtn" @click="goInbox" title="Connect" aria-label="Connect">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
              fill="currentColor"
              d="M20 3H4a2 2 0 0 0-2 2v13a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V5a2 2 0 0 0-2-2Zm0 15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6h16v12Z"
          />
          <path fill="currentColor" d="M7 9h10v2H7z" opacity=".9" />
        </svg>
      </button>

      <button class="iconBtn" @click="goMe" title="Me" aria-label="Me">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
              fill="currentColor"
              d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2-8 4.5V21h16v-2.5C20 16 16.42 14 12 14Z"
          />
        </svg>
      </button>
    </div>
  </header>
</template>

<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import logo from "@/assets/brand/logo.png";

const route = useRoute();
const router = useRouter();

/**
 * ✅ Explore만 안 바뀌는 케이스:
 * - Explore 탭 라우트가 /explore가 아니라 "/" 또는 "/discover" 등일 수 있음
 * - 그래서 path를 폭 넓게 매칭
 */
const subtitle = computed(() => {
  const path = (route.path || "/").toLowerCase();

  // login
  if (path.startsWith("/login")) return "Sign in";

  // ✅ Explore 후보들: /, /explore, /discover, /search, /feed
  if (
      path === "/" ||
      path.startsWith("/explore") ||
      path.startsWith("/discover") ||
      path.startsWith("/search") ||
      path.startsWith("/feed")
  ) {
    return "Explore";
  }

  if (path.startsWith("/inbox") || path.startsWith("/connect")) return "Connect";
  if (path.startsWith("/me")) return "Me";
  if (path.startsWith("/home")) return "Home";

  // 기본값
  return "Home";
});

function goHome() {
  router.push("/home");
}
function goInbox() {
  router.push("/inbox");
}
function goMe() {
  router.push("/me");
}
</script>

<style scoped>
.header{
  position: sticky;
  top: 0;
  z-index: 50;
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  background: rgba(15,17,21,.55);
  backdrop-filter: blur(14px);
}

.left{
  display:flex;
  align-items:center;
  gap: 10px;
  cursor: pointer;
  user-select:none;
}

.brandMark{
  width: 32px;
  height: 32px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 12px 30px rgba(0,0,0,.35);
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.04);
  display:grid;
  place-items:center;
}
.brandImg{
  width: 100%;
  height: 100%;
  display:block;
  object-fit: cover;
}

.brandText{
  display:flex;
  flex-direction:column;
  gap: 1px;
  line-height: 1.05;
}
.brandName{
  font-weight: 800;
  letter-spacing: .2px;
  font-size: 14px;
}
.brandSub{
  font-size: 11.5px;
  color: var(--muted);
}

.right{ display:flex; align-items:center; gap: 10px; }

.iconBtn{
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.04);
  color: rgba(255,255,255,.82);
  display:grid;
  place-items:center;
  cursor:pointer;
  transition: transform .08s ease, background .12s ease, border-color .12s ease;
}
.iconBtn:hover{ background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.14); }
.iconBtn:active{ transform: translateY(1px); }
</style>
