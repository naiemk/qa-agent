/**
 * In-process job queue (v1). Swap implementation later without touching Magpi Test.
 * Placeholder — days 2–7: enqueue from webhooks, drain via runner.
 */
import type { Job } from "./types.ts";

export interface JobQueue {
  enqueue(job: Job): Promise<void>;
  /** Block until a job is available (or return undefined if stopped). */
  dequeue(): Promise<Job | undefined>;
  size(): number;
}

export function createInProcessQueue(): JobQueue {
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
