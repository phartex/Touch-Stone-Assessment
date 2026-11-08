export interface ProgressPayload {
  positionSeconds: number;
  ended: boolean;
}

interface Options {
  /** Minimum time between periodic saves while playing. */
  intervalMs?: number;
  now?: () => number;
}

/**
 * Decides *when* to persist playback progress, independent of React and the DOM so it can be
 * unit-tested. Guarantees:
 *  - periodic saves while playing are throttled (default every 10s),
 *  - explicit flushes (pause, end, leaving the page) always send the latest position,
 *  - at most one request is in flight; updates during a request are coalesced into one follow-up,
 *  - an `ended` signal is never lost even if it arrives while a request is in flight.
 */
export class ProgressSyncer {
  private latest: number | null = null;
  private lastSentPosition: number | null = null;
  private lastSentAt = 0;
  private pendingEnded = false;
  private inFlight: Promise<void> | null = null;
  private queued = false;
  private readonly intervalMs: number;
  private readonly now: () => number;

  constructor(
    private readonly send: (payload: ProgressPayload) => Promise<unknown>,
    options: Options = {},
  ) {
    this.intervalMs = options.intervalMs ?? 10_000;
    this.now = options.now ?? Date.now;
  }

  /** Call on every `timeupdate`. Sends only when the throttle interval has elapsed. */
  update(positionSeconds: number) {
    this.latest = positionSeconds;
    if (this.now() - this.lastSentAt >= this.intervalMs) void this.flush();
  }

  /** Send the latest position now (pause, seek, page hide). */
  flush(options: { ended?: boolean } = {}): Promise<void> {
    if (options.ended) this.pendingEnded = true;
    if (this.inFlight) {
      this.queued = true;
      return this.inFlight;
    }
    if (this.latest === null) return Promise.resolve();
    const unchanged = this.lastSentPosition !== null && Math.abs(this.latest - this.lastSentPosition) < 0.5;
    if (unchanged && !this.pendingEnded) return Promise.resolve();

    const payload = { positionSeconds: this.latest, ended: this.pendingEnded };
    this.pendingEnded = false;
    this.lastSentAt = this.now();
    this.lastSentPosition = payload.positionSeconds;

    this.inFlight = this.send(payload)
      .then(() => undefined)
      .catch(() => {
        // Allow a retry on the next update/flush; keep the ended signal.
        this.lastSentPosition = null;
        if (payload.ended) this.pendingEnded = true;
      })
      .finally(() => {
        this.inFlight = null;
        if (this.queued) {
          this.queued = false;
          void this.flush();
        }
      });
    return this.inFlight;
  }

  /** Synchronous best-effort payload for page unload (sent with `fetch(..., { keepalive: true })`). */
  takeUnsentPayload(): ProgressPayload | null {
    if (this.latest === null) return null;
    if (this.lastSentPosition !== null && Math.abs(this.latest - this.lastSentPosition) < 0.5 && !this.pendingEnded) {
      return null;
    }
    this.lastSentPosition = this.latest;
    return { positionSeconds: this.latest, ended: this.pendingEnded };
  }
}
