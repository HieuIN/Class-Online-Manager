import { createI18n } from 'vue-i18n';
import vi from './locales/vi.json';
import en from './locales/en.json';
import zh from './locales/zh.json';

export const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('locale') || 'vi',
  fallbackLocale: 'vi',
  messages: { vi, en, zh },
});
