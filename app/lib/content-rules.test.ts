import { describe, expect, it } from "vitest";
import {
  CONTENT_RULES_ITEMS,
  CONTENT_RULES_REQUIRED_SECONDS,
  CONTENT_RULES_TITLE,
  hasAcceptedContentRules,
} from "./content-rules";

describe("content rules", () => {
  it("defines core rules configuration", () => {
    expect(CONTENT_RULES_TITLE).toBe("内容规则");
    expect(CONTENT_RULES_REQUIRED_SECONDS).toBe(5);
    expect(CONTENT_RULES_ITEMS.length).toBeGreaterThanOrEqual(4);

    for (const item of CONTENT_RULES_ITEMS) {
      expect(item.id).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.description).toBeTruthy();
    }
  });

  it("checks acceptance state correctly", () => {
    expect(hasAcceptedContentRules(null)).toBe(false);
    expect(hasAcceptedContentRules(undefined)).toBe(false);
    expect(hasAcceptedContentRules({})).toBe(false);
    expect(hasAcceptedContentRules({ rulesAccepted: false })).toBe(false);
    expect(hasAcceptedContentRules({ rulesAcceptedAt: null })).toBe(false);

    expect(hasAcceptedContentRules({ rulesAccepted: true })).toBe(true);
    expect(hasAcceptedContentRules({ rulesAcceptedAt: new Date() })).toBe(true);
    expect(hasAcceptedContentRules({ rulesAcceptedAt: Date.now() })).toBe(true);
  });
});
