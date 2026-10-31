import type { CatalogEntry } from "./catalog";

/**
 * Turns per-rating stars into a ranking of models, providers and harnesses.
 *
 * Raw averages are not comparable here: a prompt may attract strict voters, a
 * voter may hand out five stars to everything, and an entry with one vote tells
 * us almost nothing. So the ratings are fitted to an additive baseline model
 *
 *     stars ≈ mean + promptBias + voterBias + answerBias
 *
 * by regularized alternating updates (the standard baseline predictor from the
 * collaborative-filtering literature). `answerBias` is what remains once the
 * prompt and the voter are accounted for, and it is what gets aggregated.
 *
 * Everything here is pure so the weighting can be tested directly.
 */

export const DIMENSIONS = ["model", "provider", "harness", "model-provider"] as const;
export type Dimension = (typeof DIMENSIONS)[number];
export const DEFAULT_DIMENSION: Dimension = "model";

export function isDimension(value: unknown): value is Dimension {
  return typeof value === "string" && (DIMENSIONS as readonly string[]).includes(value);
}

/** Regularization strengths, read as "pseudo votes pulling the bias to zero". */
const PRIOR = {
  prompt: 5,
  voter: 5,
  answer: 3,
  /** Pulls an entry toward the site average until it has covered several prompts. */
  promptCoverage: 1,
} as const;

const ITERATIONS = 12;
const NEUTRAL_SCORE = 3;

/** Below this an entry is listed but not ranked: the sample says too little. */
export const MIN_VOTES = 3;

export interface LeaderboardSubmission {
  id: string;
  promptId: string;
  promptTitle: string;
  model: CatalogEntry;
  provider: CatalogEntry;
  harness: CatalogEntry | null;
}

export interface LeaderboardRating {
  userId: number;
  submissionId: string;
  stars: number;
}

export interface LeaderboardEntry {
  key: string;
  name: string;
  /** Second line of the label; the provider when ranking model × provider. */
  sublabel: string | null;
  /** Calibrated score on the five-star scale, or null when unrated. */
  score: number | null;
  /** Plain average of the stars received, for comparison. */
  raw: number | null;
  answers: number;
  votes: number;
  prompts: number;
  best: { submissionId: string; promptTitle: string } | null;
  ranked: boolean;
}

export interface Leaderboard {
  entries: LeaderboardEntry[];
  /** The site-wide average the scores are centered on. */
  baseline: number;
  rankedCount: number;
  votes: number;
}

function identify(
  submission: LeaderboardSubmission,
  dimension: Dimension,
): { key: string; name: string; sublabel: string | null } | null {
  const { model, provider, harness } = submission;
  switch (dimension) {
    case "model":
      return { key: model.id, name: model.name, sublabel: null };
    case "provider":
      return { key: provider.id, name: provider.name, sublabel: null };
    case "harness":
      return harness ? { key: harness.id, name: harness.name, sublabel: null } : null;
    case "model-provider":
      return {
        key: `${model.id}@${provider.id}`,
        name: model.name,
        sublabel: provider.name,
      };
  }
}

/** One regularized bias update: shrunk mean of the residuals grouped by key. */
function fitBias<K>(
  keys: K[],
  residuals: number[],
  prior: number,
  into: Map<K, number>,
) {
  const sums = new Map<K, { total: number; n: number }>();
  for (let i = 0; i < keys.length; i++) {
    const bucket = sums.get(keys[i]);
    if (bucket) {
      bucket.total += residuals[i];
      bucket.n += 1;
    } else {
      sums.set(keys[i], { total: residuals[i], n: 1 });
    }
  }
  into.clear();
  for (const [key, { total, n }] of sums) into.set(key, total / (prior + n));
}

