import { EditorView, ViewPlugin, ViewUpdate, DecorationSet, Decoration, WidgetType } from "@codemirror/view";
import { Range, StateEffect } from "@codemirror/state";
import { BlockDetector, CodeBlockRange } from "./block-detector";
import { RenderPipeline, RenderOptions, PipelineError } from "../render/pipeline";

// ---- State types ----

type BlockState =
  | { kind: "raw" }
  | { kind: "compiling" }
  | { kind: "ready"; imagePath: string }
  | { kind: "error"; message: string };

interface BlockStateEntry {
  state: BlockState;
  /** Position version at last compile trigger -- used to detect source changes. */
  sourceVersion: number;
}

// ---- State effect for async compilation completion ----

const updateBlockEffect = StateEffect.define<{ blockId: string; newState: BlockState }>();

// ---- Widget types ----

export class CompilingWidget extends WidgetType {
  toDOM(): HTMLElement {
    const div = document.createElement("div");
    div.className = "latex-algo-compiling";
    div.textContent = "Rendering LaTeX algorithm...";
    return div;
  }

  eq(other: WidgetType): boolean {
    return other instanceof CompilingWidget;
  }
}

export class ImageWidget extends WidgetType {
  constructor(
    readonly imagePath: string,
    private resolveImageSrc: (path: string) => string
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const container = document.createElement("div");
    container.className = "latex-algo-image-container";

    const img = document.createElement("img");
    img.className = "latex-algo-rendered";
    img.src = this.resolveImageSrc(this.imagePath);
    img.alt = "Rendered LaTeX algorithm";

    img.addEventListener("load", () => {
      img.style.width = `${img.naturalWidth}px`;
      img.style.height = `${img.naturalHeight}px`;
    });

    container.appendChild(img);
    return container;
  }

  eq(other: WidgetType): boolean {
    return other instanceof ImageWidget && other.imagePath === this.imagePath;
  }
}

export class ErrorWidget extends WidgetType {
  constructor(readonly message: string) {
    super();
  }

  toDOM(): HTMLElement {
    const div = document.createElement("div");
    div.className = "latex-algo-error";
    div.textContent = this.message;
    return div;
  }

  eq(other: WidgetType): boolean {
    return other instanceof ErrorWidget && other.message === this.message;
  }
}

// ---- ViewPlugin factory ----

/**
 * Create a CodeMirror 6 ViewPlugin that replaces ` ```latex-algorithm` code blocks
 * with rendered images in Live Preview mode.
 *
 * @param detector            Block detector instance.
 * @param pipeline            Rendering pipeline.
 * @param getOptions          Function returning current render options.
 * @param showRawByDefault    Function returning whether to always show raw code.
 */
