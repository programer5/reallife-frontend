export const SEARCH_TYPES = [
  { value: "ALL", label: "전체" },
  { value: "MESSAGES", label: "메시지" },
  { value: "ACTIONS", label: "액션" },
  { value: "CAPSULES", label: "캡슐" },
  { value: "POSTS", label: "피드" },
];

export function typeLabel(value) {
  return SEARCH_TYPES.find((item) => item.value === value)?.label || value;
}

export function typeTone(value) {
  if (value === "MESSAGES") return "tone-message";
  if (value === "ACTIONS") return "tone-action";
  if (value === "CAPSULES") return "tone-capsule";
  if (value === "POSTS") return "tone-post";
  return "";
}

export function relevanceLabel(score) {
  const value = Number(score || 0);
  if (value >= 1200) return "완전 일치에 가까움";
  if (value >= 850) return "정확히 맞는 결과";
  if (value >= 600) return "강하게 일치";
  if (value >= 320) return "연관도 높음";
  if (value > 0) return "연관 결과";
  return "기본 정렬";
}

export function formatSearchTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).replace("T", " ").slice(0, 16);
  const now = Date.now();
  const diffMin = Math.max(0, Math.floor((now - d.getTime()) / 60000));
  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function buildSearchTarget(item, queryText = "") {
  const link = String(item?.deepLink || "").trim();
  if (!link) return null;

  const [pathname, rawQuery] = link.split("?");
  const query = rawQuery ? Object.fromEntries(new URLSearchParams(rawQuery).entries()) : {};
  const path = pathname || link;
  const normalizedQuery = String(queryText || "").trim();

  if (item?.type === "MESSAGES") {
    query.mid = String(item?.anchorId || item?.id || "");
    query.fromSearch = "1";
    if (normalizedQuery) query.searchQ = normalizedQuery;
  } else if (item?.type === "ACTIONS") {
    query.pinId = String(item?.anchorId || item?.id || "");
    query.fromSearch = "1";
    if (normalizedQuery) query.searchQ = normalizedQuery;
  } else if (item?.type === "CAPSULES") {
    query.capsuleId = String(item?.anchorId || item?.id || "");
    query.fromSearch = "1";
    if (normalizedQuery) query.searchQ = normalizedQuery;
  }

  return { path, query };
}
