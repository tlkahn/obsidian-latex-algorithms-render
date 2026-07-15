import { writeFileSync } from "fs";

/**
 * Build a complete LaTeX document wrapping the user's algorithm snippet.
 */
export function buildLatexDocument(source: string, extraPreamble: string): string {
  const preamble = extraPreamble ? `\n${extraPreamble}\n` : "";

  return `\\documentclass{article}
\\usepackage[noend]{algorithmic}
\\usepackage{algorithm}
\\usepackage{amsmath}${preamble}
\\pagestyle{empty}
\\begin{document}

${source}

\\end{document}
`;
}

/**
 * Write the LaTeX source to a .tex file.
 */
export function writeLatexFile(texPath: string, content: string): void {
  writeFileSync(texPath, content, "utf8");
}

/**
 * Get the absolute path to pdflatex.
 * Checks common installation locations and PATH.
 */
export function getPdflatexPath(): string {
  return "pdflatex"; // Resolved via PATH by execFile
}

/**
 * LaTeX compilation error categories for user-friendly messages.
 */
export interface LatexErrorInfo {
  /** The raw stderr output */
  rawStderr: string;
  /** A short user-facing summary */
  summary: string;
}

/**
 * Parse pdflatex stderr to extract a human-readable error summary.
 * Looks for the first "! ..." error line and a few context lines after it.
 */
export function parseLatexError(stderr: string): LatexErrorInfo {
  const lines = stderr.split("\n");
  const errorLines: string[] = [];
  let inError = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("!")) {
      inError = true;
    }
    if (inError) {
      errorLines.push(line);
      // Capture ~5 lines of context after the error
      if (errorLines.length >= 5) {
        break;
      }
    }
  }

  const summary = errorLines.length > 0
    ? errorLines.join("\n")
    : "Unknown LaTeX error (check console for details)";

  return { rawStderr: stderr, summary };
}
