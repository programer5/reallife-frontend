import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

import AppShell from "../layouts/AppShell.vue";
import LoginView from "../views/LoginView.vue";
import SignupView from "../views/SignupView.vue";
import OnboardingProfileSetupView from "../views/OnboardingProfileSetupView.vue";

import HomeView from "../views/HomeView.vue";
import InboxView from "../views/InboxView.vue";
import MeView from "../views/MeView.vue";
import AdminDashboardView from "../views/AdminDashboardView.vue";

const routes = [
  { path: "/login", name: "login", component: LoginView, meta: { guestOnly: true } },
  { path: "/signup", name: "signup", component: SignupView, meta: { guestOnly: true } },
  { path: "/welcome/profile", name: "welcome-profile", component: OnboardingProfileSetupView },

  { path: "/posts/:postId", component: () => import("../views/PostDetailView.vue") },

  {
    path: "/",
    component: AppShell,
    children: [
      { path: "", redirect: "/home" },
      { path: "home", name: "home", component: HomeView },
      { path: "u/:handle", name: "user-profile", component: () => import("../views/UserProfileView.vue") },
      { path: "u/id/:userId", name: "user-profile-id", component: () => import("../views/UserProfileView.vue") },
      {
        path: "inbox",
        children: [
          { path: "", name: "inbox", component: InboxView },
          { path: "new", name: "inbox-new", component: () => import("../views/NewDirectMessageView.vue") },
          { path: "conversations", name: "conversations", component: () => import("../views/ConversationsView.vue") },
          { path: "conversations/:conversationId", name: "conversation-detail", component: () => import("../views/ConversationDetailView.vue") },
          { path: "conversations/:conversationId/pins", name: "conversation-pins", component: () => import("../views/PinnedListView.vue") },
        ],
      },
      { path: "me", name: "me", component: MeView },
      { path: "ops/dashboard", name: "admin-dashboard", component: AdminDashboardView },
    ],
  },

  { path: "/:pathMatch(.*)*", redirect: "/home" },
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (to.meta?.guestOnly) {
    if (auth.isAuthed) return { path: "/home" };
    return true;
  }

  if (auth.isAuthed) return true;

  try {
    await auth.ensureSession();
    return true;
  } catch {
    return { path: "/login" };
  }
});

export default router;