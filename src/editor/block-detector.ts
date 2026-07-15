export interface CodeBlockRange {
  /** 0-indexed line of the opening fence (```latex-algorithm) */
  fromLine: number;
  /** 0-indexed line of the closing fence (```) */
  toLine: number;
  /** Raw text content between the fences (excludes the fence lines) */
  source: string;
  /** The language tag (e.g. "latex-algorithm") */
  language: string;
}

export interface BlockDetector {
  /**
   * Scan the given document text and return all latex-algorithm code blocks.
   * Used for initial discovery and full re-scans.
   */
  findAll(doc: string): CodeBlockRange[];

  /**
   * Return the block that contains the given line number, or null.
   * Used for cursor-position lookups.
   */
  findBlockAtLine(doc: string, line: number): CodeBlockRange | null;
}

export class DefaultBlockDetector implements BlockDetector {
  /**
   * Regex for matching an opening code fence with a `latex-algorithm`
   * language tag (or variant like `latex-algorithmic`, `latex-algo`, etc.).
   */
  private static FENCE_RE = /^```(\S+)$/;
  private static CLOSING_RE = /^```/;

  findAll(doc: string): CodeBlockRange[] {
    const lines = doc.split("\n");
    const blocks: CodeBlockRange[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const match = line.match(DefaultBlockDetector.FENCE_RE);

      if (match && match[1].startsWith("latex-algorithm")) {
        const fromLine = i;
        const language = match[1];
        i++; // move past opening fence

        const sourceLines: string[] = [];
        while (i < lines.length) {
          if (DefaultBlockDetector.CLOSING_RE.test(lines[i])) {
            break;
          }
          sourceLines.push(lines[i]);
          i++;
        }

        const toLine = i; // closing fence (or last line if unclosed)

        blocks.push({
          fromLine,
          toLine,
          source: sourceLines.join("\n"),
          language,
        });
      }

      i++;
    }

    return blocks;
  }

  findBlockAtLine(doc: string, line: number): CodeBlockRange | null {
    return this.findAll(doc).find(
      (b) => line >= b.fromLine && line <= b.toLine
    ) || null;
  }
}
