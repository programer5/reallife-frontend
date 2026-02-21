import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // ✅ 기본은 nginx(80) 기준. 필요하면 env로 변경:
  // VITE_PROXY_TARGET=http://서버IP
  const target = env.VITE_PROXY_TARGET || "http://localhost";

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target,
          changeOrigin: true,

          // ✅ 쿠키 인증(dev) 안정화:
          // Set-Cookie의 Domain을 개발 환경에 맞게 정리(보통 host-only가 가장 안전)
          cookieDomainRewrite: "",

          // https 타겟을 프록시할 때 dev 서버에서 secure 쿠키 처리 이슈 방지용(지금은 http라 영향 거의 없음)
          secure: false,
        },
        "/docs": {
          target,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});