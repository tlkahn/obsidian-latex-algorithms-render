# Architecture: Obsidian LaTeX Algorithm Render Plugin

## 1. Overview

This Obsidian plugin renders LaTeX `algorithm` / `algorithmic` code blocks as images when the cursor is outside the block, and shows raw source code when the cursor is inside the block. Rendering uses the system TeX distribution (`pdflatex`) and image conversion tools.

### 1.1 Terminology

| Term | Meaning |
|------|---------|
| **Code block fence** | A markdown code block with a language label, e.g. ` ```latex-algorithm ... ``` ` |
| **Live preview** | Obsidian's WYSIWYG-ish editor mode (the default). |
| **Reading view** | The rendered/preview mode. |
| **Source mode** | The raw markdown editing mode. |

---

## 2. Fence Language Convention

The plugin observes code blocks whose language tag matches the pattern `latex-algorithm` (optionally with a variant suffix).  

Examples of recognized fences:

~~~markdown
```latex-algorithm
\begin{algorithm}
\caption{My Algorithm}
\begin{algorithmic}
...
\end{algorithmic}
\end{algorithm}
```
~~~

The language tag must start with `latex-algorithm`. The plugin will **not** intercept generic `latex` fences -- only `latex-algorithm` variants.

---

## 3. Core UX Contract

| Cursor position | What is shown |
|----------------|---------------|
| Inside the code block fence | Raw LaTeX source (editable code) |
| Outside the code block fence | Rendered image of the algorithm |

This applies in **Live Preview** mode. In **Source mode** the raw code is always shown (Obsidian convention). In **Reading view** the image is always shown.

**Edge case: split cursor / multi-cursor.** If at least one cursor position lies inside the block, the block shows raw code. Only when **all** cursors are outside does the block render as an image.

---

## 4. Rendering Pipeline

```
                      +-----------------------+
                      |  LaTeX source snippet |
                      +----------+------------+
                                 |
                                 v
                    +---------------------------+
                    | Wrap in minimal document  |
                    | (preamble + \begin{document}) |
                    +----------+----------------+
                               |
                               v
                    +---------------------------+
                    | Write .tex to cache dir   |
                    +----------+----------------+
                               |
                               v
                    +---------------------------+
                    | pdflatex (2 passes)       |
                    |  -> .pdf                  |
                    +----------+----------------+
                               |
                               v
                    +---------------------------+
                    | Convert PDF -> PNG        |
                    | (ImageMagick / pdftoppm)  |
                    +----------+----------------+
                               |
                               v
                    +---------------------------+
                    | Auto-crop (trim margins)  |
                    | +/- configurable padding  |
                    +----------+----------------+
                               |
                               v
                    +---------------------------+
                    | Store PNG in cache        |
                    | + hash-based lookup       |
                    +----------+----------------+
                               |
                               v
                    +---------------------------+
                    | Display <img> in editor   |
                    | via live preview extension|
                    +---------------------------+
```

### 4.1 LaTeX Wrapper Template

The raw algorithm snippet is inserted into a minimal LaTeX document:

```latex
\documentclass{article}
\usepackage[noend]{algorithmic}
\usepackage{algorithm}
\usepackage{amsmath}
% (user-configurable preamble additions)

\pagestyle{empty}
\begin{document}

% User algorithm snippet inserted here
\begin{algorithm}
\caption{...}
\begin{algorithmic}
...
\end{algorithmic}
\end{algorithm}

\end{document}
```

Key details:

- `\pagestyle{empty}` suppresses page numbers.
- The `[noend]` option on `algorithmic` is the default; user can override.
- The user can supply extra LaTeX packages in plugin settings.
- The document class is `article` (default) but may be configurable.

### 4.2 PDF to Raster Conversion

Two strategies, tried in order:

1. **pdftoppm** (fastest, best compression) with `-png -r <dpi>`.
2. **ImageMagick convert** fallback: `convert -density <dpi> input.pdf -quality 95 output.png`.

Default DPI: **200**. Configurable.

### 4.3 Cropping

| Tool | Command |
|------|---------|
| ImageMagick | `convert input.png -trim +repage -bordercolor white -border <pad> output.png` |
| macOS sips | Used as fallback via `sips -g pixelWidth -g pixelHeight` for dimension queries only. |

Default padding: **10px** (applied after trim). Configurable.

