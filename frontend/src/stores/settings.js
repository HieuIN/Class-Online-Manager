import { defineStore } from 'pinia';

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    mode: localStorage.getItem('themeMode') || 'light',
    locale: localStorage.getItem('locale') || 'vi',
  }),
  actions: {
    applyTheme() {
      document.documentElement.classList.toggle('dark', this.mode === 'dark');
    },
    setMode(mode) {
      this.mode = mode;
      localStorage.setItem('themeMode', mode);
      this.applyTheme();
    },
    toggleMode() {
      this.setMode(this.mode === 'dark' ? 'light' : 'dark');
    },
    setLocale(locale) {
      this.locale = locale;
      localStorage.setItem('locale', locale);
    },
  },
});
