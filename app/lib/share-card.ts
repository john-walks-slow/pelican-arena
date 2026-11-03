import { KIND_META, type PromptKind } from "./kinds";

export const CARD_WIDTH = 600;
export const CARD_HEIGHT = 400;
export const ARTWORK_HEIGHT = 315;

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif`;

const COLOR = {
  surface: "#ffffff",
  border: "#e5e7eb",
  outerBorder: "#e2e4e8",
  ink: "#111827",
  muted: "#6b7280",
  faint: "#9ca3af",
  accent: "#c2410c",
  btnBg: "#18181b",
};

export interface AnswerCardData {
  model: string;
  provider: string;
  harness: string | null;
  promptTitle: string;
  kind: PromptKind;
  starSum: number;
  votes: number;
  author?: string;
  previewImage?: string | null;
}

export interface PromptSubmissionPreview {
  modelName: string;
  previewImage?: string | null;
}

export interface PromptCardData {
  title: string;
  body: string;
  kind: PromptKind;
  answers: number;
  author?: string;
  topSubmissions?: PromptSubmissionPreview[];
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

/** Clean Markdown body for card display: strip code fences, images, links, bullet prefixes, keeping linebreaks. */
export function cleanBody(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[#>\-*+\d.]+\s+/gm, "")
    .replace(/[`*_~]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function wrap(text: string, maxWidth: number, size: number, maxLines: number, bold = false): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\n").map((p) => p.trim()).filter(Boolean);

  for (const para of paragraphs) {
    if (lines.length >= maxLines) break;
    const chars = [...para];
    let row = "";
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (textWidth(row + ch, size, bold) > maxWidth && row) {
        lines.push(row.trimEnd());
        row = ch === " " ? "" : ch;
        if (lines.length === maxLines - 1) {
          const remaining = row + chars.slice(i).join("");
          lines.push(fit(remaining, maxWidth, size, bold));
          row = "";
          break;
        }
      } else {
        row += ch;
      }
    }
    if (row && lines.length < maxLines) {
      lines.push(row.trimEnd());
    }
  }

  return lines.slice(0, maxLines);
}

/** Accent Orange PelicanRide Bike Mark */
function pelicanRideMark(x: number, y: number) {
  return [
    `<g transform="translate(${x} ${y}) scale(0.85)" stroke="${COLOR.accent}" fill="none">`,
    `  <circle cx="9" cy="23" r="5.5" stroke-width="2"/>`,
    `  <line x1="9" y1="18.6" x2="9" y2="27.4" stroke-width="1.25" stroke-linecap="round"/>`,
    `  <line x1="5.19" y1="20.8" x2="12.81" y2="25.2" stroke-width="1.25" stroke-linecap="round"/>`,
    `  <line x1="5.19" y1="25.2" x2="12.81" y2="20.8" stroke-width="1.25" stroke-linecap="round"/>`,
    `  <circle cx="9" cy="23" r="1.15" fill="${COLOR.accent}"/>`,
    `  <circle cx="23" cy="23" r="5.5" stroke-width="2"/>`,
    `  <line x1="23" y1="18.6" x2="23" y2="27.4" stroke-width="1.25" stroke-linecap="round"/>`,
    `  <line x1="19.19" y1="20.8" x2="26.81" y2="25.2" stroke-width="1.25" stroke-linecap="round"/>`,
    `  <line x1="19.19" y1="25.2" x2="26.81" y2="20.8" stroke-width="1.25" stroke-linecap="round"/>`,
    `  <circle cx="23" cy="23" r="1.15" fill="${COLOR.accent}"/>`,
    `  <path d="M9 23l5-8h7l2 8M14 15c-1.5-3 0-6.5 3.5-6.5 2 0 3 1 3.5 2.5l8 1.5c-1.32 2.56-5.24 3.5-8 2.5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    `</g>`,
  ].join("");
}

function cardShell(label: string, artworkContent: string, footerContent: string) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" font-family="${FONT}" role="img" aria-label="${escapeXml(label)}">`,
    `  <defs>`,
    `    <clipPath id="card-top-clip">`,
    `      <path d="M0,14 A14,14 0 0,1 14,0 L586,0 A14,14 0 0,1 600,14 L600,${ARTWORK_HEIGHT} L0,${ARTWORK_HEIGHT} Z" />`,
    `    </clipPath>`,
    `    <clipPath id="card-outer-clip">`,
    `      <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="14" />`,
    `    </clipPath>`,
    `  </defs>`,
    `  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="14" fill="${COLOR.surface}" />`,
    `  <!-- Top Artwork Section (1200:630 ratio equivalent to 600:315) -->`,
    `  <g clip-path="url(#card-top-clip)">`,
    `    <rect width="${CARD_WIDTH}" height="${ARTWORK_HEIGHT}" fill="#fafafa" />`,
    artworkContent,
    `  </g>`,
    pelicanRideMark(14, 12),
    `  <!-- Separator Line -->`,
    `  <line x1="0" y1="${ARTWORK_HEIGHT}" x2="${CARD_WIDTH}" y2="${ARTWORK_HEIGHT}" stroke="${COLOR.border}" stroke-width="1" />`,
    `  <!-- Bottom Info Bar -->`,
    footerContent,
    `  <!-- Card Outer Border -->`,
    `  <rect x="0.5" y="0.5" width="${CARD_WIDTH - 1}" height="${CARD_HEIGHT - 1}" rx="13.5" fill="none" stroke="${COLOR.outerBorder}" stroke-width="1" />`,
    `</svg>`,
  ].join("\n");
}

