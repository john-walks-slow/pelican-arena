import { describe, expect, it } from "vitest";
import { formatRatingLabel, isValidRating } from "./rating";
import { formatStars } from "./format";

describe("rating validation", () => {
  it("accepts valid whole and half star scores between 0.5 and 5", () => {
    const validScores = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
    for (const score of validScores) {
      expect(isValidRating(score)).toBe(true);
    }
  });

  it("rejects 0 and scores outside the 0.5-5 range", () => {
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(-0.5)).toBe(false);
    expect(isValidRating(5.5)).toBe(false);
    expect(isValidRating(10)).toBe(false);
  });

  it("rejects non-0.5 step numbers and invalid values", () => {
    expect(isValidRating(1.2)).toBe(false);
    expect(isValidRating(3.25)).toBe(false);
    expect(isValidRating(4.99)).toBe(false);
    expect(isValidRating(Number.NaN)).toBe(false);
    expect(isValidRating(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("rating labels", () => {
  it("formats whole star labels with semantic descriptions", () => {
    expect(formatRatingLabel(1)).toBe("1 星 · 很差");
    expect(formatRatingLabel(3)).toBe("3 星 · 一般");
    expect(formatRatingLabel(5)).toBe("5 星 · 惊艳");
  });

  it("formats half star labels cleanly with numbers", () => {
    expect(formatRatingLabel(0.5)).toBe("0.5 星");
    expect(formatRatingLabel(3.5)).toBe("3.5 星");
    expect(formatRatingLabel(4.5)).toBe("4.5 星");
  });
});

describe("formatStars with half-star ratings", () => {
  it("calculates accurate single decimal averages with half stars", () => {
    expect(formatStars(0, 0)).toBe("—");
    expect(formatStars(3.5, 1)).toBe("3.5");
    expect(formatStars(7.5, 2)).toBe("3.8"); // (3.5 + 4) / 2 = 3.75 -> 3.8
    expect(formatStars(8, 2)).toBe("4.0"); // (3.5 + 4.5) / 2 = 4.0
  });
});
