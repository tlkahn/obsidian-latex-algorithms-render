import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CacheManager } from "../../src/render/cache";
import { mkdtempSync, writeFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { sha256 } from "../../src/utils/hash";

describe("CacheManager", () => {
  let cacheDir: string;
  let cache: CacheManager;

  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), "cache-test-"));
    cache = new CacheManager(cacheDir);
  });

  afterEach(() => {
    rmSync(cacheDir, { recursive: true, force: true });
  });

  describe("getByHash / storeByHash", () => {
    it("getByHash returns cached path when file exists", () => {
      const hash = sha256("test source");
      const imgPath = join(cacheDir, "temp.png");
      writeFileSync(imgPath, "fake png");

      cache.storeByHash(hash, 200, 10, imgPath);

      const result = cache.getByHash(hash, 200, 10);
      expect(result).not.toBeNull();
      expect(existsSync(result!)).toBe(true);
    });

    it("getByHash returns null when file does not exist", () => {
      const hash = sha256("nonexistent");
      const result = cache.getByHash(hash, 200, 10);
      expect(result).toBeNull();
    });

    it("storeByHash copies image to cache dir with correct filename", () => {
      const hash = sha256("store test");
      const imgPath = join(cacheDir, "source.png");
      writeFileSync(imgPath, "image data");

      const dest = cache.storeByHash(hash, 300, 5, imgPath);

      expect(dest).toContain(hash);
      expect(dest).toContain("300");
      expect(dest).toContain("5");
      expect(existsSync(dest)).toBe(true);
    });
  });

  describe("cleanupAsync", () => {
    it("removes files older than maxAgeHours", async () => {
      const oldFile = join(cacheDir, "old_200_10.png");
      writeFileSync(oldFile, "old");

      const { utimesSync } = await import("fs");
      const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000);
      utimesSync(oldFile, oldTime, oldTime);

      await cache.cleanupAsync(1);

      expect(existsSync(oldFile)).toBe(false);
    });

    it("preserves recent files", async () => {
      const recentFile = join(cacheDir, "recent_200_10.png");
      writeFileSync(recentFile, "recent");

      await cache.cleanupAsync(1);

      expect(existsSync(recentFile)).toBe(true);
    });
  });
});
