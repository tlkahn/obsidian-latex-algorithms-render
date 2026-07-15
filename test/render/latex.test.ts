import { describe, it, expect } from "vitest";
import { parseLatexError, buildLatexDocument } from "../../src/render/latex";

describe("parseLatexError", () => {
  it("captures up to 15 lines after '!' marker", () => {
    const lines: string[] = [];
    lines.push("This is pdflatex output");
    lines.push("Some log line");
    lines.push("! Undefined control sequence.");
    for (let i = 0; i < 20; i++) {
      lines.push(`l.${10 + i} context line ${i}`);
    }
    const stderr = lines.join("\n");
    const result = parseLatexError(stderr);

    const resultLines = result.summary.split("\n");
    expect(resultLines.length).toBe(15);
    expect(resultLines[0]).toBe("! Undefined control sequence.");
  });

  it("returns 'Unknown LaTeX error' when no '!' found", () => {
    const result = parseLatexError("some output with no error marker");
    expect(result.summary).toContain("Unknown LaTeX error");
  });

  it("preserves raw stderr", () => {
    const stderr = "! Error\nline 2";
    const result = parseLatexError(stderr);
    expect(result.rawStderr).toBe(stderr);
  });
});

describe("buildLatexDocument", () => {
  it("wraps source in a complete LaTeX document", () => {
    const doc = buildLatexDocument("\\begin{algorithm}", "");
    expect(doc).toContain("\\documentclass");
    expect(doc).toContain("\\begin{document}");
    expect(doc).toContain("\\begin{algorithm}");
    expect(doc).toContain("\\end{document}");
  });

  it("includes extra preamble when provided", () => {
    const doc = buildLatexDocument("body", "\\usepackage{tikz}");
    expect(doc).toContain("\\usepackage{tikz}");
  });
});
