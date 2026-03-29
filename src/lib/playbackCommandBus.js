const listeners = new Map();
const recentCommands = new Map();
const COMMAND_TTL_MS = 2500;

export function dispatchPlaybackCommand(sessionId, command) {
  const key = String(sessionId || '');
  if (!key) return;
  const payload = { ...(command || {}), __dispatchedAt: Date.now() };
  recentCommands.set(key, payload);
  const set = listeners.get(key);
  if (!set?.size) return;
  for (const handler of set) {
    try {
      handler(payload);
    } catch {}
  }
}

export function subscribePlaybackCommand(sessionId, handler) {
  const key = String(sessionId || '');
  if (!key || typeof handler !== 'function') return () => {};
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(handler);

  const recent = recentCommands.get(key);
  if (recent && Date.now() - Number(recent.__dispatchedAt || 0) <= COMMAND_TTL_MS) {
    queueMicrotask(() => {
      if (!set?.has(handler)) return;
      try {
        handler(recent);
      } catch {}
    });
  }

  return () => {
    const current = listeners.get(key);
    if (!current) return;
    current.delete(handler);
    if (!current.size) listeners.delete(key);
  };
}
