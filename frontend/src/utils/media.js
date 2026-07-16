const apiBase = String(import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const apiOrigin = /^https?:\/\//i.test(apiBase) ? apiBase.replace(/\/api$/, '') : '';

export function mediaUrl(url) {
  if (!url || /^(https?:\/\/|blob:|data:)/i.test(url)) return url;
  if (url.startsWith('/uploads/') && apiOrigin) return `${apiOrigin}${url}`;
  return url;
}