export function renderAnswerCard(d: AnswerCardData) {
  const subtitle = [d.provider, d.harness].filter(Boolean).join(" · ");
  const average = d.votes === 0 ? null : (d.starSum / d.votes).toFixed(1);

  // Artwork
  let artwork = "";
  if (d.previewImage) {
    artwork = `<image href="${d.previewImage}" x="0" y="0" width="${CARD_WIDTH}" height="${ARTWORK_HEIGHT}" preserveAspectRatio="xMidYMid slice" />`;
  } else {
    artwork = [
      `<rect width="${CARD_WIDTH}" height="${ARTWORK_HEIGHT}" fill="#f8fafc" />`,
      `<text x="${CARD_WIDTH / 2}" y="${ARTWORK_HEIGHT / 2}" font-size="14" fill="${COLOR.faint}" font-weight="500" text-anchor="middle">${escapeXml(KIND_META[d.kind].label)}作品预览</text>`,
    ].join("");
  }

  // Footer Right: Rating & Button
  const btnText = "你会打几分 →";
  const btnWidth = Math.ceil(textWidth(btnText, 11, true)) + 22;
  const btnX = CARD_WIDTH - 24 - btnWidth;

  const scoreText = average !== null ? average : "暂无评分";
  const votesLabel = d.votes > 0 ? `${d.votes} 票` : "未评分";

  let ratingContent = "";
  if (average !== null) {
    const votesW = Math.ceil(textWidth(votesLabel, 11));
    const scoreW = Math.ceil(textWidth(scoreText, 14, true));
    const scoreRight = -(votesW + 8);
    const starRight = scoreRight - scoreW - 6;

    ratingContent = [
      `    <path d="M${starRight - 6} -9 l1.8 3.6 4 .5 -2.9 2.8 .7 4 -3.6 -1.9 -3.6 1.9 .7 -4 -2.9 -2.8 4 -.5 z" fill="#f97316" stroke="#ea580c" stroke-width="0.5" />`,
      `    <text x="${scoreRight}" y="0" font-size="14" font-weight="700" fill="${COLOR.ink}">${scoreText}</text>`,
      `    <text x="0" y="0" font-size="11" font-weight="400" fill="${COLOR.muted}">${votesLabel}</text>`,
    ].join("\n");
  } else {
    ratingContent = `    <text x="0" y="0" font-size="12" font-weight="500" fill="${COLOR.faint}">暂无评分</text>`;
  }

  const footerRight = [
    `  <g transform="translate(${CARD_WIDTH - 24} 347)" text-anchor="end">`,
    ratingContent,
    `  </g>`,
    `  <!-- Button -->`,
    `  <rect x="${btnX}" y="358" width="${btnWidth}" height="26" rx="6" fill="${COLOR.btnBg}" />`,
    `  <text x="${btnX + btnWidth / 2}" y="375" font-size="11" font-weight="600" fill="#ffffff" text-anchor="middle">${btnText}</text>`,
  ].join("\n");

  // Footer Left: Title, Model, Provider
  const maxLeftWidth = btnX - 44;
  const promptTitleFit = fit(d.promptTitle, maxLeftWidth, 12);
  const modelNameFit = fit(d.model, maxLeftWidth, 17, true);
  const subtitleFit = fit(subtitle, maxLeftWidth, 11);

  const footerLeft = [
    `  <text x="24" y="340" font-size="12" fill="${COLOR.muted}" font-weight="400">${escapeXml(promptTitleFit)}</text>`,
    `  <text x="24" y="362" font-size="17" fill="${COLOR.ink}" font-weight="800">${escapeXml(modelNameFit)}</text>`,
    subtitleFit
      ? `  <text x="24" y="380" font-size="11" fill="${COLOR.faint}" font-weight="400">${escapeXml(subtitleFit)}</text>`
      : "",
  ].join("\n");

  return cardShell(
    `${d.model} · ${subtitle} — ${d.promptTitle}`,
    artwork,
    `${footerLeft}\n${footerRight}`,
  );
}

