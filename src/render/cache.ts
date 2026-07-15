import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "fs";
import { join } from "path";
import { sha256 } from "../utils/hash";

/**
 * Manages the on-disk cache of rendered algorithm images.
 *
 * Cache key format:
 *   SHA256(normalized(source)) + "_" + dpi + "_" + padding + ".png"
 *
 * Cache location (default):
 *   <vault>/.obsidian/plugins/latex-algorithms-render/cache/
 */
export class CacheManager {
  private cacheDir: string;

  /**
   * @param cacheDir  Absolute path to the cache directory.
   */
  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    this.ensureCacheDir();
  }

  // ---- public API ----

  /**
   * Compute the cache filename for the given source + settings.
   */
  cacheKey(source: string, dpi: number, padding: number): string {
    const hash = sha256(source);
    return `${hash}_${dpi}_${padding}.png`;
  }

  /**
   * Return the expected absolute path for a cache key.
   */
  cachePath(key: string): string {
    return join(this.cacheDir, key);
  }

  /**
   * Check whether an image exists in the cache for the given parameters.
   */
  has(source: string, dpi: number, padding: number): boolean {
    const key = this.cacheKey(source, dpi, padding);
    return existsSync(this.cachePath(key));
  }

  /**
   * Retrieve the absolute path to a cached image, or null if not cached.
   */
  get(source: string, dpi: number, padding: number): string | null {
    const key = this.cacheKey(source, dpi, padding);
    const p = this.cachePath(key);
    return existsSync(p) ? p : null;
  }

  /**
   * Store a rendered image in the cache by copying it from its current location.
   */
  store(source: string, dpi: number, padding: number, imagePath: string): string {
    const key = this.cacheKey(source, dpi, padding);
    const dest = this.cachePath(key);
    this.ensureCacheDir();
    copyFileSync(imagePath, dest);
    return dest;
  }

  /**
   * Remove all cached images.
   * Returns the number of files removed.
   */
  flush(): number {
    if (!existsSync(this.cacheDir)) return 0;
    let count = 0;
    const entries = readdirSync(this.cacheDir);
    for (const entry of entries) {
      const fullPath = join(this.cacheDir, entry);
      try {
        unlinkSync(fullPath);
        count++;
      } catch {
        // Ignore -- file may have been deleted concurrently
      }
    }
    return count;
  }

  /**
   * Remove cached images older than `maxAgeHours`.
   * Skips non-.png files.
   */
  cleanup(maxAgeHours: number): void {
    if (!existsSync(this.cacheDir)) return;
    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    const entries = readdirSync(this.cacheDir);
    for (const entry of entries) {
      if (!entry.endsWith(".png")) continue;
      const fullPath = join(this.cacheDir, entry);
      try {
        const st = statSync(fullPath);
        if (now - st.mtimeMs > maxAgeMs) {
          unlinkSync(fullPath);
        }
      } catch {
        // Ignore -- file may have been deleted concurrently
      }
    }
  }

  // ---- private ----

  private ensureCacheDir(): void {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }
}
