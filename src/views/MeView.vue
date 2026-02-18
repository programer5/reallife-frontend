<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { api } from '../lib/api'

const router = useRouter()
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
const handle = computed(() => (me.value.handle ? `@${me.value.handle}` : ''))
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
  error.value = ''

  safeSetLocalPreview(f)

  try {
    const form = new FormData()
    form.append('file', f)

    const res = await api.post('/api/files', form, {
      headers: { ...auth.authHeader(), 'Content-Type': 'multipart/form-data' },
    })

    profileImageFileId.value = res.data.id
    // 썸네일 생성 타이밍 이슈 방지: 원본 우선
    profileImageUrl.value = res.data.downloadUrl || res.data.thumbnailUrl || ''

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
    await api.patch(
        '/api/me/profile',
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

const onLogout = async () => {
  // 1) 서버 로그아웃 best-effort + 로컬 정리(401이어도 OK)
  await auth.logoutAll()
  // 2) 즉시 로그인 화면으로 이동 (반응 없는 느낌 제거)
  router.replace('/login')
}

onMounted(load)
</script>

<template>
  <div class="wrap">
    <div v-if="toast" class="toast">{{ toast }}</div>

    <section v-if="loading" class="loading">불러오는 중...</section>

    <template v-else>
      <section class="profileCard">
        <div class="profileRow">
          <div class="avatarWrap">
            <img v-if="avatarSrc" :src="avatarSrc" class="avatar" />
            <div v-else class="avatarFallback">{{ name.slice(0, 1) }}</div>
          </div>

          <div class="profileInfo">
            <div class="nameRow">
              <div class="name">{{ name }}</div>
              <span class="badge">{{ tier }}</span>
            </div>

            <div class="handle">{{ handle }}</div>
            <div class="stats">
              <span class="statNum">{{ followers }}</span>
              <span class="statLbl">followers</span>
            </div>

            <div class="actions">
              <input
                  ref="fileInputRef"
                  class="fileHidden"
                  type="file"
                  accept="image/*"
                  @change="onFileChange"
              />
              <button class="btn primary" :disabled="uploading" @click="openFilePicker">
                {{ uploading ? '업로드 중…' : '사진 변경' }}
              </button>

              <button class="btn ghost" :disabled="!auth.accessToken" @click="onLogout">
                로그아웃
              </button>
            </div>
          </div>
        </div>

        <p v-if="error" class="err">{{ error }}</p>
      </section>

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
    </template>
  </div>
</template>

<style scoped>
.wrap { display: grid; gap: 14px; }

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

.loading{
  height: 40vh;
  display:flex;
  align-items:center;
  justify-content:center;
  opacity:.65;
  font-weight:800;
}

.err{ color:#ff6b6b; margin: 10px 0 0; font-size: 13px; }

.profileCard{
  border-radius:20px;
  padding:16px;
  border:1px solid rgba(255,255,255,0.12);
  background: linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
}

.profileRow{ display:flex; gap:18px; align-items:center; }

.avatarWrap{
  width:96px; height:96px;
  border-radius:28px;
  overflow:hidden;
  border:1px solid rgba(255,255,255,0.18);
  background:rgba(255,255,255,0.06);
  flex-shrink:0;
}
.avatar{ width:100%; height:100%; object-fit:cover; }
.avatarFallback{
  width:100%; height:100%;
  display:flex; align-items:center; justify-content:center;
  font-size:28px; font-weight:950; opacity:.85;
}

.profileInfo{ flex:1; min-width:0; }
.nameRow{ display:flex; align-items:center; gap:10px; }
.name{ font-size:20px; font-weight:950; }
.badge{
  font-size:11px;
  padding:2px 8px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,0.12);
  opacity:.85;
}
.handle{ opacity:.7; margin-top:2px; font-size:13px; }

.stats{ margin-top:10px; display:flex; gap:6px; align-items:baseline; }
.statNum{ font-size:18px; font-weight:950; }
.statLbl{ font-size:11px; opacity:.7; }

.actions{ margin-top:14px; display:flex; gap:10px; }
.fileHidden{ display:none; }

.btn{
  display:inline-flex; align-items:center; justify-content:center;
  padding:10px 12px;
  border-radius:14px;
  border:1px solid rgba(255,255,255,0.14);
  font-weight:900;
  cursor:pointer;
  background: transparent;
  color:#e8e8ea;
}
.primary{
  background: radial-gradient(600px 200px at 20% 0%, rgba(255,255,255,0.16), transparent 60%),
  rgba(255,255,255,0.08);
}
.ghost{ opacity:.9; }
.full{ width:100%; }
.btn:disabled{ opacity:.55; cursor:not-allowed; }

.card{
  padding: 12px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
}
.head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
.title{ font-weight:900; }
.sub{ font-size:12px; opacity:.7; }

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

.kv{ display:flex; justify-content:space-between; padding:10px 0; }
.k{ font-size:12px; opacity:.7; }
.v{ font-size:13px; font-weight:900; opacity:.95; }
</style>