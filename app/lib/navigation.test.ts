import { describe, expect, it } from "vitest";
import { backTarget, baseScreenKey, safeFrom, withFrom } from "./navigation";

describe("navigation return targets", () => {
  it("accepts only internal paths", () => {
    expect(safeFrom("/me?tab=answers")).toBe("/me?tab=answers");
    expect(safeFrom("//evil.example")).toBeNull();
    expect(safeFrom("/\\evil.example")).toBeNull();
    expect(safeFrom("https://evil.example")).toBeNull();
    expect(safeFrom("")).toBeNull();
  });

  it("reduces single-fetch data requests to their document path", () => {
    expect(safeFrom("/prompts/new.data")).toBe("/prompts/new");
    expect(safeFrom("/prompts/new.data?_routes=routes%2Fprompts.new")).toBe("/prompts/new");
    expect(safeFrom("/p/1.data?sort=new&_routes=routes%2Fp")).toBe("/p/1?sort=new");
    expect(safeFrom("/_.data")).toBe("/");
  });

  it("keeps an existing query string when adding from", () => {
    expect(withFrom("/p/1/edit", "/me?tab=prompts")).toBe(
      "/p/1/edit?from=%2Fme%3Ftab%3Dprompts",
    );
    expect(withFrom("/p/1?sort=new", "/me")).toBe("/p/1?sort=new&from=%2Fme");
    expect(withFrom("/p/1", null)).toBe("/p/1");
  });

  it("labels explicit back targets", () => {
    expect(backTarget("/me?tab=answers", { label: "题目", to: "/" })).toEqual({
      label: "我的",
      to: "/me?tab=answers",
      explicit: true,
    });
    expect(backTarget("/s/1?from=%2Fp%2F1", { label: "题目", to: "/" }).label).toBe("答案");
    expect(backTarget("/p/1", { label: "题目", to: "/" }).label).toBe("题目");
    expect(backTarget(null, { label: "题目", to: "/" })).toEqual({
      label: "题目",
      to: "/",
      explicit: false,
    });
  });

  it("resolves base screen identity by stripping modal suffixes", () => {
    expect(baseScreenKey("/p/test-prompt/submit")).toBe("/p/test-prompt");
    expect(baseScreenKey("/s/test-submission/edit")).toBe("/s/test-submission");
    expect(baseScreenKey("/p/test-prompt")).toBe("/p/test-prompt");
    expect(baseScreenKey("/s/test-submission")).toBe("/s/test-submission");
    expect(baseScreenKey("/")).toBe("/");
    expect(baseScreenKey("/me")).toBe("/me");
  });
});
