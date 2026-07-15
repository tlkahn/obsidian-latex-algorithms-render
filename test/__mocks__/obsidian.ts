export class Plugin {
  app: any = {};
  manifest: any = {};
  loadData() { return Promise.resolve({}); }
  saveData(_data: any) { return Promise.resolve(); }
  registerEditorExtension(_ext: any) {}
  registerMarkdownPostProcessor(_proc: any) {}
  addSettingTab(_tab: any) {}
}

export class FileSystemAdapter {
  private basePath: string;
  constructor(basePath = "/vault") { this.basePath = basePath; }
  getBasePath() { return this.basePath; }
  getResourcePath(path: string) { return `app://local/${path}`; }
}

export class Notice {
  constructor(public message: string) {}
}

export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl: any = { empty() {}, createEl() { return {}; } };
  constructor(app: any, plugin: any) { this.app = app; this.plugin = plugin; }
}

export class Setting {
  constructor(_el: any) {}
  setName(_n: string) { return this; }
  setDesc(_d: string) { return this; }
  addText(_cb: any) { return this; }
  addTextArea(_cb: any) { return this; }
  addDropdown(_cb: any) { return this; }
  addToggle(_cb: any) { return this; }
  addButton(_cb: any) { return this; }
  addSlider(_cb: any) { return this; }
}

export class App {}

export type MarkdownPostProcessor = (el: HTMLElement, ctx: MarkdownPostProcessorContext) => void;

export interface MarkdownPostProcessorContext {
  docId: string;
  sourcePath: string;
  frontmatter: any;
  addChild(child: any): void;
  getSectionInfo(el: HTMLElement): any;
}
