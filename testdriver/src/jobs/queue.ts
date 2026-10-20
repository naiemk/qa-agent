/**
 * In-memory job queue for phase 1.
 */
import type { Job } from "./types.ts";

export interface JobQueue {
  enqueue(job: Job): Promise<void>;
  dequeue(): Promise<Job | undefined>;
  size(): number;
}

export function createInMemoryQueue(): JobQueue {
  const pending: Job[] = [];
  const waiters: Array<(job: Job | undefined) => void> = [];
  let stopped = false;

  return {
    async enqueue(job) {
      if (stopped) throw new Error("queue stopped");
      const waiter = waiters.shift();
      if (waiter) waiter(job);
      else pending.push(job);
    },
    async dequeue() {
      if (pending.length > 0) return pending.shift();
      if (stopped) return undefined;
      return await new Promise<Job | undefined>((resolve) => {
        waiters.push(resolve);
      });
    },
    size() {
      return pending.length;
    },
  };
}

/** Alias used in PLAN.md */
export const createInProcessQueue = createInMemoryQueue;
