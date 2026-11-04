import { describe, expect, it } from "vitest";
import {
  AUTO_HIDE_REPORTS,
  availablePromptActions,
  availableSubmissionActions,
  canViewPrompt,
  canViewSubmission,
  initialPromptStatus,
  isReportReason,
  isSubmissionServable,
  reportOptions,
  severeReasons,
  PROMPT_TRANSITIONS,
  shouldAutoHide,
} from "./moderation";

const admin = { id: 1, role: "admin" as const, trustLevel: 4 };
const author = { id: 2, role: "user" as const, trustLevel: 2 };
const stranger = { id: 3, role: "user" as const, trustLevel: 1 };

describe("initialPromptStatus", () => {
  it("publishes immediately while review is off", () => {
    expect(initialPromptStatus(author, false)).toBe("active");
    expect(initialPromptStatus(stranger, false)).toBe("active");
  });

  it("holds new prompts from ordinary authors when review is on", () => {
    expect(initialPromptStatus(author, true)).toBe("pending");
    expect(initialPromptStatus({ role: "user", trustLevel: 3 }, true)).toBe("active");
    expect(initialPromptStatus(admin, true)).toBe("active");
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

  it("serves only public files directly; withdrawn, flagged or removed require a grant", () => {
    expect(isSubmissionServable("active", "active")).toBe(true);
    expect(isSubmissionServable("hidden", "active")).toBe(false);
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

describe("report reasons", () => {
  it("offers only the reasons that apply to the target", () => {
    expect(reportOptions("prompt").map((r) => r.id)).toEqual([
      "abuse",
      "spam",
      "unclear",
      "duplicate",
      "unsuitable",
      "other",
    ]);
    expect(isReportReason("metadata", "prompt")).toBe(false);
    expect(isReportReason("metadata", "submission")).toBe(true);
    expect(isReportReason("plagiarism", "prompt")).toBe(false);
  });

  it("marks the same core violations severe for both targets", () => {
    expect(severeReasons("prompt")).toEqual(["abuse", "spam"]);
    expect(severeReasons("submission")).toEqual(["malicious", "abuse", "spam"]);
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
