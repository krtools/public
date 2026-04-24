---
name: domain-rules
description: Produce and maintain a rules document for non-trivial business logic before implementation. Use whenever the task involves money, state machines, regulated data, irreversible actions, or any logic where "looks right" is not the same as "is right." Ensures rules are explicit, auditable, and separable from implementation.
---

# Domain rules documentation

Business logic fails silently. Code compiles, tests pass, outputs look plausible, and the bug surfaces weeks later when someone's invoice is wrong. The defense is making the rules **explicit, separate from code, and auditable before implementation starts**.

# When to activate

Activate when the user is about to implement or modify logic that:
- Computes or moves money, tokens, credits, or any unit of value
- Transitions between states in a state machine
- Handles regulated data (PII, PHI, financial records)
- Performs irreversible actions (sending email, charging cards, deleting user data)
- Enforces access control, quotas, or rate limits
- Computes anything where the spec is longer than "add two numbers"

Do NOT activate for: UI scaffolding, CRUD routes that just pass data through, obvious utility functions, configuration changes.

# Workflow

1. **Identify the implementation target.** Which file(s) will contain the logic? The rules doc lives next to it as `<file>.rules.md` (e.g. `src/refunds.ts` → `src/refunds.rules.md`). If the logic spans many files, put it in `docs/rules/<domain>.md` instead.
2. **Extract rules from sources.** Read the spec, any linked policy docs, the ticket, and relevant prior conversation. Enumerate every rule and invariant you find. Cite the source for each.
3. **Flag assumptions explicitly.** Any time you filled in a gap, mark it `ASSUMED` and ask the user to confirm before proceeding.
4. **Fill out the template** at `template.md`. Give every rule, invariant, and edge case a stable ID (`R1`, `I1`, `E1`) so tests and reviewers can cite them.
5. **Stop and present to the user.** Do not write implementation code until the user confirms the rules doc. This is the checkpoint — skipping it defeats the purpose.
6. **Keep the doc in sync.** When logic changes, update the doc first, then the code. The doc is the source of truth.

# Format essentials

Every rules doc MUST have:

- **Sources** section citing where each rule came from (policy docs, tickets, user instructions, external regulations)
- **Rules** (`R1`, `R2`, ...) — statements the code must enforce
- **Invariants** (`I1`, `I2`, ...) — conditions that must always be true, across all code paths
- **Edge cases** (`E1`, `E2`, ...) — specific scenarios with expected behavior
- **Assumptions** — anything you filled in without confirmation, numbered, awaiting user sign-off
- **Out of scope** — explicitly-excluded cases, to prevent scope creep

See `template.md` for the exact structure to copy.

# The hard rules

- **Never proceed to implementation with unconfirmed assumptions.** Ask.
- **Never write logic that isn't traceable to a rule ID.** If the code does something the rules doc doesn't describe, either the doc is incomplete or the code is wrong.
- **The logic-reviewer agent will audit against this doc.** Write it such that every rule can be mechanically checked.
- **When the user revises a rule, update the ID reference in code comments and tests.** Don't let IDs drift.

# Integration with other agents

- `requirements-analyst` produces the spec, which is an input to the rules doc.
- `tech-planner` flags which phases need a rules doc (per its "Business logic flag" section).
- The implementation agent writes code, citing rule IDs in comments where non-obvious.
- `logic-reviewer` audits the implementation against this doc.
