import { describe, expect, it } from "vitest";
import { estimateCost, formatCost } from "./cost";

describe("estimateCost", () => {
  it("returns null when model cost is missing or empty", () => {
    expect(estimateCost({ inputTokens: 1000, outputTokens: 500, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBeNull();
    expect(estimateCost({ inputTokens: 1000, outputTokens: 500, cacheReadTokens: 0, cacheWriteTokens: 0 }, null)).toBeNull();
    expect(estimateCost({ inputTokens: 1000, outputTokens: 500, cacheReadTokens: 0, cacheWriteTokens: 0 }, {})).toBeNull();
  });

  it("calculates cost accurately based on $/1M rates", () => {
    // 100k input @ $2.5/M = $0.25
    // 20k output @ $10.0/M = $0.20
    // 50k cache read @ $1.25/M = $0.0625
    // 10k cache write @ $3.75/M = $0.0375
    // total = $0.55
    const cost = { input: 2.5, output: 10, cache_read: 1.25, cache_write: 3.75 };
    const log = {
      inputTokens: 100_000,
      outputTokens: 20_000,
      cacheReadTokens: 50_000,
      cacheWriteTokens: 10_000,
    };
    const total = estimateCost(log, cost);
    expect(total).toBeCloseTo(0.55, 4);
  });
});

describe("formatCost", () => {
  it("formats zero and negative values as $0.00", () => {
    expect(formatCost(0)).toBe("$0.00");
    expect(formatCost(-0.5)).toBe("$0.00");
  });

  it("formats >= 1 with 2 decimal places", () => {
    expect(formatCost(1.2345)).toBe("$1.23");
    expect(formatCost(15.9)).toBe("$15.90");
  });

  it("formats cents with 3 decimal places", () => {
    expect(formatCost(0.0423)).toBe("$0.042");
    expect(formatCost(0.55)).toBe("$0.550");
  });

  it("formats sub-cents with 4 decimal places", () => {
    expect(formatCost(0.0042)).toBe("$0.0042");
  });

  it("formats tiny amounts as < $0.001", () => {
    expect(formatCost(0.00004)).toBe("< $0.001");
  });
});
