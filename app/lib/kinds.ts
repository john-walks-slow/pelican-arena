/** The kind of work a prompt asks for and the file its answers are stored as. */
export const PROMPT_KINDS = ["web", "markdown", "svg"] as const;
export type PromptKind = (typeof PROMPT_KINDS)[number];

interface KindMeta {
  label: string;
  description: string;
  entry: string;
  extension: string;
  accept: string;
  resultTitle: string;
  placeholder: string;
}

export const KIND_META: Record<PromptKind, KindMeta> = {
  web: {
    label: "网页",
    description: "单个 HTML 或 zip，直接运行",
    entry: "index.html",
    extension: "html",
    accept: ".html,.htm,.zip,text/html,application/zip",
    resultTitle: "结果网页",
    placeholder: "Generate an SVG of a pelican riding a bicycle, as a single HTML page.",
  },
  markdown: {
    label: "Markdown",
    description: "纯文本回答，按 Markdown 排版",
    entry: "index.md",
    extension: "md",
    accept: ".md,.markdown,.txt,text/markdown,text/plain",
    resultTitle: "Markdown 文档",
    placeholder: "写一篇介绍……的文章，使用 Markdown，保留小标题与代码块。",
  },
  svg: {
    label: "SVG",
    description: "单张矢量图",
    entry: "index.svg",
    extension: "svg",
    accept: ".svg,image/svg+xml",
    resultTitle: "SVG 图片",
    placeholder: "Generate an SVG of a pelican riding a bicycle.",
  },
};

export function isPromptKind(value: string | null | undefined): value is PromptKind {
  return PROMPT_KINDS.includes(value as PromptKind);
}
