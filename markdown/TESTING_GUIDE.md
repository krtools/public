# ElasticInput -- Live Testing Guide

This guide is for a tester manually verifying ElasticInput in a browser using the demo app (`npm run dev`, port 3000). The demo has four tabs: **CRM Search**, **Log Explorer**, **E-Commerce**, and **Spreadsheet**. The options panel on the right lets you toggle features at runtime.

---

## 0. Setup

1. Run `npm run dev` -- the demo opens at http://localhost:3000.
2. You should see a search input, example query buttons below it, and an options panel on the right.
3. The options panel has toggles for: dark mode, dropdown mode, align to input, multiline, smart select all, expand selection, wildcard wrap, format query, saved searches, history, and more.

---

## 1. Basic Typing and Syntax Highlighting

### 1.1 Field:Value pairs
- Type `status:active` -- "status" should be colored as a field name, ":" as punctuation, "active" as a value.
- Type `deal_value:>5000` -- the `>` should be colored as an operator, `5000` as a value.

### 1.2 Boolean operators
- Type `status:active AND level:ERROR` -- "AND" should be distinctly colored as a boolean operator.
- Try `OR`, `NOT` -- same coloring.
- Try lowercase: `and`, `or`, `not` -- should work identically.
- Try aliases: `&&`, `||` -- should be colored as AND/OR.

### 1.3 Quoted phrases
- Type `name:"John Doe"` -- the entire `"John Doe"` including quotes should be colored as a quoted value.
- Type `name:'John'` -- single quotes should NOT be treated as phrase delimiters. `'John'` should be a regular value.
- Type `name:"unclosed` -- should tokenize gracefully (no crash), the unclosed quote should get a squiggly error.

### 1.4 Parentheses
- Type `(status:active OR status:lead)` -- parens should be colored.
- Place cursor next to a paren -- both the paren and its match should highlight with a background color (bracket matching).
- Type `((nested))` and verify matching works at each nesting level.

### 1.5 Special tokens
- Type `#vip-active` (with saved searches enabled) -- should be colored as a saved search.
- Type `!recent` (with history enabled) -- should be colored as a history ref.
- Type `name:John*` -- the `*` should be wildcard-colored.
- Type `name:qu?ck` -- the `?` wildcard should also work.

### 1.6 Modifiers
- Type `name:john~2` -- the `~2` should be distinctly styled (tilde modifier).
- Type `tags:enterprise^3` -- the `^3` should be styled (boost modifier).
- Type `"quick fox"~5` -- proximity modifier on a quoted phrase.

### 1.7 Ranges
- Type `price:[10 TO 100]` -- the range should be sub-highlighted: brackets, `TO` keyword, and bound values each get their own color.
- Type `created:{now-7d TO now}` -- curly brackets for exclusive range.

### 1.8 Regex
- Type `name:/[Jj]oh?n/` -- should be highlighted with regex sub-highlighting (delimiters, character classes, quantifiers, etc.).

### 1.9 Per-field-type value colors
- If `valueTypes` colors are configured, verify that `price:100` (number), `created:2024-01-01` (date), `is_vip:true` (boolean) each have distinct value colors.

---

## 2. Autocomplete Dropdown

### 2.1 Field suggestions
- Click into an empty input -- dropdown should show all available field names (e.g., `name:`, `email:`, `status:`, etc.).
- Type `sta` -- dropdown should filter to fields matching "sta" (e.g., `status:`). Should also match by label (e.g., typing `dat` should match "Created Date").
- Press Tab or click a field -- it should be inserted with a trailing colon (e.g., `status:`).

### 2.2 Value suggestions
- Type `status:` -- for CRM tab, a "Searching..." spinner should briefly appear, then values like `active`, `inactive`, etc.
- Type `is_vip:` -- should show `true`, `false` (boolean field).
- Type `price:` -- should show hint "Enter a number" that persists while typing digits.
- Type `created:` -- should open a **date picker** (calendar popup), not text suggestions.
- Type `ip:` (Logs tab) -- should show hint "Enter an IP address".

### 2.3 Operator suggestions
- Type `status:active ` (with trailing space) -- dropdown should show AND, OR, NOT, plus field names (implicit AND context).

### 2.4 Suggestion chaining
- Type `sta` -> accept `status:` -> dropdown immediately shows value suggestions for status.
- Accept a value -> press space -> operators appear.
- Accept AND -> field suggestions appear again.
- **Full chain:** Build `status:active AND level:ERROR` entirely through autocomplete acceptance.

