
<!-- src/components/chat/GroupCreateModal.vue -->
<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const emit = defineEmits(["close", "created"]);
const title = computed(() => "그룹 채팅 만들기");
const sub = computed(() => "사용자 검색, 선택, 초대, 생성까지 한 번에 진행할 수 있어요.");

function goCreate() {
  emit("close");
  router.push("/inbox/group-create");
}
</script>

<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="sheet rl-cardish">
      <div class="eyebrow">GROUP CHAT</div>
      <div class="head">{{ title }}</div>
      <div class="sub">{{ sub }}</div>

      <div class="steps">
        <div class="step">1. 사용자 검색</div>
        <div class="step">2. 멤버 선택 / 초대</div>
        <div class="step">3. 그룹 생성 후 대화방 이동</div>
      </div>

      <div class="actions">
        <button class="btn ghost" type="button" @click="$emit('close')">닫기</button>
        <button class="btn primary" type="button" @click="goCreate">그룹 만들기</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.46);backdrop-filter:blur(10px);display:grid;place-items:center;padding:20px;z-index:var(--z-modal)}
.sheet{width:min(560px,100%);padding:18px;border-radius:24px;display:grid;gap:12px}
.eyebrow{font-size:11px;font-weight:900;color:var(--muted);letter-spacing:.08em}
.head{font-size:24px;font-weight:950}
.sub{font-size:13px;color:var(--muted)}
.steps{display:grid;gap:8px}
.step{padding:12px 14px;border-radius:16px;border:1px solid color-mix(in oklab,var(--border) 82%, transparent);background:color-mix(in oklab,var(--surface) 82%, transparent);font-size:13px;font-weight:800}
.actions{display:flex;justify-content:flex-end;gap:8px;padding-top:4px}
.btn{height:40px;padding:0 14px;border-radius:999px;border:none;font-weight:900;cursor:pointer}
.btn.ghost{background:rgba(255,255,255,.08);color:var(--text)}
.btn.primary{background:var(--accent);color:var(--accent-contrast, #081018)}
</style>
