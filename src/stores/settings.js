// src/stores/settings.js
import { defineStore } from "pinia";

const KEY_SOUND = "settings:pinRemindSound";
const KEY_VIBRATE = "settings:pinRemindVibrate"; // ✅ NEW
const KEY_NOTIFY = "settings:pinRemindBrowserNotify"; // ✅ NEW

/**
 * 기본값 OFF (예상치 못한 소리 방지)
 */
export const useSettingsStore = defineStore("settings", {
    state: () => ({
        pinRemindSound: localStorage.getItem(KEY_SOUND) === "1",
        pinRemindVibrate: localStorage.getItem(KEY_VIBRATE) === "1", // ✅ NEW
        pinRemindBrowserNotify: localStorage.getItem(KEY_NOTIFY) === "1", // ✅ NEW
    }),
    actions: {
        setPinRemindSound(v) {
            this.pinRemindSound = !!v;
            localStorage.setItem(KEY_SOUND, this.pinRemindSound ? "1" : "0");
        },
        setPinRemindVibrate(v) { // ✅ NEW
            this.pinRemindVibrate = !!v;
            localStorage.setItem(KEY_VIBRATE, this.pinRemindVibrate ? "1" : "0");
        },
        togglePinRemindVibrate() { // ✅ NEW
            this.setPinRemindVibrate(!this.pinRemindVibrate);
        },
        togglePinRemindSound() {
            this.setPinRemindSound(!this.pinRemindSound);
        },
        setPinRemindBrowserNotify(v) { // ✅ NEW
            this.pinRemindBrowserNotify = !!v;
            localStorage.setItem(KEY_NOTIFY, this.pinRemindBrowserNotify ? "1" : "0");
        },
        togglePinRemindBrowserNotify() { // ✅ NEW
            this.setPinRemindBrowserNotify(!this.pinRemindBrowserNotify);
        },
    },
});