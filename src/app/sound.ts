// Original synthesized effects. The application owns the context and every voice.
// No audio files, global timers, or per-scene AudioContexts are created.
export class Soundscape {
  enabled = true;
  private context: AudioContext | null = null;
  private voices = new Set<{ oscillator: OscillatorNode; gain: GainNode }>();
  private closed = false;
  private suspended = false;
  get activeCount() {
    return this.voices.size;
  }
  async unlock() {
    if (this.closed || !this.enabled) return;
    this.suspended = false;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === "suspended") await this.context.resume();
    } catch {
      /* Audio is optional; unsupported output does not block the voyage. */
    }
  }
  play(kind: "cannon" | "hit" | "loot" | "work") {
    const context = this.context;
    if (
      this.closed ||
      this.suspended ||
      !this.enabled ||
      context?.state !== "running" ||
      this.voices.size >= 8
    )
      return;
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    const now = context.currentTime;
    const duration = kind === "cannon" ? 0.32 : kind === "loot" ? 0.25 : 0.08;
    const frequency =
      kind === "cannon"
        ? 85
        : kind === "loot"
          ? 660
          : kind === "hit"
            ? 180
            : 330;
    oscillator.type = kind === "loot" ? "triangle" : "square";
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      kind === "loot" ? 990 : Math.max(30, frequency / 2),
      now + duration,
    );
    gain.gain.setValueAtTime(kind === "cannon" ? 0.07 : 0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    const voice = { oscillator, gain };
    this.voices.add(voice);
    oscillator.onended = () => {
      oscillator.onended = null;
      oscillator.disconnect();
      gain.disconnect();
      this.voices.delete(voice);
    };
    oscillator.start(now);
    oscillator.stop(now + duration);
  }
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.stop();
  }
  private stop() {
    for (const voice of this.voices) {
      voice.oscillator.onended = null;
      try {
        voice.oscillator.stop();
      } catch {
        /* A completed voice may already be stopped. */
      }
      voice.oscillator.disconnect();
      voice.gain.disconnect();
    }
    this.voices.clear();
  }
  suspend() {
    this.suspended = true;
    this.stop();
    if (this.context?.state === "running")
      void this.context.suspend().catch(() => {});
  }
  async dispose() {
    if (this.closed) return;
    this.closed = true;
    this.stop();
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed")
      await context.close().catch(() => {});
  }
}
