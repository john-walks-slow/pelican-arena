/**
 * Leaderboard scoring. Pure functions so the rules can be unit-tested apart
 * from the database.
 *
 * 1. Each submission's stars are shrunk toward the global mean (Bayesian
 *    average), so one 5-star vote does not beat twenty 4.6-star votes.
 * 2. Within each prompt, submissions are ranked into a 0–1 percentile, so a
 *    hard prompt and an easy prompt weigh the same.
 * 3. A model / provider / pair scores the mean percentile of its submissions,
 *    and only appears once it has enough rated submissions.
 */

export interface ScoredInput {
  submissionId: string;
  promptId: string;
  groupKey: string;
  starSum: number;
  votes: number;
}

export interface LeaderboardRow {
  groupKey: string;
  score: number;
  submissions: number;
  prompts: number;
  votes: number;
  avgStars: number;
}

export const PRIOR_VOTES = 3;
export const MIN_SUBMISSIONS = 3;

export function bayesian(starSum: number, votes: number, prior: number, priorVotes = PRIOR_VOTES) {
  return (starSum + prior * priorVotes) / (votes + priorVotes);
}

/** Midrank percentile: ties share a rank; a lone submission sits at 0.5. */
export function percentiles(values: number[]): number[] {
  const n = values.length;
  if (n === 1) return [0.5];
  return values.map((v) => {
    let below = 0;
    let equal = 0;
    for (const other of values) {
      if (other < v) below += 1;
      else if (other === v) equal += 1;
    }
    return (below + (equal - 1) / 2) / (n - 1);
  });
}

export function buildLeaderboard(
  inputs: ScoredInput[],
  minSubmissions = MIN_SUBMISSIONS,
): LeaderboardRow[] {
  const rated = inputs.filter((i) => i.votes > 0);
  if (rated.length === 0) return [];

  const totalStars = rated.reduce((s, i) => s + i.starSum, 0);
  const totalVotes = rated.reduce((s, i) => s + i.votes, 0);
  const prior = totalStars / totalVotes;

  const byPrompt = new Map<string, ScoredInput[]>();
  for (const input of rated) {
    const list = byPrompt.get(input.promptId) ?? [];
    list.push(input);
    byPrompt.set(input.promptId, list);
  }

  const percentileOf = new Map<string, number>();
  for (const list of byPrompt.values()) {
    const scores = list.map((i) => bayesian(i.starSum, i.votes, prior));
    percentiles(scores).forEach((p, idx) => percentileOf.set(list[idx].submissionId, p));
  }

  const groups = new Map<string, ScoredInput[]>();
  for (const input of rated) {
    const list = groups.get(input.groupKey) ?? [];
    list.push(input);
    groups.set(input.groupKey, list);
  }

  const rows: LeaderboardRow[] = [];
  for (const [groupKey, list] of groups) {
    if (list.length < minSubmissions) continue;
    const votes = list.reduce((s, i) => s + i.votes, 0);
    const stars = list.reduce((s, i) => s + i.starSum, 0);
    rows.push({
      groupKey,
      score: list.reduce((s, i) => s + percentileOf.get(i.submissionId)!, 0) / list.length,
      submissions: list.length,
      prompts: new Set(list.map((i) => i.promptId)).size,
      votes,
      avgStars: stars / votes,
    });
  }
  return rows.sort((a, b) => b.score - a.score || b.votes - a.votes);
}
