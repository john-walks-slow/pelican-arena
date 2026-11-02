export type ShareFormat = "card" | "markdown";

export const SHARE_FORMATS: readonly { value: ShareFormat; label: string }[] = [
  { value: "card", label: "实况卡片" },
  { value: "markdown", label: "Markdown" },
];

export interface ShareTarget {
  pageUrl: string;
  cardUrl: string;
  title: string;
}

const escapeAttr = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const escapeMdAlt = (s: string) => s.replace(/[[\]\\]/g, "\\$&");

export function shareSnippet({ pageUrl, cardUrl, title }: ShareTarget, format: ShareFormat) {
  switch (format) {
    case "card":
      // Discourse 原生渲染 <picture>，发帖后直接显示卡片
      return `<a href="${pageUrl}">\n<picture><source type="image/svg+xml" srcset="${cardUrl} 1x"><img width="600" height="380" alt="${escapeAttr(title)}"></picture>\n</a>`;
    case "markdown":
      return `[![${escapeMdAlt(title)}](${cardUrl})](${pageUrl})`;
  }
}
