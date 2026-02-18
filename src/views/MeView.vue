<script setup>
import { onMounted, ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { api } from '../lib/api'

const auth = useAuthStore()

const loading = ref(true)
const uploading = ref(false)
const saving = ref(false)
const error = ref('')
const toast = ref('')

const bio = ref('')
const profileImageFileId = ref(null)

const localPreviewUrl = ref('')
const profileImageUrl = ref('')
let localPreviewRevoke = null

const me = computed(() => auth.me || {})
const name = computed(() => me.value.name || '사용자')
const handle = computed(() => me.value.handle ? `@${me.value.handle}` : '')
const followers = computed(() => me.value.followerCount ?? 0)
const tier = computed(() => me.value.tier || 'NONE')
const email = computed(() => me.value.email || '')

const avatarSrc = computed(() => profileImageUrl.value || localPreviewUrl.value || '')

const showToast = (msg) => {
  toast.value = msg
  setTimeout(() => (toast.value = ''), 1500)
}

const safeSetLocalPreview = (file) => {
  if (localPreviewRevoke) localPreviewRevoke()
  const url = URL.createObjectURL(file)
  localPreviewUrl.value = url
  localPreviewRevoke = () => URL.revokeObjectURL(url)
}

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const meData = await auth.fetchMe()
    profileImageUrl.value = meData?.profileImageUrl ?? ''
    bio.value = meData?.bio ?? ''
  } catch {
    error.value = '프로필을 불러오지 못했어요'
  } finally {
    loading.value = false
  }
}

const fileInputRef = ref(null)
const openFilePicker = () => fileInputRef.value?.click()

const onFileChange = async (e) => {
  const f = e.target.files?.[0]
  if (!f) return
  uploading.value = true
  safeSetLocalPreview(f)

  try {
    const form = new FormData()
    form.append('file', f)
    const res = await api.post('/api/files', form, {
      headers: { ...auth.authHeader(), 'Content-Type': 'multipart/form-data' },
    })
    profileImageFileId.value = res.data.id
    profileImageUrl.value = res.data.downloadUrl || ''
    showToast('프로필 사진 변경 완료')
  } catch {
    error.value = '사진 업로드 실패'
  } finally {
    uploading.value = false
  }
}

