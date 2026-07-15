import { CodeBlockRange } from "./block-detector";

/**
 * Check whether any cursor range in a selection falls inside a code block.
 *
 * @param cursorLines  Array of 0-indexed cursor line positions.
 * @param block        The code block to test against.
 * @returns `true` if at least one cursor line lies within the block bounds.
 */
export function isAnyCursorInBlock(
  cursorLines: number[],
  block: CodeBlockRange
): boolean {
  return cursorLines.some(
    (line) => line >= block.fromLine && line <= block.toLine
  );
}

/**
 * Filter blocks: return blocks where NO cursor lies inside (i.e. blocks
 * eligible for rendering).
 */
export function blocksToRender(
  blocks: CodeBlockRange[],
  cursorLines: number[]
): CodeBlockRange[] {
  return blocks.filter((b) => !isAnyCursorInBlock(cursorLines, b));
}

/**
 * Filter blocks: return blocks where AT LEAST ONE cursor lies inside
 * (i.e. blocks to show as raw code).
 */
export function blocksToShowRaw(
  blocks: CodeBlockRange[],
  cursorLines: number[]
): CodeBlockRange[] {
  return blocks.filter((b) => isAnyCursorInBlock(cursorLines, b));
}
