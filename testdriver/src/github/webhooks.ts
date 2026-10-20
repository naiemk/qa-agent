/**
 * Route issue_comment and pull_request. Phase 1: log + no-op (no Magpi execution).
 * Probot verifies webhook signatures when requests hit the HTTP server.
 */
import type { Probot } from "probot";
import type { TestdriverConfig } from "../config.ts";
import { createInMemoryQueue } from "../jobs/queue.ts";
import { processJob } from "../jobs/runner.ts";
import type { Job } from "../jobs/types.ts";
import { createLogCommentPoster } from "./comments.ts";
import { parseMention } from "./mention.ts";

export interface WebhookRegistration {
  queue: ReturnType<typeof createInMemoryQueue>;
}

export function registerWebhooks(app: Probot, config: TestdriverConfig): WebhookRegistration {
  const queue = createInMemoryQueue();
  const logComments = createLogCommentPoster();

  app.on("issue_comment.created", async (context) => {
    const body = context.payload.comment.body ?? "";
    const issue = context.payload.issue;
    const repo = context.payload.repository;
    const isPullRequest = Boolean(issue.pull_request);

    console.log("[testdriver:webhook] issue_comment.created", {
      repo: repo.full_name,
      number: issue.number,
      isPullRequest,
      commentId: context.payload.comment.id,
    });

    const mention = parseMention(config.triggerPhrase, {
      body,
      issueOrPrNumber: issue.number,
      isPullRequest,
      repository: { owner: repo.owner.login, name: repo.name },
      commentId: context.payload.comment.id,
      installationId: context.payload.installation?.id,
      repoUrl: repo.clone_url ?? `https://github.com/${repo.full_name}.git`,
      ref: isPullRequest ? `refs/pull/${issue.number}/head` : (repo.default_branch ?? "HEAD"),
    });

    if (!mention) {
      console.log("[testdriver:webhook] no trigger phrase; ignoring");
      return;
    }

    console.log("[testdriver:webhook] trigger phrase matched", {
      phrase: config.triggerPhrase,
      previewUrl: mention.previewUrl ?? config.magpiTestBaseUrl,
      instruction: mention.instruction.slice(0, 120),
    });

    const previewUrl = mention.previewUrl ?? config.magpiTestBaseUrl ?? "";
    const job: Job = {
      id: `comment-${context.payload.comment.id}`,
      createdAt: new Date().toISOString(),
      mention: { ...mention, previewUrl: previewUrl || mention.previewUrl },
      magpi: {
        repoUrl: mention.repoUrl,
        ref: mention.ref,
        previewUrl: previewUrl || "https://example.invalid",
        targetDir: config.magpiTestWorkdir,
        maxMinutes: config.jobMaxMinutes,
        bin: config.magpiTestBin,
      },
    };

    await queue.enqueue(job);
    // Phase 1: process immediately (log only); days 2–7 use a background worker.
    await processJob(job, logComments);
  });

  app.on(["pull_request.opened", "pull_request.synchronize", "pull_request.reopened"], async (context) => {
    const pr = context.payload.pull_request;
    console.log("[testdriver:webhook] pull_request (stub no-op)", {
      action: context.payload.action,
      repo: context.payload.repository.full_name,
      number: pr.number,
      head: pr.head.sha,
    });
    // Phase 1: no auto-run on PR events — mention-only.
  });

  app.onError((err) => {
    console.error("[testdriver:webhook] error", err);
  });

  return { queue };
}
