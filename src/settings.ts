import { App, PluginSettingTab, Setting } from "obsidian";
import type LatexAlgoRenderPlugin from "./main";

export interface LatexAlgoSettings {
  dpi: number;
  padding: number;
  cacheTTL: number;
  cacheDir: string;
  extraPreamble: string;
  fallbackEngine: "pdftoppm" | "imagemagick";
  compileTimeout: number;
  showRawByDefault: boolean;
}

export const DEFAULT_SETTINGS: LatexAlgoSettings = {
  dpi: 200,
  padding: 10,
  cacheTTL: 168,
  cacheDir: "",
  extraPreamble: "",
  fallbackEngine: "pdftoppm",
  compileTimeout: 30,
  showRawByDefault: false,
};

export class LatexAlgoSettingTab extends PluginSettingTab {
  plugin: LatexAlgoRenderPlugin;

  constructor(app: App, plugin: LatexAlgoRenderPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // --- Rendering section ---
    containerEl.createEl("h3", { text: "Rendering" });

    new Setting(containerEl)
      .setName("DPI")
      .setDesc("Rendering resolution (50 - 600)")
      .addText((text) =>
        text
          .setPlaceholder("200")
          .setValue(String(this.plugin.settings.dpi))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num >= 50 && num <= 600) {
              this.plugin.settings.dpi = num;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Padding")
      .setDesc("Extra padding (px) after auto-crop (0 - 100)")
      .addText((text) =>
        text
          .setPlaceholder("10")
          .setValue(String(this.plugin.settings.padding))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num >= 0 && num <= 100) {
              this.plugin.settings.padding = num;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Compile timeout")
      .setDesc("Max seconds to wait for pdflatex (5 - 120)")
      .addText((text) =>
        text
          .setPlaceholder("30")
          .setValue(String(this.plugin.settings.compileTimeout))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num >= 5 && num <= 120) {
              this.plugin.settings.compileTimeout = num;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Fallback engine")
      .setDesc("PDF to PNG converter priority")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("pdftoppm", "pdftoppm (poppler-utils)")
          .addOption("imagemagick", "ImageMagick convert")
          .setValue(this.plugin.settings.fallbackEngine)
          .onChange(async (value) => {
            this.plugin.settings.fallbackEngine = value as "pdftoppm" | "imagemagick";
            await this.plugin.saveSettings();
          })
      );

    // --- LaTeX section ---
    containerEl.createEl("h3", { text: "LaTeX" });

    new Setting(containerEl)
      .setName("Extra preamble")
      .setDesc("Additional LaTeX packages and commands (inserted before \\begin{document})")
      .addTextArea((text) =>
        text
          .setPlaceholder("\\usepackage{amsmath}\n\\usepackage{amssymb}")
          .setValue(this.plugin.settings.extraPreamble)
          .onChange(async (value) => {
            this.plugin.settings.extraPreamble = value;
            await this.plugin.saveSettings();
          })
      );

    // --- Cache section ---
    containerEl.createEl("h3", { text: "Cache" });

    new Setting(containerEl)
      .setName("Cache TTL")
      .setDesc("Max age of cached images in hours (1 - 8760)")
      .addText((text) =>
        text
          .setPlaceholder("168")
          .setValue(String(this.plugin.settings.cacheTTL))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num >= 1 && num <= 8760) {
              this.plugin.settings.cacheTTL = num;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Cache directory")
      .setDesc("Override cache location (leave empty for plugin default)")
      .addText((text) =>
        text
          .setPlaceholder(".obsidian/plugins/latex-algorithms-render/cache")
          .setValue(this.plugin.settings.cacheDir)
          .onChange(async (value) => {
            this.plugin.settings.cacheDir = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Flush cache")
      .setDesc("Remove all cached rendered images")
      .addButton((button) =>
        button
          .setButtonText("Flush cache")
          .onClick(() => {
            this.plugin.flushCache();
          })
      );

    // --- Behaviour section ---
    containerEl.createEl("h3", { text: "Behaviour" });

    new Setting(containerEl)
      .setName("Show raw by default")
      .setDesc("Always show raw code instead of rendered images")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showRawByDefault)
          .onChange(async (value) => {
            this.plugin.settings.showRawByDefault = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