---

## 5. Caching Strategy

### 5.1 Cache Key

```
SHA256(normalized(source)) + "_" + dpi + "_" + padding
```

The source is **normalized** (trailing whitespace stripped, line endings normalized to `\n`) before hashing so that superficial edits do not bust the cache.

### 5.2 Cache Location

```
<vault>/.obsidian/plugins/latex-algorithms-render/cache/<hash>.png
```

Or, if the user prefers, a custom cache directory under the vault.

### 5.3 Cache Invalidation

- Cache entries older than **7 days** (configurable) are cleaned up on plugin load / periodic tick.
- Entries are **never** invalidated by cursor position changes (the image data is the same regardless).
- Manual flush button in plugin settings.

### 5.4 Concurrency

Only one `pdflatex` process per unique hash may run at a time. A `Map<hash, Promise>` guards against duplicate compilations. Subsequent requests for the same hash wait on the in-flight promise.

---

## 6. Plugin Architecture (Code Structure)

```
src/
  main.ts              -- Plugin entry point, registration
  settings.ts          -- Settings tab + interface
  render/
    pipeline.ts        -- Orchestrates the full LaTeX -> PNG pipeline
    latex.ts           -- Wrapping, escaping, pdflatex execution
    convert.ts         -- PDF -> PNG conversion (pdftoppm / ImageMagick)
    crop.ts            -- Auto-trim + padding
    cache.ts           -- Hashing, cache dir, read/write, TTL cleanup
  editor/
    live-preview.ts    -- LivePreview renderer (WidgetType /Decoration)
    source-mode.ts     -- No-op / pass-through for source mode
    cursor-tracker.ts  -- Observes cursor position per block
    block-detector.ts  -- Finds latex-algorithm code blocks in the editor
  utils/
    hash.ts            -- SHA256 wrapper
    tempdir.ts         -- Temporary directory management for .tex / .pdf
    process.ts         -- Spawn / exec with timeout
```

### 6.1 Key Classes & Responsibilities

| Class / Module | Role |
|----------------|------|
| `BlockDetector` | Scans the editor document for code fences tagged `latex-algorithm`. Returns start/end line numbers and the raw source text. |
| `CursorTracker` | Subscribes to `editor.cm.view.dispatch` or Obsidian's `cursor-change` event. For each recognized block, determines whether any cursor is inside it. Emits events on state changes. |
| `LivePreviewRenderer` | Implements `ViewPlugin` / `DecorationSet` (CodeMirror 6). When a block is in "render mode", replaces its contents with an `<img>` element. When in "source mode", shows the raw code. |
| `Pipeline` | Accepts source text, runs the full LaTeX -> PNG pipeline, returns a `file://` or `app://` URI to the cached image. Manages concurrency. |
| `Cache` | Stores/retrieves rendered images. Implements TTL-based eviction. |

---

## 7. State Machine per Block

Each recognized code block follows this state machine:

```
                    +---------+
                    | UNKNOWN |   (block not yet scanned)
                    +----+----+
                         |
                     detected by BlockDetector
                         |
                         v
                    +---------+
                    | PENDING |   (source extracted, waiting for cursor decision)
                    +----+----+
                         |
              +----------+----------+
              |                     |
         cursor inside         cursor outside
              |                     |
              v                     v
        +----------+        +--------------+
        | RAW MODE |        | RENDER MODE  |
        +----------+        +------+-------+
              |                     |
         cursor exits         image ready?
              |                     |
              +----------+----------+
                         |
                         v
                  (transition accordingly)
```

Transitions are driven by `CursorTracker` events. `RENDER MODE` itself has substates:

```
RENDER MODE
  |-- COMPILING ... (show a placeholder / spinner)
  |-- READY         (show the cached image)
  |-- ERROR         (show error message in place of image)
```

---

## 8. Error Handling

| Failure scenario | User-visible behaviour |
|------------------|------------------------|
| `pdflatex` not found | Config validation warning + error image with message |
| LaTeX compilation error (bad syntax) | Show `! LaTeX Error` excerpt in the block |
| `pdftoppm` / `convert` not found | Show installation instructions inline |
| Disk full / permission error | Obsidian notice + fallback to raw code |
| Timeout (compilation >30s) | Kill process, show "Compilation timed out" |

### 8.1 Non-blocking Compilation

