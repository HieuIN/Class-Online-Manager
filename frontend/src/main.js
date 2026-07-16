import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource/be-vietnam-pro/800.css';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';

import App from './App.vue';
import router from './router';
import { i18n } from './i18n';
import './assets/main.css';

if (localStorage.getItem('themeMode') === 'dark') document.documentElement.classList.add('dark');

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(i18n);
app.use(ElementPlus, { locale: undefined });

for (const [k, c] of Object.entries(ElementPlusIconsVue)) app.component(k, c);

app.mount('#app');
