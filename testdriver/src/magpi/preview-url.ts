/**
 * Preview / attach URL plumbing into Magpi Test (MAGPI_TEST_BASE_URL).
 * Placeholder — days 2–7: comment URL → PR deployment → explicit fail comment.
 */
import type { MentionRequest } from "../github/mention.ts";

export interface PreviewResolution {
  baseUrl: string | undefined;
  source: "mention" | "deployment" | "none";
  /** Human hint when missing (posted back to GitHub). */
  missingHint: string;
}

/**
 * Prefer URL embedded in the mention; later: GitHub Deployments / Vercel checks.
 */
export function resolvePreviewUrl(
  mention: MentionRequest,
  deploymentUrl?: string,
): PreviewResolution {
  if (mention.previewUrl) {
    return { baseUrl: mention.previewUrl, source: "mention", missingHint: "" };
  }
  if (deploymentUrl) {
    return { baseUrl: deploymentUrl, source: "deployment", missingHint: "" };
  }
  return {
    baseUrl: undefined,
    source: "none",
    missingHint:
      "Include a preview URL in your mention, e.g. `@magpi-test QA https://your-preview.example.com`",
  };
}
