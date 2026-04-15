
<template>
  <div class="explore">
    <input v-model="q" placeholder="검색..." class="search"/>

    <div class="grid">
      <div v-for="(item,i) in items" :key="i" class="card" @click="open(i)">
        <img v-if="item.imageUrl" :src="item.imageUrl"/>
        <video v-if="item.videoUrl" class="thumb" :src="item.videoUrl" muted loop playsinline></video>
      </div>
    </div>

    <ReelsView v-if="show" :items="items" :startIndex="index" @close="show=false"/>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ReelsView from '@/components/ReelsView.vue'

const q = ref('')
const show = ref(false)
const index = ref(0)

const items = ref([
  {imageUrl:'https://picsum.photos/300/400'},
  {videoUrl:'https://www.w3schools.com/html/mov_bbb.mp4'},
  {imageUrl:'https://picsum.photos/300/401'},
  {videoUrl:'https://www.w3schools.com/html/movie.mp4'}
])

const open = (i)=>{
  index.value = i
  show.value = true
}
</script>

<style scoped>
.explore{padding:12px;}
.search{width:100%;padding:10px;margin-bottom:12px;}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;}
.card{aspect-ratio:1;overflow:hidden;border-radius:10px;}
.card img,.card video{width:100%;height:100%;object-fit:cover;}
</style>
