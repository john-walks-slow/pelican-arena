import { describe, expect, it } from "vitest";
import { captureClientThumbnail } from "./client-thumbnail";

describe("client-thumbnail", () => {
  it("safely handles non-browser environments or empty data", async () => {
    // In node test environment without browser canvas/document, returns null safely
    const result = await captureClientThumbnail("svg", new Uint8Array());
    expect(result === null || result instanceof Blob).toBe(true);
  });

  it("handles empty web kind safely", async () => {
    const result = await captureClientThumbnail("web", new Uint8Array());
    expect(result === null || result instanceof Blob).toBe(true);
  });
});
