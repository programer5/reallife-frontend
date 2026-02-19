<script setup>
import { computed, onMounted, ref } from "vue";
import api from "@/lib/api.js";
import { useAuthStore } from "@/stores/auth.js";

import RlButton from "@/components/ui/RlButton.vue";
import RlBadge from "@/components/ui/RlBadge.vue";

const auth = useAuthStore();

// ===== composer =====
const content = ref("");
const visibility = ref("ALL"); // PUBLIC | FOLLOWERS | PRIVATE (백엔드 enum)
const pickedFiles = ref([]);      // File[]
const uploading = ref(false);
const posting = ref(false);
const composerError = ref("");

// ===== feed =====
const loading = ref(false);
const error = ref("");
const items = ref([]);
const nextCursor = ref(null);
const hasNext = ref(false);

const canPost = computed(() => content.value.trim().length > 0 && !posting.value);

function fmt(ts) {
  // ts can be ISO string or LocalDateTime serialized
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}.${dd} ${hh}:${mi}`;
}

function pickInitial(name, handle) {
  const raw = String((name || handle || "")).trim();
  if (!raw) return "";
  const ch = raw[0];
  if (ch === "." || ch === "-" || ch === "_") return "";
  return ch.toUpperCase();
}

async function fetchFeed({ reset = true } = {}) {
  loading.value = true;
  error.value = "";
  try {
    const params = { size: 10 };
    if (!reset && nextCursor.value) params.cursor = nextCursor.value;

    const res = await api.get("/api/feed", { params });
    const data = res.data || {};
    const newItems = Array.isArray(data.items) ? data.items : [];

    if (reset) items.value = newItems;
    else items.value = [...items.value, ...newItems];

    nextCursor.value = data.nextCursor ?? null;
    hasNext.value = !!data.hasNext;
  } catch (e) {
    error.value = e?.response?.data?.message || "피드를 불러오지 못했어요.";
  } finally {
    loading.value = false;
  }
}

function onPickImages(e) {
  const files = Array.from(e.target.files || []);
  // UX: 최대 4장
  pickedFiles.value = files.slice(0, 4);
  e.target.value = "";
}

function removePicked(idx) {
  pickedFiles.value = pickedFiles.value.filter((_, i) => i !== idx);
}

async function uploadImages() {
  if (!pickedFiles.value.length) return [];

  uploading.value = true;
  try {
    const ids = [];
    for (const f of pickedFiles.value) {
      const form = new FormData();
      form.append("file", f);
      const up = await api.post("/api/files", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const fileId = up.data?.fileId;
      if (fileId) ids.push(fileId);
    }
    return ids;
  } finally {
    uploading.value = false;
  }
}

async function createPost() {
  composerError.value = "";
  const text = content.value.trim();
  if (!text) return;

  posting.value = true;
  try {
    const imageFileIds = await uploadImages();

    await api.post("/api/posts", {
      content: text,
      imageUrls: [],          // 구버전 호환 (비워둠)
      imageFileIds,           // ✅ 정석
      visibility: visibility.value,
    });

    // reset composer
    content.value = "";
    pickedFiles.value = [];

    // refresh feed (최신 상단)
    await fetchFeed({ reset: true });
  } catch (e) {
    composerError.value = e?.response?.data?.message || "게시글 작성에 실패했어요.";
  } finally {
    posting.value = false;
  }
}

onMounted(async () => {
  await auth.ensureSession();
  await fetchFeed({ reset: true });
});
</script>

<template>
  <div class="rl-page">
    <div class="rl-section">

      <!-- Composer -->
      <section class="rl-card">
        <div class="rl-card__header">
          <div>
            <div class="rl-card__title">Home</div>
            <div class="rl-card__sub">지금 순간을 공유하세요</div>
          </div>

          <div class="headerRight">
            <RlButton size="sm" variant="soft" @click="fetchFeed({ reset: true })" :loading="loading">
              새로고침
            </RlButton>
          </div>
        </div>

        <div class="pad">
          <textarea
            v-model="content"
            class="composer"
            placeholder="무슨 일이 있었나요?"
            rows="3"
          />

          <div class="composerRow">
            <label class="fileBtn">
              <input type="file" accept="image/*" multiple class="hidden" @change="onPickImages" />
              이미지
            </label>

            <select v-model="visibility" class="select">
              <option value="ALL">전체 공개</option>
              <option value="FOLLOWERS">팔로워만</option>
              <option value="PRIVATE">나만</option>
            </select>

            <RlButton
              size="sm"
              variant="primary"
              @click="createPost"
              :disabled="!canPost || uploading"
              :loading="posting || uploading"
            >
              올리기
            </RlButton>
          </div>

          <div v-if="composerError" class="err">{{ composerError }}</div>

          <div v-if="pickedFiles.length" class="previewGrid">
            <div v-for="(f, i) in pickedFiles" :key="i" class="previewItem">
              <div class="previewName">{{ f.name }}</div>
              <button class="x" @click="removePicked(i)" aria-label="remove">×</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Feed -->
      <section class="rl-card">
        <div class="rl-card__header">
          <div>
            <div class="rl-card__title">피드</div>
            <div class="rl-card__sub">팔로잉 기반 최신 글</div>
          </div>
        </div>

        <div class="pad">
          <div v-if="error" class="err">{{ error }}</div>
          <div v-if="loading && !items.length" class="empty">불러오는 중…</div>
          <div v-else-if="!items.length" class="empty">아직 글이 없어요. 첫 글을 올려보세요!</div>

          <div v-else class="feed">
            <article v-for="p in items" :key="p.postId" class="post">
              <div class="postHead">
                <div class="avatar" aria-hidden="true">
                  <span v-if="pickInitial(p.authorName, p.authorHandle)">{{ pickInitial(p.authorName, p.authorHandle) }}</span>
                  <svg v-else viewBox="0 0 24 24" width="18" height="18">
                    <path
                      fill="currentColor"
                      d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2-8 4.5V21h16v-2.5C20 16 16.42 14 12 14Z"
                    />
                  </svg>
                </div>

                <div class="meta">
                  <div class="nameRow">
                    <div class="name">{{ p.authorName || "User" }}</div>
                    <div class="handle">@{{ p.authorHandle || "-" }}</div>
                    <RlBadge tone="neutral" class="vis">{{ String(p.visibility || "").toLowerCase() }}</RlBadge>
                  </div>
                  <div class="time">{{ fmt(p.createdAt) }}</div>
                </div>
              </div>

              <div class="content">{{ p.content }}</div>

              <div v-if="p.imageUrls && p.imageUrls.length" class="imgs">
                <img v-for="(u, i) in p.imageUrls" :key="i" :src="u" class="img" alt="post image" />
              </div>
            </article>

            <div class="moreRow">
              <RlButton v-if="hasNext" size="sm" variant="soft" @click="fetchFeed({ reset: false })" :loading="loading">
                더 보기
              </RlButton>
            </div>
          </div>
        </div>
      </section>

    </div>
  </div>
</template>

<style scoped>
.pad{ padding: 14px 16px 16px; }
.headerRight{ display:flex; align-items:center; gap: 10px; }
.err{ color: #ff6b6b; font-size: 12.5px; margin: 6px 0 0; }
.empty{ opacity:.7; font-size: 13px; padding: 6px 2px; }

.composer{
  width: 100%;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.18);
  color: rgba(255,255,255,.92);
  padding: 12px 12px;
  outline: none;
  resize: vertical;
  min-height: 84px;
}
.composer:focus{
  border-color: rgba(124,156,255,.45);
  box-shadow: 0 0 0 4px rgba(124,156,255,.12);
}

.composerRow{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.fileBtn{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  cursor: pointer;
  font-weight: 900;
  font-size: 12.5px;
}
.hidden{ display:none; }

.select{
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.18);
  color: rgba(255,255,255,.92);
  outline: none;
}

.previewGrid{
  margin-top: 10px;
  display:flex;
  gap: 10px;
  flex-wrap: wrap;
}
.previewItem{
  position: relative;
  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.12);
  max-width: 240px;
}
.previewName{
  font-size: 12px;
  opacity: .85;
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 16px;
}
.x{
  position:absolute;
  right: 8px;
  top: 6px;
  border: none;
  background: transparent;
  color: rgba(255,255,255,.85);
  font-size: 16px;
  cursor: pointer;
}

.feed{ display:flex; flex-direction:column; gap: 12px; margin-top: 10px; }
.post{
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(0,0,0,.10);
  padding: 12px 12px;
}
.postHead{ display:flex; gap: 10px; align-items:flex-start; }
.avatar{
  width: 34px; height: 34px; border-radius: 14px;
  display:grid; place-items:center;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.10);
  font-weight: 900;
  color: rgba(255,255,255,.82);
}
.meta{ min-width: 0; flex: 1 1 auto; }
.nameRow{ display:flex; align-items:baseline; gap: 8px; flex-wrap: wrap; }
.name{ font-weight: 950; font-size: 13.5px; }
.handle{ opacity: .7; font-size: 12.5px; }
.vis{ margin-left: 2px; }
.time{ opacity: .65; font-size: 12px; margin-top: 2px; }

.content{
  margin-top: 10px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13.5px;
  line-height: 1.5;
}

.imgs{
  margin-top: 10px;
  display:grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.img{
  width: 100%;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.10);
  object-fit: cover;
  max-height: 280px;
}

.moreRow{ display:flex; justify-content:center; margin-top: 12px; }
</style>
