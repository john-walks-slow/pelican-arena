import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cachedClientLoader,
  clearRouteCache,
  mergeCachedData,
  primeRouteCache,
  routeCacheKey,
  updateRouteCache,
} from "./route-cache";

describe("route-cache", () => {
  beforeEach(() => {
    clearRouteCache();
  });

  afterEach(() => {
    clearRouteCache();
    vi.restoreAllMocks();
  });

  describe("routeCacheKey", () => {
    it("extracts pathname and search", () => {
      expect(routeCacheKey("/p/123?q=test&page=2")).toBe("/p/123?q=test&page=2");
      expect(routeCacheKey("https://arena.example.com/prompts?kind=web")).toBe(
        "/prompts?kind=web",
      );
      expect(routeCacheKey("/")).toBe("/");
    });
  });

  describe("primeRouteCache & updateRouteCache", () => {
    it("primes cache only once per key", () => {
      primeRouteCache("/", { prompts: [{ id: "1" }], nextPage: 2 });
      // Second prime should not overwrite
      primeRouteCache("/", { prompts: [{ id: "2" }], nextPage: 3 });

      const request = new Request("http://local/");
      const data = cachedClientLoader(request, async () => ({ prompts: [], nextPage: null }));
      expect(data).toEqual({ prompts: [{ id: "1" }], nextPage: 2 });
    });

    it("updates existing cache entries via updateRouteCache", () => {
      primeRouteCache("/", { prompts: [{ id: "1" }], nextPage: 2 });
      updateRouteCache<any>("/", (prev) => ({
        ...prev,
        prompts: [...prev.prompts, { id: "2" }],
        nextPage: 3,
      }));

      const request = new Request("http://local/");
      const data = cachedClientLoader(request, async () => ({ prompts: [], nextPage: null }));
      expect(data).toEqual({
        prompts: [{ id: "1" }, { id: "2" }],
        nextPage: 3,
      });
    });

    it("does nothing when updating non-existent key", () => {
      expect(() => {
        updateRouteCache("/non-existent", (prev) => prev);
      }).not.toThrow();
    });
  });

  describe("mergeCachedData", () => {
    it("preserves appended pages and nextPage when fresh only has page 1", () => {
      const existing = {
        prompts: [{ id: "p1", title: "old 1" }, { id: "p2" }, { id: "p3" }],
        total: 10,
        nextPage: 3,
      };
      const fresh = {
        prompts: [{ id: "p1", title: "new 1" }],
        total: 11,
        nextPage: 2,
      };

      const merged = mergeCachedData(existing, fresh);
      expect(merged.prompts).toHaveLength(3);
      expect(merged.prompts[0]).toEqual({ id: "p1", title: "new 1" });
      expect(merged.prompts[1]).toEqual({ id: "p2" });
      expect(merged.prompts[2]).toEqual({ id: "p3" });
      expect(merged.total).toBe(11);
      expect(merged.nextPage).toBe(3);
    });

    it("handles nested structures like result.prompts", () => {
      const existing = {
        result: {
          prompts: [{ id: "p1" }, { id: "p2" }, { id: "p3" }],
          nextPage: 3,
        },
      };
      const fresh = {
        result: {
          prompts: [{ id: "p1" }],
          nextPage: 2,
        },
      };

      const merged = mergeCachedData(existing, fresh);
      expect(merged.result.prompts).toHaveLength(3);
      expect(merged.result.nextPage).toBe(3);
    });

    it("returns fresh when existing is not larger", () => {
      const existing = {
        prompts: [{ id: "p1" }],
        nextPage: 2,
      };
      const fresh = {
        prompts: [{ id: "p1" }],
        nextPage: 2,
      };

      const merged = mergeCachedData(existing, fresh);
      expect(merged).toEqual(fresh);
    });

    it("safely handles non-object values", () => {
      expect(mergeCachedData(null, { a: 1 })).toEqual({ a: 1 });
      expect(mergeCachedData(undefined, "hello")).toBe("hello");
    });
  });

  describe("cachedClientLoader", () => {
    it("returns immediate cached data on hit without waiting for network", async () => {
      primeRouteCache("/test", { count: 42 });

      const serverLoader = vi.fn(async () => ({ count: 99 }));
      const request = new Request("http://local/test");

      const result = cachedClientLoader(request, serverLoader);
      expect(result).toEqual({ count: 42 });
      expect(serverLoader).not.toHaveBeenCalled();
    });

    it("fetches from server on cache miss", async () => {
      const serverLoader = vi.fn(async () => ({ count: 100 }));
      const request = new Request("http://local/miss");

      const promise = cachedClientLoader(request, serverLoader);
      expect(promise).toBeInstanceOf(Promise);
      const result = await promise;
      expect(result).toEqual({ count: 100 });
      expect(serverLoader).toHaveBeenCalledTimes(1);

      // Subsequent call should hit cache
      const secondCall = cachedClientLoader(request, serverLoader);
      expect(secondCall).toEqual({ count: 100 });
      expect(serverLoader).toHaveBeenCalledTimes(1);
    });
  });
});
