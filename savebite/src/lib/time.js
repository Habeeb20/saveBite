export function timeAgo(date) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  const m = Math.max(1, Math.floor(s / 60));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d` : `${Math.floor(d / 7)}w`;
}

export function lastSeenText(date) {
  if (!date) return "Offline";
  return `Last seen ${timeAgo(date)} ago`;
}

export const clock = (date) =>
  new Date(date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
