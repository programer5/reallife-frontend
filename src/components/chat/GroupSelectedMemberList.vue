
<!-- src/components/chat/GroupSelectedMemberList.vue -->
<script setup>
import RlButton from "@/components/ui/RlButton.vue";
import GroupMemberChip from "@/components/chat/GroupMemberChip.vue";

defineProps({
  title: { type: String, default: "" },
  inviteNote: { type: String, default: "" },
  members: { type: Array, default: () => [] },
  creating: { type: Boolean, default: false },
});
defineEmits(["remove", "create"]);
</script>

<template>
  <section class="panel rl-cardish">
    <div class="panelHead">
      <div class="eyebrow">멤버 목록</div>
      <div class="title">초대할 멤버를 확인하세요</div>
      <div class="sub">선택한 멤버는 그룹 생성과 동시에 이 대화방에 참여하게 됩니다.</div>
    </div>

    <div class="summaryCard">
      <div class="summaryLabel">미리보기</div>
      <div class="summaryTitle">{{ title || "그룹 이름을 입력해 주세요" }}</div>
      <div class="summarySub">{{ inviteNote || "초대 메시지를 입력하면 멤버에게 전달할 분위기를 정리하기 좋아요." }}</div>
    </div>

    <div v-if="members.length === 0" class="empty">
      아직 선택된 멤버가 없어요. 왼쪽에서 검색해서 추가해 보세요.
    </div>

    <div v-else class="chips">
      <GroupMemberChip
        v-for="m in members"
        :key="m.userId"
        :member="m"
        removable
        @remove="$emit('remove', m.userId)"
      />
    </div>

    <div class="foot">
      <div class="count">총 {{ members.length }}명 초대</div>
      <RlButton size="sm" variant="primary" :disabled="members.length === 0 || !title || creating" @click="$emit('create')">
        {{ creating ? "생성 중…" : "그룹 생성" }}
      </RlButton>
    </div>
  </section>
</template>

<style scoped>
.panel{padding:16px;border-radius:24px;display:grid;gap:12px}
.panelHead{display:grid;gap:4px}
.eyebrow{font-size:11px;font-weight:900;letter-spacing:.08em;color:var(--muted)}
.title{font-size:18px;font-weight:950}
.sub{font-size:12px;color:var(--muted)}
.summaryCard{padding:14px;border-radius:18px;border:1px solid color-mix(in oklab,var(--accent) 28%, transparent);background:color-mix(in oklab,var(--accent) 10%, transparent)}
.summaryLabel{font-size:11px;font-weight:900;color:var(--muted)}
.summaryTitle{margin-top:6px;font-size:16px;font-weight:950}
.summarySub{margin-top:6px;font-size:12px;color:color-mix(in oklab,var(--text) 84%, white)}
.empty{padding:28px 12px;text-align:center;color:var(--muted);border-radius:18px;border:1px dashed color-mix(in oklab,var(--border) 76%, transparent)}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.foot{display:flex;align-items:center;justify-content:space-between;gap:10px}
.count{font-size:12px;font-weight:800;color:var(--muted)}
</style>
