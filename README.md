# Obsidian LaTeX Algorithms Render

Render ` ```latex-algorithm` code blocks as images when the cursor is outside the block. Shows raw code when the cursor is inside the block.

Requires: TeX Live / MacTeX, poppler-utils (pdftoppm) or ImageMagick.

## Usage

Wrap your LaTeX algorithm in a code fence with the `latex-algorithm` language tag:

    ```latex-algorithm
    \begin{algorithm}
    \caption{My Algorithm}
    \begin{algorithmic}
    \STATE ...
    \end{algorithmic}
    \end{algorithm}
    ```

## Development

- `npm run dev` -- watch mode
- `npm run build` -- production build
- `npm run typecheck` -- type-check without emitting
