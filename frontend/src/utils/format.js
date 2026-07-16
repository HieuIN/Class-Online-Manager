export const fmtMoney = (n) => new Intl.NumberFormat('vi-VN').format(n || 0) + ' ₫';

export const fmtDate = (d) => {
  if (!d) return '—';
  const dateOnly = String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  const date = new Date(d);
  return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;
};

export const fmtDateTime = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return fmtDate(d) + ' ' + String(date.getHours()).padStart(2,'0') + ':' + String(date.getMinutes()).padStart(2,'0');
};

export const gradeClassify = (avg) => {
  if (avg == null) return { label: '—', cls: 'badge-gray' };
  const v = +avg;
  if (v >= 8.5) return { label: 'Giỏi', cls: 'badge-green' };
  if (v >= 7) return { label: 'Khá', cls: 'badge-blue' };
  if (v >= 5) return { label: 'TB', cls: 'badge-amber' };
  return { label: 'Yếu', cls: 'badge-red' };
};

export const submissionBadge = (status) => ({
  GRADED: { label: 'Đã chấm', cls: 'badge-green' },
  SUBMITTED: { label: 'Đã nộp', cls: 'badge-blue' },
  REVISION_REQUIRED: { label: 'Cần sửa', cls: 'badge-amber' },
  NOT_SUBMITTED: { label: 'Chưa nộp', cls: 'badge-gray' },
}[status] || { label: status, cls: 'badge-gray' });

export const attendanceBadge = (status) => ({
  PRESENT: { label: 'Có mặt', cls: 'badge-green', short: '✓' },
  ABSENT: { label: 'Vắng', cls: 'badge-red', short: '✗' },
  LATE: { label: 'Đi muộn', cls: 'badge-amber', short: 'T' },
  LEFT_EARLY: { label: 'Về sớm', cls: 'badge-amber', short: 'S' },
}[status] || { label: status, cls: 'badge-gray', short: '?' });

export const paymentBadge = (status) => ({
  PAID: { label: 'Đã đóng', cls: 'badge-green' },
  PARTIAL: { label: 'Một phần', cls: 'badge-amber' },
  PENDING: { label: 'Chưa đóng', cls: 'badge-red' },
}[status] || { label: status, cls: 'badge-gray' });

export const initials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[parts.length-2][0] + parts[parts.length-1][0]).toUpperCase() : parts[0][0].toUpperCase();
};
