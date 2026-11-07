import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCoachQueue } from './coachQueue.ts';

test('slow response displays while newer repeats wait; reset discards prior item replies', async () => {
  const sent: number[] = [], received: number[] = [];
  let finish: ((value: number) => void) | undefined;
  const queue = createCoachQueue<{key: string; repeat: number}, number>(value => {
    sent.push(value.repeat); return new Promise(resolve => { finish = resolve; });
  }, value => received.push(value), () => {});
  queue.submit({key: 'A:thumb', repeat: 1});
  queue.submit({key: 'A:thumb', repeat: 2});
  queue.submit({key: 'A:thumb', repeat: 3});
  assert.deepEqual(sent, [1]);
  finish!(1); await Promise.resolve();
  assert.deepEqual(received, [1]); assert.deepEqual(sent, [1, 3]);
  queue.reset(); finish!(3); await Promise.resolve();
  assert.deepEqual(received, [1]);
});
