export const RATING_LABELS: Record<number, string> = {
  1: "很差",
  2: "较差",
  3: "一般",
  4: "不错",
  5: "惊艳",
};

export function isValidRating(stars: number): boolean {
  return Number.isFinite(stars) && stars >= 0.5 && stars <= 5 && Number.isInteger(stars * 2);
}

export function calculateRatingFromRatio(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0.5;
  if (ratio >= 1) return 5;
  const score = Math.ceil(ratio * 10) / 2;
  return Math.max(0.5, Math.min(5, score));
}

export function formatRatingLabel(stars: number): string {
  const rounded = Math.ceil(stars);
  const desc = RATING_LABELS[rounded];
  return desc ? `${stars} 星 · ${desc}` : `${stars} 星`;
}
