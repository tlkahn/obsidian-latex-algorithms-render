import { existsSync } from "fs";
import { ProcessRunner } from "../utils/process";

/**
 * Auto-crop a PNG image and add configurable padding.
 *
 * Uses ImageMagick's `-trim` to remove surrounding whitespace,
 * then adds `padding` pixels of white border on each side.
 *
 * @param inputPath   Absolute path to the input PNG.
 * @param outputPath  Desired output PNG path (can be same as inputPath).
 * @param padding     Extra white padding in pixels (0 to disable).
 * @param runner      ProcessRunner instance.
 */
export async function cropImage(
  inputPath: string,
  outputPath: string,
  padding: number,
  runner: ProcessRunner
): Promise<void> {
  if (!existsSync(inputPath)) {
    throw new Error(`Cannot crop: input file not found: ${inputPath}`);
  }

  const args: string[] = [inputPath, "-trim", "+repage"];

  if (padding > 0) {
    args.push("-bordercolor", "white", "-border", `${padding}x${padding}`);
  }

  args.push(outputPath);

  const result = await runner.exec("convert", args);
  if (result.exitCode !== 0) {
    throw new Error(`ImageMagick crop failed: ${result.stderr}`);
  }

  // If inputPath === outputPath, ImageMagick modifies in place but may leave a temp file.
  // Ensure the output exists.
  if (!existsSync(outputPath)) {
    throw new Error("Crop produced no output file");
  }
}
