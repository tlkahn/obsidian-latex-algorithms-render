import { describe, it, expect, vi, beforeEach } from "vitest";
import { convertToPng } from "../../src/render/convert";
import { ProcessRunner, ExecResult } from "../../src/utils/process";
import { mkdtempSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("convertToPng", () => {
  let testDir: string;
  let runner: ProcessRunner;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "convert-test-"));
    runner = {
      exec: vi.fn<(cmd: string, args: string[], opts?: any) => Promise<ExecResult>>()
        .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }),
    };
  });

  it("warns when pdftoppm produces multiple pages", async () => {
    const pdfPath = join(testDir, "input.pdf");
    const pngPath = join(testDir, "output.png");
    const stem = join(testDir, "output");
    writeFileSync(pdfPath, "fake pdf");

    const mockExec = runner.exec as ReturnType<typeof vi.fn>;
    mockExec.mockImplementation(async (cmd: string, args: string[]) => {
      if (cmd === "pdftoppm") {
        writeFileSync(`${stem}-1.png`, "page 1");
        writeFileSync(`${stem}-2.png`, "page 2");
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await convertToPng(pdfPath, pngPath, { dpi: 200, engine: "pdftoppm" }, runner);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("multiple pages")
    );
    warnSpy.mockRestore();
  });

  it("renames page-suffixed output when pdftoppm creates stem-1.png", async () => {
    const pdfPath = join(testDir, "input.pdf");
    const pngPath = join(testDir, "output.png");
    const stem = join(testDir, "output");
    writeFileSync(pdfPath, "fake pdf");

    const mockExec = runner.exec as ReturnType<typeof vi.fn>;
    mockExec.mockImplementation(async (cmd: string) => {
      if (cmd === "pdftoppm") {
        writeFileSync(`${stem}-1.png`, "page 1");
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    });

    await convertToPng(pdfPath, pngPath, { dpi: 200, engine: "pdftoppm" }, runner);

    expect(existsSync(pngPath)).toBe(true);
  });
});
