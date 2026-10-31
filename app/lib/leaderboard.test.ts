import { describe, expect, it } from "vitest";
import {
  buildLeaderboard,
  MIN_VOTES,
  type LeaderboardRating,
  type LeaderboardSubmission,
} from "./leaderboard";

const entry = (id: string) => ({ id, name: id });

function answer(
  id: string,
  promptId: string,
  model: string,
  provider = "p1",
  harness: string | null = "cc",
): LeaderboardSubmission {
  return {
    id,
    promptId,
    promptTitle: promptId,
    model: entry(model),
    provider: entry(provider),
    harness: harness ? entry(harness) : null,
  };
}

const votes = (submissionId: string, stars: number, voters: number[]): LeaderboardRating[] =>
  voters.map((userId) => ({ userId, submissionId, stars }));

const find = (board: ReturnType<typeof buildLeaderboard>, key: string) => {
  const found = board.entries.find((e) => e.key === key);
  if (!found) throw new Error(`missing entry ${key}`);
  return found;
};

describe("buildLeaderboard", () => {
  it("ranks a consistently better model above a worse one", () => {
    const submissions = [
      answer("a1", "q1", "good"),
      answer("a2", "q1", "bad"),
      answer("a3", "q2", "good"),
      answer("a4", "q2", "bad"),
    ];
    const ratings = [
      ...votes("a1", 5, [1, 2, 3, 4]),
      ...votes("a2", 2, [1, 2, 3, 4]),
      ...votes("a3", 4.5, [1, 2, 3, 4]),
      ...votes("a4", 1.5, [1, 2, 3, 4]),
    ];
    const board = buildLeaderboard({ submissions, ratings, dimension: "model" });

    expect(board.entries.map((e) => e.key)).toEqual(["good", "bad"]);
    expect(find(board, "good").score!).toBeGreaterThan(find(board, "bad").score!);
  });

  it("does not let a single vote outrank a well-sampled entry", () => {
    const submissions = [
      answer("lucky", "q1", "one-hit"),
      ...Array.from({ length: 6 }, (_, i) => answer(`solid${i}`, `q${i}`, "proven")),
    ];
    const ratings = [
      ...votes("lucky", 5, [99]),
      ...Array.from({ length: 6 }, (_, i) => votes(`solid${i}`, 4.5, [1, 2, 3, 4, 5])).flat(),
    ];
    const board = buildLeaderboard({ submissions, ratings, dimension: "model" });

    expect(find(board, "one-hit").ranked).toBe(false);
    expect(find(board, "proven").ranked).toBe(true);
    expect(board.entries[0].key).toBe("proven");
    // The raw average still favours the lucky one, so the ordering comes from
    // the calibration rather than from the stars alone.
    expect(find(board, "one-hit").raw).toBeGreaterThan(find(board, "proven").raw!);
  });

  it("neutralizes a prompt that everybody scores low", () => {
    // `only-hard` answers nothing but the brutal prompt; `broad` answers both.
    const submissions = [
      answer("h1", "hard", "only-hard"),
      answer("h2", "hard", "broad"),
      answer("e1", "easy", "broad"),
      answer("e2", "easy", "other"),
    ];
    const ratings = [
      ...votes("h1", 2.5, [1, 2, 3, 4, 5]),
      ...votes("h2", 2.5, [1, 2, 3, 4, 5]),
      ...votes("e1", 4.5, [1, 2, 3, 4, 5]),
      ...votes("e2", 4.5, [1, 2, 3, 4, 5]),
    ];
    const board = buildLeaderboard({ submissions, ratings, dimension: "model" });

    const hard = find(board, "only-hard");
    const broad = find(board, "broad");
    // Raw stars punish the model that only took the hard prompt…
    expect(hard.raw).toBeLessThan(broad.raw!);
    // …while the calibrated score puts the tie back, since on the shared prompt
    // the two were rated identically.
    expect(Math.abs(hard.score! - broad.score!)).toBeLessThan(0.2);
  });

  it("discounts a voter who gives everything five stars", () => {
    const submissions = [
      answer("a1", "q1", "hyped"),
      answer("a2", "q1", "steady"),
      answer("a3", "q2", "hyped"),
      answer("a4", "q2", "steady"),
    ];
    const generous = Array.from({ length: 10 }, (_, i) => 100 + i);
    const ratings = [
      // One fan floods the hyped model; ordinary voters rate both alike.
      ...generous.flatMap((userId) => [
        { userId, submissionId: "a1", stars: 5 },
        { userId, submissionId: "a3", stars: 5 },
      ]),
      ...votes("a1", 3, [1, 2, 3]),
      ...votes("a2", 3, [1, 2, 3]),
      ...votes("a3", 3, [1, 2, 3]),
      ...votes("a4", 3, [1, 2, 3]),
    ];
    const board = buildLeaderboard({ submissions, ratings, dimension: "model" });

    const gap = find(board, "hyped").score! - find(board, "steady").score!;
    const rawGap = find(board, "hyped").raw! - find(board, "steady").raw!;
    expect(gap).toBeLessThan(rawGap);
  });

  it("counts answers without votes but leaves them unranked", () => {
    const board = buildLeaderboard({
      submissions: [answer("a1", "q1", "quiet")],
      ratings: [],
      dimension: "model",
    });
    const quiet = find(board, "quiet");
    expect(quiet.answers).toBe(1);
    expect(quiet.votes).toBe(0);
    expect(quiet.score).toBeNull();
    expect(quiet.ranked).toBe(false);
    expect(board.rankedCount).toBe(0);
  });

  it("groups model and provider as one row and skips answers without a harness", () => {
    const submissions = [
      answer("a1", "q1", "m", "official"),
      answer("a2", "q1", "m", "relay"),
      answer("a3", "q1", "m", "relay", null),
    ];
    const ratings = [
      ...votes("a1", 5, [1, 2, 3]),
      ...votes("a2", 2, [1, 2, 3]),
      ...votes("a3", 2, [1, 2, 3]),
    ];

    const pairs = buildLeaderboard({ submissions, ratings, dimension: "model-provider" });
    expect(pairs.entries.map((e) => e.key)).toEqual(["m@official", "m@relay"]);
    expect(find(pairs, "m@relay").answers).toBe(2);
    expect(find(pairs, "m@official").sublabel).toBe("official");

    const harnesses = buildLeaderboard({ submissions, ratings, dimension: "harness" });
    expect(harnesses.entries).toHaveLength(1);
    expect(find(harnesses, "cc").answers).toBe(2);
  });

  it("ignores ratings that point at a missing submission", () => {
    const board = buildLeaderboard({
      submissions: [answer("a1", "q1", "m")],
      ratings: [...votes("a1", 4, [1, 2, 3]), ...votes("gone", 1, [1, 2, 3])],
      dimension: "model",
    });
    expect(board.votes).toBe(3);
    expect(find(board, "m").votes).toBe(3);
  });

  it("reports the best answer of each entry", () => {
    const submissions = [answer("weak", "q1", "m"), answer("strong", "q2", "m")];
    const ratings = [...votes("weak", 2, [1, 2, 3]), ...votes("strong", 5, [1, 2, 3])];
    const board = buildLeaderboard({ submissions, ratings, dimension: "model" });
    expect(find(board, "m").best?.submissionId).toBe("strong");
    expect(find(board, "m").prompts).toBe(2);
  });

  it("requires MIN_VOTES before an entry is ranked", () => {
    const submissions = [answer("a1", "q1", "m")];
    const below = buildLeaderboard({
      submissions,
      ratings: votes("a1", 4, Array.from({ length: MIN_VOTES - 1 }, (_, i) => i + 1)),
      dimension: "model",
    });
    const at = buildLeaderboard({
      submissions,
      ratings: votes("a1", 4, Array.from({ length: MIN_VOTES }, (_, i) => i + 1)),
      dimension: "model",
    });
    expect(find(below, "m").ranked).toBe(false);
    expect(find(at, "m").ranked).toBe(true);
  });
});
