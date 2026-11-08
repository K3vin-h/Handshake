/** Serialize requests while retaining the newest repeat, without starving slow replies. */
export function createCoachQueue<T extends { key: string }, R>(send: (value: T) => Promise<R>, receive: (value: R) => void, failed: () => void) {
  let generation = 0;
  let pending: T | null = null;
  let busy = false;
  const latestPending = (): T | null => pending;
  async function drain() {
    const current = generation;
    busy = true;
    while (pending && current === generation) {
      const request = pending;
      pending = null;
      try {
        const result = await send(request);
        const latest = latestPending();
        if (current === generation && (!latest || latest.key === request.key)) receive(result);
      } catch {
        if (current === generation) failed();
      }
    }
    if (current === generation) busy = false;
  }
  return {
    submit(value: T) { pending = value; if (!busy) void drain(); },
    reset() { generation++; pending = null; busy = false; },
  };
}
