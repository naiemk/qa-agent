/**
 * Route issue_comment (mention → Magpi) and pull_request (stub; no auto-run yet).
 * Probot verifies webhook signatures when requests hit the HTTP server.
 */
import type { Probot } from "probot";
import type { TestdriverConfig } from "../config.ts";
import { createInMemoryQueue } from "../jobs/queue.ts";
import { processJob } from "../jobs/runner.ts";
import type { Job } from "../jobs/types.ts";
import { resolvePreviewUrl } from "../magpi/preview-url.ts";
import { createOctokitCommentPoster, type CommentPoster } from "./comments.ts";
import { parseMention, type MentionRequest } from "./mention.ts";

export interface WebhookRegistration {
  queue: ReturnType<typeof createInMemoryQueue>;
}

async function postHint(comments: CommentPoster, mention: MentionRequest, body: string) {
  try {
    await comments.postResult(mention, {
      ok: false,
      summary: body,
      artifactLinks: [],
      magpi: { pass: false, summary: body, artifactLinks: [] },
    });
  } catch (err) {
    console.error("[testdriver:webhook] hint comment failed", err);
    console.log("[testdriver:webhook] hint (log fallback)", body);
  }
}

export function registerWebhooks(app: Probot, config: TestdriverConfig): WebhookRegistration {
  const queue = createInMemoryQueue();

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

    const comments = createOctokitCommentPoster(context.octokit);
    const preview = resolvePreviewUrl(mention);
    const previewUrl = preview.baseUrl ?? config.magpiTestBaseUrl;

    console.log("[testdriver:webhook] trigger phrase matched", {
      phrase: config.triggerPhrase,
      previewSource: preview.baseUrl ? preview.source : previewUrl ? "config" : "none",
      previewUrl: previewUrl ?? null,
      instruction: mention.instruction.slice(0, 120),
    });

    if (!previewUrl) {
      await postHint(comments, mention, preview.missingHint);
      return;
    }

    const mentionWithUrl: MentionRequest = { ...mention, previewUrl };
    const env: Record<string, string> = {};
    if (config.openRouterApiKey) {
      env.OPENROUTER_API_KEY = config.openRouterApiKey;
    }

    const job: Job = {
      id: `comment-${context.payload.comment.id}`,
      createdAt: new Date().toISOString(),
      mention: mentionWithUrl,
      magpi: {
        repoUrl: mention.repoUrl,
        ref: mention.ref,
        previewUrl,
        targetDir: config.magpiTestWorkdir,
        maxMinutes: config.jobMaxMinutes,
        bin: config.magpiTestBin,
        env,
      },
    };

    await queue.enqueue(job);
    await processJob(job, comments);
  });

  app.on(["pull_request.opened", "pull_request.synchronize", "pull_request.reopened"], async (context) => {
    const pr = context.payload.pull_request;
    console.log("[testdriver:webhook] pull_request (stub no-op; auto-run not in this pass)", {
      action: context.payload.action,
      repo: context.payload.repository.full_name,
      number: pr.number,
      head: pr.head.sha,
    });
  });

  app.onError((err) => {
    console.error("[testdriver:webhook] error", err);
  });

  return { queue };
}
