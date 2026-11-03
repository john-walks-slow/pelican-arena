import { describe, expect, it } from "vitest";
import {
  OUTPUT_REQUIREMENTS_TITLE,
  outputRequirements,
  promptWithRequirements,
} from "./output-requirements";

describe("outputRequirements", () => {
  it("defaults to disallowing search and libraries for web prompts", () => {
    const rules = outputRequirements("web");
    expect(rules).toContain("禁止联网搜索，仅基于模型自身知识回答。");
    expect(rules).toContain(
      "禁止使用任何外部库或框架，全部使用原生 HTML、CSS 与 JavaScript 实现（可使用 Canvas、WebGL、CSS 动画等原生特性）。",
    );
  });

  it("enables search when allowSearch is true", () => {
    const rules = outputRequirements("web", { allowSearch: true });
    expect(rules).toContain("允许联网搜索查阅资料。");
    expect(rules).not.toContain("禁止联网搜索，仅基于模型自身知识回答。");
  });

  it("enables CDN libraries when allowLibraries is true for web", () => {
    const rules = outputRequirements("web", { allowLibraries: true });
    expect(rules).toContain(
      "可以使用 Canvas、WebGL、CSS 动画、ES module，以及公开 CDN 上的库。",
    );
    expect(rules).not.toContain(
      "禁止使用任何外部库或框架，全部使用原生 HTML、CSS 与 JavaScript 实现（可使用 Canvas、WebGL、CSS 动画等原生特性）。",
    );
  });

  it("formats markdown requirements with options", () => {
    const defaultRules = outputRequirements("markdown");
    expect(defaultRules).toContain("禁止联网搜索，仅基于模型自身知识回答。");
    expect(defaultRules).toContain(
      "禁止依赖或引入外部第三方库，仅使用原生或标准库能力。",
    );

    const openRules = outputRequirements("markdown", {
      allowSearch: true,
      allowLibraries: true,
    });
    expect(openRules).toContain("允许联网搜索查阅资料。");
    expect(openRules).toContain("允许引用或推荐外部库与第三方依赖。");
  });

  it("formats svg requirements with options", () => {
    const defaultRules = outputRequirements("svg");
    expect(defaultRules).toContain("禁止联网搜索，仅基于模型自身知识回答。");
    expect(defaultRules).toContain(
      "以静态图片展示，不执行脚本，禁止引用任何外部库、外部图片或字体。",
    );

    const openRules = outputRequirements("svg", {
      allowSearch: true,
      allowLibraries: true,
    });
    expect(openRules).toContain("允许联网搜索查阅资料。");
    expect(openRules).toContain(
      "以静态图片展示，不执行脚本；可引用公开字体与外部样式。",
    );
  });
});

describe("promptWithRequirements", () => {
  it("assembles full prompt with title and requirements", () => {
    const result = promptWithRequirements("画一个太阳", "svg", {
      allowSearch: false,
      allowLibraries: false,
    });
    expect(result).toContain("画一个太阳\n\n---\n\n**" + OUTPUT_REQUIREMENTS_TITLE + "**");
    expect(result).toContain("- 输出单个 SVG 文件，根元素为 <svg> 并带有 viewBox。");
    expect(result).toContain("- 禁止联网搜索，仅基于模型自身知识回答。");
    expect(result).toContain(
      "- 以静态图片展示，不执行脚本，禁止引用任何外部库、外部图片或字体。",
    );
  });
});
