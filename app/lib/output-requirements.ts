import type { PromptKind } from "./kinds";

export interface PromptRequirementsOptions {
  allowSearch?: boolean;
  allowLibraries?: boolean;
}

export const OUTPUT_REQUIREMENTS_TITLE = "输出要求";

export function outputRequirements(
  kind: PromptKind,
  options: PromptRequirementsOptions = {},
): string[] {
  const allowSearch = Boolean(options.allowSearch);
  const allowLibraries = Boolean(options.allowLibraries);

  const searchRule = allowSearch
    ? "允许联网搜索查阅资料。"
    : "禁止联网搜索，仅基于模型自身知识回答。";

  if (kind === "web") {
    const libraryRule = allowLibraries
      ? "可以使用 Canvas、WebGL、CSS 动画、ES module，以及公开 CDN 上的库。"
      : "禁止使用任何外部库或框架，全部使用原生 HTML、CSS 与 JavaScript 实现（可使用 Canvas、WebGL、CSS 动画等原生特性）。";

    return [
      "输出单个 HTML 文件，CSS 与 JavaScript 内联；需要多文件时打包成 zip，入口为 index.html。",
      "按 1280×800 的桌面视口设计，首屏就要呈现主要效果。",
      libraryRule,
      searchRule,
      "页面运行在沙箱中：localStorage、Cookie、IndexedDB、Service Worker、摄像头、麦克风、定位和剪贴板都不可用。",
      "外部请求仅限开放 CORS、无需登录的接口。",
    ];
  }

  if (kind === "markdown") {
    const libraryRule = allowLibraries
      ? "允许引用或推荐外部库与第三方依赖。"
      : "禁止依赖或引入外部第三方库，仅使用原生或标准库能力。";

    return [
      "直接输出文本回复，使用标准 Markdown 语法，支持表格与代码块。",
      "全文会被直接排版展示，不要省略内容或用「同上」代替。",
      libraryRule,
      searchRule,
    ];
  }

  // svg
  const libraryRule = allowLibraries
    ? "以静态图片展示，不执行脚本；可引用公开字体与外部样式。"
    : "以静态图片展示，不执行脚本，禁止引用任何外部库、外部图片或字体。";

  return [
    "输出单个 SVG 文件，根元素为 <svg> 并带有 viewBox。",
    libraryRule,
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
