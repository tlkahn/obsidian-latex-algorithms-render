import { Plugin } from "obsidian";
import { LatexAlgoSettings, DEFAULT_SETTINGS, LatexAlgoSettingTab } from "./settings";
import { BlockDetector, DefaultBlockDetector } from "./editor/block-detector";
import { ProcessRunner, DefaultProcessRunner } from "./utils/process";
import { TempDirManager, DefaultTempDirManager } from "./utils/tempdir";

export default class LatexAlgoRenderPlugin extends Plugin {
  settings: LatexAlgoSettings;
  blockDetector: BlockDetector;
  processRunner: ProcessRunner;
  tempDirManager: TempDirManager;

  async onload() {
    console.log("[LaTeX Algorithms Render] Loading plugin...");

    await this.loadSettings();

    this.blockDetector = new DefaultBlockDetector();
    this.processRunner = new DefaultProcessRunner();
    this.tempDirManager = new DefaultTempDirManager();

    this.addSettingTab(new LatexAlgoSettingTab(this.app, this));

    console.log("[LaTeX Algorithms Render] Plugin loaded successfully.");
  }

  onunload() {
    console.log("[LaTeX Algorithms Render] Plugin unloaded.");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
