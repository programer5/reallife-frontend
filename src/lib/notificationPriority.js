export function normalizeNotificationCategory(item = {}) {
  const raw = String(item.category || "").trim().toUpperCase();
  if (raw) return raw;
  const type = String(item.type || "").trim().toUpperCase();
  if (type === "PIN_REMIND") return "REMINDER";
  if (type === "MESSAGE_RECEIVED") return "MESSAGE";
  if (type === "POST_COMMENT") return "COMMENT";
  if (["POST_LIKE", "FOLLOW"].includes(type)) return "REACTION";
  if (type.startsWith("PIN_")) return "ACTION";
  return "OTHER";
}

export function fallbackPriorityScore(item = {}) {
  const type = String(item.type || "").trim().toUpperCase();
  const unreadBoost = item.read ? 0 : 1000;
  switch (type) {
    case "PIN_REMIND": return unreadBoost + 500;
    case "MESSAGE_RECEIVED": return unreadBoost + 400;
    case "POST_COMMENT": return unreadBoost + 300;
    case "PIN_CREATED":
    case "PIN_UPDATED":
    case "PIN_DONE":
    case "PIN_CANCELED":
    case "PIN_DISMISSED": return unreadBoost + 250;
    case "POST_LIKE":
    case "FOLLOW": return unreadBoost + 150;
    default: return unreadBoost + 50;
  }
}

export function resolvePriorityScore(item = {}) {
  const raw = Number(item.priorityScore);
  return Number.isFinite(raw) && raw > 0 ? raw : fallbackPriorityScore(item);
}

export function shouldUseBrowserNotification(item = {}, settings = {}) {
  if (!item || item.read) return false;
  const category = normalizeNotificationCategory(item);
  const browserEnabled = !!settings.pinRemindBrowserNotify;
  if (!browserEnabled) return false;

  // 보수적으로: 실제 행동으로 이어질 가능성이 큰 알림만 브라우저 알림으로 노출
  if (category === "REMINDER") return true;

  const score = resolvePriorityScore(item);
  if (category === "ACTION") return score >= 1200;
  if (category === "MESSAGE") return score >= 1400;

  return false;
}

export function buildBrowserNotificationPayload(item = {}) {
  const category = normalizeNotificationCategory(item);
  const body = String(item.body || "").trim() || "새 알림이 도착했어요.";
  const hint = String(item.actionHint || "").trim();
  const targetLabel = String(item.targetLabel || "").trim();
  const title = category === "REMINDER"
    ? "⏰ 리마인더"
    : category === "MESSAGE"
    ? "💬 새 메시지"
    : category === "COMMENT"
    ? "📝 새 댓글"
    : category === "ACTION"
    ? "✨ 액션 업데이트"
    : "🔔 새 알림";
  const browserBody = [body, hint || targetLabel].filter(Boolean).join(" · ");
  return { title, body: browserBody || body };
}
