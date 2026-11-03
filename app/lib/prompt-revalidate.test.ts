import { describe, expect, it } from "vitest";
import { promptShouldRevalidate } from "./prompt-revalidate";

describe("promptShouldRevalidate", () => {
  it("revalidates when query/filters change", () => {
    const result = promptShouldRevalidate({
      currentUrl: new URL("http://local/p/pr-1"),
      nextUrl: new URL("http://local/p/pr-1?model=claude-3-7-sonnet"),
      defaultShouldRevalidate: false,
    });
    expect(result).toBe(true);
  });

  it("revalidates when filter is cleared or changed", () => {
    const result = promptShouldRevalidate({
      currentUrl: new URL("http://local/p/pr-1?model=claude-3-7-sonnet"),
      nextUrl: new URL("http://local/p/pr-1"),
      defaultShouldRevalidate: false,
    });
    expect(result).toBe(true);
  });

  it("skips revalidation when opening the submit child dialog with same search", () => {
    const result = promptShouldRevalidate({
      currentUrl: new URL("http://local/p/pr-1"),
      nextUrl: new URL("http://local/p/pr-1/submit"),
      defaultShouldRevalidate: true,
    });
    expect(result).toBe(false);
  });

  it("skips revalidation when closing the submit child dialog with same search", () => {
    const result = promptShouldRevalidate({
      currentUrl: new URL("http://local/p/pr-1/submit?model=gpt-4"),
      nextUrl: new URL("http://local/p/pr-1?model=gpt-4"),
      defaultShouldRevalidate: true,
    });
    expect(result).toBe(false);
  });

  it("revalidates on non-GET submissions", () => {
    const result = promptShouldRevalidate({
      currentUrl: new URL("http://local/p/pr-1"),
      nextUrl: new URL("http://local/p/pr-1"),
      formMethod: "POST",
      defaultShouldRevalidate: true,
    });
    expect(result).toBe(true);
  });

  it("falls back to defaultShouldRevalidate when navigating across prompts", () => {
    const result = promptShouldRevalidate({
      currentUrl: new URL("http://local/p/pr-1"),
      nextUrl: new URL("http://local/p/pr-2"),
      defaultShouldRevalidate: true,
    });
    expect(result).toBe(true);
  });
});
