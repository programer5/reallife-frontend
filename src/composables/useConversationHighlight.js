import { nextTick, ref } from "vue";

export function useConversationHighlight() {
  const flashMid = ref("");

  async function scrollAndFlashMessage(mid, options = {}) {
    if (!mid) return false;
    await nextTick();

    const el = document.querySelector(`[data-mid="${mid}"]`);
    if (!el) return false;

    el.scrollIntoView({
      behavior: options.behavior || "smooth",
      block: options.block || "center",
      inline: options.inline || "nearest",
    });

    flashMid.value = String(mid);
    setTimeout(() => {
      if (flashMid.value === String(mid)) flashMid.value = "";
    }, options.duration || 2000);

    return true;
  }

  async function pulseElement(selector, duration = 2200) {
    await nextTick();
    const target = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!target) return false;
    target.classList.add("searchAnchorPulse");
    setTimeout(() => target.classList.remove("searchAnchorPulse"), duration);
    return true;
  }

  async function ensureMessageVisible(mid, loadMore, maxTries = 5) {
    for (let i = 0; i < maxTries; i += 1) {
      const ok = await scrollAndFlashMessage(mid);
      if (ok) return true;
      if (typeof loadMore !== "function") return false;
      await loadMore();
    }
    return false;
  }

  return {
    flashMid,
    scrollAndFlashMessage,
    pulseElement,
    ensureMessageVisible,
  };
}
