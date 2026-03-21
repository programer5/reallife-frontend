import { onBeforeUnmount, onMounted, ref } from "vue";

export function useMessageContextMenu() {
  const menu = ref({
    open: false,
    top: 0,
    left: 0,
    msg: null,
  });

  function closeMsgMenu() {
    menu.value.open = false;
    menu.value.msg = null;
  }

  function openMsgMenu(e, m) {
    if (!m) return;

    const rect = e?.currentTarget?.getBoundingClientRect?.() || null;
    const w = 140;
    const h = 96;
    const pad = 10;

    let left = rect ? rect.right - w : (e?.clientX || 0);
    let top = rect ? rect.bottom + 8 : (e?.clientY || 0);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (left + w + pad > vw) left = vw - w - pad;
    if (left < pad) left = pad;
    if (top + h + pad > vh) top = (rect ? rect.top - h - 8 : vh - h - pad);
    if (top < pad) top = pad;

    menu.value = { open: true, left, top, msg: m };
  }

  function onKeydownForMenu(e) {
    if (e.key === "Escape") closeMsgMenu();
  }

  onMounted(() => {
    window.addEventListener("keydown", onKeydownForMenu);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("keydown", onKeydownForMenu);
  });

  return { menu, closeMsgMenu, openMsgMenu };
}
