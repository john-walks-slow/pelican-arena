import { KIND_META, type PromptKind } from "./kinds";

export const CARD_WIDTH = 600;
export const CARD_HEIGHT = 315;

const PADDING = 36;
const CONTENT_WIDTH = CARD_WIDTH - PADDING * 2;
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif`;

// Mirrors the design tokens in app.css; a standalone SVG cannot read CSS variables.
const COLOR = {
  surface: "#ffffff",
  border: "#e6e8ec",
  raised: "#f2f3f5",
  ink: "#101318",
  muted: "#626874",
  accent: "#c2410c",
};

export interface AnswerCardData {
  model: string;
  provider: string;
  harness: string | null;
  promptTitle: string;
  kind: PromptKind;
  starSum: number;
  votes: number;
  author: string;
}

export interface PromptCardData {
  title: string;
  body: string;
  kind: PromptKind;
  answers: number;
  author: string;
}

export function escapeXml(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Width in px at `size`, treating CJK and emoji as full-width and the rest as roughly half. */
function textWidth(text: string, size: number, bold = false) {
  let units = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp > 0x2e80) units += 1;
    else if (/[A-Z0-9MW@%]/.test(ch)) units += bold ? 0.68 : 0.62;
    else if (/[ilIjt.,:;'|!]/.test(ch)) units += 0.3;
    else units += bold ? 0.58 : 0.53;
  }
  return units * size;
}

function fit(text: string, maxWidth: number, size: number, bold = false) {
  if (textWidth(text, size, bold) <= maxWidth) return text;
  const chars = [...text];
  while (chars.length > 0 && textWidth(`${chars.join("")}…`, size, bold) > maxWidth) chars.pop();
  return `${chars.join("").trimEnd()}…`;
}

function wrap(text: string, maxWidth: number, size: number, maxLines: number, bold = false) {
  const rows: string[] = [];
  let row = "";
  const chars = [...text.replace(/\s+/g, " ").trim()];
  let i = 0;
  for (; i < chars.length; i++) {
    if (textWidth(row + chars[i], size, bold) > maxWidth && row) {
      if (rows.length === maxLines - 1) break;
      rows.push(row.trimEnd());
      row = chars[i] === " " ? "" : chars[i];
    } else row += chars[i];
  }
  rows.push(i < chars.length ? fit(`${row}${chars.slice(i).join("")}`, maxWidth, size, bold) : row);
  return rows;
}

/** Plain text for the prompt excerpt: Markdown syntax removed, code blocks dropped. */
export function plainExcerpt(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[#>\-*+\d.\s]+/gm, "")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function text(
  x: number,
  y: number,
  value: string,
  attrs: { size: number; fill: string; weight?: number; anchor?: "start" | "middle" | "end" },
) {
  return `<text x="${x}" y="${y}" font-size="${attrs.size}" font-weight="${attrs.weight ?? 400}" fill="${attrs.fill}"${
    attrs.anchor ? ` text-anchor="${attrs.anchor}"` : ""
  }>${escapeXml(value)}</text>`;
}

function lines(x: number, y: number, rows: string[], size: number, lineHeight: number, fill: string, weight = 400) {
  return rows.map((row, i) => text(x, y + i * lineHeight, row, { size, fill, weight })).join("");
}

function header(kind: PromptKind) {
  const label = KIND_META[kind].label;
  const pillWidth = Math.round(textWidth(label, 12) + 20);
  return [
    `<g transform="translate(${PADDING} 22) scale(0.75)" fill="none" stroke="${COLOR.ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`,
    `<circle cx="9" cy="23" r="5.5"/><circle cx="23" cy="23" r="5.5"/>`,
    `<path d="M9 23l5-8h7l2 8M14 15c-1.5-3 0-6.5 3.5-6.5 2 0 3 1 3.5 2.5l8 1.5c-1.5 2-5 2.6-8 1.8"/>`,
    `</g>`,
    text(PADDING + 30, 40, "Pelican Arena", { size: 14, fill: COLOR.ink, weight: 600 }),
    `<rect x="${CARD_WIDTH - PADDING - pillWidth}" y="24" width="${pillWidth}" height="22" rx="11" fill="${COLOR.raised}"/>`,
    text(CARD_WIDTH - PADDING - pillWidth / 2, 39.5, label, { size: 12, fill: COLOR.muted, anchor: "middle" }),
  ].join("");
}

