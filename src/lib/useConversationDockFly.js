export function useConversationDockFly({
  ref,
  nextTick,
  dockMode,
  dockOpen,
  pins,
  activeFilter,
  classifyPin,
}) {
  const flipPlaceholder = ref(null);
  const flyLayer = ref(null);
  const lastCreatedPinId = ref(null);
  const flyQueue = [];
  let flyRunning = false;
  let flySeq = 0;

  function rectOf(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  function makeFlyGhost(fromRect, toRect, html, fromStyle, toStyle, seq) {
    try {
      const ghost = document.createElement("div");
      ghost.className = "flyGhost";
      const stack = (seq ? (seq % 3) : 0);
      const ox = stack * 8;
      const oy = stack * 6;
      ghost.style.left = (fromRect.left + ox) + "px";
      ghost.style.top = (fromRect.top + oy) + "px";
      ghost.style.width = fromRect.width + "px";
      ghost.style.height = fromRect.height + "px";
      ghost.style.zIndex = String(10000 + (seq || 0));
      if (fromStyle) {
        if (fromStyle.borderRadius) ghost.style.borderRadius = fromStyle.borderRadius;
        if (fromStyle.boxShadow) ghost.style.boxShadow = fromStyle.boxShadow;
        if (fromStyle.background) ghost.style.background = fromStyle.background;
      }
      ghost.innerHTML = `<div class="flyGhostInner">${html || ""}</div>`;
      document.body.appendChild(ghost);
      ghost.getBoundingClientRect();
      if (toStyle) {
        if (toStyle.borderRadius) ghost.style.borderRadius = toStyle.borderRadius;
        if (toStyle.boxShadow) ghost.style.boxShadow = toStyle.boxShadow;
        if (toStyle.background) ghost.style.background = toStyle.background;
      }
      ghost.style.left = toRect.left + "px";
      ghost.style.top = toRect.top + "px";
      ghost.style.width = toRect.width + "px";
      ghost.style.height = toRect.height + "px";
      ghost.style.opacity = "0.0";
      const clean = () => { try { ghost.remove(); } catch {} };
      ghost.addEventListener("transitionend", clean, { once: true });
      setTimeout(clean, 820);
    } catch {}
  }

  function playTrueFlip(el, fromRect) {
    try {
      if (!el || !fromRect) return;
      const last = rectOf(el);
      if (!last) return;
      const dx = fromRect.left - last.left;
      const dy = fromRect.top - last.top;
      const sx = fromRect.width / Math.max(1, last.width);
      const sy = fromRect.height / Math.max(1, last.height);
      el.style.willChange = "transform, opacity";
      el.style.transformOrigin = "top left";
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
      el.style.opacity = "0.65";
      el.getBoundingClientRect();
      el.style.transition = "transform 520ms cubic-bezier(.16,1,.3,1), opacity 420ms cubic-bezier(.16,1,.3,1)";
      el.style.transform = "translate(0px, 0px) scale(1, 1)";
      el.style.opacity = "1";
      const clean = () => {
        try {
          el.style.willChange = "";
          el.style.transformOrigin = "";
          el.style.transition = "";
          el.style.transform = "";
        } catch {}
      };
      el.addEventListener("transitionend", clean, { once: true });
      setTimeout(clean, 750);
    } catch {}
  }

  function enqueueDockToActiveFly(job) {
    if (!job?.fromRect || !job?.createdPinId) return;
    const seq = (++flySeq);
    flyQueue.push({ ...job, _seq: seq });
    if (!flyRunning) processFlyQueue();
  }

  async function processFlyQueue() {
    if (flyRunning) return;
    flyRunning = true;
    while (flyQueue.length) {
      const job = flyQueue.shift();
      try {
        await runDockToActiveFly(job);
        await new Promise((r) => setTimeout(r, 70));
      } catch {}
    }
    flyRunning = false;
  }

  function spawnSparks(x, y) {
    try {
      const n = 9;
      for (let i = 0; i < n; i += 1) {
        const s = document.createElement("span");
        s.className = "spark";
        const a = (Math.PI * 2) * (i / n) + (Math.random() * 0.4);
        const d = 10 + Math.random() * 14;
        s.style.left = x + "px";
        s.style.top = y + "px";
        s.style.setProperty("--dx", `${(Math.cos(a) * d).toFixed(2)}px`);
        s.style.setProperty("--dy", `${(Math.sin(a) * d).toFixed(2)}px`);
        s.style.setProperty("--rot", `${(Math.random() * 120 - 60).toFixed(1)}deg`);
        document.body.appendChild(s);
        s.addEventListener("animationend", () => { try { s.remove(); } catch {} }, { once: true });
      }
    } catch {}
  }

  function safeText(v) {
    return (v == null) ? "" : String(v);
  }

  function formatCandidateTime(c) {
    const raw = c?.startAt || c?.whenAt || c?.datetime || c?.timeAt || c?.at || c?.dateTime;
    if (!raw) return "";
    try {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) {
        const y = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, "0");
        const da = String(d.getDate()).padStart(2, "0");
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        return `${y}-${mo}-${da} ${hh}:${mm}`;
      }
    } catch {}
    return safeText(raw).slice(0, 16);
  }

  function formatCandidatePlace(c) {
    const p = c?.placeText || c?.place || c?.location || c?.where || c?.addr || c?.address;
    return p ? safeText(p).slice(0, 18) : "";
  }

  function makeCandidateGhostHtml(candidate, title) {
    const t = safeText(title || candidate?.title || "액션").slice(0, 24);
    const time = formatCandidateTime(candidate);
    const place = formatCandidatePlace(candidate);
    const metaParts = [];
    if (time) metaParts.push(`🕒 ${time}`);
    if (place) metaParts.push(`📍 ${place}`);
    const meta = metaParts.length ? metaParts.join(" · ") : "저장 중…";
    return `<div class="flyGhostInner">
            <div class="flyGhostTitle">${t}</div>
            <div class="flyGhostMeta">${meta}</div>
          </div>`;
  }

  async function runDockToActiveFly(job) {
    const createdPinId = job?.createdPinId;
    const fromRect = job?.fromRect;
    const html = job?.html;
    if (!fromRect || !createdPinId) return;
    lastCreatedPinId.value = String(createdPinId);
    if (job?.meta) {
      flipPlaceholder.value = { pinId: String(createdPinId), ...job.meta };
    } else {
      flipPlaceholder.value = { pinId: String(createdPinId), title: "저장됨", time: "", place: "", type: "OTHER" };
    }
    try {
      dockMode.value = "active";
      dockOpen.value = true;
      await nextTick();
      await nextTick();
    } catch {}
    let target = document.querySelector(`[data-pin-id="${String(createdPinId)}"]`);
    if (!target) {
      const p = (pins.value || []).find((x) => String(x.pinId) === String(createdPinId));
      if (p) {
        const k = classifyPin(p);
        activeFilter.value = k || "ALL";
        await nextTick();
        await nextTick();
        target = document.querySelector(`[data-pin-id="${String(createdPinId)}"]`);
      }
    }
    const fallbackEl = document.querySelector(".dockPanel") || document.querySelector(".dockWrap");
    const toRect = rectOf(target || fallbackEl);
    if (toRect) {
      const toEl = (target || fallbackEl);
      const tcs = toEl ? window.getComputedStyle(toEl) : null;
      const toStyle = tcs ? { borderRadius: tcs.borderRadius, boxShadow: tcs.boxShadow, background: tcs.background } : null;
      makeFlyGhost(fromRect, toRect, html, job?.fromStyle, toStyle, job?._seq);
      try { spawnSparks(toRect.left + toRect.width * 0.75, toRect.top + 18); } catch {}
      if (target) {
        try {
          target.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "center" });
        } catch {}
        requestAnimationFrame(() => playTrueFlip(target, fromRect));
        setTimeout(() => {
          try {
            const exists = (pins.value || []).some((x) => String(x.pinId) === String(createdPinId));
            if (exists) flipPlaceholder.value = null;
          } catch {}
        }, 850);
      }
    }
  }

  return {
    flyLayer,
    rectOf,
    safeText,
    formatCandidateTime,
    formatCandidatePlace,
    makeCandidateGhostHtml,
    enqueueDockToActiveFly,
  };
}
