import { defineStore } from 'pinia';
import { authApi } from '@/api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    token: localStorage.getItem('token') || '',
  }),
  getters: {
    isAuthenticated: (s) => !!s.token,
    role: (s) => s.user?.role,
    isTeacher: (s) => s.user?.role === 'TEACHER',
    isStudent: (s) => s.user?.role === 'STUDENT',
    isAdmin: (s) => s.user?.role === 'ADMIN',
  },
  actions: {
    async login(email, password) {
      const res = await authApi.login(email, password);
      this.user = res.user;
      this.token = res.accessToken;
      localStorage.setItem('token', res.accessToken);
      localStorage.setItem('user', JSON.stringify(res.user));
      return res;
    },
    async fetchMe() {
      try {
        const me = await authApi.me();
        this.user = me;
        localStorage.setItem('user', JSON.stringify(me));
      } catch (e) { this.logout(); }
    },
    logout() {
      this.user = null;
      this.token = '';
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
  },
});
