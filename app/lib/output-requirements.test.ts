import { describe, expect, it } from "vitest";
import {
  OUTPUT_REQUIREMENTS_TITLE,
  outputRequirements,
  promptWithRequirements,
} from "./output-requirements";

describe("outputRequirements", () => {
  it("defaults to disallowing search for web prompts while keeping original CDN library rule and disallowing Skill", () => {
    const rules = outputRequirements("web");
    expect(rules).toContain("禁止进行网络搜索。");
    expect(rules).toContain("禁止读取 Skill。");
    expect(rules).toContain(
      "可以使用 Canvas、WebGL、CSS 动画、ES module，以及公开 CDN 上的库。",
    );
  });

  it("enables search when allowSearch is true and still disallows Skill", () => {
    const rules = outputRequirements("web", { allowSearch: true });
    expect(rules).toContain("允许进行网络搜索。");
    expect(rules).toContain("禁止读取 Skill。");
    expect(rules).not.toContain("禁止进行网络搜索。");
  });

  it("formats markdown requirements with allowSearch and disallowing Skill", () => {
    const defaultRules = outputRequirements("markdown");
    expect(defaultRules).toContain("禁止进行网络搜索。");
    expect(defaultRules).toContain("禁止读取 Skill。");
    expect(defaultRules).toContain(
      "直接输出文本回复，使用标准 Markdown 语法，支持表格与代码块。",
    );

    const openRules = outputRequirements("markdown", { allowSearch: true });
    expect(openRules).toContain("允许进行网络搜索。");
    expect(openRules).toContain("禁止读取 Skill。");
  });

  it("formats svg requirements with allowSearch and disallowing Skill", () => {
    const defaultRules = outputRequirements("svg");
    expect(defaultRules).toContain("禁止进行网络搜索。");
    expect(defaultRules).toContain("禁止读取 Skill。");
    expect(defaultRules).toContain(
      "以静态图片展示，不执行脚本，也不要引用外部图片或字体。",
    );

    const openRules = outputRequirements("svg", { allowSearch: true });
    expect(openRules).toContain("允许进行网络搜索。");
    expect(openRules).toContain("禁止读取 Skill。");
  });
});

describe("promptWithRequirements", () => {
  it("assembles full prompt with title and requirements", () => {
    const result = promptWithRequirements("画一个太阳", "svg", {
      allowSearch: false,
    });
    expect(result).toContain("画一个太阳\n\n---\n\n**" + OUTPUT_REQUIREMENTS_TITLE + "**");
    expect(result).toContain("- 输出单个 SVG 文件，根元素为 <svg> 并带有 viewBox。");
    expect(result).toContain("- 禁止读取 Skill。");
    expect(result).toContain("- 禁止进行网络搜索。");
    expect(result).toContain(
      "- 以静态图片展示，不执行脚本，也不要引用外部图片或字体。",
    );
  });
});