export function renderPromptCard(d: PromptCardData) {
  const isTextPrompt = d.kind === "markdown";
  const top = (d.topSubmissions || []).slice(0, 3);
  const hasSubmissions = d.answers > 0 || top.length > 0;

  // Footer Right: Counts & Button
  const btnText = isTextPrompt
    ? hasSubmissions
      ? "看看谁答得最好 →"
      : "来答这道题 →"
    : hasSubmissions
      ? "看看谁画得最好 →"
      : "来答这道题 →";
  const btnWidth = Math.ceil(textWidth(btnText, 11, true)) + 22;
  const btnX = CARD_WIDTH - 24 - btnWidth;

  const countDisplay = d.answers === 0 ? "还没有答案" : `${d.answers} 份答案`;

  const footerRight = [
    `  <g transform="translate(${CARD_WIDTH - 24} 347)" text-anchor="end">`,
    `    <text x="0" y="0" font-size="12" font-weight="600" fill="${COLOR.ink}"><tspan font-weight="800" fill="${COLOR.accent}">${d.answers}</tspan> 个模型同题作答 (${countDisplay})</text>`,
    `  </g>`,
    `  <!-- Button -->`,
    `  <rect x="${btnX}" y="358" width="${btnWidth}" height="26" rx="6" fill="${COLOR.btnBg}" />`,
    `  <text x="${btnX + btnWidth / 2}" y="375" font-size="11" font-weight="600" fill="#ffffff" text-anchor="middle">${btnText}</text>`,
  ].join("\n");

  let artwork = "";
  let footerLeft = "";

  if (isTextPrompt) {
    // 文本题目：不分栏，直接在上方大尺寸卡片区域清晰展示题目内容
    const contentWidth = CARD_WIDTH - 72; // 528px
    const titleLines = wrap(d.title, contentWidth, 18, 2, true);
    const bodyStartY = titleLines.length === 1 ? 116 : 142;
    const maxBodyLines = titleLines.length === 1 ? 7 : 6;
    const bodyLines = wrap(cleanBody(d.body), contentWidth, 13, maxBodyLines, false);

    const pillW = 68;
    const pillH = 22;
    const pillX = CARD_WIDTH - 24 - pillW;

    const parts: string[] = [
      `<rect width="${CARD_WIDTH}" height="${ARTWORK_HEIGHT}" fill="#fafafa" />`,
      `<g transform="translate(${pillX} 16)">`,
      `  <rect width="${pillW}" height="${pillH}" rx="11" fill="rgba(0,0,0,0.04)" stroke="${COLOR.border}" stroke-width="1" />`,
      `  <text x="${pillW / 2}" y="15" font-size="11" font-weight="600" fill="${COLOR.muted}" text-anchor="middle">Markdown</text>`,
      `</g>`,
    ];

    for (let i = 0; i < titleLines.length; i++) {
      const y = (titleLines.length === 1 ? 82 : 72) + i * 26;
      parts.push(
        `<text x="36" y="${y}" font-size="18" font-weight="700" fill="${COLOR.ink}">${escapeXml(titleLines[i])}</text>`,
      );
    }

    for (let i = 0; i < bodyLines.length; i++) {
      const y = bodyStartY + i * 22;
      parts.push(
        `<text x="36" y="${y}" font-size="13" font-weight="400" fill="#374151">${escapeXml(bodyLines[i])}</text>`,
      );
    }

    artwork = parts.join("\n");

    const maxLeftWidth = btnX - 44;
    const authorLabel = d.author ? `出题者 · @${d.author}` : "Pelican Arena · 同题竞技";
    const authorFit = fit(authorLabel, maxLeftWidth, 13, true);

    footerLeft = [
      `  <text x="24" y="352" font-size="13" fill="${COLOR.ink}" font-weight="600">${escapeXml(authorFit)}</text>`,
      `  <text x="24" y="374" font-size="11" fill="${COLOR.muted}" font-weight="400">纯文本回答 · Markdown 排版</text>`,
    ].join("\n");
  } else if (top.length > 0) {
    // 绘图题目（有作品）：按原有设计分栏展示 top 答案作品
    const n = top.length;
    const colW = CARD_WIDTH / n;
    const parts: string[] = [];

    for (let i = 0; i < n; i++) {
      const item = top[i];
      const x = i * colW;
      if (item.previewImage) {
        parts.push(
          `<g transform="translate(${x} 0)">`,
          `  <image href="${item.previewImage}" x="0" y="0" width="${colW}" height="${ARTWORK_HEIGHT}" preserveAspectRatio="xMidYMid slice" />`,
          `</g>`,
        );
      } else {
        parts.push(
          `<rect x="${x}" y="0" width="${colW}" height="${ARTWORK_HEIGHT}" fill="#f8fafc" />`,
          `<text x="${x + colW / 2}" y="${ARTWORK_HEIGHT / 2}" font-size="13" fill="${COLOR.faint}" text-anchor="middle">作品预览</text>`,
        );
      }
      if (i > 0) {
        parts.push(`<line x1="${x}" y1="0" x2="${x}" y2="${ARTWORK_HEIGHT}" stroke="${COLOR.border}" stroke-width="1" />`);
      }
      // Model badge pill at bottom of column
      const pillLabel = fit(item.modelName, colW - 24, 11, true);
      const pillW = Math.min(colW - 20, Math.ceil(textWidth(pillLabel, 11, true)) + 18);
      parts.push(
        `<g transform="translate(${x + 10} ${ARTWORK_HEIGHT - 32})">`,
        `  <rect width="${pillW}" height="22" rx="11" fill="rgba(255,255,255,0.95)" stroke="rgba(0,0,0,0.1)" stroke-width="1" />`,
        `  <text x="${pillW / 2}" y="15" font-size="11" font-weight="600" fill="${COLOR.ink}" text-anchor="middle">${escapeXml(pillLabel)}</text>`,
        `</g>`,
      );
    }
    artwork = parts.join("\n");

    const maxLeftWidth = btnX - 44;
    const titleFit = fit(d.title, maxLeftWidth, 17, true);
    const excerptFit = fit(plainExcerpt(d.body), maxLeftWidth, 11);

    footerLeft = [
      `  <text x="24" y="340" font-size="11" fill="${COLOR.muted}" font-weight="400">题目</text>`,
      `  <text x="24" y="362" font-size="17" fill="${COLOR.ink}" font-weight="800">${escapeXml(titleFit)}</text>`,
      excerptFit
        ? `  <text x="24" y="380" font-size="11" fill="${COLOR.muted}" font-weight="400">${escapeXml(excerptFit)}</text>`
        : "",
    ].join("\n");
  } else {
    // 绘图题目（暂无答案）：展示题目内容
    const contentWidth = CARD_WIDTH - 72;
    const titleLines = wrap(d.title, contentWidth, 18, 2, true);
    const bodyStartY = titleLines.length === 1 ? 116 : 142;
    const maxBodyLines = titleLines.length === 1 ? 7 : 6;
    const bodyLines = wrap(cleanBody(d.body), contentWidth, 13, maxBodyLines, false);

    const label = KIND_META[d.kind]?.label ?? "题目";
    const pillW = Math.round(textWidth(label, 11, true) + 20);
    const pillH = 22;
    const pillX = CARD_WIDTH - 24 - pillW;

    const parts: string[] = [
      `<rect width="${CARD_WIDTH}" height="${ARTWORK_HEIGHT}" fill="#fafafa" />`,
      `<g transform="translate(${pillX} 16)">`,
      `  <rect width="${pillW}" height="${pillH}" rx="11" fill="rgba(0,0,0,0.04)" stroke="${COLOR.border}" stroke-width="1" />`,
      `  <text x="${pillW / 2}" y="15" font-size="11" font-weight="600" fill="${COLOR.muted}" text-anchor="middle">${escapeXml(label)}</text>`,
      `</g>`,
    ];

    for (let i = 0; i < titleLines.length; i++) {
      const y = (titleLines.length === 1 ? 82 : 72) + i * 26;
      parts.push(
        `<text x="36" y="${y}" font-size="18" font-weight="700" fill="${COLOR.ink}">${escapeXml(titleLines[i])}</text>`,
      );
    }

    for (let i = 0; i < bodyLines.length; i++) {
      const y = bodyStartY + i * 22;
      parts.push(
        `<text x="36" y="${y}" font-size="13" font-weight="400" fill="#374151">${escapeXml(bodyLines[i])}</text>`,
      );
    }

    artwork = parts.join("\n");

    const maxLeftWidth = btnX - 44;
    const authorLabel = d.author ? `出题者 · @${d.author}` : "Pelican Arena · 同题竞技";
    const authorFit = fit(authorLabel, maxLeftWidth, 13, true);

    footerLeft = [
      `  <text x="24" y="352" font-size="13" fill="${COLOR.ink}" font-weight="600">${escapeXml(authorFit)}</text>`,
      `  <text x="24" y="374" font-size="11" fill="${COLOR.muted}" font-weight="400">${escapeXml(label)}创作题目</text>`,
    ].join("\n");
  }

  return cardShell(
    d.title,
    artwork,
    `${footerLeft}\n${footerRight}`,
  );
}
