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
  findAll(_doc: string): CodeBlockRange[] {
    throw new Error("BlockDetector.findAll not yet implemented (Phase 2)");
  }

  findBlockAtLine(_doc: string, _line: number): CodeBlockRange | null {
    throw new Error("BlockDetector.findBlockAtLine not yet implemented (Phase 2)");
  }
}
