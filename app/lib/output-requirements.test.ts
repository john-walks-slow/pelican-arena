import { describe, expect, it } from "vitest";
import {
  OUTPUT_REQUIREMENTS_TITLE,
  outputRequirements,
  promptWithRequirements,
} from "./output-requirements";

describe("outputRequirements", () => {
  it("defaults to disallowing search and enabling external libraries for web prompts", () => {
    const rules = outputRequirements("web");
    expect(rules).toContain("禁止进行网络搜索。");
    expect(rules).toContain("禁止读取 Skill。");
    expect(rules).toContain("首屏就要呈现主要效果，不要用引导页占位。");
    expect(rules).toContain(
      "可以使用 Canvas、WebGL、CSS 动画；如需第三方库，直接使用公开 CDN 的完整链接引入，不要使用 import map。",
    );
  });

  it("disables external libraries for web when allowLibraries is false", () => {
    const rules = outputRequirements("web", { allowLibraries: false });
    expect(rules).toContain(
      "禁止使用任何外部库或框架，全部使用原生 HTML、CSS 与 JavaScript 实现（可使用 Canvas、WebGL、CSS 动画等原生特性）。",
    );
    expect(rules).not.toContain(
      "可以使用 Canvas、WebGL、CSS 动画；如需第三方库，直接使用公开 CDN 的完整链接引入，不要使用 import map。",
    );
  });

  it("enables search when allowSearch is true and still disallows Skill", () => {
    const rules = outputRequirements("web", { allowSearch: true });
    expect(rules).toContain("允许进行网络搜索。");
    expect(rules).toContain("禁止读取 Skill。");
    expect(rules).not.toContain("禁止进行网络搜索。");
  });

  it("formats markdown requirements with allowSearch and without library rule", () => {
    const defaultRules = outputRequirements("markdown");
    expect(defaultRules).toContain("禁止进行网络搜索。");
    expect(defaultRules).toContain("禁止读取 Skill。");
    expect(defaultRules).toContain(
      "直接输出文本回复，使用标准 Markdown 语法，支持表格与代码块。",
    );

    // Markdown ignores allowLibraries option
    const rulesWithOptions = outputRequirements("markdown", {
      allowSearch: true,
      allowLibraries: false,
    });
    expect(rulesWithOptions).toContain("允许进行网络搜索。");
    expect(rulesWithOptions).toContain("禁止读取 Skill。");
    expect(
      rulesWithOptions.some((r) => r.includes("外部库") || r.includes("CDN")),
    ).toBe(false);
  });

  it("formats svg requirements with allowLibraries (default true allows external fonts)", () => {
    const defaultRules = outputRequirements("svg");
    expect(defaultRules).toContain("禁止进行网络搜索。");
    expect(defaultRules).toContain("禁止读取 Skill。");
    expect(defaultRules).toContain(
      "以静态图片展示，不执行脚本；可引用公开字体与外部样式。",
    );

    const strictRules = outputRequirements("svg", {
      allowSearch: false,
      allowLibraries: false,
    });
    expect(strictRules).toContain(
      "以静态图片展示，不执行脚本，禁止引用任何外部库、外部图片或字体。",
    );
  });
});

describe("promptWithRequirements", () => {
  it("assembles full prompt with title and requirements", () => {
    const result = promptWithRequirements("画一个太阳", "svg", {
      allowSearch: false,
      allowLibraries: true,
    });
    expect(result).toContain("画一个太阳\n\n---\n\n**" + OUTPUT_REQUIREMENTS_TITLE + "**");
    expect(result).toContain("- 输出单个 SVG 文件，根元素为 <svg> 并带有 viewBox。");
    expect(result).toContain("- 禁止读取 Skill。");
    expect(result).toContain("- 禁止进行网络搜索。");
    expect(result).toContain(
      "- 以静态图片展示，不执行脚本；可引用公开字体与外部样式。",
    );
  });
});
