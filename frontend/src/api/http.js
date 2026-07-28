import axios from 'axios';
import { ElMessage } from 'element-plus';

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (location.pathname !== '/login') {
        const currentPath = `${location.pathname}${location.search}${location.hash}`;
        location.replace(`/login?redirect=${encodeURIComponent(currentPath)}`);
      }
    }
    if (!err.config?.suppressErrorMessage) {
      const msg = err.response?.data?.message || err.message;
      if (Array.isArray(msg)) ElMessage.error(msg[0]);
      else ElMessage.error(msg || 'Lỗi không xác định');
    }
    return Promise.reject(err);
  },
);

export default http;