Compilation runs **asynchronously** in a worker / timeout-guarded promise. The editor never blocks.

---

## 9. Performance Considerations

1. **Debounce cursor events**: `CursorTracker` debounces at 50ms to avoid excessive re-renders during rapid typing/mouse movement.
2. **Virtual scrolling**: Only process blocks visible in the viewport. Use `editor.cm.viewportLines` or `editor.getScrollInfo()`.
3. **Cache hit fast path**: If the image hash exists on disk, load it directly -- no subprocesses.
4. **Image sizing**: The `<img>` element dimensions are set from the PNG's actual pixel size (read via `sips` or `ImageMagick identify`) rather than relying on CSS scaling.
5. **Lazy cleanup**: Cache eviction runs on plugin load and then once every hour. It is skipped if the cache dir is empty.

---

## 10. Settings

| Setting | Key | Type | Default | Description |
|---------|-----|------|---------|-------------|
| DPI | `dpi` | number | 200 | Rendering resolution |
| Padding | `padding` | number | 10 | Extra padding (px) after auto-crop |
| Cache TTL | `cacheTTL` | number (hours) | 168 (7d) | Max age of cached images |
| Cache dir | `cacheDir` | string | `[plugin]/cache/` | Override cache location |
| Extra preamble | `extraPreamble` | string (multiline) | `""` | Additional LaTeX packages/commands |
| Fallback engine | `fallbackEngine` | enum | `"pdftoppm"` | PDF -> PNG converter priority |
| Compile timeout | `compileTimeout` | number (seconds) | 30 | Max wait for `pdflatex` |
| Show raw by default | `showRawByDefault` | boolean | false | Always show raw code, never render |

---

## 11. Dependencies

### 11.1 External system commands

- `pdflatex` (TeX Live / MacTeX / MiKTeX)
- `pdftoppm` (poppler-utils) **or** `convert` (ImageMagick)

### 11.2 Obsidian / CodeMirror APIs

| API | Purpose |
|-----|---------|
| `Plugin` / `PluginSettingTab` | Plugin lifecycle & settings |
| `Editor`, `MarkdownView` | Access the editor instance |
| `MarkdownPostProcessor` (optional) | Reading view rendering |
| `ViewPlugin` / `DecorationSet` (CM6) | Live preview widget replacement |
| `ViewUpdate` / `Transaction` | Cursor position observation |
| `editor.cm` | Direct CodeMirror 6 access |
| `requestAnimationFrame` / `requestIdleCallback` | Scheduling non-urgent updates |

### 11.3 Node.js / Obsidian built-in

- `child_process` (via `require("child_process")` -- available in Obsidian plugin context)
- `path`, `fs`, `crypto`
- `os.tmpdir()` for temp files

---

## 12. Reading View (MarkdownPostProcessor)

In **reading view**, the plugin registers a `MarkdownPostProcessor` that transforms ` ```latex-algorithm` blocks into rendered images directly. No cursor tracking applies -- the image is always shown.

The post-processor uses the same `Pipeline` and `Cache` modules, so the cache is shared between Live Preview and Reading View.

---

## 13. Implementation Phases

### Phase 1: Skeleton
- Plugin scaffold (`main.ts`, `manifest.json`, `tsconfig.json`, `rollup.config.js`)
- Settings tab skeleton
- Block detector stub

### Phase 2: LaTeX Pipeline
- Implement `latex.ts`, `convert.ts`, `crop.ts`, `cache.ts`
- Pipeline orchestration with concurrency guard
- Temp file cleanup

### Phase 3: Editor Integration
- LivePreview `ViewPlugin` + `DecorationSet`
- Cursor tracking
- Mode switching (raw <-> image)

### Phase 4: Reading View
- `MarkdownPostProcessor` integration

### Phase 5: Polish
- Error messages displayed inline
- Settings UI complete
- Cache eviction
- Performance tuning (debounce, viewport detection)
- Testing with real algorithm examples

---

## 14. Out of Scope (v1)

- Rendered image click-to-edit (user must click into the code block via cursor positioning)
- Drag-and-drop image export
- Live editing in the image (WYSIWYG)
- Support for `listings`, `minted`, or other non-algorithm LaTeX environments (future extension: `latex-*` prefix)
- Synchronized scrolling
- Multi-line caption editing
