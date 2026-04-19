import { ref } from 'vue';

export function useConversationMessageFocus({ nextTick, getScrollerEl }) {
  const flashMid = ref(null);

  async function ensureMessageVisible(messageId, extraLoads = 0) {
    const mid = String(messageId || '');
    if (!mid) return false;

    let tries = 0;
    while (tries <= extraLoads) {
      await nextTick();
      const el = getScrollerEl?.();
      const node = el?.querySelector?.(`[data-mid="${mid}"]`);
      if (node) {
        node.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        return true;
      }
      tries += 1;
      if (tries <= extraLoads) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }

    return false;
  }

  async function scrollAndFlashMessage(messageId, { block = 'center', ms = 2200 } = {}) {
    const mid = String(messageId || '');
    if (!mid) return false;

    await nextTick();
    const el = getScrollerEl?.();
    const node = el?.querySelector?.(`[data-mid="${mid}"]`);
    if (!node) return false;

    node.scrollIntoView?.({ behavior: 'smooth', block });
    flashMid.value = mid;

    window.setTimeout(() => {
      if (flashMid.value === mid) flashMid.value = null;
    }, ms);

    return true;
  }

  return {
    flashMid,
    ensureMessageVisible,
    scrollAndFlashMessage,
  };
}
