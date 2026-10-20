/**
 * @mention trigger parsing.
 * Placeholder — days 2–7: detect @magpi-test (or MENTION_HANDLE) and extract text/URL.
 */

export interface MentionRequest {
  handle: string;
  body: string;
  /** Raw remainder after the mention token */
  instruction: string;
  /** First http(s) URL in the comment, if any */
  previewUrl: string | undefined;
  issueOrPrNumber: number;
  isPullRequest: boolean;
  repository: { owner: string; name: string };
  commentId: number;
  installationId: number | undefined;
}

const URL_RE = /https?:\/\/[^\s<>")]+/i;

/**
 * Returns a MentionRequest when the comment addresses our handle; otherwise null.
 */
export function parseMention(
  handle: string,
  input: {
    body: string;
    issueOrPrNumber: number;
    isPullRequest: boolean;
    repository: { owner: string; name: string };
    commentId: number;
    installationId?: number;
  },
): MentionRequest | null {
  const normalized = handle.replace(/^@/, "").toLowerCase();
  const mentionRe = new RegExp(`(^|\\s)@${normalized}\\b`, "i");
  if (!mentionRe.test(input.body)) return null;

  const instruction = input.body.replace(mentionRe, " ").trim();
  const match = instruction.match(URL_RE);
  const previewUrl = match?.[0]?.replace(/[.,;:]+$/, "");

  return {
    handle: normalized,
    body: input.body,
    instruction,
    previewUrl,
    issueOrPrNumber: input.issueOrPrNumber,
    isPullRequest: input.isPullRequest,
    repository: input.repository,
    commentId: input.commentId,
    installationId: input.installationId,
  };
}