const save = async () => {
  if (!auth.accessToken) {
    error.value = '로그인이 필요합니다'
    return
  }
  saving.value = true
  error.value = ''
  try {
    await api.patch('/api/me/profile',
        { bio: bio.value, profileImageFileId: profileImageFileId.value },
        { headers: auth.authHeader() }
    )
    showToast('저장 완료')
  } catch {
    error.value = '저장 실패'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="wrap">
    <div v-if="toast" class="toast">{{ toast }}</div>

    <section v-if="loading" class="skeleton">
      <div class="skAvatar"></div>
      <div class="skLines">
        <div class="sk1"></div>
        <div class="sk2"></div>
        <div class="sk3"></div>
      </div>
    </section>

    <section v-else class="hero">
      <div class="avatarWrap">
        <img v-if="avatarSrc" :src="avatarSrc" class="avatar"/>
        <div v-else class="fallback">{{ name.slice(0,1) }}</div>
      </div>

      <div class="info">
        <div class="top">
          <div class="nm">{{ name }}</div>
          <span class="tier">{{ tier }}</span>
        </div>
        <div class="hd">{{ handle }}</div>

        <div class="numbers">
          <div class="numBox">
            <div class="num">{{ followers }}</div>
            <div class="lbl">followers</div>
          </div>
        </div>

        <div class="btnRow">
          <input ref="fileInputRef" class="hidden" type="file" accept="image/*" @change="onFileChange"/>
          <button class="btn primary" :disabled="uploading" @click="openFilePicker">
            {{ uploading ? '업로드 중…' : '사진 변경' }}
          </button>
          <button class="btn ghost" @click="auth.logoutAll()">로그아웃</button>
        </div>
      </div>
    </section>

    <p v-if="error" class="err">{{ error }}</p>

    <section class="card">
      <div class="head">
        <div class="title">한 줄 소개</div>
        <div class="sub">선택</div>
      </div>

      <input class="input" v-model="bio" placeholder="예) 커피 좋아하고, 밤에 개발해요" />
      <button class="btn primary full" :disabled="saving || !auth.accessToken" @click="save">
        {{ saving ? '저장 중…' : '저장' }}
      </button>
    </section>

    <section class="card">
      <div class="head">
        <div class="title">계정</div>
        <div class="sub">로그인 정보</div>
      </div>
      <div class="kv">
        <div class="k">이메일</div>
        <div class="v">{{ email }}</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.wrap{display:grid;gap:14px}
.toast{
  position: sticky; top: 8px; z-index: 10;
  width: fit-content;
  padding: 10px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(0,0,0,0.25);
  backdrop-filter: blur(10px);
  font-size: 13px;
}
.err{color:#ff6b6b;margin:0;font-size:13px}

.hero{
  display:flex;
  gap: 16px;
  align-items:center;
  padding: 14px;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.10);
  background: radial-gradient(900px 240px at 20% 0%, rgba(255,255,255,0.10), transparent 55%),
  rgba(255,255,255,0.04);
}

.avatarWrap{
  width: 94px; height: 94px;
  border-radius: 30px;
  overflow:hidden;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.06);
  flex-shrink:0;
}
.avatar{width:100%;height:100%;object-fit:cover}
.fallback{
  width:100%;height:100%;
  display:flex;align-items:center;justify-content:center;
  font-size:28px;font-weight:950;opacity:.85;
}

.info{flex:1;min-width:0}
.top{display:flex;align-items:center;gap:10px}
.nm{font-size:20px;font-weight:950}
.tier{
  font-size:11px;padding:2px 8px;border-radius:999px;
  border:1px solid rgba(255,255,255,0.12);opacity:.85;
}
.hd{opacity:.7;margin-top:2px;font-size:13px}

.numbers{margin-top:10px}
.numBox{
  display:inline-flex;gap:6px;align-items:baseline;
  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
}
.num{font-size:18px;font-weight:950}
.lbl{font-size:11px;opacity:.7}

.btnRow{margin-top:12px;display:flex;gap:10px}
.hidden{display:none}

.btn{
  display:inline-flex;align-items:center;justify-content:center;
  padding:10px 12px;border-radius:14px;
  border:1px solid rgba(255,255,255,0.14);
  font-weight:900; cursor:pointer;
  background: transparent; color:#e8e8ea;
}
.primary{
  background: radial-gradient(600px 200px at 20% 0%, rgba(255,255,255,0.16), transparent 60%),
  rgba(255,255,255,0.08);
}
.ghost{opacity:.9}
.full{width:100%}
.btn:disabled{opacity:.6;cursor:not-allowed}

.card{
  padding: 12px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
}
.head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.title{font-weight:900}
.sub{font-size:12px;opacity:.7}
.input{
  width:100%;
  padding:12px;
  border-radius:14px;
  border:1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.15);
  color:#e8e8ea;
  outline:none;
  margin-bottom:10px;
}
.kv{display:flex;justify-content:space-between;padding:10px 0}
.k{font-size:12px;opacity:.7}
.v{font-size:13px;font-weight:900;opacity:.95}

/* skeleton */
.skeleton{
  display:flex; gap:16px; align-items:center;
  padding:14px;
  border-radius:20px;
  border:1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
}
.skAvatar{width:94px;height:94px;border-radius:30px;background:rgba(255,255,255,0.06)}
.skLines{flex:1;display:grid;gap:10px}
.sk1,.sk2,.sk3{height:14px;border-radius:999px;background:rgba(255,255,255,0.06)}
.sk2{width:70%}
.sk3{width:45%}
</style>