<template>
  <div class="page">
    <section class="heroCard">
      <div class="heroTop">
        <div class="identity">
          <img v-if="avatarUrl" :src="avatarUrl" class="avatarImg" alt="avatar" />
          <div v-else class="avatar fallback">{{ initials }}</div>
          <div class="heroMeta">
            <div class="heroTitle">내 프로필</div>
            <div class="heroName">{{ form.name || me?.name || '사용자' }}</div>
            <div class="heroHandle">@{{ me?.handle || 'user' }}</div>
            <div class="heroSub">가입 직후 넣은 정보도 여기서 계속 다듬을 수 있어요.</div>
          </div>
        </div>
        <div class="heroActions">
          <button class="softBtn" type="button" @click="goMyPublicProfile" :disabled="!me?.handle">내 프로필 보기</button>
          <button class="ghostBtn" type="button" @click="refreshAll" :disabled="loading">새로고침</button>
          <button class="dangerBtn" type="button" @click="onLogout" :disabled="loading">로그아웃</button>
        </div>
      </div>
      <div class="stats">
        <div class="stat"><strong>{{ publicProfile?.followerCount ?? 0 }}</strong><span>팔로워</span></div>
        <div class="stat"><strong>{{ publicProfile?.followingCount ?? 0 }}</strong><span>팔로잉</span></div>
        <div class="stat"><strong>{{ me?.tier || me?.role || 'NONE' }}</strong><span>계정 상태</span></div>
      </div>
    </section>

    <section class="card">
      <div class="sectionHead">
        <div>
          <div class="title">프로필 편집</div>
          <div class="sub">이름, 소개, 웹사이트, 사진을 바로 바꿀 수 있어요.</div>
        </div>
        <button class="primaryBtn" type="button" @click="saveProfile" :disabled="saving">{{ saving ? '저장 중...' : '저장' }}</button>
      </div>
      <div class="formGrid">
        <label class="label avatarCol">
          프로필 사진
          <div class="avatarPanel">
            <img v-if="avatarUrl" :src="avatarUrl" class="avatarLg" alt="avatar" />
            <div v-else class="avatarLg fallback">{{ initials }}</div>
            <div class="avatarBtns">
              <button class="softBtn" type="button" @click="onPickAvatar">사진 변경</button>
              <button class="ghostBtn" type="button" @click="clearAvatar" :disabled="saving">사진 제거</button>
            </div>
            <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onUploadAvatar" />
          </div>
        </label>

        <div class="fields">
          <label class="label">
            이름
            <input v-model.trim="form.name" class="input" maxlength="30" placeholder="표시될 이름" />
          </label>
          <label class="label">
            소개
            <textarea v-model.trim="form.bio" class="textarea" rows="4" maxlength="255" placeholder="예) 커피 좋아하고, 밤에 개발해요"></textarea>
            <div class="count">{{ (form.bio || '').length }}/255</div>
          </label>
          <label class="label">
            웹사이트
            <input v-model.trim="form.website" class="input" placeholder="https://example.com" />
          </label>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="sectionHead compact">
        <div>
          <div class="title">공개 프로필 미리보기</div>
          <div class="sub">다른 사용자가 보게 될 모습이에요.</div>
        </div>
      </div>
      <div class="preview">
        <div class="previewName">{{ form.name || me?.name || '사용자' }}</div>
        <div class="previewHandle">@{{ me?.handle || 'user' }}</div>
        <div v-if="form.bio" class="previewBio">{{ form.bio }}</div>
        <a v-if="form.website" class="previewWebsite" :href="websiteUrl(form.website)" target="_blank" rel="noreferrer">{{ form.website }}</a>
        <div v-else class="previewEmpty">아직 웹사이트를 입력하지 않았어요.</div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useToastStore } from "@/stores/toast";
import { useAuthStore } from "@/stores/auth";
import { uploadImages } from "@/api/files";
import { fetchMe, updateMyProfile } from "@/api/me";
import { fetchUserProfileByHandle } from "@/api/users";

const router = useRouter();
const toast = useToastStore();
const auth = useAuthStore();
const me = ref(null);
const publicProfile = ref(null);
const avatarUrl = ref('');
const avatarFileId = ref(undefined);
const fileInput = ref(null);
const loading = ref(false);
const saving = ref(false);
const form = reactive({ name: '', bio: '', website: '' });

const initials = computed(() => {
  const raw = String(form.name || me.value?.name || me.value?.handle || 'R').trim();
  return raw ? raw[0].toUpperCase() : 'R';
});

function websiteUrl(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  return /^(http|https):\/\//i.test(s) ? s : `https://${s}`;
}

