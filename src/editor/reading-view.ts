import { MarkdownPostProcessor, MarkdownPostProcessorContext } from "obsidian";
import { RenderPipeline, RenderOptions, PipelineError } from "../render/pipeline";

/**
 * Factory for the Reading View markdown post-processor.
 *
 * Transforms ` ```latex-algorithm` code blocks into rendered images.
 * No cursor tracking -- images are always shown in Reading View.
 * The cache is shared with the Live Preview renderer via the Pipeline.
 *
 * When `showRawByDefault()` returns true, blocks are left as-is (raw code).
 */
export function createReadingViewPostProcessor(
  pipeline: RenderPipeline,
  getOptions: () => RenderOptions,
  showRawByDefault: () => boolean,
  resolveImageSrc: (path: string) => string
): MarkdownPostProcessor {
  return (el: HTMLElement, _ctx: MarkdownPostProcessorContext): void => {
    // If user prefers raw code always, skip entirely
    if (showRawByDefault()) return;

    // Obsidian renders code blocks as: <pre><code class="language-latex-algorithm*">...</code></pre>
    const codeBlocks = el.querySelectorAll<HTMLElement>(
      'pre > code[class*="language-latex-algorithm"]'
    );

    for (let i = 0; i < codeBlocks.length; i++) {
      const codeEl = codeBlocks[i];
      const pre = codeEl.parentElement;
      if (!pre) continue;

      const source = codeEl.textContent || "";
      if (!source.trim()) continue;

      const options = getOptions();

      // Immediately replace the <pre> with a placeholder
      const placeholder = createPlaceholder();
      pre.replaceWith(placeholder);

      // Async compilation (fire-and-forget -- post-processor returns void)
      pipeline
        .render(source, options)
        .then((result) => {
          if (!placeholder.isConnected) return; // view was torn down
          const img = createImageElement(result.imagePath, resolveImageSrc);
          placeholder.replaceWith(img);
        })
        .catch((err) => {
          if (!placeholder.isConnected) return;
          const msg =
            err instanceof PipelineError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Rendering failed";
          const errorEl = createErrorElement(msg);
          placeholder.replaceWith(errorEl);
        });
    }
  };
}

// ---- DOM helpers ----

function createPlaceholder(): HTMLElement {
  const div = document.createElement("div");
  div.className = "latex-algo-reading-placeholder";
  div.textContent = "Rendering LaTeX algorithm...";
  return div;
}

function createImageElement(imagePath: string, resolveImageSrc: (path: string) => string): HTMLElement {
  const container = document.createElement("div");
  container.className = "latex-algo-reading-image";

  const img = document.createElement("img");
  img.className = "latex-algo-rendered";
  img.src = resolveImageSrc(imagePath);
  img.alt = "Rendered LaTeX algorithm";

  // Set explicit dimensions from natural size once loaded
  img.addEventListener("load", () => {
    img.style.width = `${img.naturalWidth}px`;
    img.style.height = `${img.naturalHeight}px`;
  });

  container.appendChild(img);
  return container;
}

function createErrorElement(message: string): HTMLElement {
  const div = document.createElement("div");
  div.className = "latex-algo-reading-error";
  div.textContent = message;
  return div;
}
