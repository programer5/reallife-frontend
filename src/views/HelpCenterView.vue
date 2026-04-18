<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const auth = useAuthStore();

const sections = computed(() => [
  {
    title: '처음 시작',
    items: [
      { title: 'Home', body: '피드와 반응을 보는 곳' },
      { title: 'Search', body: '사람을 찾고 프로필이나 대화로 이동' },
      { title: 'Connect', body: '대화, 알림, 약속 흐름 확인' },
      { title: 'Me', body: '프로필과 개인 설정 정리' },
    ],
  },
  {
    title: '대화에서 자주 쓰는 기능',
    items: [
      { title: '메시지', body: '바로 보내고 읽음 흐름 확인' },
      { title: 'Pin', body: '약속이나 중요한 내용을 고정' },
      { title: 'Capsule', body: '나중에 열리는 메시지 보내기' },
      { title: 'Session', body: '같이 보고 듣는 플레이 세션' },
    ],
  },
  {
    title: '빠른 이동',
    items: [
      { title: '프로필 보기', body: '검색 결과나 내 프로필에서 이동' },
      { title: '대화 시작', body: '검색 결과에서 바로 열기' },
      { title: '알림 확인', body: '헤더 Inbox 또는 Connect 탭' },
      { title: '도움 다시 보기', body: '상단 Help 버튼' },
    ],
  },
]);

const displayName = computed(() => auth.me?.name || auth.me?.handle || '사용자');
</script>

<template>
  <div class="rl-page helpPage">
    <div class="rl-section helpSection">
      <section class="rl-card heroCard">
        <div class="eyebrow">Help</div>
        <h1 class="heroTitle">{{ displayName }}님, 필요한 사용법만 한 번에 볼 수 있어요.</h1>
        <div class="heroActions">
          <button class="ghostBtn" type="button" @click="router.push('/home')">Home</button>
          <button class="softBtn" type="button" @click="router.push('/search')">Search</button>
          <button class="softBtn" type="button" @click="router.push('/inbox')">Connect</button>
        </div>
      </section>

      <section v-for="section in sections" :key="section.title" class="rl-card guideCard">
        <div class="sectionTitle">{{ section.title }}</div>
        <div class="guideGrid">
          <article v-for="item in section.items" :key="item.title" class="guideItem">
            <strong>{{ item.title }}</strong>
            <p>{{ item.body }}</p>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.helpPage {
  padding-bottom: 28px;
}

.helpSection {
  display: grid;
  gap: 14px;
}

.heroCard {
  padding: 20px;
  display: grid;
  gap: 14px;
}

.eyebrow {
  font-size: 11px;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 900;
}

.heroTitle {
  margin: 0;
  font-size: clamp(22px, 3.2vw, 32px);
  line-height: 1.2;
}

.heroActions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.softBtn,
.ghostBtn {
  min-height: 42px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.08);
  color: var(--text);
  cursor: pointer;
  font-weight: 900;
}

.softBtn {
  background: color-mix(in oklab, var(--accent) 14%, rgba(255,255,255,.05));
}

.ghostBtn {
  background: rgba(255,255,255,.04);
}

.guideCard {
  padding: 18px;
  display: grid;
  gap: 14px;
}

.sectionTitle {
  font-size: 16px;
  font-weight: 950;
}

.guideGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.guideItem {
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.04);
  display: grid;
  gap: 8px;
}

.guideItem strong {
  font-size: 14px;
}

.guideItem p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.55;
}

@media (max-width: 720px) {
  .guideGrid {
    grid-template-columns: 1fr;
  }
}
</style>
