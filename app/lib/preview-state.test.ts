import { describe, expect, it } from "vitest";
import { resolvePreviewLayer } from "./preview-state";

describe("resolvePreviewLayer", () => {
  it("prefers the live frame once it is ready", () => {
    expect(resolvePreviewLayer({ poster: "ready", liveRequested: true, live: "ready" })).toBe(
      "live",
    );
  });

  it("keeps the poster while the live frame is still loading", () => {
    expect(resolvePreviewLayer({ poster: "ready", liveRequested: true, live: "loading" })).toBe(
      "poster",
    );
  });

  it("shows the loading layer only while something can still arrive", () => {
    expect(resolvePreviewLayer({ poster: "loading", liveRequested: false, live: "idle" })).toBe(
      "loading",
    );
    expect(resolvePreviewLayer({ poster: "idle", liveRequested: true, live: "loading" })).toBe(
      "loading",
    );
  });

  it("settles on the empty state when nothing is loading or ready", () => {
    expect(resolvePreviewLayer({ poster: "error", liveRequested: false, live: "idle" })).toBe(
      "empty",
    );
    expect(resolvePreviewLayer({ poster: "error", liveRequested: true, live: "error" })).toBe(
      "empty",
    );
    expect(resolvePreviewLayer({ poster: "idle", liveRequested: true, live: "error" })).toBe(
      "empty",
    );
  });

  it("retries the loading state when the frame remounts", () => {
    expect(resolvePreviewLayer({ poster: "idle", liveRequested: true, live: "loading" })).toBe(
      "loading",
    );
  });
});
