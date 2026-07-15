import { existsSync, renameSync } from "fs";
import { join, dirname, basename } from "path";
import { ProcessRunner } from "../utils/process";

export interface ConvertOptions {
  dpi: number;
  engine: "pdftoppm" | "imagemagick";
}

/**
 * Convert a PDF to a PNG image.
 *
 * Strategy:
 *  1. Try pdftoppm first (faster, better compression).
 *  2. If pdftoppm is unavailable, fall back to ImageMagick convert.
 *
 * @param pdfPath  Absolute path to the input PDF.
 * @param pngPath  Desired output PNG path.
 * @param options  Conversion settings (DPI, preferred engine).
 * @param runner   ProcessRunner instance.
 */
export async function convertToPng(
  pdfPath: string,
  pngPath: string,
  options: ConvertOptions,
  runner: ProcessRunner
): Promise<void> {
  // Try preferred engine first, then the other
  const engines: Array<"pdftoppm" | "imagemagick"> =
    options.engine === "pdftoppm"
      ? ["pdftoppm", "imagemagick"]
      : ["imagemagick", "pdftoppm"];

  for (const engine of engines) {
    try {
      if (engine === "pdftoppm") {
        await convertWithPdftoppm(pdfPath, pngPath, options.dpi, runner);
      } else {
        await convertWithImageMagick(pdfPath, pngPath, options.dpi, runner);
      }
      // Success -- file exists at pngPath
      if (existsSync(pngPath)) {
        return;
      }
      // pdftoppm may have created a page-suffixed file like output-1.png
      if (engine === "pdftoppm") {
        const dir = dirname(pngPath);
        const stem = basename(pngPath, ".png");
        const pagePath = join(dir, `${stem}-1.png`);
        if (existsSync(pagePath)) {
          renameSync(pagePath, pngPath);
          return;
        }
      }
    } catch {
      // Engine failed, try next one
      continue;
    }
  }

  throw new Error(
    "Failed to convert PDF to PNG. Please install poppler-utils (pdftoppm) or ImageMagick (convert)."
  );
}

async function convertWithPdftoppm(
  pdfPath: string,
  pngPath: string,
  dpi: number,
  runner: ProcessRunner
): Promise<void> {
  const stem = pngPath.replace(/\.png$/i, "");
  const result = await runner.exec("pdftoppm", [
    "-png",
    "-r", String(dpi),
    pdfPath,
    stem,
  ]);
  if (result.exitCode !== 0) {
    throw new Error(`pdftoppm failed: ${result.stderr}`);
  }
}

async function convertWithImageMagick(
  pdfPath: string,
  pngPath: string,
  dpi: number,
  runner: ProcessRunner
): Promise<void> {
  const result = await runner.exec("convert", [
    "-density", String(dpi),
    pdfPath,
    "-quality", "95",
    pngPath,
  ]);
  if (result.exitCode !== 0) {
    throw new Error(`ImageMagick convert failed: ${result.stderr}`);
  }
}
