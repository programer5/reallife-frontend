// src/stores/toast.js
import { defineStore } from "pinia";

function uid() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export const useToastStore = defineStore("toast", {
    state: () => ({
        items: [],
    }),

    actions: {
        show({ title, message = "", type = "info", durationMs = 3500 } = {}) {
            const id = uid();
            const item = { id, title, message, type };
            this.items.push(item);

            if (durationMs > 0) {
                setTimeout(() => this.dismiss(id), durationMs);
            }
            return id;
        },

        success(title, message = "") {
            return this.show({ title, message, type: "success" });
        },

        error(title, message = "") {
            return this.show({ title, message, type: "error", durationMs: 5000 });
        },

        info(title, message = "") {
            return this.show({ title, message, type: "info" });
        },

        dismiss(id) {
            this.items = this.items.filter((t) => t.id !== id);
        },

        clear() {
            this.items = [];
        },
    },
});