function mean(values: number[]) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function buildLeaderboard(input: {
  submissions: LeaderboardSubmission[];
  ratings: LeaderboardRating[];
  dimension: Dimension;
}): Leaderboard {
  const { dimension } = input;
  const byId = new Map(input.submissions.map((s) => [s.id, s]));
  const votes = input.ratings.filter((r) => byId.has(r.submissionId));

  const baseline = votes.length
    ? votes.reduce((sum, r) => sum + r.stars, 0) / votes.length
    : NEUTRAL_SCORE;

  const promptOf = votes.map((r) => byId.get(r.submissionId)!.promptId);
  const voterOf = votes.map((r) => r.userId);
  const answerOf = votes.map((r) => r.submissionId);

  const promptBias = new Map<string, number>();
  const voterBias = new Map<number, number>();
  const answerBias = new Map<string, number>();
  const at = <K>(map: Map<K, number>, key: K) => map.get(key) ?? 0;

  for (let round = 0; round < ITERATIONS; round++) {
    fitBias(
      promptOf,
      votes.map(
        (r, i) =>
          r.stars - baseline - at(voterBias, voterOf[i]) - at(answerBias, answerOf[i]),
      ),
      PRIOR.prompt,
      promptBias,
    );
    fitBias(
      voterOf,
      votes.map(
        (r, i) =>
          r.stars - baseline - at(promptBias, promptOf[i]) - at(answerBias, answerOf[i]),
      ),
      PRIOR.voter,
      voterBias,
    );
    fitBias(
      answerOf,
      votes.map(
        (r, i) =>
          r.stars - baseline - at(promptBias, promptOf[i]) - at(voterBias, voterOf[i]),
      ),
      PRIOR.answer,
      answerBias,
    );
  }

  const starSumBySubmission = new Map<string, { stars: number; votes: number }>();
  for (const rating of votes) {
    const bucket = starSumBySubmission.get(rating.submissionId);
    if (bucket) {
      bucket.stars += rating.stars;
      bucket.votes += 1;
    } else {
      starSumBySubmission.set(rating.submissionId, { stars: rating.stars, votes: 1 });
    }
  }

  interface Group {
    key: string;
    name: string;
    sublabel: string | null;
    answers: number;
    votes: number;
    starSum: number;
    /** Answer biases grouped by prompt, so one popular prompt cannot dominate. */
    byPrompt: Map<string, number[]>;
    best: { submissionId: string; promptTitle: string; bias: number } | null;
  }

  const groups = new Map<string, Group>();
  for (const submission of input.submissions) {
    const ident = identify(submission, dimension);
    if (!ident) continue;
    let group = groups.get(ident.key);
    if (!group) {
      group = { ...ident, answers: 0, votes: 0, starSum: 0, byPrompt: new Map(), best: null };
      groups.set(ident.key, group);
    }
    group.answers += 1;

    const tally = starSumBySubmission.get(submission.id);
    if (!tally) continue;
    group.votes += tally.votes;
    group.starSum += tally.stars;

    const bias = at(answerBias, submission.id);
    const bucket = group.byPrompt.get(submission.promptId);
    if (bucket) bucket.push(bias);
    else group.byPrompt.set(submission.promptId, [bias]);

    if (!group.best || bias > group.best.bias) {
      group.best = { submissionId: submission.id, promptTitle: submission.promptTitle, bias };
    }
  }

  const entries: LeaderboardEntry[] = [...groups.values()].map((group) => {
    const perPrompt = [...group.byPrompt.values()].map(mean);
    const advantage = perPrompt.length
      ? perPrompt.reduce((a, b) => a + b, 0) / (perPrompt.length + PRIOR.promptCoverage)
      : 0;
    return {
      key: group.key,
      name: group.name,
      sublabel: group.sublabel,
      score: group.votes
        ? Math.min(5, Math.max(0.5, baseline + advantage))
        : null,
      raw: group.votes ? group.starSum / group.votes : null,
      answers: group.answers,
      votes: group.votes,
      prompts: group.byPrompt.size,
      best: group.best
        ? { submissionId: group.best.submissionId, promptTitle: group.best.promptTitle }
        : null,
      ranked: group.votes >= MIN_VOTES,
    };
  });

  entries.sort((a, b) => {
    if (a.ranked !== b.ranked) return a.ranked ? -1 : 1;
    if (a.ranked && b.ranked && a.score !== b.score) return (b.score ?? 0) - (a.score ?? 0);
    if (a.votes !== b.votes) return b.votes - a.votes;
    if (a.answers !== b.answers) return b.answers - a.answers;
    return a.name.localeCompare(b.name, "zh-CN");
  });

  return {
    entries,
    baseline,
    rankedCount: entries.filter((e) => e.ranked).length,
    votes: votes.length,
  };
}
