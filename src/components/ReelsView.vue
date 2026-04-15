
<template>
  <div class="reels" @click="close">
    <div class="container" ref="container" @click.stop>
      <div v-for="(item,i) in items" :key="i" class="reel">
        <video v-if="item.videoUrl"
          class="media"
          :src="item.videoUrl"
          muted loop playsinline autoplay></video>

        <img v-else-if="item.imageUrl" class="media" :src="item.imageUrl"/>

        <div class="overlay">{{ item.text }}</div>

        <div class="actions">
          <button>❤️</button>
          <button>💬</button>
          <button>🔖</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
const props = defineProps({ items:Array, startIndex:Number })
const emit = defineEmits(['close'])
const container = ref(null)

const close = ()=>emit('close')

onMounted(()=>{
  if(container.value){
    container.value.scrollTop = (props.startIndex||0)*window.innerHeight
  }
})
</script>

<style scoped>
.reels{position:fixed;inset:0;background:#000;z-index:999999;overflow:hidden;}
.container{height:100%;overflow-y:scroll;scroll-snap-type:y mandatory;}
.reel{height:100vh;scroll-snap-align:start;position:relative;}
.media{width:100%;height:100%;object-fit:cover;}
.overlay{position:absolute;bottom:20px;left:16px;color:#fff;}
.actions{position:absolute;right:12px;bottom:100px;display:flex;flex-direction:column;gap:12px;}
.actions button{background:rgba(0,0,0,0.4);border:none;color:#fff;width:44px;height:44px;border-radius:50%;}
</style>
