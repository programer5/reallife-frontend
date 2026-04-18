<script setup>
import { computed } from 'vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  mode: { type: String, default: 'set' },
  isNarrow: { type: Boolean, default: false },
  password: { type: String, default: '' },
  confirmPassword: { type: String, default: '' },
});

const emit = defineEmits([
  'update:open',
  'update:password',
  'update:confirm-password',
  'submit',
  'close',
]);

const passwordModel = computed({
  get: () => props.password,
  set: (value) => emit('update:password', value),
});

const confirmPasswordModel = computed({
  get: () => props.confirmPassword,
  set: (value) => emit('update:confirm-password', value),
});

const titleText = computed(() => (props.mode === 'set' ? '🔒 대화 잠금 설정' : '🔓 대화 잠금 해제'));
const subtitleText = computed(() => (
  props.mode === 'set'
    ? '이 DM에 들어갈 때마다 비밀번호를 입력해야 해요.'
    : '잠금을 해제하려면 비밀번호를 입력해 주세요.'
));
const primaryText = computed(() => (props.mode === 'set' ? '잠금 설정' : '잠금 해제'));
</script>

<template>
  <div v-if="open" class="modalBackdrop" @click.self="emit('close')">
    <div class="modal rl-cardish" :class="{ 'modal--sheet': isNarrow }" role="dialog" aria-modal="true">
      <div v-if="isNarrow" class="modalGrab" aria-hidden="true"></div>
      <div class="mTitle">{{ titleText }}</div>
      <div class="mSub">{{ subtitleText }}</div>

      <div class="mBody">
        <input
          v-model="passwordModel"
          class="mInput"
          type="password"
          :placeholder="mode === 'set' ? '비밀번호' : '비밀번호 입력'"
          @keydown.enter.prevent="emit('submit')"
        />
        <input
          v-if="mode === 'set'"
          v-model="confirmPasswordModel"
          class="mInput"
          type="password"
          placeholder="비밀번호 확인"
          @keydown.enter.prevent="emit('submit')"
        />
      </div>

      <div class="mActions">
        <button class="mBtn" type="button" @click="emit('submit')">{{ primaryText }}</button>
        <button class="mBtn soft" type="button" @click="emit('close')">취소</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modalBackdrop{
  position:fixed;
  inset:0;
  background: rgba(0,0,0,.56);
  backdrop-filter: blur(10px);
  display:grid;
  place-items:center;
  padding: 20px;
  z-index: 120;
}
.modal{
  width: min(520px, calc(100% - 24px));
  border-radius: 22px;
  border: 1px solid var(--border);
  background: color-mix(in oklab, var(--surface) 92%, transparent);
  box-shadow: 0 28px 80px rgba(0,0,0,.42);
  padding: 16px;
}
.modalGrab{
  width: 52px;
  height: 5px;
  border-radius: 999px;
  margin: 0 auto 12px;
  background: color-mix(in oklab, var(--text) 20%, transparent);
}
.mTitle{font-weight:950}
.mSub{margin-top:6px;color:var(--muted);font-size:12px}
.mBody{margin-top:10px;display:grid;gap:8px}
.mInput{
  height:44px;
  border-radius:14px;
  border:1px solid var(--border);
  background: color-mix(in oklab, var(--surface) 86%, transparent);
  color:var(--text);
  padding:0 12px;
}
.mActions{margin-top:12px;display:flex;gap:8px}
.mBtn{
  flex:1;
  height:44px;
  border-radius:14px;
  border:1px solid var(--border);
  background: transparent;
  color:var(--text);
  font-weight:950;
}
.mBtn.soft{opacity:.85}
@media (max-width: 640px){
  .modalBackdrop{
    place-items:end center;
    padding: 12px 12px calc(env(safe-area-inset-bottom) + var(--app-bottombar-h, 56px) + 12px);
  }
  .modal,
  .modal--sheet{
    width: 100%;
    border-radius: 22px;
    padding: 16px 14px;
  }
  .mActions{flex-direction: column;}
  .mBtn{height:48px;}
}
</style>
