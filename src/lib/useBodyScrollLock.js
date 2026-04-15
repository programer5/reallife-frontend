import { onBeforeUnmount } from "vue";

let lockCount = 0;
let previousOverflow = "";

function applyLocked() {
  if (typeof document === "undefined") return;
  if (lockCount > 0) {
    document.body.style.overflow = "hidden";
    return;
  }
  document.body.style.overflow = previousOverflow;
  previousOverflow = "";
}

export function useBodyScrollLock() {
  let locked = false;

  function setLocked(next) {
    const shouldLock = Boolean(next);
    if (shouldLock === locked) return;

    if (typeof document !== "undefined") {
      if (shouldLock) {
        if (lockCount === 0) {
          previousOverflow = document.body.style.overflow || "";
        }
        lockCount += 1;
      } else {
        lockCount = Math.max(0, lockCount - 1);
      }
      applyLocked();
    }

    locked = shouldLock;
  }

  onBeforeUnmount(() => {
    setLocked(false);
  });

  return { setLocked };
}
