import { describe, expect, it, vi } from 'vitest';
import { ProgressSyncer, type ProgressPayload } from './progressSyncer';

/** Let pending promise chains (send → then → finally) settle. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(sendImpl?: (p: ProgressPayload) => Promise<unknown>) {
  let now = 0;
  const sent: ProgressPayload[] = [];
  const send = vi.fn(async (payload: ProgressPayload) => {
    sent.push(payload);
    return sendImpl?.(payload);
  });
  const syncer = new ProgressSyncer(send, { intervalMs: 10_000, now: () => now });
  return { syncer, sent, send, advance: (ms: number) => (now += ms) };
}

describe('ProgressSyncer', () => {
  it('throttles periodic saves while playing', async () => {
    const { syncer, sent, advance } = setup();
    advance(10_000);
    syncer.update(1);
    for (let t = 2; t <= 9; t++) {
      advance(1_000);
      syncer.update(t);
    }
    await tick();
    expect(sent).toEqual([{ positionSeconds: 1, ended: false }]);

    advance(10_000);
    syncer.update(20);
    await tick();
    expect(sent.at(-1)).toEqual({ positionSeconds: 20, ended: false });
  });

  it('flush sends the latest position immediately but skips unchanged positions', async () => {
    const { syncer, sent } = setup();
    syncer.update(33.3); // within the throttle window: not sent yet
    expect(sent).toEqual([]);
    await syncer.flush();
    await syncer.flush(); // nothing new: no duplicate request
    expect(sent).toEqual([{ positionSeconds: 33.3, ended: false }]);
  });

  it('always sends the ended signal, even when the position is unchanged', async () => {
    const { syncer, sent } = setup();
    syncer.update(60);
    await syncer.flush();
    await syncer.flush({ ended: true });
    expect(sent.at(-1)).toEqual({ positionSeconds: 60, ended: true });
  });

  it('coalesces updates made while a request is in flight and never loses `ended`', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { syncer, sent } = setup(() => (sent.length === 1 ? gate : Promise.resolve()));

    syncer.update(10);
    const first = syncer.flush();
    syncer.update(11);
    void syncer.flush();
    syncer.update(12);
    void syncer.flush({ ended: true });
    expect(sent).toHaveLength(1);

    release();
    await first;
    await tick();
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual({ positionSeconds: 12, ended: true });
  });

  it('retries after a failed save', async () => {
    let fail = true;
    const { syncer, sent } = setup(async () => {
      if (fail) throw new Error('offline');
    });
    syncer.update(5);
    await syncer.flush({ ended: true });
    fail = false;
    await syncer.flush();
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual({ positionSeconds: 5, ended: true });
  });

  it('provides an unsent payload for page unload only when there is something new', async () => {
    const { syncer } = setup();
    expect(syncer.takeUnsentPayload()).toBeNull();
    syncer.update(7);
    await syncer.flush();
    expect(syncer.takeUnsentPayload()).toBeNull();
    syncer.update(8);
    expect(syncer.takeUnsentPayload()).toEqual({ positionSeconds: 8, ended: false });
  });
});
