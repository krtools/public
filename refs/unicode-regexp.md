| Property Type            | Escape Syntax Examples                | Description                                                    |
|--------------------------|--------------------------------------|----------------------------------------------------------------|
| **General Category**     | `\p{L}` or `\p{Letter}`              | Any kind of letter (alias for `General_Category=Letter`) :contentReference[oaicite:0]{index=0} |
|                          | `\p{Lu}` or `\p{Uppercase_Letter}`   | Uppercase letters                                                |
|                          | `\p{Ll}` or `\p{Lowercase_Letter}`   | Lowercase letters                                                |
|                          | `\p{M}` or `\p{Mark}`                | Mark characters (diacritics etc.)                                |
|                          | `\p{N}` or `\p{Number}`              | Numbers (digits, letter numbers etc.)                            |
|                          | `\p{P}` or `\p{Punctuation}`         | Punctuation characters                                           |
|                          | `\p{S}` or `\p{Symbol}`              | Symbols (currency, math, etc.)                                   |
|                          | `\p{Z}` or `\p{Separator}`           | Separators (space, line breaks, paragraph separators)             |
|                          | `\p{C}` or `\p{Other}`               | Other/unassigned/control characters                              |
| **Script**               | `\p{Script=Greek}` or `\p{sc=Grek}` | Characters from Greek script                                      :contentReference[oaicite:1]{index=1} |
|                          | `\p{Script=Latin}` or `\p{sc=Latn}` | Characters from Latin script                                     |
| **Script Extensions**    | `\p{Script_Extensions=Hiragana}` or `\p{scx=Hira}` | Characters that may belong to multiple scripts (e.g., Hiragana) :contentReference[oaicite:2]{index=2} |
| **Binary Properties**    | `\p{Alphabetic}` or `\p{Alpha}`      | Matches characters that are alphabetic                          :contentReference[oaicite:3]{index=3} |
|                          | `\p{ASCII}`                          | ASCII characters                                                 |
|                          | `\p{ASCII_Hex_Digit}` or `\p{AHex}`  | ASCII hexadecimal digits                                        |
|                          | `\p{White_Space}`                    | Whitespace characters                                            |
|                          | `\p{Any}`                            | All assigned code points (very broad)                            |
|                          | `\p{Assigned}`                       | Assigned code points                                             |
|                          | `\p{Emoji}`                          | Emoji characters or sequences (implementation-dependent)          |


| Abbrev | Long Name                  | Category Group | Description |
|---------|---------------------------|----------------|--------------|
| **L**   | Letter                    | Major          | Any kind of letter |
| Lu      | Uppercase_Letter          | L              | Uppercase letters |
| Ll      | Lowercase_Letter          | L              | Lowercase letters |
| Lt      | Titlecase_Letter          | L              | Titlecase letters (e.g., ǅ) |
| Lm      | Modifier_Letter           | L              | Letters that modify other letters (e.g., ʰ) |
| Lo      | Other_Letter              | L              | Letters from alphabets without case (e.g., Greek α) |
| **M**   | Mark                      | Major          | Diacritics / combining marks |
| Mn      | Nonspacing_Mark           | M              | Do not advance cursor (e.g., ◌́ ) |
| Mc      | Spacing_Mark              | M              | Visible marks that advance cursor |
| Me      | Enclosing_Mark            | M              | Marks that enclose other chars (e.g., ◌⃝) |
| **N**   | Number                    | Major          | Numeric characters |
| Nd      | Decimal_Number            | N              | 0–9 and other decimal digits |
| Nl      | Letter_Number             | N              | Letters used as numbers (e.g., Ⅻ) |
| No      | Other_Number              | N              | Fractions, superscripts, etc. |
| **P**   | Punctuation               | Major          | Punctuation characters |
| Pc      | Connector_Punctuation     | P              | Underscore-like connectors (e.g., _) |
| Pd      | Dash_Punctuation          | P              | Dashes/hyphens (e.g., –, —) |
| Ps      | Open_Punctuation          | P              | Opening brackets/quotes (e.g., (), [) |
| Pe      | Close_Punctuation         | P              | Closing brackets/quotes (e.g., ), ]) |
| Pi      | Initial_Punctuation       | P              | Opening quotes (e.g., “) |
| Pf      | Final_Punctuation         | P              | Closing quotes (e.g., ”) |
| Po      | Other_Punctuation         | P              | Other punctuation (e.g., !, ?) |
| **S**   | Symbol                    | Major          | Mathematical/currency/symbolic characters |
| Sm      | Math_Symbol               | S              | Mathematical operators (+, =) |
| Sc      | Currency_Symbol           | S              | Currency signs ($, ¥, €) |
| Sk      | Modifier_Symbol           | S              | Modifiers (e.g., ^, ~) |
| So      | Other_Symbol              | S              | Miscellaneous symbols (e.g., ©, ☺) |
| **Z**   | Separator                 | Major          | Space and invisible separators |
| Zs      | Space_Separator           | Z              | Regular spaces |
| Zl      | Line_Separator            | Z              | Line separator (U+2028) |
| Zp      | Paragraph_Separator       | Z              | Paragraph separator (U+2029) |
| **C**   | Other                     | Major          | Non-printing / control / unassigned |
| Cc      | Control                   | C              | Control chars (U+0000–U+001F, etc.) |
| Cf      | Format                    | C              | Invisible format chars (e.g., Zero Width Joiner) |
| Cs      | Surrogate                 | C              | UTF-16 surrogate halves |
| Co      | Private_Use               | C              | Private-use codepoints |
| Cn      | Unassigned                | C              | Unused/reserved codepoints |