export function createAlgorithmViewPlugin(
  detector: BlockDetector,
  pipeline: RenderPipeline,
  getOptions: () => RenderOptions,
  showRawByDefault: () => boolean,
  resolveImageSrc: (path: string) => string
) {
  return ViewPlugin.fromClass(
    class AlgorithmRenderPluginInstance {
      decorations: DecorationSet;
      private blockStates = new Map<string, BlockStateEntry>();
      private pending = new Set<string>();
      private docVersion = 0;
      private debounceTimer: number | null = null;

      constructor(private view: EditorView) {
        this.decorations = Decoration.none;
        this.recompute();
      }

      update(update: ViewUpdate) {
        // Check for async completion effects first
        for (const tr of update.transactions) {
          for (const effect of tr.effects) {
            if (effect.is(updateBlockEffect)) {
              const { blockId, newState } = effect.value;
              const entry = this.blockStates.get(blockId);
              if (entry) {
                entry.state = newState;
              }
            }
          }
        }

        // Always recompute on doc/viewport/effect changes
        if (update.docChanged || update.viewportChanged) {
          if (this.debounceTimer !== null) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
          }
          if (update.docChanged) {
            this.docVersion++;
          }
          this.recompute();
          return;
        }

        // Debounce cursor-only updates at 50ms (Section 9.1)
        if (update.selectionSet) {
          if (this.debounceTimer !== null) {
            clearTimeout(this.debounceTimer);
          }
          this.debounceTimer = window.setTimeout(() => {
            this.debounceTimer = null;
            this.recompute();
          }, 50);
          return;
        }

        // Also recompute if a state effect arrived on its own
        if (
          update.transactions.some((tr) =>
            tr.effects.some((e) => e.is(updateBlockEffect))
          )
        ) {
          this.recompute();
        }
      }

      destroy() {
        if (this.debounceTimer !== null) {
          clearTimeout(this.debounceTimer);
          this.debounceTimer = null;
        }
        // Pending compilations are abandoned -- the pipeline's concurrency
        // guard handles orphaned promises gracefully.
        this.pending.clear();
      }

      // ---- private ----

      private recompute(): void {
        const doc = this.view.state.doc.toString();
        const allBlocks = detector.findAll(doc);
        const viewport = this.view.viewport;
        const widgets: Range<Decoration>[] = [];
        const rawByDefault = showRawByDefault();

        for (const block of allBlocks) {
          const blockId = `${block.fromLine}-${block.toLine}`;
          const fromPos = this.view.state.doc.line(block.fromLine + 1).from;
          const toPos = this.view.state.doc.line(block.toLine + 1).to;

          // VIEWPORT FILTERING (Section 9.2): skip off-screen blocks to
          // avoid starting compilations the user cannot see yet.
          const isOffScreen = toPos < viewport.from || fromPos > viewport.to;

          const cursorInside = this.isAnyCursorInBlock(block);

          // Show raw code if: cursor is inside, OR showRawByDefault is on
          if (rawByDefault || cursorInside) {
            this.blockStates.set(blockId, {
              state: { kind: "raw" },
              sourceVersion: this.docVersion,
            });
            continue;
          }

          // RENDER MODE -- skip if off-screen (defer compilation until scrolled into view)
          if (isOffScreen) {
            // Keep existing ready results cached in memory but don't start work
            const existing = this.blockStates.get(blockId);
            if (existing && (existing.state.kind === "ready" || existing.state.kind === "error")) {
              // Show ready/error even off-screen (cheap -- no compilation needed)
              const widget = this.widgetForState(existing.state);
              widgets.push(Decoration.replace({ widget }).range(fromPos, toPos));
            }
            continue;
          }

          // Block IS on-screen -- manage state normally
          let entry = this.blockStates.get(blockId);

          // Start compilation if: new block, or source changed, or was in raw mode
          if (
            !entry ||
            entry.state.kind === "raw" ||
            entry.sourceVersion < this.docVersion
          ) {
            entry = {
              state: { kind: "compiling" },
              sourceVersion: this.docVersion,
            };
            this.blockStates.set(blockId, entry);
            this.startCompilation(block, blockId);
          }

          // Build widget from current state
          const widget = this.widgetForState(entry.state);
          widgets.push(Decoration.replace({ widget }).range(fromPos, toPos));
        }

        // Prune stale states for blocks that no longer exist
        this.pruneStaleStates(allBlocks);

        this.decorations = Decoration.set(widgets, true);
      }

      private isAnyCursorInBlock(block: CodeBlockRange): boolean {
        for (const range of this.view.state.selection.ranges) {
          const line = this.view.state.doc.lineAt(range.head).number - 1;
          if (line >= block.fromLine && line <= block.toLine) {
            return true;
          }
        }
        return false;
      }

      private async startCompilation(
        block: CodeBlockRange,
        blockId: string
      ): Promise<void> {
        if (this.pending.has(blockId)) return;
        this.pending.add(blockId);

        let newState: BlockState;
        try {
          const result = await pipeline.render(block.source, getOptions());
          newState = { kind: "ready", imagePath: result.imagePath };
          console.debug("[LaTeX Algorithms Render] Compiled block", blockId, "->", result.imagePath);
        } catch (err) {
          const message =
            err instanceof PipelineError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Unknown rendering error";
          newState = { kind: "error", message };
          console.warn("[LaTeX Algorithms Render] Block", blockId, "failed:", message);
        } finally {
          this.pending.delete(blockId);
        }

        // Dispatch effect to trigger re-render with the new state
        this.view.dispatch({
          effects: updateBlockEffect.of({ blockId, newState }),
        });
      }

      private widgetForState(state: BlockState): WidgetType {
        switch (state.kind) {
          case "compiling":
            return new CompilingWidget();
          case "ready":
            return new ImageWidget(state.imagePath, resolveImageSrc);
          case "error":
            return new ErrorWidget(state.message);
          default:
            return new CompilingWidget();
        }
      }

      private pruneStaleStates(blocks: CodeBlockRange[]): void {
        const validIds = new Set(
          blocks.map((b) => `${b.fromLine}-${b.toLine}`)
        );
        for (const id of this.blockStates.keys()) {
          if (!validIds.has(id)) {
            this.blockStates.delete(id);
          }
        }
      }
    },
    { decorations: (v) => v.decorations }
  );
}
