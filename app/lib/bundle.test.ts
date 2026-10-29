import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildBundle, BundleError, BUNDLE_LIMITS, normalizePath, unzipBundle } from "./bundle";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("normalizePath", () => {
  it("cleans separators and rejects traversal", () => {
    expect(normalizePath("./assets\\app.js")).toBe("assets/app.js");
    expect(normalizePath("/index.html")).toBe("index.html");
    expect(normalizePath("a/../../etc/passwd")).toBeNull();
    expect(normalizePath("")).toBeNull();
  });
});

describe("buildBundle", () => {
  it("unwraps a single top-level folder and drops OS junk", () => {
    const files = buildBundle([
      { path: "pelican/index.html", data: bytes("<h1>hi</h1>") },
      { path: "pelican/app.js", data: bytes("1") },
      { path: "pelican/.DS_Store", data: bytes("x") },
      { path: "__MACOSX/pelican/._app.js", data: bytes("x") },
    ]);
    expect(files.map((f) => f.path)).toEqual(["app.js", "index.html"]);
  });

  it("requires an index.html entry", () => {
    expect(() => buildBundle([{ path: "main.html", data: bytes("") }])).toThrow(BundleError);
  });

  it("rejects bundles over the total size limit", () => {
    const big = new Uint8Array(BUNDLE_LIMITS.totalBytes);
    expect(() =>
      buildBundle([
        { path: "index.html", data: bytes("x") },
        { path: "big.bin", data: big },
      ]),
    ).toThrow(BundleError);
  });
});

describe("unzipBundle", () => {
  it("reads a zip into entries", () => {
    const zip = zipSync({ "index.html": bytes("<p>ok</p>"), "css/a.css": bytes("p{}") });
    const files = buildBundle(unzipBundle(zip));
    expect(files.map((f) => f.path)).toEqual(["css/a.css", "index.html"]);
  });

  it("refuses archives that inflate past the limit", () => {
    const zip = zipSync({ "index.html": new Uint8Array(BUNDLE_LIMITS.totalBytes + 1) }, { level: 9 });
    expect(zip.byteLength).toBeLessThan(BUNDLE_LIMITS.zipBytes);
    expect(() => unzipBundle(zip)).toThrow(BundleError);
  });
});