async function refreshAll() {
  loading.value = true;
  try {
    me.value = await fetchMe();
    auth.me = me.value;
    if (me.value?.handle) publicProfile.value = await fetchUserProfileByHandle(me.value.handle);
    form.name = publicProfile.value?.name || me.value?.name || '';
    form.bio = publicProfile.value?.bio || '';
    form.website = publicProfile.value?.website || '';
    avatarUrl.value = publicProfile.value?.profileImageUrl || '';
  } catch (e) {
    toast.error('불러오기 실패', e?.response?.data?.message || '내 프로필을 불러오지 못했어요.');
  } finally { loading.value = false; }
}
function onPickAvatar() { fileInput.value?.click?.(); }
async function onUploadAvatar(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    avatarUrl.value = URL.createObjectURL(file);
    const ids = await uploadImages([file]);
    avatarFileId.value = ids?.[0] || null;
    toast.success('사진 준비 완료', '저장하면 새 프로필 사진으로 반영돼요.');
  } catch (err) {
    toast.error('업로드 실패', err?.response?.data?.message || '사진 업로드에 실패했어요.');
  }
}
function clearAvatar() { avatarUrl.value = ''; avatarFileId.value = null; }
async function saveProfile() {
  saving.value = true;
  try {
    await updateMyProfile({ name: form.name || null, bio: form.bio || null, website: form.website || null, profileImageFileId: avatarFileId.value });
    await refreshAll();
    toast.success('저장 완료', '내 프로필이 업데이트됐어요.');
  } catch (e) {
    toast.error('저장 실패', e?.response?.data?.message || '프로필을 저장하지 못했어요.');
  } finally { saving.value = false; }
}
function goMyPublicProfile() { if (me.value?.handle) router.push(`/u/${encodeURIComponent(me.value.handle)}`); }
async function onLogout() { loading.value = true; try { await auth.logoutCookie(); router.replace('/login'); } finally { loading.value = false; } }
onMounted(async () => { try { if (!auth.me) await auth.ensureSession(); } catch { router.replace('/login'); return; } await refreshAll(); });
</script>

<style scoped>
.page{max-width:920px;margin:0 auto;padding:18px 14px 100px;display:grid;gap:14px}.heroCard,.card{border:1px solid var(--border);border-radius:24px;background:color-mix(in oklab,var(--surface) 92%,transparent);box-shadow:0 14px 42px rgba(0,0,0,.18)}.heroCard{padding:18px}.card{padding:18px}.heroTop{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.identity{display:flex;gap:14px;align-items:center}.avatarImg,.avatar,.avatarLg{object-fit:cover;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10)}.avatarImg,.avatar{width:78px;height:78px;border-radius:24px}.avatarLg{width:112px;height:112px;border-radius:28px}.fallback{display:grid;place-items:center;font-size:30px;font-weight:950;background:linear-gradient(135deg,color-mix(in oklab,var(--accent) 34%,transparent),color-mix(in oklab,var(--accent) 12%,transparent))}.heroTitle{font-size:12px;font-weight:900;letter-spacing:.16em;color:var(--muted)}.heroName{margin-top:4px;font-size:24px;font-weight:950}.heroHandle{margin-top:2px;color:var(--muted)}.heroSub{margin-top:8px;color:var(--muted);line-height:1.55;max-width:520px}.heroActions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.stat{padding:12px;border:1px solid var(--border);border-radius:16px;background:color-mix(in oklab,var(--surface-2) 80%,transparent);display:grid;gap:4px}.stat strong{font-size:18px}.stat span{font-size:12px;color:var(--muted)}.sectionHead{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:14px}.title{font-size:18px;font-weight:950}.sub{margin-top:4px;color:var(--muted);line-height:1.5}.compact{margin-bottom:10px}.formGrid{display:grid;grid-template-columns:260px 1fr;gap:18px}.label{display:grid;gap:8px;font-size:13px;color:var(--muted)}.avatarPanel{display:grid;gap:12px;justify-items:start}.avatarBtns{display:flex;gap:8px;flex-wrap:wrap}.fields{display:grid;gap:14px}.input,.textarea{width:100%;border-radius:14px;border:1px solid var(--border);background:color-mix(in oklab,var(--surface-2) 88%,transparent);color:var(--text);padding:12px}.textarea{min-height:120px;resize:vertical}.count{justify-self:end;font-size:12px;color:var(--muted)}.preview{padding:14px;border:1px solid var(--border);border-radius:18px;background:color-mix(in oklab,var(--surface-2) 76%,transparent)}.previewName{font-size:20px;font-weight:950}.previewHandle{margin-top:4px;color:var(--muted)}.previewBio{margin-top:10px;line-height:1.6}.previewWebsite{display:inline-block;margin-top:10px;color:var(--text)}.previewEmpty{margin-top:10px;color:var(--muted)}.primaryBtn,.softBtn,.ghostBtn,.dangerBtn{height:42px;padding:0 14px;border-radius:14px;font-weight:900}.primaryBtn{border:1px solid color-mix(in oklab,var(--accent) 40%, var(--border));background:color-mix(in oklab,var(--accent) 18%,transparent);color:var(--text)}.softBtn{border:1px solid var(--border);background:color-mix(in oklab,var(--surface-2) 82%,transparent);color:var(--text)}.ghostBtn{border:1px solid var(--border);background:transparent;color:var(--text)}.dangerBtn{border:1px solid color-mix(in oklab,var(--danger) 42%, var(--border));background:color-mix(in oklab,var(--danger) 10%, transparent);color:var(--text)}.hidden{display:none}@media (max-width:780px){.heroTop{flex-direction:column}.heroActions{justify-content:flex-start}.stats{grid-template-columns:1fr}.formGrid{grid-template-columns:1fr}.avatarLg{width:96px;height:96px;border-radius:22px}}
</style>
