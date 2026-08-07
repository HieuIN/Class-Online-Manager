export const meetingUrl = (item) => item?.meetingUrl || item?.meeting_url || '';

export const isZoomMeeting = (item) => {
  try { return /(^|\.)zoom\.us$/i.test(new URL(meetingUrl(item)).hostname); }
  catch { return false; }
};

export const joinMeeting = (router, item) => {
  const url = meetingUrl(item);
  if (!url) return;
  if (isZoomMeeting(item) && item?.id) {
    router.push({ path: `/live-class/${item.id}`, query: { fallback: url } });
    return;
  }
  window.open(url, '_blank', 'noopener');
};
