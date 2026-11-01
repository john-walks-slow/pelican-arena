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
  /**
   * Pulls an entry toward the site average until the evidence adds up, counted
   * in the same weight units as the votes below: at 9, an entry needs about
   * nine votes of evidence before half of its edge is believed.
   */
  evidence: 9,
} as const;

/**
 * How much weight one prompt can contribute. Votes beyond this stop counting,
 * so a single busy prompt cannot speak for an entry on its own.
 */
const PROMPT_WEIGHT_CAP = 5;

/**
 * Alternating updates stop early once no bias moves more than this, and never
 * run past the cap. Twelve rounds covers the connected shapes this site
 * produces; a prompt answered by a single answer stays partly undecidable,
 * which is the documented cost of the model.
 */
const CONVERGENCE = 1e-3;
const MAX_ROUNDS = 12;
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
  /** Place among the ranked entries, or null when the entry is not ranked. */
  place: number | null;
}

export interface Leaderboard {
  entries: LeaderboardEntry[];
  /** Average star the current selection is centered on. */
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

  const largestShift = <K>(next: Map<K, number>, previous: Map<K, number>) => {
    let largest = 0;
    for (const [key, value] of next) {
      largest = Math.max(largest, Math.abs(value - (previous.get(key) ?? 0)));
    }
    return largest;
  };

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const previous = {
      prompt: new Map(promptBias),
      voter: new Map(voterBias),
      answer: new Map(answerBias),
    };
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
    const shift = Math.max(
      largestShift(promptBias, previous.prompt),
      largestShift(voterBias, previous.voter),
      largestShift(answerBias, previous.answer),
    );
    if (shift < CONVERGENCE) break;
  }

  const starSumBySubmission = new Map<
    string,
    { stars: number; votes: number; voters: number[] }
  >();
  for (const rating of votes) {
    const bucket = starSumBySubmission.get(rating.submissionId);
    if (bucket) {
      bucket.stars += rating.stars;
      bucket.votes += 1;
      bucket.voters.push(rating.userId);
    } else {
      starSumBySubmission.set(rating.submissionId, {
        stars: rating.stars,
        votes: 1,
        voters: [rating.userId],
      });
    }
  }

  interface Group {
    key: string;
    name: string;
    sublabel: string | null;
    answers: number;
    votes: number;
    starSum: number;
    /** Everyone who rated any answer here; ranking counts people, not ballots. */
    voters: Set<number>;
    /** Every prompt this entry answered, rated or not. */
    answered: Set<string>;
    /**
     * Answer biases grouped by prompt, each carrying the votes behind it, so a
     * thinly-rated prompt counts for less than a well-rated one.
     */
    byPrompt: Map<string, { bias: number; votes: number }[]>;
    best: { submissionId: string; promptTitle: string; bias: number } | null;
  }

  const groups = new Map<string, Group>();
  for (const submission of input.submissions) {
    const ident = identify(submission, dimension);
    if (!ident) continue;
    let group = groups.get(ident.key);
    if (!group) {
      group = {
        ...ident,
        answers: 0,
        votes: 0,
        starSum: 0,
        voters: new Set(),
        answered: new Set(),
        byPrompt: new Map(),
        best: null,
      };
      groups.set(ident.key, group);
    }
    group.answers += 1;
    group.answered.add(submission.promptId);

    const tally = starSumBySubmission.get(submission.id);
    if (!tally) continue;
    group.votes += tally.votes;
    group.starSum += tally.stars;
    for (const voter of tally.voters) group.voters.add(voter);

    const bias = at(answerBias, submission.id);
    const bucket = group.byPrompt.get(submission.promptId);
    if (bucket) bucket.push({ bias, votes: tally.votes });
    else group.byPrompt.set(submission.promptId, [{ bias, votes: tally.votes }]);

    // A single five-star vote is not a best answer; require the same sample the
    // ranking itself demands.
    if (tally.votes >= MIN_VOTES && (!group.best || bias > group.best.bias)) {
      group.best = { submissionId: submission.id, promptTitle: submission.promptTitle, bias };
    }
  }

  const entries: LeaderboardEntry[] = [...groups.values()].map((group) => {
    // Average within each prompt first, then across prompts weighted by the
    // (capped) votes behind each one, and finally shrink by the total evidence.
    let weighted = 0;
    let weight = 0;
    for (const answers of group.byPrompt.values()) {
      const promptWeight = Math.min(
        answers.reduce((sum, a) => sum + a.votes, 0),
        PROMPT_WEIGHT_CAP,
      );
      weighted += mean(answers.map((a) => a.bias)) * promptWeight;
      weight += promptWeight;
    }
    const advantage = weight > 0 ? weighted / (weight + PRIOR.evidence) : 0;
    return {
      key: group.key,
      name: group.name,
      sublabel: group.sublabel,
      score: group.votes ? Math.min(5, Math.max(1, baseline + advantage)) : null,
      raw: group.votes ? group.starSum / group.votes : null,
      answers: group.answers,
      votes: group.votes,
      prompts: group.answered.size,
      best: group.best
        ? { submissionId: group.best.submissionId, promptTitle: group.best.promptTitle }
        : null,
      ranked: group.voters.size >= MIN_VOTES,
      place: null,
    };
  });

  entries.sort((a, b) => {
    if (a.ranked !== b.ranked) return a.ranked ? -1 : 1;
    if (a.ranked && b.ranked && a.score !== b.score) return (b.score ?? 0) - (a.score ?? 0);
    if (a.votes !== b.votes) return b.votes - a.votes;
    if (a.answers !== b.answers) return b.answers - a.answers;
    const byName = a.name.localeCompare(b.name, "zh-CN");
    const bySublabel = (a.sublabel ?? "").localeCompare(b.sublabel ?? "", "zh-CN");
    return byName !== 0 ? byName : bySublabel !== 0 ? bySublabel : a.key.localeCompare(b.key);
  });

  // Strict order: the place follows the score, with the sample size shown next
  // to it so a thin lead is readable as thin.
  let position = 0;
  for (const entry of entries) {
    if (!entry.ranked) continue;
    position += 1;
    entry.place = position;
  }

  return {
    entries,
    baseline,
    rankedCount: entries.filter((e) => e.ranked).length,
    votes: votes.length,
  };
}
