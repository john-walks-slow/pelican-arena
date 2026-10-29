import { describe, expect, it } from "vitest";
import { buildLeaderboard, percentiles, type ScoredInput } from "./leaderboard";

const sub = (submissionId: string, promptId: string, groupKey: string, stars: number[]): ScoredInput => ({
  submissionId,
  promptId,
  groupKey,
  starSum: stars.reduce((a, b) => a + b, 0),
  votes: stars.length,
});

describe("percentiles", () => {
  it("gives ties the same midrank", () => {
    expect(percentiles([1, 2, 2, 3])).toEqual([0, 0.5, 0.5, 1]);
    expect(percentiles([4])).toEqual([0.5]);
  });
});

describe("buildLeaderboard", () => {
  it("does not let a single 5-star vote beat a well-rated record", () => {
    const rows = buildLeaderboard(
      [
        sub("a1", "p1", "lucky", [5]),
        sub("b1", "p1", "steady", [5, 5, 5, 4, 5, 5, 5, 4]),
        sub("c1", "p1", "weak", [2, 2, 3]),
      ],
      1,
    );
    expect(rows.map((r) => r.groupKey)).toEqual(["steady", "lucky", "weak"]);
  });

  it("weighs each prompt equally regardless of how harsh its raters were", () => {
    // Model A wins the harsh prompt, B wins the generous one: they should tie.
    const rows = buildLeaderboard(
      [
        sub("a1", "harsh", "A", [3, 3, 3]),
        sub("b1", "harsh", "B", [1, 1, 1]),
        sub("a2", "kind", "A", [4, 4, 4]),
        sub("b2", "kind", "B", [5, 5, 5]),
      ],
      1,
    );
    expect(rows[0].score).toBeCloseTo(rows[1].score);
  });

  it("hides groups below the minimum number of rated submissions", () => {
    const rows = buildLeaderboard([
      sub("a1", "p1", "A", [5]),
      sub("a2", "p2", "A", [5]),
      sub("b1", "p1", "B", [3]),
      sub("b2", "p2", "B", [3]),
      sub("b3", "p3", "B", [3]),
      sub("u1", "p3", "unrated", []),
    ]);
    expect(rows.map((r) => r.groupKey)).toEqual(["B"]);
  });
});
