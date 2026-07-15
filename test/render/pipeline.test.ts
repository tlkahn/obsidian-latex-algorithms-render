import { describe, it, expect, vi, beforeEach } from "vitest";
import { RenderPipeline, PipelineError, RenderOptions } from "../../src/render/pipeline";
import { ProcessRunner, ExecResult } from "../../src/utils/process";
import { TempDirManager } from "../../src/utils/tempdir";
import { mkdtempSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const defaultOptions: RenderOptions = {
  dpi: 200,
  padding: 10,
  extraPreamble: "",
  fallbackEngine: "pdftoppm",
  compileTimeout: 30,
};

function makeMockRunner(): ProcessRunner {
  return {
    exec: vi.fn<(cmd: string, args: string[], opts?: any) => Promise<ExecResult>>()
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }),
  };
}

function makeMockTempDir(): TempDirManager {
  let dir: string;
  return {
    create: vi.fn<() => Promise<string>>().mockImplementation(async () => {
      dir = mkdtempSync(join(tmpdir(), "pipeline-test-"));
      return dir;
    }),
    cleanup: vi.fn<(dir: string) => Promise<void>>().mockResolvedValue(undefined),
  };
}

describe("RenderPipeline", () => {
  let cache: any;
  let runner: ProcessRunner;
  let tempDir: TempDirManager;
  let pipeline: RenderPipeline;

  beforeEach(() => {
    cache = {
      get: vi.fn().mockReturnValue(null),
      getByHash: vi.fn().mockReturnValue(null),
      store: vi.fn().mockReturnValue("/cache/result.png"),
      storeByHash: vi.fn().mockReturnValue("/cache/result.png"),
      cacheKey: vi.fn().mockReturnValue("key.png"),
      cacheKeyFromHash: vi.fn().mockReturnValue("key.png"),
      cachePath: vi.fn().mockReturnValue("/cache/key.png"),
      has: vi.fn().mockReturnValue(false),
      flush: vi.fn().mockReturnValue(0),
      cleanup: vi.fn(),
      cleanupAsync: vi.fn().mockResolvedValue(undefined),
    };

    runner = makeMockRunner();
    tempDir = makeMockTempDir();
    pipeline = new RenderPipeline(cache, runner, tempDir);
  });

  it("returns cached result without compilation", async () => {
    cache.getByHash.mockReturnValue("/cache/cached.png");

    const result = await pipeline.render("test source", defaultOptions);
    expect(result.fromCache).toBe(true);
    expect(result.imagePath).toBe("/cache/cached.png");
    expect(runner.exec).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent compilations", async () => {
    const doRenderSpy = vi.spyOn(pipeline as any, "doRender");
    doRenderSpy.mockResolvedValue({
      imagePath: "/cache/result.png",
      sourceHash: "abc",
      fromCache: false,
    });

    const [r1, r2] = await Promise.all([
      pipeline.render("same source", defaultOptions),
      pipeline.render("same source", defaultOptions),
    ]);

    expect(r1.imagePath).toBe(r2.imagePath);
    expect(doRenderSpy).toHaveBeenCalledTimes(1);
  });

  it("wraps unexpected errors as PipelineError kind 'unknown'", async () => {
    cache.storeByHash.mockImplementation(() => {
      throw new Error("ENOSPC");
    });

    // Runner mock succeeds for all calls (pdflatex, pdftoppm/convert)
    const mockExec = runner.exec as ReturnType<typeof vi.fn>;
    mockExec.mockImplementation(async (cmd: string, args: string[]) => {
      if (cmd === "pdftoppm") {
        // Create the expected output file so the pipeline thinks conversion succeeded
        const stem = args[args.length - 1];
        const pagePath = `${stem}-1.png`;
        writeFileSync(pagePath, "fake png");
      }
      if (cmd === "convert") {
        // For crop step: create output file
        const outputPath = args[args.length - 1];
        writeFileSync(outputPath, "fake cropped png");
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    });

    try {
      await pipeline.render("test source", defaultOptions);
      expect.fail("Expected PipelineError to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PipelineError);
      expect((err as PipelineError).kind).toBe("unknown");
      expect((err as PipelineError).message).toContain("ENOSPC");
    }
  });
});
