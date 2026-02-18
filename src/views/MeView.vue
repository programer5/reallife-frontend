<script setup>
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { api } from '../lib/api'

const auth = useAuthStore()

// ===== UI state =====
const loading = ref(true)
const saving = ref(false)
const uploading = ref(false)
const error = ref('')
const toast = ref('')

// ===== profile form =====
const bio = ref('')
const website = ref('')
const profileImageFileId = ref(null)

// ===== image preview state =====
const localPreviewUrl = ref('')        // file 선택 즉시 보여줄 로컬 미리보기
const originalUrl = ref('')            // 서버 원본 downloadUrl
const thumbnailUrl = ref('')           // 서버 썸네일 thumbnailUrl
const thumbReady = ref(false)          // 썸네일 준비 여부

let localPreviewRevoke = null
let thumbRetryTimer = null
let thumbRetryCount = 0

const showToast = (msg) => {
  toast.value = msg
  setTimeout(() => (toast.value = ''), 1800)
}

const safeSetLocalPreview = (file) => {
  if (localPreviewRevoke) localPreviewRevoke()
  const url = URL.createObjectURL(file)
  localPreviewUrl.value = url
  localPreviewRevoke = () => URL.revokeObjectURL(url)
}

const bestThumbSrc = computed(() => {
  // 1) 썸네일이 준비되면 썸네일
  if (thumbReady.value && thumbnailUrl.value) return thumbnailUrl.value
  // 2) 아직이면 서버 원본(있으면)
  if (originalUrl.value) return originalUrl.value
  // 3) 업로드 전이면 로컬 미리보기
  if (localPreviewUrl.value) return localPreviewUrl.value
  return ''
})

const bestOriginalSrc = computed(() => {
  // 원본은 서버 원본 우선, 없으면 로컬 미리보기
  return originalUrl.value || localPreviewUrl.value || ''
})

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const me = await auth.fetchMe()

    bio.value = me?.profile?.bio ?? me?.bio ?? ''
    website.value = me?.profile?.website ?? me?.website ?? ''

    // profileImageUrl이 내려오면 서버 원본으로 사용
    originalUrl.value = me?.profileImageUrl ?? me?.profile?.profileImageUrl ?? ''

    // 서버가 thumbnailUrl을 직접 주는 구조면 여기서 받아도 됨(없으면 비워둠)
    thumbnailUrl.value = me?.profileThumbnailUrl ?? me?.profile?.profileThumbnailUrl ?? ''
    thumbReady.value = !!thumbnailUrl.value
  } catch (e) {
    error.value = e?.response?.data?.message || '불러오기 실패'
  } finally {
    loading.value = false
  }
}

const retryThumb = () => {
  // thumbnailUrl이 없으면 재시도 의미 없음
  if (!thumbnailUrl.value) return

  // 재시도 제한
  if (thumbRetryCount >= 6) return

  clearTimeout(thumbRetryTimer)
  thumbRetryTimer = setTimeout(() => {
    thumbRetryCount += 1

    // 캐시를 피하기 위해 쿼리 붙여서 다시 로드(ETag 있으니 서버 부담 낮음)
    const busted = `${thumbnailUrl.value}${thumbnailUrl.value.includes('?') ? '&' : '?'}v=${Date.now()}`
    thumbnailUrl.value = busted

    // 아직 준비 안 됐으면 다시 예약
    if (!thumbReady.value) retryThumb()
  }, 800)
}

const onThumbLoad = () => {
  thumbReady.value = true
}

const onThumbError = () => {
  // 썸네일이 아직 생성 전일 가능성이 큼 → 원본/로컬 미리보기로 대체되게 두고 재시도
  thumbReady.value = false
  retryThumb()
}

const onFileChange = async (e) => {
  const f = e.target.files?.[0]
  if (!f) return

  error.value = ''
  uploading.value = true
  thumbReady.value = false
  thumbRetryCount = 0

  // 1) 선택 즉시 로컬 미리보기(깨진 아이콘 방지)
  safeSetLocalPreview(f)

  try {
    // 2) 업로드
    const form = new FormData()
    form.append('file', f)

    const res = await api.post('/api/files', form, {
      headers: { ...auth.authHeader(), 'Content-Type': 'multipart/form-data' },
    })

    profileImageFileId.value = res.data.id
    originalUrl.value = res.data.downloadUrl || ''
    thumbnailUrl.value = res.data.thumbnailUrl || ''

    showToast('업로드 완료 ✅ (썸네일 생성 중)')
    // 3) 썸네일은 바로 없을 수 있으니 재시도 시작
    retryThumb()
  } catch (err) {
    error.value = err?.response?.data?.message || '업로드 실패'
  } finally {
    uploading.value = false
  }
}

const save = async () => {
  saving.value = true
  error.value = ''
  try {
    await api.patch(
        '/api/me/profile',
        {
          bio: bio.value,
          website: website.value,
          profileImageFileId: profileImageFileId.value,
        },
        { headers: auth.authHeader() }
    )
    showToast('저장 완료 ✅')
    await load()
  } catch (e) {
    error.value = e?.response?.data?.message || '저장 실패'
  } finally {
    saving.value = false
  }
}

onMounted(load)
onUnmounted(() => {
  if (localPreviewRevoke) localPreviewRevoke()
  clearTimeout(thumbRetryTimer)
})
</script>

