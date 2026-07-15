export class WidgetType {
  toDOM(): HTMLElement { return null as any; }
  eq(_other: WidgetType): boolean { return false; }
  destroy(_dom: HTMLElement): void {}
}

export class EditorView {}
export class ViewPlugin {
  static fromClass(_cls: any, _spec?: any) { return {}; }
}
export class Decoration {
  static none: any = {};
  static replace(_spec: any) { return { range: (_from: number, _to: number) => ({}) }; }
  static set(_widgets: any[], _sort?: boolean) { return {}; }
}
export type DecorationSet = any;
export type ViewUpdate = any;
