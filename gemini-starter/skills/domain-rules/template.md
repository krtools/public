# Rules: <domain or feature>

Status: Draft | Confirmed
Date: YYYY-MM-DD
Implementation: <path/to/file.ts>
Related spec: docs/specs/<nnn>-<slug>.md

## Sources

List every source these rules were derived from. Each rule below should cite one or more of these.

- `docs/policy/<file>.md` §<section>
- Ticket: <link or ID>
- User instruction dated YYYY-MM-DD
- External reg: <name, section>

## Rules

Statements the code MUST enforce. Each rule gets a stable ID. Tests and code comments reference these IDs.

- **R1.** <rule statement>. Source: <citation>.
- **R2.** <rule statement>. Source: <citation>.
- **R3.** <rule statement>. Source: <citation>.

## Invariants

Conditions that must always be true, across all code paths, always. Violations indicate data corruption.

- **I1.** <invariant>. Example violation: <scenario>. Source: <citation>.
- **I2.** <invariant>. Example violation: <scenario>. Source: <citation>.

## Edge cases

Specific scenarios with expected behavior. Tests should exercise each by ID.

- **E1.** <scenario description> → expected: <behavior>.
- **E2.** <scenario description> → expected: <behavior>.
- **E3.** <scenario description> → expected: <behavior>.

## Boundary conditions

Numeric, temporal, and collection boundaries that need explicit handling.

- Zero: <expected behavior>
- Negative: <expected behavior or rejection>
- Empty collection: <expected behavior>
- Max value: <expected behavior>
- Concurrent modification: <expected behavior>
- Timezone/DST: <expected behavior, if relevant>
- Precision: <e.g. "amounts are integer cents; no floats in money math">

## Assumptions

Things filled in without explicit confirmation. Each must be accepted or overridden by the user before implementation begins.

- **A1.** <assumption>. Awaiting confirmation.
- **A2.** <assumption>. Awaiting confirmation.

## Out of scope

Cases explicitly NOT handled here, with a brief reason. Prevents scope creep.

- <case>: <reason it's excluded>
- <case>: <reason it's excluded>

## Change log

- YYYY-MM-DD: Initial draft.
- YYYY-MM-DD: R3 revised per user clarification; A1 confirmed.
