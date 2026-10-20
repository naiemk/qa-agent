/**
 * Detect the configured TRIGGER_PHRASE in issue/PR comment bodies.
 */

export interface MentionRequest {
  triggerPhrase: string;
  body: string;
  /** Remainder after the trigger token. */
  instruction: string;
  /** First http(s) URL in the comment, if any. */
  previewUrl: string | undefined;
  issueOrPrNumber: number;
  isPullRequest: boolean;
  repository: { owner: string; name: string };
  commentId: number;
  installationId: number | undefined;
  /** Best-effort clone URL for Magpi boundary. */
  repoUrl: string;
  /** Best-effort ref (PR head SHA or branch) when known. */
  ref: string;
}

const URL_RE = /https?:\/\/[^\s<>")]+/i;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns a MentionRequest when `body` contains the configured trigger phrase;
 * otherwise null. Phrase may be stored with or without a leading `@`.
 */
export function parseMention(
  triggerPhrase: string,
  input: {
    body: string;
    issueOrPrNumber: number;
    isPullRequest: boolean;
    repository: { owner: string; name: string };
    commentId: number;
    installationId?: number;
    repoUrl?: string;
    ref?: string;
  },
): MentionRequest | null {
  const withAt = triggerPhrase.startsWith("@") ? triggerPhrase : `@${triggerPhrase}`;
  const withoutAt = withAt.slice(1);
  const mentionRe = new RegExp(`(^|\\s)@?${escapeRegExp(withoutAt)}\\b`, "i");
  if (!mentionRe.test(input.body)) return null;

  const instruction = input.body.replace(mentionRe, " ").trim();
  const match = instruction.match(URL_RE);
  const previewUrl = match?.[0]?.replace(/[.,;:]+$/, "");
  const { owner, name } = input.repository;

  return {
    triggerPhrase: withAt,
    body: input.body,
    instruction,
    previewUrl,
    issueOrPrNumber: input.issueOrPrNumber,
    isPullRequest: input.isPullRequest,
    repository: input.repository,
    commentId: input.commentId,
    installationId: input.installationId,
    repoUrl: input.repoUrl ?? `https://github.com/${owner}/${name}.git`,
    ref: input.ref ?? "HEAD",
  };
}
