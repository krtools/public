# Gemini CLI configuration

A production-oriented configuration for Gemini CLI that closes most of the quality gap with Claude Code. Emphasis on careful business logic, explicit requirements, and reviewable output.

## What's in here

```
gemini-cli-config/
├── settings.json               # User-level Gemini CLI settings
├── GEMINI.md                   # Global working agreement (prepended to every session)
├── geminiignore.example        # Per-project ignore template (rename to .geminiignore)
├── agents/
│   ├── requirements-analyst.md # Elicits and clarifies requirements; writes specs
│   ├── tech-planner.md         # Breaks specs into verifiable phases; writes plans
│   ├── logic-reviewer.md       # Audits business logic against rules docs
│   ├── code-reviewer.md        # Generic review: types, errors, conventions
│   ├── researcher.md           # Deep codebase investigation; returns summaries
│   └── test-runner.md          # Runs typecheck/lint/tests and reports
└── skills/
    └── domain-rules/           # On-demand skill for producing rules docs
        ├── SKILL.md
        └── template.md
```

## Install

Everything here goes into `~/.gemini/`:

```sh
# macOS / Linux
cp    settings.json         ~/.gemini/settings.json
cp    GEMINI.md             ~/.gemini/GEMINI.md
mkdir -p ~/.gemini/agents ~/.gemini/skills
cp -R agents/*              ~/.gemini/agents/
cp -R skills/*              ~/.gemini/skills/
```

If you already have a `~/.gemini/settings.json`, merge rather than overwrite — you'll lose your auth setup otherwise.

Per-project: copy `geminiignore.example` into any repo as `.geminiignore`, and add a project-specific `.gemini/GEMINI.md` at the repo root with stack-specific info (commands, entry points, local conventions).

## The intended workflow

For **small, obvious tasks**: just prompt the main agent. Fix a typo, add a trivial helper, wire up a button. No ceremony.

For **ambitious or ambiguous work**, follow the three-step rhythm:

1. **Requirements** — `@requirements-analyst I want to <broad goal>`. Iterate until the spec is confirmed and saved to `docs/specs/`.
2. **Plan** — `@tech-planner plan the work described in docs/specs/001-feature.md`. Review the phases; push back on any that feel too big or too vague.
3. **Execute phase by phase** — `execute phase 1 of docs/plans/001-feature.md, then stop`. After each phase, run `@test-runner` and `@code-reviewer`.

For **business logic specifically** (money, state machines, regulated data, irreversible actions):

1. Before any code, ask the agent to activate the `domain-rules` skill and produce a rules doc next to the target file.
2. Review and correct the rules doc yourself — this is the step only you can do.
3. Have the agent write tests first, based on the rules doc.
4. Implement.
5. Run `@logic-reviewer` to audit the implementation against the rules doc.
6. Fix anything the reviewer blocks or flags, and re-run.

## Why this setup

- **Two planning agents, not one.** `requirements-analyst` has no code-reading tools — it can't drift into implementation. `tech-planner` reads code but can't write it. The boundary is structural, not just instructional.
- **Two review agents, not one.** `code-reviewer` handles generic issues (types, errors, conventions). `logic-reviewer` audits domain correctness against an explicit rules doc. They have different jobs; combining them produces lazy reviews.
- **Skills for on-demand expertise.** `domain-rules` loads only when business logic work is happening, keeping it out of every other session's context.
- **Human gates between phases.** No orchestrator pattern. Spec → (you review) → plan → (you review) → execute phase 1 → (you review) → phase 2 ... The model is not graded by another instance of itself.
- **Artifact persistence.** Specs, plans, and rules docs live in the repo under version control. You can diff them, review them, and blame them months later.

## Model assignments

- `gemini-3-pro-preview` for main agent and most subagents.
- `gemini-3-flash-preview` for `test-runner` only (cheap, fast, well-scoped).

If new model versions land, update the `model:` field in each agent's frontmatter and the `model.name` key in `settings.json`.

## MCP servers included

- **context7** — pulls current library docs on demand. Reduces hallucinated API usage.
- **playwright** — browser automation for web/UI work and scraping.

Add more via `settings.json > mcpServers` as needed: GitHub, your DB, etc.

## What this config does NOT do

- **No YOLO mode.** Auto-approving tool calls is how you delete production. Approve explicitly, or allow-list specific read-only commands in project settings.
- **No orchestrator subagent.** Chains of agents grading each other are mostly theater. Use the agents manually with review points between them.
- **No role-playing.** No "you are a senior X with 20 years of experience" preambles. Clear instructions beat performance.
- **No fake metrics in outputs.** Some public subagent collections include hallucinated status reports with invented numbers. These are at best useless and at worst actively misleading.

## Project-level setup (recommended)

In each serious project, add:

```
your-repo/
├── .geminiignore               # Copied from geminiignore.example
├── .gemini/
│   └── GEMINI.md               # Project-specific: stack, commands, conventions
├── docs/
│   ├── specs/                  # Written by requirements-analyst
│   ├── plans/                  # Written by tech-planner
│   └── rules/                  # Written via domain-rules skill (when applicable)
```

The project-level `GEMINI.md` overrides/extends the global one. Keep it short — entry points, package manager, test command, naming conventions, anything truly project-specific.

## Honest limits

Even fully tuned, Gemini CLI and Claude Code have different strengths. Gemini 3 Pro is strong on long-context reasoning and multimodal work; Claude Sonnet/Opus tends to edge ahead on tool-use reliability across long agentic loops and on careful code edits. This config closes most of the gap; the rest comes down to model behavior, and shifts with each release on both sides.

For regulated-data, money-handling, or otherwise load-bearing code, no configuration substitutes for a domain expert reading the final implementation carefully. The workflow above makes that review possible by producing legible, auditable artifacts — it does not replace it.
