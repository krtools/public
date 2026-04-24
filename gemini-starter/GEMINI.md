# Working agreement

Read this at the start of every session. Don't restate it back to me.

## How we work

- Prefer TypeScript/Node.js. Strict mode. No `any`, no unchecked casts, no non-null assertions without a comment explaining why.
- For any task that touches more than ~3 files, is architecturally novel, or has ambiguous requirements: **stop and ask clarifying questions, then propose a plan for me to confirm before editing anything.** Small, obvious tasks don't need this ceremony.
- Don't invent APIs. If you're unsure whether a function, flag, or package exists, read the source or use the context7 MCP. Guessing is worse than asking.
- After non-trivial edits, run typecheck and the relevant tests. Fix what you broke before handing back. "Should work" is not a valid stopping point.
- Prefer small, reviewable diffs. Don't refactor unrelated code while you're in the neighborhood.
- Never run `git commit`, `git push`, `git reset --hard`, or any destructive operation without explicit approval in this session.

## Code style

- Functional over class-based where reasonable. Pure functions at the edges, side effects in narrow layers.
- Early returns over nested ifs. Exhaustive `switch` on discriminated unions (let TS enforce completeness).
- Descriptive names. No single-letter variables except loop indices. No abbreviations unless they're domain terms.
- Comments only where intent isn't obvious from the code. Don't narrate what the code does; explain why it does it that way.
- No banner comments, no horizontal-rule separators, no ASCII art. A blank line is enough.
- Tests live next to code (`foo.ts` + `foo.test.ts`) unless the project already does it differently.

## Business logic — extra care

For any code that handles money, regulated data, state machines, or irreversible actions, follow this discipline:

1. **Rules doc first, code second.** Before writing logic, produce or update a `.rules.md` file next to the implementation file. List every rule, invariant, and edge case. Cite the source (policy doc, ticket, user instruction). Flag any assumption you had to make. Wait for me to review before writing code. See the `domain-rules` skill for the format.
2. **Make illegal states unrepresentable.** Use branded types for IDs and money:
   ```ts
   type UserId = string & { readonly __brand: "UserId" };
   type Cents = number & { readonly __brand: "Cents" };
   ```
   Use discriminated unions for anything with states. Let the type system enforce invariants wherever possible.
3. **Never mix units.** `Cents` and `Dollars` are different types. Same for `Seconds` vs `Milliseconds`, `Gross` vs `Net`, etc.
4. **Tests before implementation for non-trivial logic.** Encode every rule from the rules doc as a test. Add property-based tests (fast-check) for invariants and numeric computations.
5. **Append-only for ledgers, events, and audit trails.** No updates, no deletes without explicit approval.

## When stuck

- Don't produce plausible-looking guesses. Say "I don't know" and ask, or investigate.
- If a test keeps failing in ways you don't understand, stop and describe what you've tried. Don't paper over with `@ts-ignore`, `any`, retries, or skips.
- If the task as stated conflicts with something in the codebase, surface the conflict. Don't silently reconcile.

## Output preferences

- Be terse. I can ask for more detail. I can't unread a wall of text.
- When proposing a plan, use short phased steps with clear verification points, not paragraphs.
- Show diffs or file:line references rather than pasting full files back at me.
