import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

const routes = [
  // ✅ Explore 탭이 /search를 쓰는 프로젝트가 많아서 /search를 공식 경로로 둠
  { path: "/", redirect: "/inbox" },

  { path: "/login", component: () => import("../views/LoginView.vue") },

  {
    path: "/",
    component: () => import("../layouts/AppShell.vue"),
    children: [
      { path: "inbox", component: () => import("../views/InboxView.vue") },
      { path: "home", component: () => import("../views/HomeView.vue") },

      // ✅ Explore: /search (BottomTabs에서 /search로 이동하는 경우가 있음)
      { path: "search", component: () => import("../views/SearchView.vue") },

      // ✅ 호환: /explore 로 들어오면 /search로 보내기
      { path: "explore", redirect: "/search" },

      { path: "me", component: () => import("../views/MeView.vue") },

      // Chat detail
      { path: "chat/:id", component: () => import("../views/ChatView.vue") },
    ],
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (to.path === "/login") return true;

  if (auth.isAuthed) return true;

  const ok = await auth.ensureSession();
  if (!ok) return "/login";
  return true;
});