### 2.5 Saved search suggestions
- Enable "Saved Searches" in the options panel.
- Type `#` -- should show all saved searches (#vip-active, #high-value, etc.).
- Type `#vip` -- should filter to matching saved searches.

### 2.6 History suggestions
- Enable "History" in the options panel.
- Type `!` -- should show history entries with a two-row layout (query text + timestamp).
- History items with boolean operators should be wrapped in parens when inserted.

### 2.7 Hint items
- With saved searches and history enabled, click into an empty input -- you should see a `#saved-search` and `!history` hint at the bottom of the dropdown.
- Start typing -- hints should disappear.
- Click the `#saved-search` hint -- it should insert `#` and show saved search suggestions.

### 2.8 Async behavior
- Type `company:` (CRM tab) -- should show "Searching..." briefly (800ms delay), then company suggestions.
- Type `slow:` (CRM tab) -- should show "Searching..." for 3 seconds, then results.
- Type `broken:` (CRM tab) -- should show an error message in the dropdown (async error demo).
- Type `company:A` quickly while results are pending -- previous results should stay visible (no flash), then update.
- Type `name:` -- should show nothing (suggestions: false on this field, no spinner at all).

### 2.9 Loading delay
- If `loadingDelay` is configured (options panel), verify the spinner doesn't appear for fast responses.

### 2.10 Field groups
- Type `status:(` -- inside the parens, suggestions should be values for `status` field, not field names.
- Type `status:(active OR ` -- next suggestion inside parens should still be status values.

### 2.11 Dropdown alignment
- Toggle "Align to Input" in options -- the dropdown should span the full input width and attach to its bottom edge.
- In this mode, verify descriptions are NOT unnecessarily truncated (they should use available space).

### 2.12 Max suggestions
- Type `s` -- if more fields start with "s" than `maxSuggestions`, only the configured max should show.
- Type `sku:` (E-Commerce tab) -- there are 500 SKUs; only `maxSuggestions` should render.

---

## 3. Date Picker

### 3.1 Single date
- Type `created:` (CRM tab) -- date picker should appear.
- Click a date -- it should insert `YYYY-MM-DD` format.
- Verify a trailing space is added if at end of input.

### 3.2 Range mode
- Click the range toggle in the date picker.
- Click a start date, then an end date -- should insert `[YYYY-MM-DD TO YYYY-MM-DD]`.
- If you click end before start (reversed), it should auto-correct.

### 3.3 Navigation
- Click the month/year header to zoom out: Days -> Months -> Years.
- Click a month in months view to drill back to days.
- Click a year in years view to drill to months.
- Use left/right arrows to navigate by month/year/decade.

### 3.4 Range hover preview
- In range mode after selecting a start date, hover over other dates -- the range preview should highlight.

### 3.5 Presets
- In range mode, preset buttons (e.g., "Last 7 days", "Last 30 days") should appear below the calendar.
- Click a preset -- it should insert the appropriate range.

### 3.6 Existing value
- Use an example query with `created:[2024-01-01 TO 2024-12-31]`, click inside the range -- the date picker should open in range mode with those dates pre-populated.
- Use `created:2024-06-15`, click on the date -- picker should open in single mode with June 15 highlighted.

---

## 4. Validation and Squiggly Underlines

### 4.1 Unknown field
- Type `fakefield:value` -- red squiggly should appear under "fakefield".
- Hover over the squiggly -- tooltip should say "Unknown field: fakefield".

### 4.2 Type validation
- Type `deal_value:abc` (CRM) -- squiggly on "abc" ("Expected a number").
- Type `is_vip:maybe` (CRM) -- squiggly on "maybe" ("Expected true or false").
- Type `ip:not-an-ip` (Logs) -- squiggly on "not-an-ip".
- Type `created:notadate` (CRM) -- squiggly on "notadate".

### 4.3 Custom validation
- Type `rating:99` (E-Commerce) -- squiggly ("Rating must be between 1 and 5").
- Type `email:john.doe` (CRM) -- warning squiggly in amber ("Not a valid email").
- Type `*corp` (CRM) -- warning squiggly ("Leading wildcard -- query may be slow").
- Type `phone:abc-def` (CRM) -- squiggly ("Invalid phone format").
- Type `age:abc` (CRM) -- squiggly ("Expected age, range (21-27), or list (21,24,23-29)").

### 4.4 Comparison operator validation
- Type `status:>active` (CRM) -- squiggly (comparison ops only work on number/date fields).
- Type `price:>100` -- no squiggly (valid).

### 4.5 Modifier validation
- Type `name:john~5` -- squiggly ("Fuzzy edit distance must be 0, 1, or 2").
- Type `name:john^0` -- squiggly ("Boost value must be positive").
- Type `name:john~2` -- no squiggly (valid).

### 4.6 Range validation
- Type `price:[abc TO def]` -- squiggly on each non-numeric bound separately.
- Type `created:[invalid TO now]` -- squiggly on "invalid" only.

### 4.7 Deferred display
- Type `status:` and then start typing an invalid value like `status:12` -- the squiggly should NOT appear while the cursor is still in the value.
- Move cursor away (click elsewhere or press space and type more) -- now the squiggly should appear.
- Blur the input -- ALL deferred errors should become visible.

### 4.8 Ambiguous precedence warning
- Type `a AND b OR c` -- amber warning squiggly should appear.
- Type `(a AND b) OR c` -- no warning (parens clarify).
- Type `a AND b AND c` -- no warning (same operator).

### 4.9 Syntax errors
- Type `(a b c` (no closing paren) -- squiggly on the `(`.
- Type `a )` -- squiggly on `)` ("Unexpected closing parenthesis").
- Type `a AND` (nothing after) -- squiggly on AND ("Missing search term after AND").
- Type `AND a` -- squiggly on AND ("Unexpected AND").

### 4.10 Incomplete expressions
- Type `name:` (leave empty) -- squiggly ("Missing value after name:").
- Type `price:>` -- squiggly ("Missing value after price>").

### 4.11 Star field bypass
- Type `*:value` -- no errors (star means all fields).

---

## 5. Keyboard Shortcuts

### 5.1 Tab -- Accept suggestion
- With dropdown open and an item highlighted, press Tab -- suggestion should be accepted.
- Tab should NEVER submit the search.

### 5.2 Enter -- Accept and possibly submit
- With a field value selected in dropdown, press Enter -- value is accepted AND search submits (`onSearch` fires, visible in the console/event log).
- With a field name selected, press Enter -- only accepts, does NOT submit.
- With no dropdown, press Enter -- submits the search.

### 5.3 Ctrl+Enter / Cmd+Enter -- Always submit
- At any time, Ctrl+Enter should submit regardless of dropdown state.

### 5.4 Escape -- Close dropdown
- Open dropdown, press Escape -- dropdown should close without accepting anything.

### 5.5 Arrow keys in dropdown
- ArrowDown/ArrowUp should navigate through suggestions.
- ArrowDown on last item should wrap to first.
- ArrowUp past first item should deselect (index -1).

### 5.6 Ctrl+Space -- Manual activation
- Set dropdown mode to "manual" in options.
- Type text -- no dropdown should appear.
- Press Ctrl+Space (or Cmd+Space on Mac) -- dropdown should appear.

### 5.7 Shift+Enter -- Newline (multiline)
- Ensure "Multiline" is enabled in options.
- Press Shift+Enter -- a line break should be inserted.
- The query should still parse correctly across lines.
- Ctrl+Enter should still submit.

### 5.8 Backspace in newline-only content
- Start with empty input. Press Shift+Enter 3 times (3 newlines).
- Press Backspace once -- should remove ONE newline, not clear the entire input.
- Press Backspace again -- removes another newline.
- Continue until empty.

### 5.9 Ctrl+A -- Smart select all
- Enable "Smart Select All" in options.
- Place cursor inside a value like `active` in `status:active`.
- Press Ctrl+A -- should select just `active`.
- Press Ctrl+A again -- should select all text.

### 5.10 Alt+Shift+Arrow -- Expand/Shrink selection
- Enable "Expand Selection" in options.
- Place cursor in `active` of `(status:active OR name:john) AND tags:enterprise`.
- Press Alt+Shift+Right repeatedly -- selection should expand: `active` -> `status:active` -> `status:active OR name:john` -> `(status:active OR name:john)` -> entire query.
- Press Alt+Shift+Left -- shrinks back down.

### 5.11 Alt+Shift+F -- Format query
- Enable "Format Query" in options.
- Type a long single-line query: `(status:active OR status:lead) AND deal_value:>5000 AND created:[now-30d TO now]`
- Press Alt+Shift+F -- the query should be reformatted/pretty-printed with indentation.
- **On macOS:** This should work despite Option key producing special characters (uses `e.code` internally).

### 5.12 Format query preserves operators
- Type `a && b || c` and press Alt+Shift+F -- should stay `a && b || c`, NOT normalized to `a AND b OR c`.
- If `formatQuery` is configured with `{ andOperator: 'AND', orOperator: 'OR' }`, then it should normalize.

---

## 6. Selection Wrapping (Surround)

### 6.1 Parentheses wrapping
- Select `a AND b` in `a AND b OR c`.
- Type `(` -- should wrap to `(a AND b) OR c`.
- The selection should be preserved inside the parens.

### 6.2 Quote wrapping
- Select a word like `hello`.
- Type `"` -- should wrap to `"hello"`.

### 6.3 Bracket wrapping
- Select a word, type `[` -- should wrap to `[word]`.

### 6.4 Wildcard wrapping
- Enable "Wildcard Wrap" in options.
- Select a single value token like `test` in `status:test`.
- Type `*` -- should become `status:*test*`.
- Select a multi-token span (e.g., `status:test`) -- pressing `*` should insert normally, NOT wrap.

### 6.5 Undo after wrapping
- Wrap a selection with `(`.
- Press Ctrl+Z -- should undo the wrapping AND restore the original selection.

---

## 7. Undo / Redo

### 7.1 Basic undo
- Type `hello world`.
- Press Ctrl+Z -- should undo the last typing group.
- Press Ctrl+Z again -- more undo.

### 7.2 Redo
- After undoing, press Ctrl+Y (or Ctrl+Shift+Z) -- should redo.

### 7.3 Typing group behavior
- Type quickly without pausing -- should be one undo group.
- Pause 300ms+ and type more -- should be a separate undo group.

### 7.4 Suggestion acceptance as distinct undo entry
- Type `sta`, accept `status:` from dropdown.
- Press Ctrl+Z -- should undo the suggestion acceptance (back to `sta`), not undo character-by-character.

---

## 8. Double-Click and Selection

### 8.1 Word selection
- Double-click on `value` in `filter:value abc` -- should select `value` WITHOUT trailing whitespace.
- Press Backspace -- should delete `value` only, leaving `filter: abc` (space preserved).

### 8.2 Syntax-aware boundaries
- Double-click on `filter` in `filter:value` -- should select `filter` only (stops at `:`).

### 8.3 Triple-click
- Triple-click -- should select the entire line (browser default behavior).

### 8.4 Multi-token selection suppresses dropdown
- Triple-click to select `email:asdf` (spans field + colon + value) -- dropdown should NOT appear.
- Double-click just `email` -- dropdown should appear with field suggestions.

---

## 9. Paste Behavior

### 9.1 Typographic normalization
- Copy text with smart quotes from Word/Outlook (e.g., `status:\u201Cactive\u201D`).
- Paste into the input -- smart quotes should be normalized to regular double quotes.
- Em dashes, en dashes, and non-breaking spaces should also be normalized.

### 9.2 Paste interception
- If `interceptPaste` is configured, paste multi-line content -- the interception dialog/transform should fire.

---

## 10. Dropdown Modes

### 10.1 "always" mode (default)
- Dropdown appears automatically on focus and typing.
- Escape dismisses; Ctrl+Space re-opens.

### 10.2 "input" mode
- Set dropdown mode to "input".
- Click into input -- no dropdown appears (navigation doesn't trigger).
- Type a character -- dropdown appears.
- Type a space -- dropdown should dismiss.

### 10.3 "manual" mode
- Set dropdown mode to "manual".
- Type text -- no dropdown.
- Press Ctrl+Space -- dropdown appears.
- Move cursor to a different context (field name -> field value) -- dropdown should dismiss.
- Ctrl+Space re-opens.

### 10.4 "never" mode
- Set dropdown mode to "never".
- No dropdown should ever appear. No date picker, no suggestions.

### 10.5 onNavigation toggle
- Disable "On Navigation" in options.
- Typing should still show the dropdown.
- Clicking to a different position should NOT open the dropdown.

---

## 11. Visual and Layout

### 11.1 Dark mode
- Toggle dark mode -- all colors (input background, text, dropdown, squigglies, date picker) should switch.
- Syntax highlighting colors should update without needing to re-type.

### 11.2 Collapse on blur
- If "Collapse on Blur" is enabled (Spreadsheet tab), the input should collapse to one line when blurred and expand when focused.

### 11.3 Dropdown positioning
- Type near the bottom of the viewport -- dropdown should flip above the input if no space below.
- Scroll the page with the dropdown open -- it should reposition correctly.
- Resize the browser window with the dropdown open -- it should reposition.

### 11.4 Squiggly positioning on multiline
- Enter a multiline query with errors spanning multiple lines -- each line should get its own squiggly (not one giant bounding box).

---

## 12. Example Query Buttons

- Click each example query button for the active tab. For each:
  - Verify the query populates correctly.
  - Verify syntax highlighting is correct.
  - Verify expected validation errors/warnings appear.
  - Click into various parts of the query and verify autocomplete shows relevant suggestions.

### Key examples to test per tab:

**CRM:**
- "Errors: unknown + type" -- should show squiggly on "region" (unknown field) and "abc" (not a number).
- "Leading wildcard (warning)" -- amber warning squiggly on `*corp`.
- "Bad email (warning)" -- amber warning on `john.doe`.
- "Saved search + NOT" -- saved search colored, NOT colored.
- "Regex" -- regex sub-highlighting.
- "Plain mode (large query)" -- very long query, highlighting and autocomplete should be disabled.

**Logs:**
- "Errors: bad IP + type" -- multiple squigglies.
- "IP + wildcard" -- wildcard IP should be valid (no error).
- "Regex request ID" -- regex with character classes.

**E-Commerce:**
- "Errors: bad rating + unknown" -- rating out of range, unknown "color" field, non-numeric "price".

---

## 13. Imperative API

The demo exposes API methods. Open the browser console or use the demo's controls:

- **getValue()** -- should return current query text.
- **setValue("new query")** -- should update the input programmatically, with re-lex/re-parse/re-validate.
- **focus() / blur()** -- should focus/blur the input.
- **getAST()** -- should return the parsed AST.
- **getValidationErrors()** -- should return current errors.

---

## 14. Edge Cases

### 14.1 Empty input
- No errors, no squigglies. Placeholder text visible if configured.

### 14.2 Whitespace only
- Type spaces -- should be treated as empty. No errors.

### 14.3 Very long input
- Paste or type a very long query (100+ terms). Performance should remain acceptable. If `plainModeLength` is configured, it should degrade gracefully to plain text mode.

### 14.4 Rapid typing
- Type very quickly -- no visual glitches, no stale dropdown results, no errors.

### 14.5 Escaping
- Type `hello\!world` -- the `\!` should be treated as a literal (no history ref).
- Type `first\ name:value` -- escaped space should be part of the field name.

### 14.6 Field groups
- Type `status:(active OR inactive)` -- should parse as a field group with value suggestions inside.
- Type `created:(2024-01-01 now-7d)` -- no errors (valid dates in date field group).
- Type `created:(abc def)` -- errors on each invalid date.

### 14.7 Prefix operators
- Type `-status:active` -- should parse as NOT(status:active).
- Type `last-contact:x` -- the hyphen should be part of the field name, NOT a prefix op.
- Type `status:-inactive` -- the `-` after colon is part of the value, not a prefix op.

### 14.8 Aliases
- If a field has aliases configured, typing the alias should work identically (no unknown field error, correct type validation, correct autocomplete).

### 14.9 Blur behavior
- Type `status:` and start an async fetch, then immediately click outside (blur).
- The pending fetch should be cancelled. No dropdown should appear on the blurred input.
- All deferred errors should become visible on blur.
- If there were matching parens highlighted, the highlight should clear on blur.

---

## 15. Spreadsheet Tab

The Spreadsheet tab has special configuration (typically: no trailing space on accept, collapse on blur, etc.).

- Verify the input collapses to a single line when blurred.
- Verify accepting a suggestion does NOT add a trailing space.
- Verify Tab behavior matches the configured `onTab` handler.

---

## Summary Checklist

| Area | Key Things to Verify |
|------|---------------------|
| Highlighting | All token types colored, per-type value colors, regex/range sub-highlighting, paren matching |
| Autocomplete | Field/value/operator/saved/history suggestions, chaining, async lifecycle, hints, loading/error states |
| Date picker | Single/range mode, navigation, presets, hover preview, existing value pre-population |
| Validation | Unknown fields, type errors, custom validation, warnings, deferred display, modifier/range validation |
| Keyboard | Tab/Enter/Escape/Ctrl+Enter, arrows, Shift+Enter, Ctrl+A, Alt+Shift+Arrow, Alt+Shift+F |
| Selection | Double-click boundaries, surround wrapping, wildcard wrap, undo after wrap |
| Undo/Redo | Typing groups, suggestion acceptance entries, redo discard |
| Dropdown modes | always/input/manual/never, onNavigation, alignToInput |
| Edge cases | Empty, whitespace, long input, escaping, field groups, prefix ops, blur behavior |
| Visual | Dark mode, collapse on blur, dropdown repositioning, multiline squigglies |
