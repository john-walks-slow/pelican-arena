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

  it("compresses a thin edge far below its raw size", () => {
    // `thin` is perfect on the one prompt it shares with `broad`, but that is
    // three votes against thirty spread over five prompts. The edge survives,
    // much smaller; the list shows the vote counts rather than hiding them.
    const submissions = [
      answer("t1", "q1", "thin"),
      ...Array.from({ length: 5 }, (_, i) => answer(`b${i}`, `q${i}`, "broad")),
    ];
    const ratings = [
      ...votes("t1", 5, [1, 2, 3]),
      ...Array.from({ length: 5 }, (_, i) =>
        votes(`b${i}`, 4.5, [1, 2, 3, 4, 5, 6]),
      ).flat(),
    ];
    const board = buildLeaderboard({ submissions, ratings, dimension: "model" });

    const thin = find(board, "thin");
    const broad = find(board, "broad");
    expect(thin.ranked).toBe(true);
    expect(broad.ranked).toBe(true);
    // Raw stars still favour `thin`, so the compressed edge is the calibration
    // at work: most of a half-star raw gap does not survive.
    expect(thin.raw!).toBeGreaterThan(broad.raw!);
    expect(thin.score! - broad.score!).toBeLessThan((thin.raw! - broad.raw!) * 0.25);
  });

  it("trusts the same per-answer edge more when it covers more prompts", () => {
    // Both models beat a shared baseline by the same margin per prompt; the one
    // that showed it on three prompts keeps more of that edge than the one that
    // showed it once.
    const submissions = [
      answer("n1", "q1", "narrow"),
      answer("n2", "q1", "control"),
      answer("w1", "w1", "wide"),
      answer("w2", "w1", "control"),
      answer("w3", "w2", "wide"),
      answer("w4", "w2", "control"),
      answer("w5", "w3", "wide"),
      answer("w6", "w3", "control"),
    ];
    const ratings = [
      ...votes("n1", 5, [1, 2, 3]),
      ...votes("n2", 2.5, [1, 2, 3]),
      ...["w1", "w3", "w5"].flatMap((id) => votes(id, 5, [1, 2, 3])),
      ...["w2", "w4", "w6"].flatMap((id) => votes(id, 2.5, [1, 2, 3])),
    ];
    const board = buildLeaderboard({ submissions, ratings, dimension: "model" });

    const narrow = find(board, "narrow");
    const wide = find(board, "wide");
    expect(wide.score!).toBeGreaterThan(narrow.score!);
  });

  it("numbers every ranked entry in order", () => {
    const submissions = ["top", "mid", "low"].map((m, i) => answer(`a${i}`, "q1", m));
    const ratings = [
      ...votes("a0", 5, [1, 2, 3, 4, 5]),
      ...votes("a1", 2.5, [1, 2, 3, 4, 5]),
      ...votes("a2", 1, [1, 2, 3, 4, 5]),
    ];
    const board = buildLeaderboard({ submissions, ratings, dimension: "model" });

    expect(find(board, "top").place).toBe(1);
    expect(find(board, "mid").place).toBe(2);
    expect(find(board, "low").place).toBe(3);
  });

  it("counts people rather than ballots before ranking", () => {
    // One account rating three answers of the same model is still one opinion.
    const submissions = ["a1", "a2", "a3"].map((id, i) => answer(id, `q${i}`, "solo-fan"));
    const ratings = submissions.flatMap((s) => votes(s.id, 5, [42]));
    const board = buildLeaderboard({ submissions, ratings, dimension: "model" });

    const entry = find(board, "solo-fan");
    expect(entry.votes).toBe(3);
    expect(entry.ranked).toBe(false);
  });

  it("does not call a single vote the best answer", () => {
    const submissions = [answer("lucky", "q1", "m"), answer("solid", "q2", "m")];
    const ratings = [...votes("lucky", 5, [9]), ...votes("solid", 4, [1, 2, 3, 4])];
    const board = buildLeaderboard({ submissions, ratings, dimension: "model" });

    expect(find(board, "m").best?.submissionId).toBe("solid");
  });

  it("counts prompts an entry answered but was not rated on", () => {
    const submissions = [answer("a1", "q1", "m"), answer("a2", "q2", "m")];
    const board = buildLeaderboard({
      submissions,
      ratings: votes("a1", 4, [1, 2, 3]),
      dimension: "model",
    });

    const entry = find(board, "m");
    expect(entry.answers).toBe(2);
    expect(entry.prompts).toBe(2);
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
