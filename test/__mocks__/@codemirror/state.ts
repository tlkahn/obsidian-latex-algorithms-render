export class StateEffect {
  static define<_T>() {
    const type = { _brand: "StateEffectType" };
    return type as any;
  }
}

export class Range {}
