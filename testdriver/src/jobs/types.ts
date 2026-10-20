/**
 * Job shapes for the mention → Magpi → comment pipeline.
 * Keep GitHub payload details out of Magpi Test core.
 */
import type { MentionRequest } from "../github/mention.ts";
import type { MagpiRunRequest, MagpiRunResult } from "../magpi/contract.ts";

export interface Job {
  id: string;
  createdAt: string;
  mention: MentionRequest;
  magpi: MagpiRunRequest;
}

export interface JobResult {
  ok: boolean;
  exitCode: number;
  previewUrl: string | undefined;
  reportExcerpt: string | undefined;
  errorMessage: string | undefined;
  magpi: MagpiRunResult;
}
