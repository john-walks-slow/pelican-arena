import { beforeEach, describe, expect, it } from "vitest";
import {
  __setNavigationEntriesForTest,
  canGoBackInApp,
  getBackDelta,
  recordNavigation,
  type HistoryEntry,
} from "./navigation-history";

describe("navigation history stack", () => {
  beforeEach(() => {
    __setNavigationEntriesForTest([]);
  });

  describe("recordNavigation", () => {
    it("initializes empty stack with the first entry", () => {
      const next: HistoryEntry = { key: "k1", pathname: "/" };
      expect(recordNavigation([], next, "PUSH")).toEqual([next]);
    });

    it("appends new entries on push", () => {
      const e1: HistoryEntry = { key: "k1", pathname: "/" };
      const e2: HistoryEntry = { key: "k2", pathname: "/p/1" };
      expect(recordNavigation([e1], e2, "PUSH")).toEqual([e1, e2]);
    });

    it("does not duplicate when key is identical", () => {
      const e1: HistoryEntry = { key: "k1", pathname: "/" };
      expect(recordNavigation([e1], e1, "PUSH")).toEqual([e1]);
    });

    it("replaces the top entry on replace", () => {
      const e1: HistoryEntry = { key: "k1", pathname: "/" };
      const e2: HistoryEntry = { key: "k2", pathname: "/p/1" };
      const e2New: HistoryEntry = { key: "k3", pathname: "/p/1?tab=source" };
      expect(recordNavigation([e1, e2], e2New, "REPLACE")).toEqual([e1, e2New]);
    });

    it("slices stack back to previous key on pop", () => {
      const e1: HistoryEntry = { key: "k1", pathname: "/" };
      const e2: HistoryEntry = { key: "k2", pathname: "/p/1" };
      const e3: HistoryEntry = { key: "k3", pathname: "/p/1/submit" };
      expect(recordNavigation([e1, e2, e3], e2, "POP")).toEqual([e1, e2]);
    });
  });

  describe("getBackDelta and canGoBackInApp", () => {
    it("returns null when stack has only 0 or 1 entry", () => {
      expect(getBackDelta()).toBeNull();
      expect(canGoBackInApp()).toBe(false);

      __setNavigationEntriesForTest([{ key: "k1", pathname: "/p/1" }]);
      expect(getBackDelta()).toBeNull();
      expect(canGoBackInApp()).toBe(false);
    });

    it("returns -1 for simple two-page transitions", () => {
      __setNavigationEntriesForTest([
        { key: "k1", pathname: "/" },
        { key: "k2", pathname: "/p/1" },
      ]);
      expect(getBackDelta()).toBe(-1);
      expect(canGoBackInApp()).toBe(true);
    });

    it("skips modal overlay routes when popping back", () => {
      // Flow: /p/1 -> /p/1/submit (modal) -> /s/10 (submission detail)
      __setNavigationEntriesForTest([
        { key: "k1", pathname: "/p/1" },
        { key: "k2", pathname: "/p/1/submit" },
        { key: "k3", pathname: "/s/10" },
      ]);
      // Clicking back on /s/10 should skip /p/1/submit and land on /p/1 (-2 steps)
      expect(getBackDelta()).toBe(-2);
      expect(canGoBackInApp()).toBe(true);
    });

    it("skips modal edit dialog and redundant entries of the same screen", () => {
      // Flow: /me -> /s/10 -> /s/10/edit (modal) -> /s/10 (redirect back after save)
      __setNavigationEntriesForTest([
        { key: "k1", pathname: "/me" },
        { key: "k2", pathname: "/s/10" },
        { key: "k3", pathname: "/s/10/edit" },
        { key: "k4", pathname: "/s/10" },
      ]);
      // On /s/10, clicking back should skip /s/10/edit and the previous /s/10, landing on /me (-3 steps)
      expect(getBackDelta()).toBe(-3);
      expect(canGoBackInApp()).toBe(true);
    });

    it("returns null if all previous entries are modal routes", () => {
      // Flow: direct landing on /p/1/submit -> /s/10
      __setNavigationEntriesForTest([
        { key: "k1", pathname: "/p/1/submit" },
        { key: "k2", pathname: "/s/10" },
      ]);
      expect(getBackDelta()).toBeNull();
      expect(canGoBackInApp()).toBe(false);
    });

    it("pops back to host page when currently on a modal route", () => {
      // Flow: /p/1 -> /p/1/submit
      __setNavigationEntriesForTest([
        { key: "k1", pathname: "/p/1" },
        { key: "k2", pathname: "/p/1/submit" },
      ]);
      expect(getBackDelta()).toBe(-1);
      expect(canGoBackInApp()).toBe(true);
    });
  });
});
