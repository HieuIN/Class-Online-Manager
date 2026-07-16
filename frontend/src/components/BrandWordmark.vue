<template>
  <span :class="['brand-wordmark', { 'is-light': light, 'is-compact': compact }]">
    <span class="wordmark-seal" aria-hidden="true">中文</span>
    <span class="wordmark-title"><b>C</b>talk Chinese</span>
    <span v-if="subtitle" class="wordmark-subtitle">{{ subtitle }}</span>
  </span>
</template>

<script setup>
defineProps({
  light: Boolean,
  compact: Boolean,
  subtitle: { type: String, default: '' },
});
</script>

<style scoped>
.brand-wordmark { align-items:center; display:grid; column-gap:7px; grid-template-areas:'seal title' 'seal subtitle'; grid-template-columns:auto minmax(0, 1fr); line-height:1; min-width:0; }
.wordmark-seal { align-items:center; background:#fff1e6; border:1px solid #cf6b58; border-radius:4px; color:#af3e32; display:inline-flex; font-family:'STKaiti', 'Kaiti SC', 'DFKai-SB', serif; font-size:11px; font-weight:700; grid-area:seal; height:24px; justify-content:center; letter-spacing:0.02em; transform:rotate(-3deg); width:24px; }
.wordmark-title { color:var(--brand-700); font-family:'Brush Script MT', 'Segoe Script', 'Apple Chancery', 'URW Chancery L', cursive; font-size:25px; font-style:italic; font-weight:700; grid-area:title; letter-spacing:0.01em; line-height:0.82; overflow:visible; transform:rotate(-1.5deg); transform-origin:left center; white-space:nowrap; }
.wordmark-title b { color:#b94134; font-size:1.18em; font-weight:inherit; }
.wordmark-subtitle { color:var(--ink-500); font-family:'Be Vietnam Pro', Arial, sans-serif; font-size:10px; font-weight:650; grid-area:subtitle; letter-spacing:0.03em; line-height:1.25; margin-top:4px; text-transform:uppercase; }
.is-light .wordmark-title { color:#fff9e8; }
.is-light .wordmark-title b { color:#f3c867; }
.is-light .wordmark-seal { background:rgba(185, 65, 52, 0.9); border-color:#ffd9b2; color:#fff5dc; }
.is-light .wordmark-subtitle { color:rgba(238, 250, 244, 0.78); }
.is-compact .wordmark-seal { height:21px; width:21px; font-size:10px; }
.is-compact .wordmark-title { font-size:22px; }
.is-compact .wordmark-subtitle { font-size:9px; }
</style>
