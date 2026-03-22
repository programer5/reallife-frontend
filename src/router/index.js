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

function parseCsv(value) {
  return String(value || "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
}

function isOpsAllowedUser(me) {
  if (!me) return false;

  const allowedEmails = parseCsv(import.meta.env.VITE_OPS_ALLOWED_EMAILS);
  const allowedHandles = parseCsv(import.meta.env.VITE_OPS_ALLOWED_HANDLES);

  const email = String(me.email || "").trim().toLowerCase();
  const handle = String(me.handle || "").trim().toLowerCase();

  if (allowedEmails.length && email && allowedEmails.includes(email)) {
    return true;
  }

  if (allowedHandles.length && handle && allowedHandles.includes(handle)) {
    return true;
  }

  return false;
}

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
          { path: "group-create", name: "inbox-group-create", component: () => import("../views/GroupCreateView.vue") },
          { path: "conversations/:conversationId", name: "conversation-detail", component: () => import("../views/ConversationDetailView.vue") },
          { path: "conversations/:conversationId/pins", name: "conversation-pins", component: () => import("../views/PinnedListView.vue") },
          { path: "conversations/:conversationId/group", name: "conversation-group-manage", component: () => import("../views/GroupManageView.vue") },
        ],
      },
      { path: "me", name: "me", component: MeView },
      { path: "me/activity", name: "my-activity", component: () => import("../views/MyActivityView.vue") },
      { path: "search", name: "search-hub", component: () => import("../views/GlobalSearchView.vue") },
      {
        path: "ops/dashboard",
        name: "admin-dashboard",
        component: AdminDashboardView,
        meta: { requiresOps: true },
      },
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

  if (!auth.isAuthed) {
    try {
      await auth.ensureSession();
    } catch {
      return { path: "/login" };
    }
  }

  if (to.meta?.requiresOps) {
    const me = auth.me;
    if (!isOpsAllowedUser(me)) {
      return { path: "/me", query: { denied: "ops" } };
    }
  }

  return true;
});

export default router;