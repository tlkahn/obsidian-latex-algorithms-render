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

class CompilingWidget extends WidgetType {
  toDOM(): HTMLElement {
    const div = document.createElement("div");
    div.className = "latex-algo-compiling";
    div.textContent = "Rendering LaTeX algorithm...";
    div.style.cssText = `
      padding: 12px 16px;
      background: var(--background-secondary);
      border-radius: 6px;
      color: var(--text-muted);
      font-style: italic;
      text-align: center;
    `;
    return div;
  }
}

class ImageWidget extends WidgetType {
  constructor(readonly imagePath: string) {
    super();
  }

  toDOM(): HTMLElement {
    const container = document.createElement("div");
    container.className = "latex-algo-image-container";
    container.style.cssText = `
      padding: 8px 0;
      display: flex;
      justify-content: center;
    `;

    const img = document.createElement("img");
    img.className = "latex-algo-rendered";
    img.src = `file://${this.imagePath}`;
    img.alt = "Rendered LaTeX algorithm";
    img.style.cssText = `
      max-width: 100%;
      height: auto;
      border-radius: 4px;
    `;

    // Set explicit dimensions from natural size once loaded
    img.addEventListener("load", () => {
      img.style.width = `${img.naturalWidth}px`;
      img.style.height = `${img.naturalHeight}px`;
    });

    container.appendChild(img);
    return container;
  }
}

class ErrorWidget extends WidgetType {
  constructor(readonly message: string) {
    super();
  }

  toDOM(): HTMLElement {
    const div = document.createElement("div");
    div.className = "latex-algo-error";
    div.style.cssText = `
      padding: 12px 16px;
      background: var(--background-modifier-error, #fdd);
      border-radius: 6px;
      color: var(--text-error, #c00);
      font-family: var(--font-monospace);
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
    `;
    div.textContent = this.message;
    return div;
  }
}

// ---- ViewPlugin factory ----

export function createAlgorithmViewPlugin(
  detector: BlockDetector,
  pipeline: RenderPipeline,
  getOptions: () => RenderOptions
) {
  return ViewPlugin.fromClass(
    class AlgorithmRenderPluginInstance {
      decorations: DecorationSet;
      private blockStates = new Map<string, BlockStateEntry>();
      private pending = new Set<string>();
      private docVersion = 0;

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

        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet ||
          update.transactions.some((tr) =>
            tr.effects.some((e) => e.is(updateBlockEffect))
          )
        ) {
          if (update.docChanged) {
            this.docVersion++;
          }
          this.recompute();
        }
      }

      destroy() {
        // Pending compilations are abandoned -- the pipeline's concurrency
        // guard handles orphaned promises gracefully.
        this.pending.clear();
      }

      // ---- private ----

      private recompute(): void {
        const doc = this.view.state.doc.toString();
        const blocks = detector.findAll(doc);
        const widgets: Range<Decoration>[] = [];

        for (const block of blocks) {
          const blockId = `${block.fromLine}-${block.toLine}`;
          const cursorInside = this.isAnyCursorInBlock(block);

          if (cursorInside) {
            // RAW MODE -- no decoration, let raw code show through
            this.blockStates.set(blockId, {
              state: { kind: "raw" },
              sourceVersion: this.docVersion,
            });
            continue;
          }

          // RENDER MODE
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
          const from = this.view.state.doc.line(block.fromLine + 1).from;
          const to = this.view.state.doc.line(block.toLine + 1).to;
          widgets.push(Decoration.replace({ widget }).range(from, to));
        }

        // Prune stale states for blocks that no longer exist
        this.pruneStaleStates(blocks);

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
        } catch (err) {
          const message =
            err instanceof PipelineError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Unknown rendering error";
          newState = { kind: "error", message };
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
            return new ImageWidget(state.imagePath);
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