const STAR_PATH = "M8 1.2l2.1 4.5 4.9.6-3.6 3.4.9 4.9L8 12.2l-4.3 2.4.9-4.9L1 6.3l4.9-.6z";

function footer(left: string, ...right: string[]) {
  const y = CARD_HEIGHT - 28;
  return [
    `<line x1="${PADDING}" y1="${y - 22}" x2="${CARD_WIDTH - PADDING}" y2="${y - 22}" stroke="${COLOR.border}"/>`,
    text(PADDING, y, left, { size: 13, fill: COLOR.muted }),
    ...right,
  ].join("");
}

function frame(label: string, body: string) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" font-family="${FONT}" role="img" aria-label="${escapeXml(label)}">`,
    `<rect x=".5" y=".5" width="${CARD_WIDTH - 1}" height="${CARD_HEIGHT - 1}" rx="14" fill="${COLOR.surface}" stroke="${COLOR.border}"/>`,
    body,
    `</svg>`,
  ].join("");
}

export function renderAnswerCard(d: AnswerCardData) {
  const subtitle = [d.provider, d.harness].filter(Boolean).join(" · ");
  const average = d.votes === 0 ? null : (d.starSum / d.votes).toFixed(1);
  const modelLines = wrap(d.model, CONTENT_WIDTH, 34, 2, true);
  const modelY = 150;
  const subtitleY = modelY + (modelLines.length - 1) * 40 + 30;

  const baseline = CARD_HEIGHT - 28;
  let score = text(CARD_WIDTH - PADDING, baseline, "暂无评分", { size: 13, fill: COLOR.muted, anchor: "end" });
  if (average !== null) {
    const votesLabel = `${d.votes} 票`;
    const averageRight = CARD_WIDTH - PADDING - Math.ceil(textWidth(votesLabel, 13)) - 10;
    const starX = averageRight - Math.ceil(textWidth(average, 20, true)) - 24;
    score = [
      text(CARD_WIDTH - PADDING, baseline, votesLabel, { size: 13, fill: COLOR.muted, anchor: "end" }),
      text(averageRight, baseline + 1, average, { size: 20, fill: COLOR.ink, weight: 700, anchor: "end" }),
      `<path transform="translate(${starX} ${baseline - 16})" d="${STAR_PATH}" fill="${COLOR.accent}"/>`,
    ].join("");
  }

  return frame(
    `${d.model} · ${subtitle} — ${d.promptTitle}`,
    [
      header(d.kind),
      text(PADDING, 104, fit(d.promptTitle, CONTENT_WIDTH, 14), { size: 14, fill: COLOR.muted }),
      lines(PADDING, modelY, modelLines, 34, 40, COLOR.ink, 700),
      subtitle && text(PADDING, subtitleY, fit(subtitle, CONTENT_WIDTH, 16), { size: 16, fill: COLOR.muted }),
      footer(`提交者 ${fit(d.author, 200, 13)}`, score),
    ].join(""),
  );
}

export function renderPromptCard(d: PromptCardData) {
  const titleLines = wrap(d.title, CONTENT_WIDTH, 26, 2, true);
  const excerptY = 100 + titleLines.length * 34;
  const excerptLines = wrap(plainExcerpt(d.body), CONTENT_WIDTH, 14, titleLines.length === 1 ? 4 : 3);
  return frame(
    d.title,
    [
      header(d.kind),
      lines(PADDING, 120, titleLines, 26, 34, COLOR.ink, 700),
      lines(PADDING, excerptY + 14, excerptLines, 14, 22, COLOR.muted),
      footer(
        `出题者 ${fit(d.author, 200, 13)}`,
        text(CARD_WIDTH - PADDING, CARD_HEIGHT - 28, d.answers === 0 ? "还没有答案" : `${d.answers} 份答案`, {
          size: 13,
          fill: COLOR.ink,
          weight: 600,
          anchor: "end",
        }),
      ),
    ].join(""),
  );
}
