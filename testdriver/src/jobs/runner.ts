/**
 * Dequeue → Magpi CLI client → result comment.
 * Placeholder — days 2–7: wire queue loop; never import Magpi Test src/.
 */
import type { CommentPoster } from "../github/comments.ts";
import { runMagpiTest } from "../magpi/client.ts";
import type { JobQueue } from "./queue.ts";
import type { Job, JobResult } from "./types.ts";

export async function processJob(job: Job, comments: CommentPoster): Promise<JobResult> {
  await comments.acknowledge(job.mention);
  const magpi = await runMagpiTest(job.magpi);
  const result: JobResult = {
    ok: magpi.exitCode === 0,
    exitCode: magpi.exitCode,
    previewUrl: job.magpi.baseUrl,
    reportExcerpt: magpi.reportExcerpt,
    errorMessage: magpi.errorMessage,
    magpi,
  };
  await comments.postResult(job.mention, result);
  return result;
}

/** Background loop — call from index once Probot is up. */
export async function runWorker(queue: JobQueue, comments: CommentPoster): Promise<void> {
  for (;;) {
    const job = await queue.dequeue();
    if (!job) return;
    try {
      await processJob(job, comments);
    } catch (err) {
      console.error("[testdriver] job failed", job.id, err);
    }
  }
}
