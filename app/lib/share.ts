export type ShareFormat = "link" | "markdown" | "html";

export const SHARE_FORMATS: readonly { value: ShareFormat; label: string }[] = [
  { value: "link", label: "链接" },
  { value: "markdown", label: "Markdown" },
  { value: "html", label: "HTML" },
];

export interface ShareTarget {
  pageUrl: string;
  cardUrl: string;
  /** Alt text for the card image. */
  title: string;
}

const escapeAttr = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const escapeMdAlt = (s: string) => s.replace(/[[\]\\]/g, "\\$&");

export function shareSnippet({ pageUrl, cardUrl, title }: ShareTarget, format: ShareFormat) {
  switch (format) {
    case "link":
      return pageUrl;
    case "markdown":
      return `[![${escapeMdAlt(title)}](${cardUrl})](${pageUrl})`;
    case "html":
      return `<a href="${pageUrl}"><img src="${cardUrl}" width="600" height="315" alt="${escapeAttr(title)}"></a>`;
  }
}
