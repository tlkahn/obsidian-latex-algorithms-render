export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ProcessRunner {
  /**
   * Execute a command with arguments, capturing stdout/stderr.
   * Throws on timeout (kills process).
   */
  exec(cmd: string, args: string[], options?: { timeout?: number; cwd?: string }): Promise<ExecResult>;
}

export class DefaultProcessRunner implements ProcessRunner {
  async exec(
    _cmd: string,
    _args: string[],
    _options?: { timeout?: number; cwd?: string }
  ): Promise<ExecResult> {
    throw new Error("ProcessRunner.exec not yet implemented (Phase 2)");
  }
}
