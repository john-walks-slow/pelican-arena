import { describe, expect, it } from "vitest";
import {
  GRANT_SEGMENT,
  previewUrl,
  SANDBOX,
  submissionUrl,
  usercontentUrl,
} from "./sandbox";

describe("sandbox security policy and url builder", () => {
  it("strictly enforces sandbox flags and omits allow-same-origin", () => {
    expect(SANDBOX).toContain("allow-scripts");
    expect(SANDBOX).toContain("allow-forms");
    expect(SANDBOX).toContain("allow-modals");
    expect(SANDBOX).toContain("allow-popups");
    expect(SANDBOX).toContain("allow-downloads");
    // Critical: must NEVER contain allow-same-origin to prevent host cookie and storage access
    expect(SANDBOX).not.toContain("allow-same-origin");
  });

  it("builds public usercontent urls correctly", () => {
    const origin = "https://usercontent.example.com";
    const subId = "sub1234567890";
    expect(usercontentUrl(origin, subId, "index.html")).toBe(
      "https://usercontent.example.com/sub1234567890/index.html",
    );
    expect(submissionUrl(origin, subId, "web")).toBe(
      "https://usercontent.example.com/sub1234567890/index.html",
    );
    expect(submissionUrl(origin, subId, "markdown")).toBe(
      "https://usercontent.example.com/sub1234567890/index.md",
    );
    expect(submissionUrl(origin, subId, "svg")).toBe(
      "https://usercontent.example.com/sub1234567890/index.svg",
    );
  });

  it("injects preview grant prefix when grant is provided", () => {
    const origin = "https://usercontent.example.com";
    const subId = "sub1234567890";
    const grant = "sig-token-abc";
    const url = submissionUrl(origin, subId, "web", grant);
    expect(url).toBe(
      `https://usercontent.example.com/${GRANT_SEGMENT}/sig-token-abc/sub1234567890/index.html`,
    );
  });

  it("appends preview query flag for cached gallery previews", () => {
    const origin = "https://usercontent.example.com";
    const subId = "sub1234567890";
    expect(previewUrl(origin, subId, "web")).toBe(
      "https://usercontent.example.com/sub1234567890/index.html?preview=1",
    );
  });
});
