/**
 * Source Mode pass-through.
 *
 * Obsidian's Source mode uses a separate CodeMirror instance where the
 * editor extensions registered via `registerEditorExtension()` are NOT
 * active.  Therefore the ViewPlugin from `live-preview.ts` automatically
 * does not apply in Source mode, and raw LaTeX code is shown as-is.
 *
 * This module exists as a documentation anchor -- no implementation
 * is needed.
 */
export const SOURCE_MODE_HANDLED_BY_DEFAULT = true;
