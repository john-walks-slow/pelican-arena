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
  model: CatalogEntry;
}

export interface LeaderboardRating {
  userId: number;
  submissionId: string;
  stars: number;
}

export interface LeaderboardEntry {
  key: string;
  name: string;
  /** Calibrated score on the five-star scale, or null when unrated. */
  score: number | null;
  /** Plain average of the stars received, for comparison. */
  raw: number | null;
  answers: number;
  votes: number;
  prompts: number;
  /** False when no answer of this entry could be compared under equal conditions. */
  comparable: boolean;
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

export function buildLeaderboard(input: {
  submissions: LeaderboardSubmission[];
  ratings: LeaderboardRating[];
}): Leaderboard {
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
    answers: number;
    votes: number;
    starSum: number;
    /** Everyone who rated any answer here; ranking counts people, not ballots. */
    voters: Set<number>;
    /** Every prompt this entry answered, rated or not. */
    answered: Set<string>;
    /** Weighted sum of same-cell contrasts, and the weight behind it. */
    weighted: number;
    weight: number;
    /** Whether any comparison at all was possible. */
    comparable: boolean;
  }

  const groups = new Map<string, Group>();
  const groupOf = (model: CatalogEntry): Group => {
    let group = groups.get(model.id);
    if (!group) {
      group = {
        key: model.id,
        name: model.name,
        answers: 0,
        votes: 0,
        starSum: 0,
        voters: new Set(),
        answered: new Set(),
        weighted: 0,
        weight: 0,
        comparable: false,
      };
      groups.set(model.id, group);
    }
    return group;
  };

  /**
   * A model is only compared with the models that answered the same prompt: the
   * score is how far it sits from the rest of that prompt's field, so题目难度
   * cancels out instead of favouring whoever picked the easy ones.
   */
  const cells = new Map<string, Map<string, { bias: number; answers: number; votes: number }>>();

  for (const submission of input.submissions) {
    const group = groupOf(submission.model);
    group.answers += 1;
    group.answered.add(submission.promptId);

    const tally = starSumBySubmission.get(submission.id);
    if (!tally) continue;
    group.votes += tally.votes;
    group.starSum += tally.stars;
    for (const voter of tally.voters) group.voters.add(voter);

    let cell = cells.get(submission.promptId);
    if (!cell) {
      cell = new Map();
      cells.set(submission.promptId, cell);
    }
    const slot = cell.get(submission.model.id);
    const bias = at(answerBias, submission.id);
    if (slot) {
      slot.bias += bias;
      slot.answers += 1;
      slot.votes += tally.votes;
    } else {
      cell.set(submission.model.id, { bias, answers: 1, votes: tally.votes });
    }
  }

  // Turn each cell into a contrast against the other entries in it.
  for (const cell of cells.values()) {
    if (cell.size < 2) continue;
    let biasSum = 0;
    let answerCount = 0;
    for (const slot of cell.values()) {
      biasSum += slot.bias;
      answerCount += slot.answers;
    }
    for (const [key, slot] of cell) {
      // An entry with no votes here contributes nothing usable.
      if (slot.votes === 0) continue;
      const others = answerCount - slot.answers;
      if (others === 0) continue;
      const contrast = slot.bias / slot.answers - (biasSum - slot.bias) / others;
      const group = groups.get(key);
      if (!group) continue;
      const weight = Math.min(slot.votes, PROMPT_WEIGHT_CAP);
      group.weighted += contrast * weight;
      group.weight += weight;
      group.comparable = true;
    }
  }

  const entries: LeaderboardEntry[] = [...groups.values()].map((group) => {
    // The pooled contrast shrinks toward "no advantage" until the comparisons
    // add up, so a single shared cell cannot lift an entry onto the podium.
    const advantage = group.weight > 0 ? group.weighted / (group.weight + PRIOR.evidence) : 0;
    return {
      key: group.key,
      name: group.name,
      score: group.comparable
        ? Math.min(5, Math.max(1, baseline + advantage))
        : null,
      raw: group.votes ? group.starSum / group.votes : null,
      answers: group.answers,
      votes: group.votes,
      prompts: group.answered.size,
      comparable: group.comparable,
      ranked: group.comparable && group.voters.size >= MIN_VOTES,
      place: null,
    };
  });

  entries.sort((a, b) => {
    if (a.ranked !== b.ranked) return a.ranked ? -1 : 1;
    if (a.ranked && b.ranked && a.score !== b.score) return (b.score ?? 0) - (a.score ?? 0);
    if (a.votes !== b.votes) return b.votes - a.votes;
    if (a.answers !== b.answers) return b.answers - a.answers;
    const byName = a.name.localeCompare(b.name, "zh-CN");
    return byName !== 0 ? byName : a.key.localeCompare(b.key);
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
