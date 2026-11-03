import type { PromptKind } from "./kinds";

/** Output requirements every prompt carries, so answers run inside the sandbox. */
const NOTES: Record<PromptKind, string[]> = {
  web: [
    "输出单个 HTML 文件，CSS 与 JavaScript 内联；需要多文件时打包成 zip，入口为 index.html。",
    "按 1280×800 的桌面视口设计，首屏就要呈现主要效果。",
    "可以使用 Canvas、WebGL、CSS 动画、ES module，以及公开 CDN 上的库。",
    "页面运行在沙箱中：localStorage、Cookie、IndexedDB、Service Worker、摄像头、麦克风、定位和剪贴板都不可用。",
    "外部请求仅限开放 CORS、无需登录的接口。",
  ],
  markdown: [
    "直接输出文本回复，使用标准 Markdown 语法，支持表格与代码块。",
    "全文会被直接排版展示，不要省略内容或用「同上」代替。",
  ],
  svg: [
    "输出单个 SVG 文件，根元素为 <svg> 并带有 viewBox。",
    "以静态图片展示，不执行脚本，也不要引用外部图片或字体。",
  ],
};

export const OUTPUT_REQUIREMENTS_TITLE = "输出要求";

export function outputRequirements(kind: PromptKind): string[] {
  return NOTES[kind];
}

/** The prompt exactly as a model receives it: the author's text, then the output requirements. */
export function promptWithRequirements(body: string, kind: PromptKind): string {
  const notes = outputRequirements(kind)
    .map((item) => `- ${item}`)
    .join("\n");
  return `${body.trim()}\n\n---\n\n**${OUTPUT_REQUIREMENTS_TITLE}**\n\n${notes}`;
}
