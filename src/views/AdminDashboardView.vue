<template>
  <div class="page">

    <!-- HERO -->
    <section class="hero cardSurface">
      <div class="heroLeft">
        <div class="eyebrow">REALIFE OPS</div>
        <h1 class="title">Admin Dashboard</h1>
        <p class="sub">
          서비스 상태, 실시간 연결, scheduler 상태, 이상징후를 한 화면에서 확인합니다.
        </p>
      </div>

      <div class="heroRight">
        <div class="statusBadge" :data-status="normalizedDashboard.status">
          {{ normalizedDashboard.status }}
        </div>

        <div class="refreshMeta">
          <span>자동 새로고침 30초</span>
          <span>마지막 {{ lastLoadedText }}</span>
        </div>

        <RlButton size="sm" variant="soft" @click="load" :loading="loading">
          새로고침
        </RlButton>
      </div>
    </section>


    <!-- 이상징후 카드 -->
    <section v-if="anomalyList.length" class="panel anomalyPanel">

      <div class="panelTitle">⚠ 이상 징후 감지</div>

      <div class="anomalyList">

        <div
            v-for="item in anomalyList"
            :key="item.type"
            class="anomalyCard"
            :data-level="item.level"
        >
          <div class="anomalyTitle">{{ item.title }}</div>
          <div class="anomalyDesc">{{ item.desc }}</div>
        </div>

      </div>

    </section>


    <!-- 통계 -->
    <section class="grid4">

      <div class="statCard cardSurface">
        <div class="label">SSE 연결</div>
        <div class="value">{{ normalizedDashboard.overview.activeSseConnections }}</div>
      </div>

      <div class="statCard cardSurface">
        <div class="label">미읽음 알림</div>
        <div class="value">{{ normalizedDashboard.overview.unreadNotifications }}</div>
      </div>

      <div class="statCard cardSurface">
        <div class="label">활성 핀</div>
        <div class="value">{{ normalizedDashboard.overview.activePins }}</div>
      </div>

      <div class="statCard cardSurface">
        <div class="label">오늘 알림</div>
        <div class="value">{{ normalizedDashboard.overview.todayCreatedNotifications }}</div>
      </div>

    </section>


    <!-- health -->
    <section class="healthGrid">

      <div class="panel cardSurface">

        <div class="panelTitle">Health Status</div>

        <div class="healthList">

          <div
              v-for="(value,key) in normalizedDashboard.health.checks"
              :key="key"
              class="healthRow"
          >
            <span class="healthKey">{{ key }}</span>

            <span
                class="healthValue"
                :data-status="value"
            >
              {{ value }}
            </span>

          </div>

        </div>

      </div>


      <!-- scheduler -->
      <div class="panel cardSurface">

        <div class="panelTitle">Scheduler</div>

        <div class="timingList">

          <div class="timingRow">
            <span>Last SSE Event</span>
            <strong>{{ fmtDateTime(normalizedDashboard.health.lastSseEventSentAt) }}</strong>
          </div>

          <div class="timingRow">
            <span>Last Reminder Run</span>
            <strong>{{ fmtDateTime(normalizedDashboard.health.lastReminderRunAt) }}</strong>
          </div>

          <div class="timingRow">
            <span>Reminder Delay</span>
            <strong>{{ normalizedDashboard.health.minutesSinceLastReminderRun }} min</strong>
          </div>

        </div>

      </div>

    </section>


    <!-- totals -->
    <section class="grid3">

      <div class="miniCard cardSurface">
        <div class="label">Users</div>
        <div class="value">{{ normalizedDashboard.totals.users }}</div>
      </div>

      <div class="miniCard cardSurface">
        <div class="label">Posts</div>
        <div class="value">{{ normalizedDashboard.totals.posts }}</div>
      </div>

      <div class="miniCard cardSurface">
        <div class="label">Messages</div>
        <div class="value">{{ normalizedDashboard.totals.messages }}</div>
      </div>

    </section>


  </div>
</template>


<script setup>

import { ref,computed,onMounted,onBeforeUnmount } from "vue"
import RlButton from "@/components/ui/RlButton.vue"
import { fetchAdminDashboard } from "@/api/admin"

const dashboard = ref(null)
const loading = ref(false)
const lastLoadedAt = ref(null)

let refreshTimer = null


const normalizedDashboard = computed(() => {

  const raw = dashboard.value || {}

  return {

    status: raw.status || "UNKNOWN",

    overview: raw.overview || {
      activeSseConnections:0,
      unreadNotifications:0,
      activePins:0,
      todayCreatedNotifications:0
    },

    health: raw.health || {
      checks:{},
      minutesSinceLastReminderRun:0
    },

    totals: raw.totals || {
      users:0,
      posts:0,
      messages:0
    }

  }

})


const anomalyList = computed(() => {

  const list = []

  if (normalizedDashboard.value.overview.activeSseConnections === 0) {

    list.push({
      type:"sse",
      level:"warning",
      title:"SSE 연결 없음",
      desc:"현재 활성 SSE 연결이 없습니다."
    })

  }

  if (normalizedDashboard.value.health.minutesSinceLastReminderRun > 15) {

    list.push({
      type:"reminder",
      level:"danger",
      title:"Reminder Scheduler 지연",
      desc:`${normalizedDashboard.value.health.minutesSinceLastReminderRun}분 동안 실행되지 않았습니다`
    })

  }

  if (normalizedDashboard.value.status !== "UP") {

    list.push({
      type:"health",
      level:"danger",
      title:"서비스 상태 비정상",
      desc:`현재 상태 ${normalizedDashboard.value.status}`
    })

  }

  return list

})


async function load({silent=false}={}){

  if(!silent) loading.value=true

  try{

    dashboard.value = await fetchAdminDashboard()

    lastLoadedAt.value = Date.now()

  }finally{

    loading.value=false

  }

}


function startAutoRefresh(){

  refreshTimer = setInterval(()=>{

    if(document.visibilityState==="visible"){

      load({silent:true})

    }

  },30000)

}

function stopAutoRefresh(){

  if(refreshTimer) clearInterval(refreshTimer)

}


function fmtDateTime(v){

  if(!v) return "-"

  return new Date(v).toLocaleString("ko-KR")

}

const lastLoadedText = computed(()=>{

  if(!lastLoadedAt.value) return "-"

  return new Date(lastLoadedAt.value).toLocaleTimeString("ko-KR")

})


onMounted(async()=>{

  await load()

  startAutoRefresh()

})

onBeforeUnmount(()=>{

  stopAutoRefresh()

})

</script>


<style scoped>

.anomalyPanel{

  border:1px solid rgba(255,120,0,0.4);
  background:rgba(255,120,0,0.08)

}

.anomalyList{

  display:grid;
  gap:10px;
  margin-top:12px

}

.anomalyCard{

  padding:12px;
  border-radius:12px;
  border:1px solid rgba(255,255,255,0.1)

}

.anomalyCard[data-level="warning"]{

  border-color:#f6c344;
  background:rgba(246,195,68,0.12)

}

.anomalyCard[data-level="danger"]{

  border-color:#ff5d5d;
  background:rgba(255,93,93,0.12)

}

.anomalyTitle{

  font-weight:800

}

.anomalyDesc{

  font-size:13px;
  opacity:0.8

}

</style>