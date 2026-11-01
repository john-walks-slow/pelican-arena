import { describe, expect, it } from "vitest";
import {
  AUTO_HIDE_REPORTS,
  availablePromptActions,
  availableSubmissionActions,
  canViewPrompt,
  canViewSubmission,
  initialPromptStatus,
  isSubmissionServable,
  PROMPT_TRANSITIONS,
  shouldAutoHide,
} from "./moderation";

const admin = { id: 1, role: "admin" as const, trustLevel: 4 };
const author = { id: 2, role: "user" as const, trustLevel: 2 };
const stranger = { id: 3, role: "user" as const, trustLevel: 1 };

describe("initialPromptStatus", () => {
  it("holds new prompts from ordinary authors for review", () => {
    expect(initialPromptStatus(author)).toBe("pending");
    expect(initialPromptStatus({ role: "user", trustLevel: 3 })).toBe("active");
    expect(initialPromptStatus(admin)).toBe("active");
  });
});

describe("visibility", () => {
  const pending = { status: "pending" as const, authorId: author.id };

  it("shows a pending prompt only to its author and admins", () => {
    expect(canViewPrompt(null, pending)).toBe(false);
    expect(canViewPrompt(stranger, pending)).toBe(false);
    expect(canViewPrompt(author, pending)).toBe(true);
    expect(canViewPrompt(admin, pending)).toBe(true);
  });

  it("hides an answer when either the answer or its prompt is not live", () => {
    const flagged = { status: "flagged" as const, authorId: author.id };
    expect(canViewSubmission(stranger, flagged, "active")).toBe(false);
    expect(canViewSubmission(author, flagged, "active")).toBe(true);
    expect(canViewSubmission(admin, flagged, "active")).toBe(true);
    expect(
      canViewSubmission(stranger, { status: "active", authorId: author.id }, "pending"),
    ).toBe(false);
  });

  it("serves withdrawn files by direct link but never flagged ones", () => {
    expect(isSubmissionServable("hidden", "active")).toBe(true);
    expect(isSubmissionServable("active", "active")).toBe(true);
    expect(isSubmissionServable("flagged", "active")).toBe(false);
    expect(isSubmissionServable("removed", "active")).toBe(false);
    expect(isSubmissionServable("active", "removed")).toBe(false);
  });
});

describe("transitions", () => {
  it("offers only the moves the current status allows", () => {
    expect(availablePromptActions("pending")).toEqual(["approve", "reject"]);
    expect(availablePromptActions("rejected")).toEqual(["restore"]);
    expect(availablePromptActions("active")).toEqual(["remove"]);
    expect(availableSubmissionActions("flagged")).toEqual(["keep", "remove"]);
    expect(availableSubmissionActions("hidden")).toEqual(["remove"]);
    expect(availableSubmissionActions("removed")).toEqual(["restore"]);
  });

  it("requires a reason when rejecting or removing", () => {
    expect(PROMPT_TRANSITIONS.reject.noteRequired).toBe(true);
    expect(PROMPT_TRANSITIONS.remove.noteRequired).toBe(true);
    expect(PROMPT_TRANSITIONS.approve.noteRequired).toBe(false);
  });
});

describe("shouldAutoHide", () => {
  it("hides a live answer once enough severe reports arrive", () => {
    expect(shouldAutoHide("active", AUTO_HIDE_REPORTS - 1)).toBe(false);
    expect(shouldAutoHide("active", AUTO_HIDE_REPORTS)).toBe(true);
    expect(shouldAutoHide("hidden", AUTO_HIDE_REPORTS)).toBe(false);
    expect(shouldAutoHide("removed", AUTO_HIDE_REPORTS)).toBe(false);
  });
});
