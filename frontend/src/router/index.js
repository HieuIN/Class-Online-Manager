import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes = [
  { path: '/login', component: () => import('@/views/auth/Login.vue'), meta: { public: true } },
  { path: '/forgot-password', component: () => import('@/views/auth/ForgotPassword.vue'), meta: { public: true } },
  { path: '/reset-password', component: () => import('@/views/auth/ResetPassword.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('@/views/AppLayout.vue'),
    children: [
      { path: '', redirect: '/dashboard' },
      // Teacher
      { path: 'dashboard', component: () => import('@/views/teacher/Dashboard.vue'), meta: { roles: ['TEACHER'] } },
      { path: 'classes', component: () => import('@/views/shared/Classes.vue'), meta: { roles: ['TEACHER','ADMIN'] } },
      { path: 'attendance', component: () => import('@/views/teacher/Attendance.vue'), meta: { roles: ['TEACHER'] } },
      { path: 'grades', component: () => import('@/views/teacher/Grades.vue'), meta: { roles: ['TEACHER'] } },
      { path: 'assignments', component: () => import('@/views/teacher/Assignments.vue'), meta: { roles: ['TEACHER'] } },
      { path: 'quizzes', component: () => import('@/views/teacher/Quizzes.vue'), meta: { roles: ['TEACHER'] } },
      { path: 'progress', component: () => import('@/views/teacher/Progress.vue'), meta: { roles: ['TEACHER'] } },
      { path: 'materials', component: () => import('@/views/shared/Materials.vue') },
      { path: 'forum', component: () => import('@/views/shared/Forum.vue'), meta: { roles: ['TEACHER','STUDENT'] } },
      { path: 'pronunciation', component: () => import('@/views/shared/Pronunciation.vue'), meta: { roles: ['TEACHER','STUDENT','ADMIN'] } },
      { path: 'flashcards', component: () => import('@/views/shared/Flashcards.vue'), meta: { roles: ['TEACHER','STUDENT','ADMIN'] } },
      { path: 'class-extras', component: () => import('@/views/shared/ClassExtras.vue'), meta: { roles: ['TEACHER','STUDENT','ADMIN'] } },
      { path: 'calendar', component: () => import('@/views/shared/Calendar.vue') },
      { path: 'analytics', component: () => import('@/views/teacher/Analytics.vue'), meta: { roles: ['TEACHER','ADMIN'] } },
      { path: 'payments', component: () => import('@/views/shared/Payments.vue'), meta: { roles: ['TEACHER','ADMIN'] } },
      { path: 'notifications', component: () => import('@/views/shared/Notifications.vue') },
      { path: 'profile', component: () => import('@/views/shared/Profile.vue') },

      // Student
      { path: 'student/dashboard', component: () => import('@/views/student/StudentDashboard.vue'), meta: { roles: ['STUDENT'] } },
      { path: 'student/grades', component: () => import('@/views/student/StudentGrades.vue'), meta: { roles: ['STUDENT'] } },
      { path: 'student/assignments', component: () => import('@/views/student/StudentAssignments.vue'), meta: { roles: ['STUDENT'] } },
      { path: 'student/quizzes', component: () => import('@/views/student/StudentQuizzes.vue'), meta: { roles: ['STUDENT'] } },
      { path: 'student/attendance', component: () => import('@/views/student/StudentAttendance.vue'), meta: { roles: ['STUDENT'] } },

      // Admin
      { path: 'admin/dashboard', component: () => import('@/views/admin/AdminDashboard.vue'), meta: { roles: ['ADMIN'] } },
      { path: 'admin/users', component: () => import('@/views/admin/Users.vue'), meta: { roles: ['ADMIN'] } },
      { path: 'admin/courses', component: () => import('@/views/admin/Courses.vue'), meta: { roles: ['ADMIN'] } },
      { path: 'admin/revenue', component: () => import('@/views/admin/Revenue.vue'), meta: { roles: ['ADMIN'] } },
      { path: 'admin/operations', component: () => import('@/views/admin/Operations.vue'), meta: { roles: ['ADMIN'] } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach((to, from, next) => {
  const auth = useAuthStore();
  if (to.meta.public) return next();
  if (!auth.isAuthenticated) return next('/login');
  if (to.meta.roles && !to.meta.roles.includes(auth.role)) {
    if (auth.isStudent) return next('/student/dashboard');
    if (auth.isAdmin) return next('/admin/dashboard');
    return next('/dashboard');
  }
  next();
});

export default router;
