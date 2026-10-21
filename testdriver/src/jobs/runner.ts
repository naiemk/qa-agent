/**
 * Dequeue path: run Magpi Test for real, then post results.
 */
import type { CommentPoster } from "../github/comments.ts";
import { runMagpiTest } from "../magpi/client.ts";
import type { JobQueue } from "./queue.ts";
import type { Job, JobResult } from "./types.ts";

async function tryComment(
  label: string,
  fn: () => Promise<void>,
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[testdriver:runner] ${label} failed`, err);
  }
}

export async function processJob(job: Job, comments?: CommentPoster): Promise<JobResult> {
  console.log("[testdriver:runner] starting Magpi Test", {
    id: job.id,
    repo: `${job.mention.repository.owner}/${job.mention.repository.name}`,
    issueOrPr: job.mention.issueOrPrNumber,
    previewUrl: job.magpi.previewUrl,
    ref: job.magpi.ref,
    targetDir: job.magpi.targetDir,
    hasOpenRouterKey: Boolean(job.magpi.env?.OPENROUTER_API_KEY),
  });

  if (comments) {
    await tryComment("acknowledge", () => comments.acknowledge(job.mention));
  }

  const magpi = await runMagpiTest(job.magpi);
  const result: JobResult = {
    ok: magpi.pass,
    summary: magpi.summary,
    artifactLinks: magpi.artifactLinks,
    magpi,
  };

  console.log("[testdriver:runner] Magpi Test finished", {
    id: job.id,
    pass: magpi.pass,
    exitCode: magpi.exitCode,
  });

  if (comments) {
    await tryComment("postResult", () => comments.postResult(job.mention, result));
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
      if (comments) {
        await tryComment("crashResult", () =>
          comments.postResult(job.mention, {
            ok: false,
            summary: `Magpi Test job crashed: ${err instanceof Error ? err.message : String(err)}`,
            artifactLinks: [],
            magpi: {
              pass: false,
              summary: "Job crashed before Magpi Test completed.",
              artifactLinks: [],
            },
          }),
        );
      }
    }
  }
}
