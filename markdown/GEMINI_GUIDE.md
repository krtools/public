Here's a practical config that will get Gemini CLI as close to Claude Code quality as you can reasonably get today. The biggest quality levers are: **model choice**, **context files (GEMINI.md)**, **skills**, **subagents**, and **MCP servers**. Settings tweaks help at the margins.

## 1. User-level `~/.gemini/settings.json`

```json
{
  "model": {
    "name": "gemini-3-pro-preview",
    "maxSessionTurns": -1,
    "summarizeToolOutput": {
      "default": { "tokenBudget": 2000 }
    }
  },
  "general": {
    "checkpointing": { "enabled": true },
    "preferredEditor": "code"
  },
  "ui": {
    "theme": "Default",
    "showMemoryUsage": true,
    "hideFooter": false
  },
  "context": {
    "fileName": ["GEMINI.md", "AGENTS.md"],
    "importFormat": "tree",
    "loadMemoryFromIncludeDirectories": true
  },
  "tools": {
    "usePty": true,
    "shell": {
      "enableInteractiveShell": true
    }
  },
  "security": {
    "folderTrust": { "enabled": true },
    "auth": {
      "selectedType": "oauth-personal"
    }
  },
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp"]
    }
  },
  "experimental": {
    "extensionManagement": true
  }
}
```

Key choices explained:
- **`gemini-3-pro-preview`** is the strongest model; use it as the default and let cheap subagents use `gemini-3-flash` (below). Pro is slower but much closer to Claude Sonnet 4.6/Opus in coding quality.
- **`checkpointing`** gives you `/restore` (like Claude Code's rewind). Essential safety net.
- **`context.fileName: ["GEMINI.md", "AGENTS.md"]`** accepts both — handy if you already have AGENTS.md from other tools.
- **Don't use YOLO mode** (`--yolo`). Use tool allow-listing via per-project settings for the specific commands you trust (e.g. `npm test`, `tsc`, `git status`).

## 2. Global `~/.gemini/GEMINI.md`

This is the single biggest quality lever — the equivalent of a CLAUDE.md. It's prepended to every prompt. Keep it tight; long context hurts:

```markdown
# Core working agreement

- Prefer TypeScript/Node.js. Strict mode, no `any`, no unchecked casts.
- Write comments only where intent isn't obvious from the code. No banner/horizontal-rule comments.
- When a task is highly complex or ambiguous, STOP and ask clarifying questions, then propose a plan I confirm before you start editing.
- Don't invent APIs — if unsure whether a function/package exists, read source or docs first (use context7 MCP when relevant).
- Always run typecheck + tests after non-trivial edits. Fix what you broke before handing back.
- Prefer small, reviewable diffs. Don't refactor unrelated code.
- Never commit or push unless I explicitly ask.

# Style

- Functional over class-based where reasonable.
- Early returns over nested ifs.
- Descriptive names; avoid abbreviations.
```

Then add a project-level `.gemini/GEMINI.md` in each repo with the stack, entry points, and commands (`npm run dev`, test patterns, etc.). Gemini CLI loads both hierarchically.

## 3. Install a few subagents (`~/.gemini/agents/`)

Subagents are Gemini's answer to Claude Code's Task tool — specialists with isolated context windows. They prevent context rot on long sessions. Drop these `.md` files in `~/.gemini/agents/`:

**`code-reviewer.md`**
```markdown
---
name: code-reviewer
description: Reviews recent code changes for bugs, type safety issues, unhandled errors, and adherence to project conventions. Use after any non-trivial edit.
tools:
  - read_file
  - glob
  - grep
  - run_shell_command(git diff*)
  - run_shell_command(git log*)
model: gemini-3-pro-preview
---
You are a senior TypeScript reviewer. Look for: type holes, missing await, unhandled promise rejections, resource leaks, off-by-one errors, inconsistency with neighboring code. Be terse. List issues with file:line. Suggest the minimal fix.
```

**`researcher.md`**
```markdown
---
name: researcher
description: Deep-reads large codebases or docs to answer architectural questions without bloating main context. Returns a concise summary.
tools:
  - read_file
  - glob
  - grep
  - mcp_context7_*
model: gemini-3-pro-preview
max_turns: 50
---
You investigate and summarize. Never edit files. Return findings as: Summary, Key files, Open questions. Keep under 400 words.
```

**`test-runner.md`**
```markdown
---
name: test-runner
description: Runs tests and typecheck, then reports failures with minimal reproduction info.
tools:
  - run_shell_command(npm test*)
  - run_shell_command(npm run*)
  - run_shell_command(npx tsc*)
  - read_file
model: gemini-3-flash-preview
---
Run tests and typecheck. If anything fails, report the first 3 failures with file, line, and the exact error. Don't try to fix; just report.
```

Flash for the cheap runner, Pro for reviewer/researcher. Main agent will auto-delegate, or invoke with `@code-reviewer ...`.

## 4. MCP servers worth adding

The ones I put in the config:
- **Context7** — fetches current docs for libraries. Huge quality boost; Gemini's training cutoff misses a lot.
- **Playwright MCP** — for any web/UI work (debugging, scraping, e2e).

Worth considering depending on your work: **GitHub MCP** (PR/issue management), **filesystem MCP** if you want scoped file access, **Firebase/Supabase MCP** if you use them.

## 5. Workflow habits that matter more than config

- **Use plan mode for anything non-trivial.** Start with `gemini --plan` or toggle it in-session. It's read-only — mirrors Claude Code's plan mode and dramatically improves outcomes on multi-file changes.
- **`/memory add <fact>`** when you catch yourself repeating instructions — appends to global GEMINI.md.
- **`/compress`** (or `/compact`) long sessions instead of letting them degrade.
- **`.geminiignore`** in each repo — exclude `node_modules`, `dist`, `.next`, lockfiles, generated code. Tighter context = better answers.
- **Keep GEMINI.md under ~2k tokens.** Beyond that, move detail into skills (`.gemini/skills/*`) which load on demand.

## Honest caveat

Even fully tuned, Gemini CLI and Claude Code have different strengths. Gemini 3 Pro is excellent at long-context analysis (1M window) and multimodal tasks. It tends to lag on tool-use reliability for long agentic loops and on nuanced code edits where Claude Sonnet/Opus still feels more careful. The config above closes most of the gap; the rest comes down to model behavior.

Want me to generate the actual files (`settings.json`, `GEMINI.md`, the three subagents) as downloadable artifacts so you can drop them straight into `~/.gemini/`?
