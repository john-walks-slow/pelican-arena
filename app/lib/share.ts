export type ShareFormat = "forum" | "markdown" | "html" | "link";

export const SHARE_FORMATS: readonly { value: ShareFormat; label: string }[] = [
  { value: "forum", label: "论坛卡片 (推荐)" },
  { value: "markdown", label: "Markdown" },
  { value: "html", label: "HTML" },
  { value: "link", label: "链接" },
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
    case "forum":
      // 与 hb.lafi.sh 格式 1:1 对齐，Discourse/L站完全免转存、原生直接渲染为精美卡片
      return `<a href="${pageUrl}">\n<picture><source type="image/svg+xml" srcset="${cardUrl} 1x"><img width="600" height="315" alt="${escapeAttr(title)}"></picture>\n</a>`;
    case "markdown":
      return `[![${escapeMdAlt(title)}](${cardUrl})](${pageUrl})`;
    case "html":
      return `<a href="${pageUrl}"><img src="${cardUrl}" width="600" height="315" alt="${escapeAttr(title)}"></a>`;
    case "link":
      return pageUrl;
  }
}
