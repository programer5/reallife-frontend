<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { connectSse } from '../lib/sse'

const auth = useAuthStore()

// ===== SSE 상태 =====
const sseStatus = ref('disconnected') // connecting | connected | error
const events = ref([])

let disconnect = null

onMounted(() => {
  sseStatus.value = 'connecting'

  disconnect = connectSse({
    url: '/api/sse/subscribe', // 필요하면 백엔드 경로에 맞게 수정
    token: auth.accessToken,

    onOpen: () => {
      sseStatus.value = 'connected'
    },

    onMessage: (ev) => {
      events.value.unshift({
        t: new Date().toLocaleTimeString(),
        type: ev.event || 'message',
        data: ev.data,
      })

      // 최대 30개만 유지
      if (events.value.length > 30) events.value.pop()
    },

    onError: () => {
      sseStatus.value = 'error'
    },
  })
})

onUnmounted(() => {
  disconnect?.()
})

// ===== 목업 알림/대화 목록 (나중에 API 연결 예정) =====
const notifications = [
  { id: 1, title: '새 알림', body: '누군가 회원님 게시글을 좋아합니다.', time: '방금' },
  { id: 2, title: '댓글', body: '“이거 좋아요!”', time: '5분 전' },
]

const conversations = [
  { id: 1, name: '민수', last: '오늘 저녁 어때?', unread: 2 },
  { id: 2, name: '지연', last: '파일 보냈어!', unread: 0 },
  { id: 3, name: '팀 채팅', last: '내일 10시 가능?', unread: 5 },
]
</script>

<template>
  <div class="wrap">

    <!-- ===== 실시간 이벤트 ===== -->
    <section class="card">
      <div class="card__head">
        <div class="card__title">실시간 이벤트</div>
        <div class="pill" :class="sseStatus">{{ sseStatus }}</div>
      </div>

      <div class="list">
        <div v-if="events.length === 0" class="empty">이벤트 대기 중...</div>

        <div class="row" v-for="(e, idx) in events" :key="idx">
          <div class="row__main">
            <div class="row__title">{{ e.type }}</div>
            <div class="row__body">{{ e.data }}</div>
            <div class="row__time">{{ e.t }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== 알림 ===== -->
    <section class="card">
      <div class="card__head">
        <div class="card__title">알림</div>
        <div class="card__hint">모아보기</div>
      </div>

      <div class="list">
        <div class="row" v-for="n in notifications" :key="n.id">
          <div class="dot"></div>
          <div class="row__main">
            <div class="row__title">{{ n.title }}</div>
            <div class="row__body">{{ n.body }}</div>
          </div>
          <div class="row__time">{{ n.time }}</div>
        </div>
      </div>
    </section>

    <!-- ===== 메시지 ===== -->
    <section class="card">
      <div class="card__head">
        <div class="card__title">메시지</div>
        <div class="card__hint">실시간</div>
      </div>

      <div class="list">
        <div class="row clickable" v-for="c in conversations" :key="c.id">
          <div class="avatar">{{ c.name.slice(0,1) }}</div>
          <div class="row__main">
            <div class="row__title">
              {{ c.name }}
              <span v-if="c.unread" class="badge">{{ c.unread }}</span>
            </div>
            <div class="row__body">{{ c.last }}</div>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
.wrap { display: grid; gap: 14px; }

.card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  overflow: hidden;
}

.card__head {
  display:flex; align-items:center; justify-content:space-between;
  padding: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.card__title { font-weight: 800; }
.card__hint { font-size: 12px; opacity: 0.7; }

.pill {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.14);
}
.pill.connecting { opacity: 0.6; }
.pill.connected { }
.pill.error { border-color: #ff6b6b; color: #ff6b6b; }

.list { display: grid; }

.row {
  display:flex; gap: 10px; align-items:flex-start;
  padding: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.row:last-child { border-bottom: none; }

.row__main { flex: 1; }
.row__title { font-weight: 700; }
.row__body { font-size: 13px; opacity: 0.85; margin-top: 2px; }
.row__time { font-size: 11px; opacity: 0.6; margin-top: 6px; }

.empty { padding: 12px; font-size: 12px; opacity: 0.7; }

.dot {
  width: 10px; height: 10px; border-radius: 999px;
  background: rgba(255,255,255,0.18);
  margin-top: 4px;
}

.avatar{
  width: 36px; height: 36px; border-radius: 14px;
  background: rgba(255,255,255,0.10);
  display:flex; align-items:center; justify-content:center;
  font-weight: 800;
}

.badge{
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255,255,255,0.14);
}

.clickable { cursor: pointer; }
</style>