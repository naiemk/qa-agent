import type { Lens } from "../scenario/types.ts";

/** Fixed list (scenario-and-trajectory.md "Lenses"). New lenses are a spec change. */
export const LENS_INSTRUCTIONS: Record<Lens, { asks: string; asserts: string }> = {
  happy: { asks: "Complete the main flow with valid data.", asserts: "the success outcome" },
  "invalid-input": {
    asks: "Submit with missing, malformed, or boundary values, one at a time.",
    asserts: "the validation message, and that no success state appears",
  },
  "empty-or-error": { asks: "Reach empty lists, bad links, not-found states.", asserts: "the empty or error message" },
  "alternate-entry": {
    asks: "Reach the same flow from a different entry point (nav, deep link, back button).",
    asserts: "the flow's first screen is correct",
  },
  deep: { asks: "Go one level past the happy path (view, edit, cancel, share the created thing).", asserts: "the follow-up outcome" },
};
