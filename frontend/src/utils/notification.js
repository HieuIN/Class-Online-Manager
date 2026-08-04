import dayjs from 'dayjs';
import 'dayjs/locale/vi';

export function notificationContent(content) {
  return String(content || '')
    .replace(/^(?:session_id|assignment_id)=\d+;(?:start_at=[^;]*;)?(?:end_at=[^;]*;)?(?:[^;]+;)?\s*/i, '')
    .replace('Chưa có link Zoom/Meet.', 'Giáo viên chưa cập nhật đường dẫn phòng học.');
}

function contentValue(content, key) {
  return String(content || '').match(new RegExp(`(?:^|;)${key}=([^;]*)`))?.[1] || '';
}

export function notificationSchedule(notification) {
  if ((notification?.notifType || notification?.notif_type) !== 'REMINDER') return '';
  const content = notification?.content || '';
  const explicitStart = contentValue(content, 'start_at');
  const timeMatch = content.match(/bắt đầu lúc\s+(\d{1,2}:\d{2})/i);
  const fallbackDate = notification?.createdAt || notification?.created_at;
  const start = explicitStart
    ? dayjs(explicitStart)
    : (fallbackDate && timeMatch ? dayjs(`${dayjs(String(fallbackDate).replace(/Z$/, '')).format('YYYY-MM-DD')}T${timeMatch[1]}`) : null);
  if (!start?.isValid()) return '';

  const explicitEnd = contentValue(content, 'end_at');
  const end = explicitEnd ? dayjs(explicitEnd) : null;
  const now = dayjs();
  const minutes = Math.ceil(start.diff(now) / 60000);
  let countdown = '';
  if (minutes > 0) countdown = `Còn ${minutes} phút`;
  else if (end?.isValid() && now.isBefore(end)) countdown = 'Đang diễn ra';
  else countdown = 'Đã bắt đầu';

  const range = end?.isValid()
    ? `${start.format('HH:mm')}–${end.format('HH:mm')}`
    : start.format('HH:mm');
  return `${start.locale('vi').format('dddd, DD/MM/YYYY')} · ${range} · ${countdown}`;
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
