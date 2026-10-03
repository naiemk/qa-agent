# Specs

Specs grow as we learn. Each one has a status at the top:

| Status | Meaning | What an implementer may do |
| --- | --- | --- |
| `decided` | Settled, with a decision in `../decisions.md`. | Build to it. |
| `proposed (M1)` | Concrete enough to build M1. May change after a spike. | Build to it; record any mismatch you find. |
| `undiscovered` | Intent and open questions only. | Do not build. Ask or wait for a spike. |

| Spec | Status | Covers |
| --- | --- | --- |
| [product.md](product.md) | decided | Thesis, users, what Magpi Test is not |
| [architecture.md](architecture.md) | proposed (M1) | The M1 pipeline, modules, data flow, CLI |
| [magpi-integration.md](magpi-integration.md) | proposed (M1) | Verified facts about Magpi: entry points, artifacts, traps, rules |
| [target-manifest.md](target-manifest.md) | proposed (M1) | Startup contract, answer key, output location |
| [scenario-and-trajectory.md](scenario-and-trajectory.md) | proposed (M1) | Scenario and Trajectory JSON, the AI-to-code boundary |
| [test-synthesis.md](test-synthesis.md) | proposed (M1) | Trajectory to Playwright, locators, assertions, acceptance, repair |
| [discovery-and-exploration.md](discovery-and-exploration.md) | proposed (M1) | Drop-in discovery, critical paths, lenses, coached passes |
| [onchain-invoice.md](onchain-invoice.md) | proposed (M1) | Dogfood target facts: startup, routes, helpers, answer key |
| [prior-art.md](prior-art.md) | undiscovered | What to reuse from Playwright and competitors (filled by MT-0.1) |
| [knowledge.md](knowledge.md) | undiscovered | Persistent application understanding (M2) |
| [fixtures.md](fixtures.md) | undiscovered | Environment capabilities for hard flows (M3) |
| [incremental.md](incremental.md) | undiscovered | Change-driven exploration (M4) |
| [evaluation.md](evaluation.md) | undiscovered | Metrics and the hidden-answer benchmark (M5; M1 uses a subset) |
| [open-questions.md](open-questions.md) | living | Brief section 20, with owners and answers so far |
