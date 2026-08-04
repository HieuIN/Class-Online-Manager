import http from './http';

export const authApi = {
  login: (email, password) => http.post('/auth/login', { email, password }),
  register: (data) => http.post('/auth/register', data),
  me: () => http.get('/auth/me'),
  changePassword: (oldPwd, newPwd) => http.post('/auth/change-password', { oldPassword: oldPwd, newPassword: newPwd }),
  forgotPassword: (email) => http.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => http.post('/auth/reset-password', { token, newPassword }),
  verify2fa: (userId, code) => http.post('/auth/verify-2fa', { userId, code }),
};

export const usersApi = {
  list: (role, includeInactive = false) => http.get('/users', {
    params: { ...(role ? { role } : {}), ...(includeInactive ? { includeInactive: 'true' } : {}) },
  }),
  get: (id) => http.get(`/users/${id}`),
  create: (data) => http.post('/users', data),
  update: (id, data) => http.patch(`/users/${id}`, data),
  uploadAvatar: (id, formData) => http.post(`/users/${id}/avatar`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
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
  duplicate: (id, d) => http.post(`/classes/${id}/duplicate`, d),
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

export const aiSuggestionsApi = {
  suggestFeedback: (studentId, classId) => http.post('/ai/suggest-feedback', { studentId, classId }),
  assignmentReview: (submissionId) => http.post('/ai/assignment-review', { submissionId }),
};

export const assignmentsApi = {
  list: (classId) => http.get('/assignments', { params: { classId } }),
  create: (formData) => http.post('/assignments', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, formData) => http.patch(`/assignments/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  comments: (id) => http.get(`/assignments/${id}/comments`),
  addComment: (id, content) => http.post(`/assignments/${id}/comments`, { content }),
  deleteAttachment: (assignmentId, attachmentId) => http.delete(`/assignments/${assignmentId}/attachments/${attachmentId}`),
  publish: (id) => http.post(`/assignments/${id}/publish`),
  groups: (id) => http.get(`/assignments/${id}/groups`),
  saveGroups: (id, groups) => http.post(`/assignments/${id}/groups`, { groups }),
  delete: (id) => http.delete(`/assignments/${id}`),
};

export const assignmentTemplatesApi = {
  list: () => http.get('/assignment-templates'),
  save: (name, payload) => http.post('/assignment-templates', { name, payload }),
  create: (id, data) => http.post(`/assignment-templates/${id}/create`, data),
  delete: (id) => http.delete(`/assignment-templates/${id}`),
};

export const submissionsApi = {
  matrix: (assignmentId) => http.get(`/submissions/matrix/${assignmentId}`),
  byStudent: (studentId, classId) => http.get('/submissions', { params: { studentId, classId } }),
  upload: (formData) => http.post('/submissions/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  submit: (formData) => http.post('/submissions/submit', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  grade: (id, d) => http.patch(`/submissions/${id}/grade`, d),
  versions: (id) => http.get(`/submissions/${id}/versions`),
  annotations: (id, attachmentId) => http.get(`/submissions/${id}/annotations`, { params: attachmentId ? { attachmentId } : undefined }),
  addAnnotation: (id, data) => http.post(`/submissions/${id}/annotations`, data),
  similarity: (assignmentId) => http.get(`/submissions/similarity/${assignmentId}`),
};

export const materialsApi = {
  list: (courseId) => http.get('/materials', { params: { courseId } }),
  upload: (formData) => http.post('/materials/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  create: (d) => http.post('/materials', d),
  update: (id, d) => http.patch(`/materials/${id}`, d),
  delete: (id) => http.delete(`/materials/${id}`),
};

export const paymentsApi = {
  list: (params) => http.get('/payments', { params }),
  summary: () => http.get('/payments/summary'),
  revenueReport: (from, to) => http.get('/payments/revenue-report', { params: { from, to } }),
  pay: (id, paidAmount) => http.patch(`/payments/${id}/pay`, { paidAmount }),
  create: (d) => http.post('/payments', d),
  downloadInvoice: (id) => http.get(`/payments/${id}/invoice`, { responseType: 'blob' }),
  installments: (id) => http.get(`/payments/${id}/installments`),
  createInstallment: (id, d) => http.post(`/payments/${id}/installments`, d),
  payInstallment: (id, paidAmount) => http.patch(`/payment-installments/${id}/pay`, { paidAmount }),
  vietqr: (id) => http.get(`/payments/${id}/vietqr`),
  commissions: (month) => http.get('/payments/teacher-commissions', { params: { month } }),
};

export const notificationsApi = {
  list: () => http.get('/notifications'),
  unreadCount: () => http.get('/notifications/unread-count'),
  markRead: (id) => http.patch(`/notifications/${id}/read`),
  markAllRead: () => http.patch('/notifications/read-all'),
  getRule: (classId) => http.get(`/notifications/rules/${classId}`),
  setRule: (classId, d) => http.post(`/notifications/rules/${classId}`, d),
};

export const classPostsApi = {
  list: (classId) => http.get('/class-posts', { params: { classId } }),
  create: (d) => http.post('/class-posts', d, d instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined),
  delete: (id) => http.delete(`/class-posts/${id}`),
  pin: (id) => http.patch(`/class-posts/${id}/pin`),
  comments: (id) => http.get(`/class-posts/${id}/comments`),
  addComment: (id, content) => http.post(`/class-posts/${id}/comments`, { content }),
};

export const quizzesApi = {
  list: (classId) => http.get('/quizzes', { params: { classId } }),
  create: (d) => http.post('/quizzes', d),
  update: (id, d) => http.patch(`/quizzes/${id}`, d),
  delete: (id) => http.delete(`/quizzes/${id}`),
  get: (id) => http.get(`/quizzes/${id}`),
  full: (id) => http.get(`/quizzes/${id}/full`),
  start: (id) => http.post(`/quizzes/${id}/start`),
  attempts: (params) => http.get('/quiz-attempts', { params }),
  attempt: (id) => http.get(`/quiz-attempts/${id}`),
  submit: (id, answers) => http.post(`/quiz-attempts/${id}/submit`, { answers }),
};

export const certificatesApi = {
  list: (params) => http.get('/certificates', { params }),
  preview: (enrollmentId) => http.get(`/certificates/preview/${enrollmentId}`),
  issue: (enrollmentId) => http.post(`/certificates/issue/${enrollmentId}`),
  download: (id) => http.get(`/certificates/${id}/download`, { responseType: 'blob' }),
};

export const calendarApi = {
  list: (start, end) => http.get('/calendar', { params: { start, end } }),
  exportIcs: (classId) => http.get('/calendar/export.ics', { params: { classId }, responseType: 'blob' }),
  create: (d) => http.post('/calendar', d),
  delete: (id) => http.delete(`/calendar/${id}`),
};

export const analyticsApi = {
  compareClasses: (classIds) => http.get('/analytics/compare-classes', { params: { classIds: classIds.join(',') } }),
  predictFinal: (classId) => http.get('/analytics/predict-final', { params: { classId } }),
  attendanceHeatmap: (classId) => http.get('/analytics/attendance-heatmap', { params: { classId } }),
  ranking: (classId) => http.get('/analytics/ranking', { params: { classId } }),
  assignmentDifficulty: (classId) => http.get('/analytics/assignment-difficulty', { params: { classId } }),
};

export const reportsApi = {
  exportGrades: (classId) => http.get(`/reports/grades/${classId}`, { responseType: 'blob' }),
  exportAttendance: (classId) => http.get(`/reports/attendance/${classId}`, { responseType: 'blob' }),
  studentFinal: (studentId, classId) => http.get(`/reports/student-final/${studentId}`, { params: { classId }, responseType: 'blob' }),
};

export const learningExtrasApi = {
  submitAnonymousFeedback: (classId, d) => http.post(`/anonymous-feedback/${classId}`, d),
  anonymousFeedbackStats: (classId) => http.get(`/anonymous-feedback/${classId}`),
  decks: (classId) => http.get('/flashcards/decks', { params: { classId } }),
  createDeck: (d) => http.post('/flashcards/decks', d),
  cards: (deckId) => http.get(`/flashcards/decks/${deckId}/cards`),
  createCard: (deckId, d) => http.post(`/flashcards/decks/${deckId}/cards`, d),
  uploadFlashcardMedia: (formData) => http.post('/flashcards/media', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  markCard: (cardId, remembered) => http.patch(`/flashcards/cards/${cardId}/progress`, { remembered }),
  transcript: (studentId) => http.get(`/students/${studentId}/transcript`),
  gallery: (classId) => http.get('/gallery', { params: { classId } }),
  uploadGallery: (classId, formData) => http.post(`/gallery/${classId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteGallery: (id) => http.delete(`/gallery/${id}`),
  reorderGradeItems: (items) => http.patch('/grade-items/reorder', { items }),
  reorderSessions: (items) => http.patch('/sessions/reorder', { items }),
  sentiment: (text) => http.post('/feedback/sentiment', { text }),
};

export const opsApi = {
  auditLogs: (params) => http.get('/audit-logs', { params }),
  createAudit: (d) => http.post('/audit-logs', d),
  backups: () => http.get('/backups'),
  createBackup: () => http.post('/backups'),
  downloadBackup: (fileName) => http.get(`/backups/${fileName}`, { responseType: 'blob' }),
  set2fa: (enabled) => http.patch('/auth/2fa', { enabled }),
  sendOtp: () => http.post('/auth/2fa/send'),
  pushSubscribe: (subscription) => http.post('/push/subscribe', subscription),
  runBirthdays: () => http.post('/birthdays/run'),
  myReferralCode: () => http.get('/referrals/my-code'),
};

export const pronunciationApi = {
  list: (classId) => http.get('/pronunciation-exercises', { params: { classId }, suppressErrorMessage: true }),
  create: (formData) => http.post('/pronunciation-exercises', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, formData) => http.patch(`/pronunciation-exercises/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id) => http.delete(`/pronunciation-exercises/${id}`),
  submissions: (exerciseId) => http.get(`/pronunciation-exercises/${exerciseId}/submissions`),
  submit: (exerciseId, formData) => http.post(`/pronunciation-exercises/${exerciseId}/submit`, formData, { headers: { 'Content-Type': 'multipart/form-data' }, suppressErrorMessage: true }),
  mySubmissions: (classId) => http.get('/pronunciation-submissions', { params: { classId } }),
  grade: (id, data) => http.patch(`/pronunciation-submissions/${id}/grade`, data),
};
