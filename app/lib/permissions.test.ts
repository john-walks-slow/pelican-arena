import { describe, expect, it } from "vitest";
import {
  ACTION_LABELS,
  DAILY_LIMITS,
  LIMIT_NOUNS,
  TRUST,
  can,
  denyReason,
  type Action,
} from "./permissions";

describe("permissions and gate rules", () => {
  it("defines consistent action labels and trust levels", () => {
    const actions: Action[] = ["createPrompt", "submit", "rate", "report"];
    for (const action of actions) {
      expect(ACTION_LABELS[action]).toBeDefined();
      expect(TRUST[action]).toBeGreaterThanOrEqual(1);
      expect(DAILY_LIMITS[action]).toBeGreaterThan(0);
      expect(LIMIT_NOUNS[action]).toBeDefined();
    }
  });

  it("checks trust levels correctly", () => {
    const guest = null;
    expect(can(guest, "submit")).toBe(false);
    expect(denyReason(guest, "submit")).toBe("请先登录");

    const tl0User = { trustLevel: 0, silenced: false, role: "user" as const };
    expect(can(tl0User, "submit")).toBe(false);
    expect(can(tl0User, "createPrompt")).toBe(false);
    expect(denyReason(tl0User, "submit")).toBe("需要信任等级 1 及以上");

    const tl1User = { trustLevel: 1, silenced: false, role: "user" as const };
    expect(can(tl1User, "submit")).toBe(true);
    expect(can(tl1User, "rate")).toBe(true);
    expect(can(tl1User, "report")).toBe(true);
    expect(can(tl1User, "createPrompt")).toBe(false);

    const tl2User = { trustLevel: 2, silenced: false, role: "user" as const };
    expect(can(tl2User, "createPrompt")).toBe(true);

    const silencedUser = { trustLevel: 3, silenced: true, role: "user" as const };
    expect(can(silencedUser, "submit")).toBe(false);
    expect(denyReason(silencedUser, "submit")).toBe("你的论坛账号处于禁言状态");

    const admin = { trustLevel: 0, silenced: true, role: "admin" as const };
    expect(can(admin, "createPrompt")).toBe(true);
    expect(can(admin, "submit")).toBe(true);
  });
});
