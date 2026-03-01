// src/lib/sound.js
/**
 * PIN_REMIND 같은 가벼운 알림용 "띵" 사운드.
 * - 오디오 파일 없이 Web Audio API로 생성
 * - 브라우저 정책상 사용자 제스처 이후에만 재생 가능하므로 unlock() 필요
 */

let ctx = null;

function getCtx() {
    if (ctx) return ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
    return ctx;
}

export async function unlockSound() {
    const c = getCtx();
    if (!c) return false;
    try {
        if (c.state === "suspended") await c.resume();
        return c.state === "running";
    } catch {
        return false;
    }
}

/** 클릭/키다운 1회로 audio unlock */
export function bindSoundUnlockOnce() {
    const handler = async () => {
        await unlockSound();
        window.removeEventListener("pointerdown", handler);
        window.removeEventListener("keydown", handler);
        window.removeEventListener("touchstart", handler);
    };
    window.addEventListener("pointerdown", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });
    window.addEventListener("touchstart", handler, { once: true });
}

/** 짧은 2톤 '띵' */
export async function playDing({ volume = 0.18 } = {}) {
    const c = getCtx();
    if (!c) return;

    try {
        if (c.state === "suspended") await c.resume();
    } catch {}
    if (c.state !== "running") return;

    const now = c.currentTime;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    gain.connect(c.destination);

    const o1 = c.createOscillator();
    o1.type = "sine";
    o1.frequency.setValueAtTime(880, now); // A5
    o1.connect(gain);

    const o2 = c.createOscillator();
    o2.type = "sine";
    o2.frequency.setValueAtTime(1320, now + 0.07);
    o2.connect(gain);

    o1.start(now);
    o1.stop(now + 0.14);

    o2.start(now + 0.07);
    o2.stop(now + 0.22);
}