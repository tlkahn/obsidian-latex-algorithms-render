import { describe, it, expect } from "vitest";

class MockAdapter {
  private basePath: string;
  constructor(basePath: string) { this.basePath = basePath; }
  getBasePath() { return this.basePath; }
  getResourcePath(path: string) { return `app://local/${path}`; }
}

describe("resolveImageSrc", () => {
  function makeResolveImageSrc(vaultBasePath: string) {
    const adapter = new MockAdapter(vaultBasePath);
    return (absolutePath: string): string => {
      if (absolutePath.startsWith(vaultBasePath)) {
        let relative = absolutePath.slice(vaultBasePath.length);
        if (relative.startsWith("/")) relative = relative.slice(1);
        return adapter.getResourcePath(relative);
      }
      return `file://${absolutePath}`;
    };
  }

  it("returns app:// URI for vault-internal paths", () => {
    const resolve = makeResolveImageSrc("/Users/test/vault");
    const result = resolve("/Users/test/vault/.obsidian/plugins/cache/img.png");
    expect(result).toContain("app://");
    expect(result).toContain(".obsidian/plugins/cache/img.png");
  });

  it("falls back to file:// for external paths", () => {
    const resolve = makeResolveImageSrc("/Users/test/vault");
    const result = resolve("/tmp/some/other/path.png");
    expect(result).toBe("file:///tmp/some/other/path.png");
  });
});
