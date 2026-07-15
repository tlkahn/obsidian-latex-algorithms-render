import { join } from "path";
import { sha256 } from "../utils/hash";
import { ProcessRunner } from "../utils/process";
import { TempDirManager } from "../utils/tempdir";
import {
  buildLatexDocument,
  writeLatexFile,
  getPdflatexPath,
  parseLatexError,
} from "./latex";
import { convertToPng } from "./convert";
import { cropImage } from "./crop";
import { CacheManager } from "./cache";

// ---- Types ----

export interface RenderOptions {
  dpi: number;
  padding: number;
  extraPreamble: string;
  fallbackEngine: "pdftoppm" | "imagemagick";
  compileTimeout: number;
}

export interface RenderResult {
  /** Absolute path to the rendered PNG. */
  imagePath: string;
  /** SHA-256 of the normalized source text. */
  sourceHash: string;
  /** Whether the result was served from cache. */
  fromCache: boolean;
}

export class PipelineError extends Error {
  constructor(
    public kind: "latex_error" | "convert_error" | "crop_error" | "timeout" | "missing_command" | "unknown",
    message: string,
    public detail?: string
  ) {
    super(message);
    this.name = "PipelineError";
  }
}

// ---- Pipeline ----

export class RenderPipeline {
  private cache: CacheManager;
  private runner: ProcessRunner;
  private tempDirManager: TempDirManager;
  /** Guards against concurrent compilation of the same source+settings. */
  private inflight: Map<string, Promise<RenderResult>>;

  constructor(
    cache: CacheManager,
    runner: ProcessRunner,
    tempDirManager: TempDirManager
  ) {
    this.cache = cache;
    this.runner = runner;
    this.tempDirManager = tempDirManager;
    this.inflight = new Map();
  }

  /**
   * Render a LaTeX algorithm source to a PNG image.
   *
   * Returns a cached image immediately if available.
   * Prevents concurrent compilations of the same source+settings combination;
   * subsequent callers receive the in-flight promise.
   *
   * Throws `PipelineError` on any failure.
   */
  async render(source: string, options: RenderOptions): Promise<RenderResult> {
    const hash = sha256(source);
    const cacheKey = `${hash}_${options.dpi}_${options.padding}`;

    // 1. Cache hit fast path
    const cached = this.cache.getByHash(hash, options.dpi, options.padding);
    if (cached) {
      return { imagePath: cached, sourceHash: hash, fromCache: true };
    }

    // 2. Concurrency guard: wait for an in-flight compilation of the same key
    const inflight = this.inflight.get(cacheKey);
    if (inflight) {
      const result = await inflight;
      return result;
    }

    // 3. Start compilation
    const promise = this.doRender(source, options, hash);
    this.inflight.set(cacheKey, promise);

    try {
      return await promise;
    } finally {
      this.inflight.delete(cacheKey);
    }
  }

  /**
   * Return the number of in-flight compilations (for diagnostics).
   */
  get inflightCount(): number {
    return this.inflight.size;
  }

  // ---- private ----

  private async doRender(
    source: string,
    options: RenderOptions,
    hash: string
  ): Promise<RenderResult> {
    const tempDir = await this.tempDirManager.create();
    let cleanupTemp = true;

    try {
      // 3a. Build and write LaTeX document
      const latex = buildLatexDocument(source, options.extraPreamble);
      const texPath = join(tempDir, "algorithm.tex");
      writeLatexFile(texPath, latex);

      // 3b. Compile with pdflatex (2 passes for cross-references)
      const pdflatex = getPdflatexPath();
      const latexArgs = [
        "-interaction=nonstopmode",
        "-halt-on-error",
        texPath,
      ];

      for (let pass = 0; pass < 2; pass++) {
        let result;
        try {
          result = await this.runner.exec(pdflatex, latexArgs, {
            cwd: tempDir,
            timeout: options.compileTimeout,
          });
        } catch (err) {
          throw new PipelineError(
            "missing_command",
            `pdflatex is not installed or not found on PATH. Please install TeX Live / MacTeX.`,
            (err as Error).message
          );
        }

        if (result.exitCode !== 0) {
          cleanupTemp = false;
          if (result.exitCode === -1) {
            throw new PipelineError(
              "timeout",
              `LaTeX compilation timed out after ${options.compileTimeout}s. Try increasing the compile timeout in settings.`
            );
          }
          const { summary } = parseLatexError(result.stderr);
          throw new PipelineError(
            "latex_error",
            `LaTeX compilation failed:\n${summary}`,
            result.stderr
          );
        }
      }

      // 3c. Convert PDF to PNG
      const pdfPath = join(tempDir, "algorithm.pdf");
      const rawPngPath = join(tempDir, "algorithm.png");
      try {
        await convertToPng(pdfPath, rawPngPath, {
          dpi: options.dpi,
          engine: options.fallbackEngine,
        }, this.runner);
      } catch (err) {
        throw new PipelineError(
          "convert_error",
          (err as Error).message ||
            "Failed to convert PDF to PNG. Install poppler-utils (pdftoppm) or ImageMagick."
        );
      }

      // 3d. Crop
      const croppedPngPath = join(tempDir, "algorithm-cropped.png");
      try {
        await cropImage(rawPngPath, croppedPngPath, options.padding, this.runner);
      } catch (err) {
        throw new PipelineError(
          "crop_error",
          (err as Error).message || "Failed to crop rendered image."
        );
      }

      // 3e. Store in persistent cache
      const cachedPath = this.cache.storeByHash(
        hash,
        options.dpi,
        options.padding,
        croppedPngPath
      );

      return {
        imagePath: cachedPath,
        sourceHash: hash,
        fromCache: false,
      };
    } catch (err) {
      if (err instanceof PipelineError) throw err;
      throw new PipelineError("unknown", (err as Error).message);
    } finally {
      if (cleanupTemp) {
        await this.tempDirManager.cleanup(tempDir);
      }
    }
  }
}
