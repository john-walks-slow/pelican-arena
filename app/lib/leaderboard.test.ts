import { describe, expect, it } from "vitest";
import {
  buildLeaderboard,
  MIN_VOTES,
  type LeaderboardRating,
  type LeaderboardSubmission,
} from "./leaderboard";

const entry = (id: string) => ({ id, name: id });

function answer(id: string, promptId: string, model: string): LeaderboardSubmission {
  return { id, promptId, model: entry(model) };
}

const votes = (submissionId: string, stars: number, voters: number[]): LeaderboardRating[] =>
  voters.map((userId) => ({ userId, submissionId, stars }));

const find = (board: ReturnType<typeof buildLeaderboard>, key: string) => {
  const found = board.entries.find((e) => e.key === key);
  if (!found) throw new Error(`missing entry ${key}`);
  return found;
};

/** Everyone votes the same, so the ordering is the only variable under test. */
const crowd = [1, 2, 3];

describe("buildLeaderboard", () => {
  it("ranks a consistently better model above a worse one", () => {
    const submissions = [
      answer("a1", "q1", "good"),
      answer("a2", "q1", "bad"),
      answer("a3", "q2", "good"),
      answer("a4", "q2", "bad"),
    ];
    const ratings = [
      ...votes("a1", 5, crowd),
      ...votes("a2", 2, crowd),
      ...votes("a3", 4.5, crowd),
      ...votes("a4", 1.5, crowd),
    ];
    const board = buildLeaderboard({ submissions, ratings });

    expect(board.entries.map((e) => e.key)).toEqual(["good", "bad"]);
    expect(find(board, "good").score!).toBeGreaterThan(find(board, "bad").score!);
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
    const board = buildLeaderboard({ submissions, ratings });

    const hard = find(board, "only-hard");
    const broad = find(board, "broad");
    // Raw stars punish the model that only took the hard prompt…
    expect(hard.raw).toBeLessThan(broad.raw!);
    // …while on the shared prompt the two were rated identically, so the
    // calibrated scores land together.
    expect(Math.abs(hard.score! - broad.score!)).toBeLessThan(0.3);
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
      ...votes("a1", 3, crowd),
      ...votes("a2", 3, crowd),
      ...votes("a3", 3, crowd),
      ...votes("a4", 3, crowd),
    ];
    const board = buildLeaderboard({ submissions, ratings });

    const gap = find(board, "hyped").score! - find(board, "steady").score!;
    const rawGap = find(board, "hyped").raw! - find(board, "steady").raw!;
    expect(gap).toBeLessThan(rawGap);
  });

  it("trusts the same edge more when it holds across more prompts", () => {
    // Both beat the same opponent by the same margin; `wide` shows it on three
    // prompts, `narrow` on one, so `wide` keeps more of its edge.
    const submissions = [
      answer("n1", "q1", "narrow"),
      answer("c1", "q1", "control"),
      ...["w1", "w2", "w3"].flatMap((prompt) => [
        answer(`${prompt}n`, prompt, "wide"),
        answer(`${prompt}c`, prompt, "control"),
      ]),
    ];
    const ratings = [
      ...votes("n1", 5, crowd),
      ...votes("c1", 2.5, crowd),
      ...["w1", "w2", "w3"].flatMap((prompt) => [
        ...votes(`${prompt}n`, 5, crowd),
        ...votes(`${prompt}c`, 2.5, crowd),
      ]),
    ];
    const board = buildLeaderboard({ submissions, ratings });

    expect(find(board, "wide").score!).toBeGreaterThan(find(board, "narrow").score!);
  });

  it("shrinks a conclusion drawn from one crowded answer", () => {
    // `thin` wins its single prompt by a wide margin against one opponent, so
    // the raw gap is large while the calibrated one must stay much smaller.
    const submissions = [answer("t1", "q1", "thin"), answer("b1", "q1", "broad")];
    const ratings = [...votes("t1", 5, crowd), ...votes("b1", 2, crowd)];
    const board = buildLeaderboard({ submissions, ratings });

    const thin = find(board, "thin");
    expect(thin.score! - find(board, "broad").score!).toBeLessThan(
      (thin.raw! - find(board, "broad").raw!) * 0.75,
    );
  });

  it("leaves a model unranked when it never shared a prompt", () => {
    const submissions = [answer("a1", "q1", "solo")];
    const board = buildLeaderboard({
      submissions,
      ratings: votes("a1", 5, crowd),
    });

    const solo = find(board, "solo");
    expect(solo.comparable).toBe(false);
    expect(solo.score).toBeNull();
    expect(solo.ranked).toBe(false);
    // The raw average is still reported, so the row is not blank.
    expect(solo.raw).toBe(5);
    expect(board.rankedCount).toBe(0);
  });

  it("counts people rather than ballots before ranking", () => {
    // One account rating three answers of the same model is still one opinion.
    const submissions = [
      answer("a1", "q1", "solo-fan"),
      answer("a2", "q2", "solo-fan"),
      answer("a3", "q3", "solo-fan"),
      answer("b1", "q1", "rival"),
    ];
    const ratings = [
      ...["a1", "a2", "a3"].flatMap((id) => votes(id, 5, [42])),
      ...votes("b1", 3, crowd),
    ];
    const board = buildLeaderboard({ submissions, ratings });

    const entry = find(board, "solo-fan");
    expect(entry.votes).toBe(3);
    expect(entry.ranked).toBe(false);
  });

  it("counts prompts an entry answered but was not rated on", () => {
    const submissions = [
      answer("a1", "q1", "m"),
      answer("a2", "q2", "m"),
      answer("b1", "q1", "other"),
    ];
    const board = buildLeaderboard({
      submissions,
      ratings: [...votes("a1", 4, crowd), ...votes("b1", 2, crowd)],
    });

    const entry = find(board, "m");
    expect(entry.answers).toBe(2);
    expect(entry.prompts).toBe(2);
  });

  it("counts answers without votes but leaves them unranked", () => {
    const board = buildLeaderboard({
      submissions: [answer("a1", "q1", "quiet")],
      ratings: [],
    });
    const quiet = find(board, "quiet");
    expect(quiet.answers).toBe(1);
    expect(quiet.votes).toBe(0);
    expect(quiet.score).toBeNull();
    expect(quiet.ranked).toBe(false);
    expect(board.rankedCount).toBe(0);
  });

  it("ignores ratings that point at a missing submission", () => {
    const board = buildLeaderboard({
      submissions: [answer("a1", "q1", "m"), answer("b1", "q1", "other")],
      ratings: [
        ...votes("a1", 4, crowd),
        ...votes("b1", 2, crowd),
        ...votes("gone", 1, crowd),
      ],
    });
    expect(board.votes).toBe(6);
    expect(find(board, "m").votes).toBe(3);
  });

  it("requires MIN_VOTES before an entry is ranked", () => {
    const submissions = [answer("a1", "q1", "m"), answer("a2", "q1", "other")];
    const votesBy = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
    const below = buildLeaderboard({
      submissions,
      ratings: [
        ...votes("a1", 4, votesBy(MIN_VOTES - 1)),
        ...votes("a2", 2, votesBy(MIN_VOTES)),
      ],
    });
    const at = buildLeaderboard({
      submissions,
      ratings: [
        ...votes("a1", 4, votesBy(MIN_VOTES)),
        ...votes("a2", 2, votesBy(MIN_VOTES)),
      ],
    });
    expect(find(below, "m").ranked).toBe(false);
    expect(find(at, "m").ranked).toBe(true);
  });

  it("numbers every ranked entry in order", () => {
    const submissions = ["top", "mid", "low"].map((m, i) => answer(`a${i}`, "q1", m));
    const ratings = [
      ...votes("a0", 5, crowd),
      ...votes("a1", 2.5, crowd),
      ...votes("a2", 1, crowd),
    ];
    const board = buildLeaderboard({ submissions, ratings });

    expect(find(board, "top").place).toBe(1);
    expect(find(board, "mid").place).toBe(2);
    expect(find(board, "low").place).toBe(3);
  });
});
