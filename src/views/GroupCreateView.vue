
<!-- src/views/GroupCreateView.vue -->
<script setup>
import { computed, onMounted, ref, watch, nextTick } from "vue";
import { useRouter } from "vue-router";
import RlButton from "@/components/ui/RlButton.vue";
import { searchUsers } from "@/api/users";
import { createGroupConversation } from "@/api/conversations";
import GroupUserSearchPanel from "@/components/chat/GroupUserSearchPanel.vue";
import GroupSelectedMemberList from "@/components/chat/GroupSelectedMemberList.vue";
import { useAuthStore } from "@/stores/auth";
import { useToastStore } from "@/stores/toast";

const router = useRouter();
const auth = useAuthStore();
const toast = useToastStore();

const title = ref("");
const inviteNote = ref("같이 이야기하고 현실로 이어갈 그룹 채팅을 열어요.");
const q = ref("");
const loading = ref(false);
const creating = ref(false);
const error = ref("");
const results = ref([]);
const nextCursor = ref(null);
const hasNext = ref(false);
const selected = ref([]);
const inputRef = ref(null);

const canSearch = computed(() => q.value.trim().length > 0);
const canCreate = computed(() => title.value.trim().length > 0 && selected.value.length > 0);

let t = null;

function isMine(user) {
  const meId = auth.me?.userId || auth.me?.id || null;
  return !!meId && String(user?.userId || user?.id) === String(meId);
}

function normalizeUser(u) {
  if (!u) return null;
  return {
    userId: u.userId || u.id,
    nickname: u.nickname || u.name || u.handle || "사용자",
    handle: u.handle || "",
    profileImageUrl: u.profileImageUrl || "",
  };
}

function alreadySelected(user) {
  const id = String(user?.userId || user?.id || "");
  return selected.value.some((m) => String(m.userId) === id);
}

function addUser(user) {
  const n = normalizeUser(user);
  if (!n?.userId || alreadySelected(n)) return;
  selected.value = [...selected.value, n];
}

function removeUser(userId) {
  selected.value = selected.value.filter((m) => String(m.userId) !== String(userId));
}

async function runSearch({ reset = true } = {}) {
  const query = q.value.trim();
  if (!query) {
    results.value = [];
    nextCursor.value = null;
    hasNext.value = false;
    return;
  }

  loading.value = true;
  error.value = "";
  try {
    const res = await searchUsers({
      q: query,
      cursor: reset ? null : nextCursor.value,
      size: 20,
    });

    let items = Array.isArray(res.items) ? res.items.map(normalizeUser).filter(Boolean) : [];
    items = items.filter((u) => !isMine(u));

    if (reset) results.value = items;
    else results.value = [...results.value, ...items];

    nextCursor.value = res.nextCursor ?? null;
    hasNext.value = !!res.hasNext;
  } catch (e) {
    error.value = e?.response?.data?.message || "사용자 검색에 실패했어요.";
  } finally {
    loading.value = false;
  }
}

function onTyping() {
  clearTimeout(t);
  t = setTimeout(() => runSearch({ reset: true }), 220);
}
watch(q, onTyping);

function saveLocalGroupMeta(conversationId) {
  try {
    const raw = sessionStorage.getItem("reallife:groupConversationMetaMap") || "{}";
    const map = JSON.parse(raw);
    map[String(conversationId)] = {
      title: title.value.trim(),
      inviteNote: inviteNote.value.trim(),
      members: selected.value,
      createdAt: new Date().toISOString(),
    };
    sessionStorage.setItem("reallife:groupConversationMetaMap", JSON.stringify(map));
  } catch {}
}

async function createGroup() {
  if (!canCreate.value || creating.value) return;
  creating.value = true;
  error.value = "";
  try {
    const res = await createGroupConversation({
      title: title.value.trim(),
      participantIds: selected.value.map((m) => m.userId),
      coverImageFileId: null,
    });
    const cid = res?.conversationId;
    if (!cid) throw new Error("conversationId missing");
    saveLocalGroupMeta(cid);
    toast.success?.("그룹 채팅 생성", "선택한 멤버로 새 그룹을 만들었어요.");
    router.push(`/inbox/conversations/${cid}`);
  } catch (e) {
    error.value = e?.response?.data?.message || "그룹 채팅을 만들지 못했어요.";
  } finally {
    creating.value = false;
  }
}

onMounted(async () => {
  await auth.ensureSession?.();
  await nextTick();
  inputRef.value?.focus?.();
});
</script>

<template>
  <div class="page">
    <header class="hero rl-cardish">
      <div class="heroTop">
        <RlButton size="sm" variant="ghost" @click="router.back()">←</RlButton>
        <div class="heroTitle">
          <div class="h1">그룹 채팅 만들기</div>
          <div class="h2">사용자를 검색해서 여러 명을 선택하고, 그룹 이름을 정한 뒤 바로 대화를 시작하세요.</div>
        </div>
        <div class="spacer"></div>
      </div>

      <div class="heroGrid">
        <label class="field rl-cardish">
          <span class="fieldLabel">그룹 이름</span>
          <input ref="inputRef" v-model="title" class="fieldInput" placeholder="예: 홍대 저녁 번개 / 운동 메이트 / 주말 스터디" />
        </label>

        <label class="field rl-cardish">
          <span class="fieldLabel">초대 메시지</span>
          <input v-model="inviteNote" class="fieldInput" placeholder="멤버들에게 보여줄 짧은 설명" />
        </label>
      </div>

      <div class="helperRow">
        <span class="helperPill">선택 멤버 {{ selected.length }}명</span>
        <span class="helperPill">검색 후 바로 추가</span>
        <span class="helperPill">생성 후 대화방으로 이동</span>
      </div>
    </header>

    <section class="bodyGrid">
      <GroupUserSearchPanel
        v-model:q="q"
        :items="results"
        :loading="loading"
        :error="error"
        :can-search="canSearch"
        :has-next="hasNext"
        @search="runSearch({ reset: true })"
        @load-more="runSearch({ reset: false })"
        @add="addUser"
      />

      <GroupSelectedMemberList
        :title="title"
        :invite-note="inviteNote"
        :members="selected"
        :creating="creating"
        @remove="removeUser"
        @create="createGroup"
      />
    </section>
  </div>
</template>

<style scoped>
.page{display:grid;gap:14px}
.hero{padding:16px;border-radius:24px;display:grid;gap:14px}
.heroTop{display:flex;align-items:center;gap:10px}
.heroTitle{display:grid;gap:4px}
.h1{font-size:22px;font-weight:950}
.h2{font-size:13px;color:var(--muted)}
.spacer{flex:1}
.heroGrid{display:grid;grid-template-columns:1.05fr .95fr;gap:12px}
.field{display:grid;gap:8px;padding:14px;border-radius:18px}
.fieldLabel{font-size:12px;font-weight:900;color:var(--muted)}
.fieldInput{height:46px;border-radius:14px;border:1px solid var(--border);background:color-mix(in oklab,var(--surface-2) 90%,transparent);padding:0 12px;color:var(--text)}
.helperRow{display:flex;flex-wrap:wrap;gap:8px}
.helperPill{display:inline-flex;align-items:center;justify-content:center;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);font-size:12px;font-weight:800}
.bodyGrid{display:grid;grid-template-columns:1.15fr .85fr;gap:14px}
@media (max-width: 920px){
  .heroGrid,.bodyGrid{grid-template-columns:1fr}
}
</style>
