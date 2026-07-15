import { mkdtempSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export interface TempDirManager {
  /** Create a temporary directory for LaTeX compilation artifacts */
  create(): Promise<string>;
  /** Clean up a temporary directory by path */
  cleanup(dir: string): Promise<void>;
}

export class DefaultTempDirManager implements TempDirManager {
  async create(): Promise<string> {
    return mkdtempSync(join(tmpdir(), "latex-algo-"));
  }

  async cleanup(dir: string): Promise<void> {
    if (dir && existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}
