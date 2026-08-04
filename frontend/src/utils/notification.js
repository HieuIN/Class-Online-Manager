import dayjs from 'dayjs';

export function notificationContent(content) {
  return String(content || '')
    .replace(/^(?:session_id|assignment_id)=\d+;(?:[^;]+;)?\s*/i, '')
    .replace('Chưa có link Zoom/Meet.', 'Giáo viên chưa cập nhật đường dẫn phòng học.');
}

export function notificationTime(value) {
  if (!value) return '';
  // Database timestamps are local wall-clock values but may be serialized with Z.
  return dayjs(String(value).replace(/Z$/, '')).format('DD/MM/YYYY HH:mm');
}

export function notificationTarget(notification, role) {
  const type = notification?.notifType || notification?.notif_type || '';
  const related = notification?.relatedUrl || notification?.related_url || '';
  if (related.startsWith('/')) return related;
  if (type === 'REMINDER') return '/calendar';
  if (type === 'ASSIGNMENT_PUBLISHED' || type === 'ASSIGNMENT_DUE' || type === 'ALERT_HOMEWORK') {
    return role === 'STUDENT' ? '/student/assignments' : '/assignments';
  }
  if (type === 'ALERT_ABSENCE') return role === 'STUDENT' ? '/student/attendance' : '/attendance';
  return '/notifications';
}

