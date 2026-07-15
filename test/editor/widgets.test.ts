import { describe, it, expect } from "vitest";

// We test the widget eq() logic by importing the module.
// The widgets are not exported directly, so we test via a helper that
// re-creates the same class structure. Instead, we'll use a dynamic import
// approach to access the module's internals.

// Since the widgets are not exported from live-preview.ts, we test the
// eq() logic by directly constructing the classes from the module scope.
// For this to work, we need to export them. Let's test via the module.

// Actually, the classes ARE accessible if we structure the imports right.
// But they're not exported. We'll need to either export them or test indirectly.
// The plan says to add eq() overrides, so let's test them after export.

// For now, write the test assuming the widgets will be exported.
import {
  CompilingWidget,
  ImageWidget,
  ErrorWidget,
} from "../../src/editor/live-preview";

describe("Widget eq() overrides", () => {
  it("ImageWidget.eq returns true for same imagePath", () => {
    const a = new ImageWidget("/path/a.png", (p) => p);
    const b = new ImageWidget("/path/a.png", (p) => p);
    expect(a.eq(b)).toBe(true);
  });

  it("ImageWidget.eq returns false for different imagePath", () => {
    const a = new ImageWidget("/path/a.png", (p) => p);
    const b = new ImageWidget("/path/b.png", (p) => p);
    expect(a.eq(b)).toBe(false);
  });

  it("CompilingWidget.eq returns true for another CompilingWidget", () => {
    const a = new CompilingWidget();
    const b = new CompilingWidget();
    expect(a.eq(b)).toBe(true);
  });

  it("ErrorWidget.eq returns true for same message", () => {
    const a = new ErrorWidget("err");
    const b = new ErrorWidget("err");
    expect(a.eq(b)).toBe(true);
  });

  it("ErrorWidget.eq returns false for different message", () => {
    const a = new ErrorWidget("err1");
    const b = new ErrorWidget("err2");
    expect(a.eq(b)).toBe(false);
  });
});
