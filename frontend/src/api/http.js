import axios from 'axios';
import { ElMessage } from 'element-plus';

const http = axios.create({
  baseURL: '/api',
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
      if (location.pathname !== '/login') location.href = '/login';
    }
    const msg = err.response?.data?.message || err.message;
    if (Array.isArray(msg)) ElMessage.error(msg[0]);
    else ElMessage.error(msg || 'Lỗi không xác định');
    return Promise.reject(err);
  },
);

export default http;
