import { describe, expect, it } from "vitest";
import { formatRelative } from "./format";

const NOW = new Date("2026-11-04T02:00:00Z").getTime();

describe("formatRelative", () => {
  it("describes recent timestamps relative to now", () => {
    expect(formatRelative(NOW - 20_000, NOW)).toBe("刚刚");
    expect(formatRelative(NOW - 5 * 60_000, NOW)).toContain("分钟");
    expect(formatRelative(NOW - 3 * 3_600_000, NOW)).toContain("小时");
    expect(formatRelative(NOW - 3 * 86_400_000, NOW)).toContain("天");
  });

  it("accepts every timestamp shape the loaders produce", () => {
    const fiveMinutesAgo = NOW - 5 * 60_000;
    const asDate = new Date(fiveMinutesAgo);
    const asIso = asDate.toISOString();

    expect(formatRelative(asDate, NOW)).toBe(formatRelative(fiveMinutesAgo, NOW));
    expect(formatRelative(asIso, NOW)).toBe(formatRelative(fiveMinutesAgo, NOW));
  });

  it("falls back to a dated string once the gap passes a month", () => {
    const text = formatRelative(NOW - 400 * 86_400_000, NOW);
    expect(text).not.toContain("Invalid");
    expect(text).toMatch(/\d{4}/);
  });

  it("never renders an invalid date for missing or malformed input", () => {
    for (const value of [undefined, null, "", "not-a-date", NaN, 0]) {
      const text = formatRelative(value as never, NOW);
      expect(text).not.toContain("Invalid");
      expect(text).toBe("—");
    }
  });
});
