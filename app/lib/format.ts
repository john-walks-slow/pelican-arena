export function avatarUrl(template: string | null | undefined, size = 48) {
  if (!template) return null;
  const url = template.replace("{size}", String(size));
  return url.startsWith("http") ? url : `https://linux.do${url}`;
}

export function formatCount(n: number) {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export function formatDuration(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} 秒`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} 分 ${s % 60} 秒`;
  return `${Math.floor(m / 60)} 小时 ${m % 60} 分`;
}

const rtf = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });

export function formatRelative(date: Date | string | number, now = Date.now()) {
  const t = new Date(date).getTime();
  const diff = (t - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "刚刚";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return new Date(t).toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
}

export function formatStars(starSum: number, votes: number) {
  return votes === 0 ? "—" : (starSum / votes).toFixed(1);
}

export const REASONING_LABELS = {
  off: "不思考",
  low: "低",
  medium: "中",
  high: "高",
} as const;
