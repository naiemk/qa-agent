# Scenario and Trajectory

Status: **proposed (M1)**. Decisions: QD3, QD4, QD5.

Two JSON records carry everything between "what should be tested" and "the Playwright
file". Models fill and repair these. Code turns them into tests. Keep both small and
typed; a cheap model must be able to produce a valid one from a short prompt plus the
JSON Schema.

Define both as TypeScript types in `src/scenario/types.ts` and `src/synth/types.ts`,
with a hand-written validator (no schema library needed in M1; follow Magpi's
`validatePredicate` style: return a list of error strings).

## Scenario

What to test. Written by a human (guided) or by exploration (candidate).

```ts
interface Scenario {
  schemaVersion: 1;
  id: string;                 // kebab-case, stable: "create-invoice-custom-address"
  title: string;              // one line, becomes the Playwright test title
  source: "human" | "explore" | "discover";
  area: string;               // app-map area id: "commerce.create"
  lens: Lens;                 // "happy" | "invalid-input" | "empty-or-error" | "alternate-entry" | "deep"
  startPath: string;          // relative to baseURL: "/create"
  preconditions: string[];    // plain language; M1 may only state them
  steps: string[];            // plain language, ordered; guidance for Magpi, not code
  expected: string[];         // plain language outcome
  criteria: Predicate[];      // Magpi predicates; fixed before the run (D20)
  criteriaStatus: "human" | "compiled" | "approved";
  needsFixture?: string[];    // "webauthn", "email-otp", "funding", "worker-tick"
  priority: 1 | 2 | 3;        // 1 = critical path
  status: "pending" | "running" | "trajectory" | "accepted" | "quarantined" | "skipped";
  notes?: string[];
}
```

Rules:

- `criteria` must contain at least one predicate that would fail on the start page.
  Otherwise a do-nothing run passes. The criteria compiler checks this by evaluating
  them against a fresh load of `startPath`; if all pass there, reject.
- `ref_exists` is not allowed in criteria.
- Scenarios with `needsFixture` are `skipped` in M1 with the reason in `notes`.

### Human scenario file (guided input)

`<target>/magpi-tests/scenarios/<id>.md`. Markdown so humans can write it quickly; the
parser maps headings to fields. Unknown headings are an error, not ignored.

```markdown
# Create invoice with a custom payout address

area: commerce.create
start: /create
priority: 1

## Steps
- Choose a network and token
- Pick "custom address" for payout and enter 0x1111111111111111111111111111111111111111
- Enter amount 25
- Create the invoice

## Expected
- A pay link for the new invoice is shown
- The amount 25 is displayed

## Criteria
- text_visible: 25
- {"kind":"url_includes","text":"/pay"}
```

`## Criteria` is optional. If missing, the criteria compiler (MT-4.2) proposes
predicates from `## Expected`, writes them into the scenario JSON with
`criteriaStatus: "compiled"`, and `magpi-test guided` prints them. In M1 compiled
criteria are used directly; `--require-approval` makes the command stop until the human
changes the status to `approved`.

## Trajectory

What happened in a successful run, in a form the emitter can turn into Playwright.

```ts
interface Trajectory {
  schemaVersion: 1;
  id: string;                     // "<scenarioId>--<n>"
  scenarioId: string;
  source: {
    goalId: string;
    magpiRoot: string;
    magpiVersion: string;
    locatorRecovery: "ledger-target" | "payload-join";
  };
  startPath: string;
  steps: Step[];
  assertions: Assertion[];        // final; from scenario criteria
  status: "draft" | "accepted" | "quarantined";
  repairs: RepairNote[];          // what the repair loop changed and why
}

interface Step {
  intent: string;                 // from ledger `intent`; becomes a comment and test.step title
  action:
    | { kind: "goto"; path: string }
    | { kind: "click"; target: Target }
    | { kind: "fill"; target: Target; value: Value }
    | { kind: "select"; target: Target; value: Value }
    | { kind: "check" | "uncheck"; target: Target }
    | { kind: "press"; target: Target; key: string };
  waitFor?: Assertion[];          // e.g. URL after navigation, from ledger `after.url`
}

type Target =
  | { by: "role"; role: string; name: string; exact?: boolean }
  | { by: "label"; text: string; exact?: boolean }
  | { by: "placeholder"; text: string }
  | { by: "text"; text: string; exact?: boolean }
  | { by: "testId"; id: string };

type Value =
  | { literal: string }
  | { env: string }               // secrets and per-env values: process.env[NAME]
  | { unique: string };           // "invoice-{n}" -> made unique per test run

type Assertion =                  // same vocabulary as Magpi Predicate, minus ref_exists
  Predicate;

interface RepairNote { at: string; error: string; change: string }
```

## Building a Trajectory from a Magpi goal (MT-2.4)

1. Read `events.jsonl`. Keep events with `type === "action"`, in order. Drop
   `type === "failure"` (the harness rejected them) and non-action events.
2. Map Magpi action kinds: `navigate` → `goto` (path relative to `baseURL`; drop the
   origin), `click` → `click`, `type` → `fill`, `select` → `select`. Other kinds: record
   in `notes` and fail the build with a clear error rather than guessing.
3. Target from `action.target` (after MT-2.1) or the payload join (fallback):
   - has a non-empty accessible `name` and a role in Playwright's ARIA role list →
     `{ by: "role", role, name, exact: true }`;
   - text input with no name but a placeholder → `placeholder`;
   - otherwise fail the step with `unresolvable-target` and let the repair loop decide.
4. Collapse noise: consecutive `fill`s on the same target keep the last; a `click`
   that only focused a field immediately before a `fill` of the same target is dropped.
5. `waitFor`: when `after.url` path differs from `before.url` path, add
   `url_includes` with the new path, with ids and hashes replaced (see
   [test-synthesis.md](test-synthesis.md), "Dynamic values").
6. `assertions` = the scenario's `criteria`, copied, never invented here.
7. Inputs: literal values typed during the run become `{ literal }`; values that match
   an env var the manifest exposes become `{ env }`; values that must be unique
   (names, emails) become `{ unique }` when the scenario or the repair loop says so.

## Lenses

Fixed list in M1, in `src/explore/lenses.ts`. Each lens is a short instruction
appended to the objective of a pass, plus rules for what counts as a test.

| Lens | Asks Magpi to | A resulting test asserts |
| --- | --- | --- |
| `happy` | Complete the main flow with valid data | the success outcome |
| `invalid-input` | Submit with missing, malformed, or boundary values, one at a time | the validation message, and that no success state appears |
| `empty-or-error` | Reach empty lists, bad links, not-found states | the empty or error message |
| `alternate-entry` | Reach the same flow from a different entry point (nav, deep link, back button) | the flow's first screen is correct |
| `deep` | Go one level past the happy path (view, edit, cancel, share the created thing) | the follow-up outcome |

New lenses are a spec change, not a code-only change.
