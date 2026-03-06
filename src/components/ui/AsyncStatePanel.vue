<template>
  <section class="panel" :data-tone="tone">
    <div class="hero">
      <div v-if="icon" class="icon" aria-hidden="true">{{ icon }}</div>
      <div class="text">
        <div class="title">{{ title }}</div>
        <div v-if="description" class="desc">{{ description }}</div>
      </div>
    </div>

    <div v-if="$slots.default" class="body">
      <slot />
    </div>

    <div v-if="showActions && (primaryLabel || secondaryLabel || retryLabel)" class="actions">
      <button v-if="secondaryLabel" class="btn ghost" type="button" @click="$emit('secondary')">{{ secondaryLabel }}</button>
      <button v-if="primaryLabel || retryLabel" class="btn primary" type="button" @click="$emit(primaryLabel ? 'primary' : 'retry')">{{ primaryLabel || retryLabel }}</button>
    </div>
  </section>
</template>

<script setup>
defineEmits(["primary", "secondary", "retry"]);
defineProps({
  icon: { type: String, default: "" },
  title: { type: String, default: "" },
  description: { type: String, default: "" },
  primaryLabel: { type: String, default: "" },
  secondaryLabel: { type: String, default: "" },
  retryLabel: { type: String, default: "" },
  tone: { type: String, default: "default" },
  showActions: { type: Boolean, default: true },
});
</script>

<style scoped>
.panel{
  display:grid;
  gap:14px;
  padding:18px 16px;
  max-width:100%;
  border-radius:20px;
  border:1px solid color-mix(in oklab, var(--border) 84%, transparent);
  background:
    linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01)),
    color-mix(in oklab, var(--surface) 88%, transparent);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
  text-align:left;
}
.hero{display:flex;align-items:flex-start;gap:12px;}
.icon{width:40px;height:40px;border-radius:14px;display:grid;place-items:center;font-size:18px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);}
.text{min-width:0;display:grid;gap:5px;}
.title{font-size:15px;font-weight:950;color:var(--text);letter-spacing:-.02em;line-height:1.25;}
.desc{font-size:12px;color:var(--muted);line-height:1.55;max-width:58ch;}
.body{display:grid;gap:10px;}
.actions{display:flex;gap:8px;flex-wrap:wrap;padding-top:2px;}
.btn{min-height:40px;padding:0 14px;border-radius:13px;border:1px solid color-mix(in oklab, var(--border) 84%, transparent);font-weight:900;color:var(--text);}
.btn.ghost{background:rgba(255,255,255,.03);}
.btn.primary{border-color:color-mix(in oklab, var(--accent) 42%, var(--border));background:color-mix(in oklab, var(--accent) 18%, transparent);}
.panel[data-tone="loading"] .icon{background:color-mix(in oklab, var(--accent) 14%, rgba(255,255,255,.04));}
.panel[data-tone="danger"]{border-color:color-mix(in oklab, var(--danger) 32%, var(--border));}
.panel[data-tone="danger"] .icon{background:color-mix(in oklab, var(--danger) 16%, rgba(255,255,255,.04));}
.panel[data-tone="empty"] .icon{background:color-mix(in oklab, var(--surface-2) 86%, rgba(255,255,255,.04));}
@media (max-width:640px){
  .panel{padding:16px 14px;border-radius:18px;}
  .actions{display:grid;grid-template-columns:1fr 1fr;}
  .btn{width:100%;}
}
</style>
