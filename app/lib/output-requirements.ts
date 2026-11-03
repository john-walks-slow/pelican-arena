import type { PromptKind } from "./kinds";

export interface PromptRequirementsOptions {
  allowSearch?: boolean;
}

export const OUTPUT_REQUIREMENTS_TITLE = "输出要求";
export const SKILL_DISALLOW_RULE = "禁止读取 Skill。";

export function outputRequirements(
  kind: PromptKind,
  options: PromptRequirementsOptions = {},
): string[] {
  const allowSearch = Boolean(options.allowSearch);
  const searchRule = allowSearch ? "允许进行网络搜索。" : "禁止进行网络搜索。";

  if (kind === "web") {
    return [
      "输出单个 HTML 文件，CSS 与 JavaScript 内联；需要多文件时打包成 zip，入口为 index.html。",
      "按 1280×800 的桌面视口设计，首屏就要呈现主要效果。",
      "可以使用 Canvas、WebGL、CSS 动画、ES module，以及公开 CDN 上的库。",
      SKILL_DISALLOW_RULE,
      searchRule,
      "页面运行在沙箱中：localStorage、Cookie、IndexedDB、Service Worker、摄像头、麦克风、定位和剪贴板都不可用。",
      "外部请求仅限开放 CORS、无需登录的接口。",
    ];
  }

  if (kind === "markdown") {
    return [
      "直接输出文本回复，使用标准 Markdown 语法，支持表格与代码块。",
      "全文会被直接排版展示，不要省略内容或用「同上」代替。",
      SKILL_DISALLOW_RULE,
      searchRule,
    ];
  }

  // svg
  return [
    "输出单个 SVG 文件，根元素为 <svg> 并带有 viewBox。",
    "以静态图片展示，不执行脚本，也不要引用外部图片或字体。",
    SKILL_DISALLOW_RULE,
    searchRule,
  ];
}

/** The prompt exactly as a model receives it: the author's text, then the output requirements. */
export function promptWithRequirements(
  body: string,
  kind: PromptKind,
  options: PromptRequirementsOptions = {},
): string {
  const notes = outputRequirements(kind, options)
    .map((item) => `- ${item}`)
    .join("\n");
  return `${body.trim()}\n\n---\n\n**${OUTPUT_REQUIREMENTS_TITLE}**\n\n${notes}`;
}
