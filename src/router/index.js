// src/router/index.js
import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

import AppShell from "../layouts/AppShell.vue";
import LoginView from "../views/LoginView.vue";

import HomeView from "../views/HomeView.vue";
import InboxView from "../views/InboxView.vue";
import MeView from "../views/MeView.vue";

const routes = [
  { path: "/login", name: "login", component: LoginView },

  { path: "/posts/:postId", component: () => import("../views/PostDetailView.vue") },

  {
    path: "/",
    component: AppShell,
    children: [
      { path: "", redirect: "/home" },

      { path: "home", name: "home", component: HomeView },

      // ✅ Inbox (알림 화면)
      {
        path: "inbox",
        children: [
          {
            path: "",
            name: "inbox",
            component: InboxView,
          },

          // ✅ Conversations list
          {
            path: "conversations",
            name: "conversations",
            component: () => import("../views/ConversationsView.vue"),
          },

          // ✅ Conversation detail
          {
            path: "conversations/:conversationId",
            name: "conversation-detail",
            component: () => import("../views/ConversationDetailView.vue"),
          },
        ],
      },

      { path: "me", name: "me", component: MeView },
    ],
  },

  { path: "/:pathMatch(.*)*", redirect: "/home" },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  if (to.path === "/login") return true;

  const auth = useAuthStore();
  if (auth.isAuthed) return true;

  try {
    await auth.ensureSession();
    return true;
  } catch {
    return { path: "/login" };
  }
});

export default router;