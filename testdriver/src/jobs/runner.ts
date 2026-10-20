/**
 * Phase 1 runner: accept a job, log it, do not execute Magpi Test.
 */
import type { CommentPoster } from "../github/comments.ts";
import type { JobQueue } from "./queue.ts";
import type { Job, JobResult } from "./types.ts";

export async function processJob(job: Job, comments?: CommentPoster): Promise<JobResult> {
  console.log("[testdriver:runner] accepted job (no execution in phase 1)", {
    id: job.id,
    repo: `${job.mention.repository.owner}/${job.mention.repository.name}`,
    issueOrPr: job.mention.issueOrPrNumber,
    previewUrl: job.magpi.previewUrl,
    ref: job.magpi.ref,
  });

  const result: JobResult = {
    ok: false,
    summary: "Phase 1: job logged only; Magpi Test not run.",
    artifactLinks: [],
    magpi: {
      pass: false,
      summary: "Phase 1 stub — no Magpi execution.",
      artifactLinks: [],
    },
  };

  if (comments) {
    await comments.postResult(job.mention, result);
  }
  return result;
}

export async function runWorker(queue: JobQueue, comments?: CommentPoster): Promise<void> {
  for (;;) {
    const job = await queue.dequeue();
    if (!job) return;
    try {
      await processJob(job, comments);
    } catch (err) {
      console.error("[testdriver:runner] job failed", job.id, err);
    }
  }
}
