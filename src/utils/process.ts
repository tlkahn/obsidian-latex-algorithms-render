import { execFile } from "child_process";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ProcessRunner {
  /**
   * Execute a command with arguments, capturing stdout/stderr.
   * Throws on ENOENT (command not found). Resolves with exitCode for all other outcomes,
   * including timeouts (exitCode === -1) and non-zero exits.
   */
  exec(cmd: string, args: string[], options?: { timeout?: number; cwd?: string }): Promise<ExecResult>;
}

export class DefaultProcessRunner implements ProcessRunner {
  async exec(
    cmd: string,
    args: string[],
    options?: { timeout?: number; cwd?: string }
  ): Promise<ExecResult> {
    return new Promise<ExecResult>((resolve, reject) => {
      const child = execFile(
        cmd,
        args,
        {
          cwd: options?.cwd,
          timeout: options?.timeout ? options.timeout * 1000 : undefined,
          maxBuffer: 10 * 1024 * 1024, // 10 MB
        },
        (error, stdout, stderr) => {
          if (error) {
            // Command not found -- infrastructure failure, reject
            if ((error as any).code === "ENOENT") {
              reject(new Error(`Command not found: ${cmd}`));
              return;
            }
            // Killed by timeout
            if ((error as any).killed) {
              resolve({ stdout: stdout || "", stderr: stderr || "", exitCode: -1 });
              return;
            }
            // Non-zero exit or other error -- still return data
            resolve({ stdout: stdout || "", stderr: stderr || "", exitCode: (error as any).code || 1 });
            return;
          }
          resolve({ stdout: stdout || "", stderr: stderr || "", exitCode: 0 });
        }
      );

      if (child.stdin) {
        child.stdin.end();
      }
    });
  }
}
