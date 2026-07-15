export interface TempDirManager {
  /** Create a temporary directory for LaTeX compilation artifacts */
  create(): Promise<string>;
  /** Clean up a temporary directory by path */
  cleanup(dir: string): Promise<void>;
}

export class DefaultTempDirManager implements TempDirManager {
  async create(): Promise<string> {
    throw new Error("TempDirManager.create not yet implemented (Phase 2)");
  }
  async cleanup(_dir: string): Promise<void> {
    throw new Error("TempDirManager.cleanup not yet implemented (Phase 2)");
  }
}
