import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    alias: {
      obsidian: resolve(__dirname, "test/__mocks__/obsidian.ts"),
      "@codemirror/view": resolve(__dirname, "test/__mocks__/@codemirror/view.ts"),
      "@codemirror/state": resolve(__dirname, "test/__mocks__/@codemirror/state.ts"),
    },
  },
});
