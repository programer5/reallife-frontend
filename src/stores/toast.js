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
        show({ title, message = "", type = "info", durationMs = 3500, to = "" } = {}) {
            const id = uid();
            const item = { id, title, message, type, to };
            this.items.push(item);

            if (durationMs > 0) {
                setTimeout(() => this.dismiss(id), durationMs);
            }
            return id;
        },

        success(title, message = "", opts = {}) {
            return this.show({ title, message, type: "success", ...opts });
        },

        error(title, message = "", opts = {}) {
            return this.show({ title, message, type: "error", durationMs: 5000, ...opts });
        },

        info(title, message = "", opts = {}) {
            return this.show({ title, message, type: "info", ...opts });
        },

        dismiss(id) {
            this.items = this.items.filter((t) => t.id !== id);
        },

        clear() {
            this.items = [];
        },
    },
});