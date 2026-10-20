/**
 * Post comments on the triggering issue or PR via Octokit.
 */
import type { JobResult } from "../jobs/types.ts";
import type { MentionRequest } from "./mention.ts";

/** Minimal Octokit surface used for comments (Probot's context.octokit satisfies this). */
export interface IssuesOctokit {
  issues: {
    createComment(params: {
      owner: string;
      repo: string;
      issue_number: number;
      body: string;
    }): Promise<unknown>;
  };
}

export interface CommentPoster {
  acknowledge(mention: MentionRequest): Promise<void>;
  postResult(mention: MentionRequest, result: JobResult): Promise<void>;
}

export function formatResultComment(result: JobResult): string {
  const links =
    result.artifactLinks.length > 0
      ? ["", "Artifacts:", ...result.artifactLinks.map((l) => `- ${l}`)].join("\n")
      : "";
  return [
    `### Magpi Test ${result.ok ? "finished" : "update"}`,
    "",
    result.summary,
    links,
  ]
    .filter((line) => line !== undefined)
    .join("\n")
    .trim();
}

export function createOctokitCommentPoster(octokit: IssuesOctokit): CommentPoster {
  async function post(mention: MentionRequest, body: string): Promise<void> {
    await octokit.issues.createComment({
      owner: mention.repository.owner,
      repo: mention.repository.name,
      issue_number: mention.issueOrPrNumber,
      body,
    });
  }

  return {
    async acknowledge(mention) {
      await post(
        mention,
        `Queued Magpi Test for ${mention.previewUrl ?? "preview URL TBD"} (phase 1: log only).`,
      );
    },
    async postResult(mention, result) {
      await post(mention, formatResultComment(result));
    },
  };
}

/** Log-only poster for fixture replay / missing credentials. */
export function createLogCommentPoster(): CommentPoster {
  return {
    async acknowledge(mention) {
      console.log("[testdriver:comments] ack (log only)", {
        repo: `${mention.repository.owner}/${mention.repository.name}`,
        number: mention.issueOrPrNumber,
      });
    },
    async postResult(mention, result) {
      console.log("[testdriver:comments] result (log only)", {
        number: mention.issueOrPrNumber,
        body: formatResultComment(result),
      });
    },
  };
}
