import { defineStore } from 'pinia';
import { authApi } from '@/api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    token: localStorage.getItem('token') || '',
    sessionChecked: false,
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
      if (res.requiresOtp) return res;
      this.setSession(res);
      return res;
    },
    async verify2fa(userId, code) {
      const res = await authApi.verify2fa(userId, code);
      this.setSession(res);
      return res;
    },
    setSession(res) {
      this.user = res.user;
      this.token = res.accessToken;
      this.sessionChecked = true;
      localStorage.setItem('token', res.accessToken);
      localStorage.setItem('user', JSON.stringify(res.user));
      return res;
    },
    async fetchMe() {
      try {
        const me = await authApi.me();
        this.user = me;
        this.sessionChecked = true;
        localStorage.setItem('user', JSON.stringify(me));
        return true;
      } catch (e) {
        this.logout();
        return false;
      }
    },
    async ensureSession() {
      if (!this.token) {
        this.sessionChecked = true;
        return false;
      }
      if (this.sessionChecked) return Boolean(this.user);
      return this.fetchMe();
    },
    logout() {
      this.user = null;
      this.token = '';
      this.sessionChecked = true;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
  },
});
