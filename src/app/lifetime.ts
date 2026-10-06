export class Lifetime {
  private cleanups: (() => void)[] = [];
  closed = false;
  own(cleanup: () => void) {
    if (this.closed) cleanup();
    else this.cleanups.push(cleanup);
  }
  listen(target: EventTarget, event: string, handler: EventListener) {
    target.addEventListener(event, handler);
    this.own(() => target.removeEventListener(event, handler));
  }
  get count() {
    return this.cleanups.length;
  }
  dispose() {
    if (this.closed) return;
    this.closed = true;
    for (let i = this.cleanups.length - 1; i >= 0; i--) this.cleanups[i]();
    this.cleanups.length = 0;
  }
}
export class Samples {
  private values = new Float64Array(600);
  private index = 0;
  private count = 0;
  add(value: number) {
    this.values[this.index] = value;
    this.index = (this.index + 1) % 600;
    this.count = Math.min(600, this.count + 1);
  }
  summary() {
    const sorted = Array.from(this.values.subarray(0, this.count)).sort(
      (a, b) => a - b,
    );
    return {
      count: this.count,
      p50: sorted[Math.floor(this.count * 0.5)] ?? 0,
      p95: sorted[Math.floor(this.count * 0.95)] ?? 0,
      p99: sorted[Math.floor(this.count * 0.99)] ?? 0,
    };
  }
}
