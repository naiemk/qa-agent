/**
 * Job shapes for mention → (later) Magpi → comment.
 */
import type { MentionRequest } from "../github/mention.ts";
import type { MagpiRunInput, MagpiRunOutput } from "../magpi/contract.ts";

export interface Job {
  id: string;
  createdAt: string;
  mention: MentionRequest;
  magpi: MagpiRunInput;
}

export interface JobResult {
  ok: boolean;
  summary: string;
  artifactLinks: string[];
  magpi: MagpiRunOutput;
}
