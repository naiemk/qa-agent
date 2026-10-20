/**
 * Results / progress comments on the triggering issue or PR.
 * Placeholder — days 2–7: post via Octokit; never include secrets or PEM material.
 */
import type { JobResult } from "../jobs/types.ts";
import type { MentionRequest } from "./mention.ts";

export interface CommentPoster {
  /** Ack that work is queued (👀 or short text). */
  acknowledge(mention: MentionRequest): Promise<void>;
  /** Final summary after Magpi Test exits. */
  postResult(mention: MentionRequest, result: JobResult): Promise<void>;
}

/** Formats a Markdown body for GitHub. Keep Magpi paths as opaque artifact links. */
export function formatResultComment(result: JobResult): string {
  const lines = [
    `### Magpi Test ${result.ok ? "finished" : "did not succeed"}`,
    "",
    `- Exit code: \`${result.exitCode}\``,
    result.previewUrl ? `- Preview: ${result.previewUrl}` : null,
    result.reportExcerpt ? ["", "#### Report (excerpt)", "", "```", result.reportExcerpt, "```"].join("\n") : null,
    result.errorMessage ? ["", `> ${result.errorMessage}`].join("\n") : null,
  ].filter(Boolean);
  return lines.join("\n");
}

/** Placeholder poster — logs only until Octokit is wired. */
export function createLogCommentPoster(): CommentPoster {
  return {
    async acknowledge(mention) {
      console.log("[testdriver] ack", mention.repository, mention.issueOrPrNumber);
    },
    async postResult(mention, result) {
      console.log("[testdriver] result comment", mention.issueOrPrNumber, formatResultComment(result));
    },
  };
}
