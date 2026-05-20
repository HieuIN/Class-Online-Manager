import http from './http';

export const authApi = {
  login: (email, password) => http.post('/auth/login', { email, password }),
  register: (data) => http.post('/auth/register', data),
  me: () => http.get('/auth/me'),
  changePassword: (oldPwd, newPwd) => http.post('/auth/change-password', { oldPassword: oldPwd, newPassword: newPwd }),
  forgotPassword: (email) => http.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => http.post('/auth/reset-password', { token, newPassword }),
};

export const usersApi = {
  list: (role) => http.get('/users', { params: { role } }),
  get: (id) => http.get(`/users/${id}`),
  create: (data) => http.post('/users', data),
  update: (id, data) => http.patch(`/users/${id}`, data),
  delete: (id) => http.delete(`/users/${id}`),
};

export const coursesApi = {
  list: () => http.get('/courses'),
  get: (id) => http.get(`/courses/${id}`),
  create: (d) => http.post('/courses', d),
  update: (id, d) => http.patch(`/courses/${id}`, d),
  delete: (id) => http.delete(`/courses/${id}`),
};

export const classesApi = {
  list: () => http.get('/classes'),
  get: (id) => http.get(`/classes/${id}`),
  students: (id) => http.get(`/classes/${id}/students`),
  create: (d) => http.post('/classes', d),
  update: (id, d) => http.patch(`/classes/${id}`, d),
  delete: (id) => http.delete(`/classes/${id}`),
};

export const enrollmentsApi = {
  list: (params) => http.get('/enrollments', { params }),
  enroll: (classId, studentId) => http.post('/enrollments', { classId, studentId }),
  bulkEnroll: (classId, studentIds) => http.post('/enrollments/bulk', { classId, studentIds }),
  delete: (id) => http.delete(`/enrollments/${id}`),
};

export const sessionsApi = {
  list: (classId) => http.get('/sessions', { params: { classId } }),
  progress: (classId) => http.get(`/sessions/progress/${classId}`),
  generate: (d) => http.post('/sessions/generate', d),
  create: (d) => http.post('/sessions', d),
  update: (id, d) => http.patch(`/sessions/${id}`, d),
  delete: (id) => http.delete(`/sessions/${id}`),
};

export const attendanceApi = {
  bySession: (sessionId) => http.get('/attendance', { params: { sessionId } }),
  byStudent: (studentId, classId) => http.get('/attendance', { params: { studentId, classId } }),
  matrix: (classId) => http.get(`/attendance/matrix/${classId}`),
  stats: (studentId, classId) => http.get('/attendance/stats', { params: { studentId, classId } }),
  bulkMark: (sessionId, records) => http.post('/attendance/bulk', { sessionId, records }),
};

export const gradeItemsApi = {
  list: (classId) => http.get('/grade-items', { params: { classId } }),
  create: (d) => http.post('/grade-items', d),
  update: (id, d) => http.patch(`/grade-items/${id}`, d),
  delete: (id) => http.delete(`/grade-items/${id}`),
};

export const gradesApi = {
  byStudent: (studentId, classId) => http.get('/grades', { params: { studentId, classId } }),
  byItem: (gradeItemId) => http.get('/grades', { params: { gradeItemId } }),
  average: (studentId, classId) => http.get('/grades/average', { params: { studentId, classId } }),
  distribution: (classId, itemName) => http.get(`/grades/distribution/${classId}`, { params: { itemName } }),
  upsert: (d) => http.post('/grades', d),
  bulkUpsert: (records) => http.post('/grades/bulk', { records }),
};

export const assignmentsApi = {
  list: (classId) => http.get('/assignments', { params: { classId } }),
  create: (d) => http.post('/assignments', d),
  update: (id, d) => http.patch(`/assignments/${id}`, d),
  delete: (id) => http.delete(`/assignments/${id}`),
};

export const submissionsApi = {
  matrix: (assignmentId) => http.get(`/submissions/matrix/${assignmentId}`),
  byStudent: (studentId, classId) => http.get('/submissions', { params: { studentId, classId } }),
  upload: (formData) => http.post('/submissions/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  grade: (id, d) => http.patch(`/submissions/${id}/grade`, d),
};

export const materialsApi = {
  list: (courseId) => http.get('/materials', { params: { courseId } }),
  upload: (formData) => http.post('/materials/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  create: (d) => http.post('/materials', d),
  delete: (id) => http.delete(`/materials/${id}`),
};

export const paymentsApi = {
  list: (params) => http.get('/payments', { params }),
  summary: () => http.get('/payments/summary'),
  pay: (id, paidAmount) => http.patch(`/payments/${id}/pay`, { paidAmount }),
  create: (d) => http.post('/payments', d),
};

export const notificationsApi = {
  list: () => http.get('/notifications'),
  unreadCount: () => http.get('/notifications/unread-count'),
  markRead: (id) => http.patch(`/notifications/${id}/read`),
  markAllRead: () => http.patch('/notifications/read-all'),
  getRule: (classId) => http.get(`/notifications/rules/${classId}`),
  setRule: (classId, d) => http.post(`/notifications/rules/${classId}`, d),
};

export const calendarApi = {
  list: (start, end) => http.get('/calendar', { params: { start, end } }),
  create: (d) => http.post('/calendar', d),
  delete: (id) => http.delete(`/calendar/${id}`),
};

export const reportsApi = {
  exportGrades: (classId) => http.get(`/reports/grades/${classId}`, { responseType: 'blob' }),
  exportAttendance: (classId) => http.get(`/reports/attendance/${classId}`, { responseType: 'blob' }),
};
