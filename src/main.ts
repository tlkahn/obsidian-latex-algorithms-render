import { Plugin, FileSystemAdapter, Notice } from "obsidian";
import { join } from "path";
import { tmpdir } from "os";
import { LatexAlgoSettings, DEFAULT_SETTINGS, LatexAlgoSettingTab } from "./settings";
import { BlockDetector, DefaultBlockDetector } from "./editor/block-detector";
import { createAlgorithmViewPlugin } from "./editor/live-preview";
import { createReadingViewPostProcessor } from "./editor/reading-view";
import { ProcessRunner, DefaultProcessRunner } from "./utils/process";
import { TempDirManager, DefaultTempDirManager } from "./utils/tempdir";
import { CacheManager } from "./render/cache";
import { RenderPipeline, RenderOptions } from "./render/pipeline";

/** How often to run automatic cache cleanup (milliseconds). */
const CACHE_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

export default class LatexAlgoRenderPlugin extends Plugin {
  settings: LatexAlgoSettings;
  blockDetector: BlockDetector;
  processRunner: ProcessRunner;
  tempDirManager: TempDirManager;
  cache: CacheManager;
  pipeline: RenderPipeline;
  private cleanupTimer: number | null = null;

  async onload() {
    console.log("[LaTeX Algorithms Render] Loading plugin...");

    await this.loadSettings();

    // Instantiate utilities
    this.blockDetector = new DefaultBlockDetector();
    this.processRunner = new DefaultProcessRunner();
    this.tempDirManager = new DefaultTempDirManager();

    // Initialise cache and pipeline
    const cacheDir = this.resolveCacheDir();
    this.cache = new CacheManager(cacheDir);
    this.pipeline = new RenderPipeline(
      this.cache,
      this.processRunner,
      this.tempDirManager
    );

    // Run cache TTL cleanup on load
    this.runCacheCleanup();

    // Periodic cache eviction (Section 9.5)
    this.cleanupTimer = window.setInterval(() => {
      this.runCacheCleanup();
    }, CACHE_CLEANUP_INTERVAL);

    // Register Live Preview ViewPlugin
    this.registerEditorExtension(
      createAlgorithmViewPlugin(
        this.blockDetector,
        this.pipeline,
        () => this.getRenderOptions(),
        () => this.settings.showRawByDefault
      )
    );

    // Register Reading View post-processor
    this.registerMarkdownPostProcessor(
      createReadingViewPostProcessor(
        this.pipeline,
        () => this.getRenderOptions(),
        () => this.settings.showRawByDefault
      )
    );

    // Settings tab
    this.addSettingTab(new LatexAlgoSettingTab(this.app, this));

    console.log("[LaTeX Algorithms Render] Plugin loaded successfully.");
  }

  onunload() {
    // Clear periodic cleanup timer
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    console.log("[LaTeX Algorithms Render] Plugin unloaded.");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * Flush the rendered image cache and notify the user.
   */
  flushCache(): void {
    const count = this.cache.flush();
    new Notice(`LaTeX cache flushed (${count} files removed).`);
  }

  /**
   * Build the render options from current settings.
   */
  getRenderOptions(): RenderOptions {
    return {
      dpi: this.settings.dpi,
      padding: this.settings.padding,
      extraPreamble: this.settings.extraPreamble,
      fallbackEngine: this.settings.fallbackEngine,
      compileTimeout: this.settings.compileTimeout,
    };
  }

  // ---- private ----

  private resolveCacheDir(): string {
    // User-specified absolute path override
    if (this.settings.cacheDir) {
      return this.settings.cacheDir;
    }
    // Default: <vault>/.obsidian/plugins/latex-algorithms-render/cache/
    const adapter = this.app.vault.adapter;
    if (adapter instanceof FileSystemAdapter) {
      const vaultPath = adapter.getBasePath();
      const relDir =
        this.manifest.dir || ".obsidian/plugins/latex-algorithms-render";
      return join(vaultPath, relDir, "cache");
    }
    // Fallback (should not happen on desktop)
    return join(tmpdir(), "latex-algo-cache");
  }

  private runCacheCleanup(): void {
    try {
      this.cache.cleanup(this.settings.cacheTTL);
    } catch (err) {
      console.warn("[LaTeX Algorithms Render] Cache cleanup error:", err);
    }
  }
}
