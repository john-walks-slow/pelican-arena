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

export function formatRatingLabel(stars: number): string {
  const desc = RATING_LABELS[stars];
  return desc ? `${stars} 星 · ${desc}` : `${stars} 星`;
}