<template>
  <div class="wrap">
    <!-- Header -->
    <section class="hero">
      <div class="heroLeft">
        <div class="avatar">
          <img v-if="bestThumbSrc" :src="bestThumbSrc" @load="onThumbLoad" @error="onThumbError" />
          <div v-else class="avatarFallback">ME</div>
        </div>
        <div class="heroText">
          <div class="heroTitle">내 페이지</div>
          <div class="heroSub">프로필/설정 · 빠르게 편집</div>
        </div>
      </div>

      <button class="ghost" @click="auth.logoutAll()">전체 로그아웃</button>
    </section>

    <p v-if="error" class="err">{{ error }}</p>
    <div v-if="toast" class="toast">{{ toast }}</div>

    <section class="card">
      <div class="cardHead">
        <div class="cardTitle">프로필 사진</div>
        <div class="chip" :class="{ on: uploading }">
          {{ uploading ? '업로드 중…' : (thumbReady ? '썸네일 준비됨' : '썸네일 생성 중') }}
        </div>
      </div>

      <div class="imgRow">
        <div class="imgBox">
          <div class="label">썸네일(자동)</div>
          <div class="imgWrap">
            <img v-if="bestThumbSrc" :src="bestThumbSrc" @load="onThumbLoad" @error="onThumbError" />
            <div v-else class="placeholder" />
          </div>
        </div>

        <div class="imgBox">
          <div class="label">원본</div>
          <div class="imgWrap">
            <img v-if="bestOriginalSrc" :src="bestOriginalSrc" />
            <div v-else class="placeholder" />
          </div>
        </div>

        <div class="imgBox">
          <div class="label">변경</div>
          <input class="file" type="file" accept="image/*" @change="onFileChange" />
          <div class="hint">파일 선택 즉시 미리보기 → 업로드 완료 후 자동 반영</div>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="cardHead">
        <div class="cardTitle">프로필 정보</div>
      </div>

      <div class="form">
        <label class="field">
          <div class="label">bio</div>
          <input class="input" v-model="bio" placeholder="자기소개" />
        </label>

        <label class="field">
          <div class="label">website</div>
          <input class="input" v-model="website" placeholder="https://..." />
        </label>
      </div>

      <button class="primary" :disabled="saving" @click="save">
        {{ saving ? '저장 중…' : '저장' }}
      </button>

      <details class="debug">
        <summary>debug: /api/me</summary>
        <pre>{{ auth.me }}</pre>
      </details>
    </section>
  </div>
</template>

<style scoped>
/* layout */
.wrap { display: grid; gap: 14px; }
.err { color:#ff6b6b; margin: 0; font-size: 13px; }
.toast{
  position: sticky;
  top: 8px;
  z-index: 10;
  width: fit-content;
  padding: 10px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(0,0,0,0.25);
  backdrop-filter: blur(10px);
  font-size: 13px;
}

/* hero */
.hero{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding: 12px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.10);
  background: radial-gradient(900px 240px at 20% 0%, rgba(255,255,255,0.10), transparent 55%),
  rgba(255,255,255,0.04);
}
.heroLeft{ display:flex; gap: 12px; align-items:center; }
.heroTitle{ font-weight: 950; font-size: 16px; }
.heroSub{ font-size: 12px; opacity: 0.75; margin-top: 2px; }

.avatar{
  width: 54px; height: 54px; border-radius: 18px;
  overflow:hidden;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06);
  display:flex; align-items:center; justify-content:center;
}
.avatar img{ width:100%; height:100%; object-fit:cover; }
.avatarFallback{ font-weight: 900; opacity: 0.8; }

/* buttons */
.ghost{
  background: transparent;
  color: #e8e8ea;
  border: 1px solid rgba(255,255,255,0.14);
  padding: 8px 10px;
  border-radius: 12px;
  cursor: pointer;
}

/* cards */
.card{
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  padding: 12px;
}
.cardHead{ display:flex; align-items:center; justify-content:space-between; margin-bottom: 10px; }
.cardTitle{ font-weight: 900; }
.chip{
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.12);
  opacity: 0.8;
}
.chip.on{ opacity: 1; }

/* images */
.imgRow{ display:grid; gap: 12px; }
.imgBox{ display:grid; gap: 6px; }
.label{ font-size: 12px; opacity: 0.75; }
.imgWrap img{
  width: 120px; height: 120px;
  object-fit: cover;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.10);
}
.placeholder{
  width: 120px; height: 120px;
  border-radius: 18px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.10);
}
.file{ width: 100%; }
.hint{ font-size: 12px; opacity: 0.7; }

/* form */
.form{ display:grid; gap: 12px; margin-bottom: 12px; }
.field{ display:grid; gap: 6px; }
.input{
  width: 100%;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.15);
  color: #e8e8ea;
  outline: none;
}
.primary{
  width: 100%;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.16);
  background: rgba(255,255,255,0.08);
  color: #e8e8ea;
  font-weight: 900;
  cursor: pointer;
}
.primary:disabled{ opacity: 0.6; cursor: not-allowed; }

.debug pre{
  white-space: pre-wrap;
  background: rgba(0,0,0,0.2);
  padding: 10px;
  border-radius: 12px;
  overflow:auto;
}
</style>