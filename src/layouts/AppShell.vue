<script setup>
import AppHeader from '../components/AppHeader.vue'
import BottomTabs from '../components/BottomTabs.vue'
</script>

<template>
  <div class="shell">
    <AppHeader />

    <main class="content">
      <router-view />
    </main>

    <BottomTabs />
  </div>
</template>

<style scoped>
.shell{
  min-height: 100vh;
  display:flex;
  flex-direction:column;
}

.content{
  flex: 1;
  padding: 14px;
  overflow: auto;
}
</style>