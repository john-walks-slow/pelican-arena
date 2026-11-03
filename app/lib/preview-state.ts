/**
 * A preview is a stack of two media layers: a static poster (thumbnail) and a
 * live frame (the answer page). Neither is guaranteed to exist or load, so the
 * visible layer is derived from what each one has actually reported instead of
 * from "which event have we seen" flags.
 */
export type MediaStatus = "idle" | "loading" | "ready" | "error";

export type PreviewLayer = "poster" | "live" | "loading" | "empty";

export function resolvePreviewLayer(input: {
  poster: MediaStatus;
  liveRequested: boolean;
  live: MediaStatus;
}): PreviewLayer {
  const { poster, liveRequested, live } = input;

  if (liveRequested && live === "ready") return "live";
  if (poster === "ready") return "poster";
  if (poster === "loading" || (liveRequested && live === "loading")) return "loading";
  return "empty";
}
