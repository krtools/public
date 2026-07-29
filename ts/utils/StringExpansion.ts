/**
 * String expansion: enumerates every string matched by a finite regex-like pattern.
 * Every generated string is matched by the pattern when used as a real regex; every
 * construct whose match set would be unbounded is a parse error, never silently ignored.
 *
 * Supported syntax:
 *   abc              literals
 *   [abc] [a-f0-9]   character classes with ranges ("-" literal at start/end)
 *   a|bc             alternation, expanded in written order
 *   (x|y)z (?:x|y)z  groups (capturing and non-capturing are equivalent here)
 *   x?               optional            -> {0,1}
 *   x{n} x{n,m}      bounded quantifiers
 *   \d \w \s         finite shorthand classes (also inside [...]), ascending code-point order
 *   \n \t \r \v \f \0 \xHH \uHHHH        character escapes
 *   \[ \] \( \) \| \{ \} \? \\ \- etc.   any escaped punctuation is that literal char
 *
 * Rejected (PatternError): . * + {n,} ^ $ \b \D \W \S [^...] lazy modifiers,
 * lookarounds, backreferences.
 *
 * Expansion order is deterministic: the leftmost part varies slowest, alternatives
 * come in written order, ranges ascend, quantifiers count up from min to max.
 *   expand("a[bcd]") -> "ab", "ac", "ad"
 *   expand("(ab|c)d?") -> "ab", "abd", "c", "cd"
 */

export class PatternError extends Error {
  constructor(
    message: string,
    readonly pattern: string,
    readonly index: number,
  ) {
    super(`${message} at index ${index} in ${JSON.stringify(pattern)}`);
    this.name = 'PatternError';
  }
}

export type Expansion = Generator<string, void, undefined>;

/** Lazily yields every string the pattern matches. Throws PatternError on unsupported syntax. */
export function expand(pattern: string): Expansion {
  return generate(new Parser(pattern).parse());
}

/**
 * Number of strings expand() would yield, computed without generating them.
 * Approximate above Number.MAX_SAFE_INTEGER.
 */
export function expansionCount(pattern: string): number {
  return countNode(new Parser(pattern).parse());
}

type Node =
  | { readonly kind: 'lit'; readonly text: string }
  | { readonly kind: 'class'; readonly chars: readonly string[] }
  | { readonly kind: 'seq'; readonly items: readonly Node[] }
  | { readonly kind: 'alt'; readonly branches: readonly Node[] }
  | { readonly kind: 'repeat'; readonly item: Node; readonly min: number; readonly max: number };

const DIGIT_CHARS = '0123456789';
const WORD_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
// The JS regex \s set, ascending by code point.
const SPACE_CHARS =
  '\t\n\v\f\r \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff';

class Parser {
  private pos = 0;

  constructor(private readonly pattern: string) {}

  parse(): Node {
    const node = this.parseAlternation();
    if (this.pos < this.pattern.length) this.fail('unmatched ")"');
    return node;
  }

  private fail(message: string, index = this.pos): never {
    throw new PatternError(message, this.pattern, index);
  }

  private parseAlternation(): Node {
    const branches = [this.parseSequence()];
    while (this.pattern[this.pos] === '|') {
      this.pos++;
      branches.push(this.parseSequence());
    }
    return branches.length === 1 ? branches[0] : { kind: 'alt', branches };
  }

  private parseSequence(): Node {
    const items: Node[] = [];
    while (this.pos < this.pattern.length) {
      const c = this.pattern[this.pos];
      if (c === '|' || c === ')') break;
      const atom = this.parseAtom();
      const q = this.tryParseQuantifier();
      items.push(q && !(q.min === 1 && q.max === 1) ? { kind: 'repeat', item: atom, min: q.min, max: q.max } : atom);
    }
    return items.length === 1 ? items[0] : { kind: 'seq', items };
  }

  private parseAtom(): Node {
    const c = this.pattern[this.pos];
    switch (c) {
      case '(':
        return this.parseGroup();
      case '[':
        return this.parseClass();
      case '\\': {
        const esc = this.parseEscapeBody();
        return esc.single ? { kind: 'lit', text: esc.chars } : { kind: 'class', chars: [...esc.chars] };
      }
      case '.':
        this.fail('"." is not supported (its match set is unbounded); use a character class');
      case '^':
      case '$':
        this.fail(`anchor "${c}" is not supported; escape as "\\${c}" for the literal`);
      case '*':
      case '+':
      case '?':
      case '{':
        this.fail(`quantifier "${c}" has nothing to repeat`);
      case ']':
        this.fail('unmatched "]"; escape as "\\]" for the literal');
      default:
        this.pos++;
        return { kind: 'lit', text: c };
    }
  }

  private parseGroup(): Node {
    const open = this.pos;
    this.pos++; // '('
    if (this.pattern[this.pos] === '?') {
      if (this.pattern[this.pos + 1] !== ':') {
        this.fail('only "(?:" is supported among "(?" forms (no lookarounds or named groups)');
      }
      this.pos += 2;
    }
    const node = this.parseAlternation();
    if (this.pattern[this.pos] !== ')') this.fail('unterminated group', open);
    this.pos++;
    return node;
  }

  private tryParseQuantifier(): { min: number; max: number } | undefined {
    const c = this.pattern[this.pos];
    if (c === '*' || c === '+') {
      this.fail(`"${c}" is not supported (unbounded); use a bounded quantifier like "{0,5}"`);
    }
    if (c === '?') {
      this.pos++;
      this.rejectLazyModifier();
      return { min: 0, max: 1 };
    }
    if (c === '{') return this.parseBraceQuantifier();
    return undefined;
  }

  private parseBraceQuantifier(): { min: number; max: number } {
    const open = this.pos;
    this.pos++; // '{'
    const min = this.readInt();
    if (min === undefined) {
      this.fail('"{" must start a quantifier like "{2}" or "{1,3}"; escape as "\\{" for the literal', open);
    }
    let max = min;
    if (this.pattern[this.pos] === ',') {
      this.pos++;
      const m = this.readInt();
      if (m === undefined) this.fail(`"{${min},}" is not supported (unbounded); give an upper bound`, open);
      max = m;
    }
    if (this.pattern[this.pos] !== '}') this.fail('unterminated quantifier; expected "}"', open);
    this.pos++;
    if (max < min) this.fail(`quantifier range out of order: {${min},${max}}`, open);
    this.rejectLazyModifier();
    return { min, max };
  }

  private rejectLazyModifier(): void {
    if (this.pattern[this.pos] === '?') {
      this.fail('lazy quantifier modifier "?" is not supported (it would not change the expansion)');
    }
  }

  private readInt(): number | undefined {
    const start = this.pos;
    while (/[0-9]/.test(this.pattern[this.pos] ?? '')) this.pos++;
    if (this.pos === start) return undefined;
    return parseInt(this.pattern.slice(start, this.pos), 10);
  }

  private parseClass(): Node {
    const open = this.pos;
    this.pos++; // '['
    if (this.pattern[this.pos] === '^') {
      this.fail('negated character classes are not supported (their match set depends on an alphabet)');
    }
    const chars = new Set<string>();
    for (;;) {
      if (this.pos >= this.pattern.length) this.fail('unterminated character class', open);
      if (this.pattern[this.pos] === ']') {
        this.pos++;
        break;
      }
      const first = this.parseClassItem();
      if (first.single && this.pattern[this.pos] === '-' && this.pos + 1 < this.pattern.length && this.pattern[this.pos + 1] !== ']') {
        this.pos++; // '-'
        const end = this.parseClassItem();
        if (!end.single) this.fail('a shorthand class cannot be a range endpoint');
        const lo = first.chars.charCodeAt(0);
        const hi = end.chars.charCodeAt(0);
        if (lo > hi) this.fail(`range out of order: "${first.chars}-${end.chars}"`);
        for (let code = lo; code <= hi; code++) chars.add(String.fromCharCode(code));
      } else {
        for (const ch of first.chars) chars.add(ch);
      }
    }
    if (chars.size === 0) this.fail('empty character class matches nothing', open);
    return { kind: 'class', chars: [...chars] };
  }

  private parseClassItem(): { chars: string; single: boolean } {
    const c = this.pattern[this.pos];
    if (c === '\\') return this.parseEscapeBody();
    this.pos++;
    return { chars: c, single: true };
  }

  /** Parses an escape starting at "\"; returns the char(s) it stands for. */
  private parseEscapeBody(): { chars: string; single: boolean } {
    const start = this.pos;
    this.pos++; // '\'
    const c = this.pattern[this.pos];
    if (c === undefined) this.fail('dangling "\\"', start);
    this.pos++;
    switch (c) {
      case 'd':
        return { chars: DIGIT_CHARS, single: false };
      case 'w':
        return { chars: WORD_CHARS, single: false };
      case 's':
        return { chars: SPACE_CHARS, single: false };
      case 'D':
      case 'W':
      case 'S':
        this.fail(`"\\${c}" is not supported (its match set is unbounded)`, start);
      case 'b':
      case 'B':
        this.fail(`"\\${c}" is not supported (anchors generate nothing)`, start);
      case 'n':
        return { chars: '\n', single: true };
      case 't':
        return { chars: '\t', single: true };
      case 'r':
        return { chars: '\r', single: true };
      case 'v':
        return { chars: '\v', single: true };
      case 'f':
        return { chars: '\f', single: true };
      case '0':
        return { chars: '\0', single: true };
      case 'x':
        return { chars: this.readHex(2), single: true };
      case 'u':
        return { chars: this.readHex(4), single: true };
      default:
        if (/[1-9]/.test(c)) this.fail('backreferences are not supported', start);
        if (/[A-Za-z]/.test(c)) this.fail(`unknown escape "\\${c}"`, start);
        return { chars: c, single: true };
    }
  }

  private readHex(len: number): string {
    const hex = this.pattern.slice(this.pos, this.pos + len);
    if (hex.length < len || !/^[0-9a-fA-F]+$/.test(hex)) this.fail(`expected ${len} hex digits`);
    this.pos += len;
    return String.fromCharCode(parseInt(hex, 16));
  }
}

function* generate(node: Node): Expansion {
  switch (node.kind) {
    case 'lit':
      yield node.text;
      return;
    case 'class':
      yield* node.chars;
      return;
    case 'alt':
      for (const branch of node.branches) yield* generate(branch);
      return;
    case 'seq':
      yield* generateSequence(node.items, 0);
      return;
    case 'repeat':
      for (let n = node.min; n <= node.max; n++) yield* generateRepeat(node.item, n);
      return;
  }
}

function* generateSequence(items: readonly Node[], from: number): Expansion {
  if (from === items.length) {
    yield '';
    return;
  }
  for (const head of generate(items[from])) {
    for (const tail of generateSequence(items, from + 1)) yield head + tail;
  }
}

function* generateRepeat(item: Node, n: number): Expansion {
  if (n === 0) {
    yield '';
    return;
  }
  for (const head of generate(item)) {
    for (const tail of generateRepeat(item, n - 1)) yield head + tail;
  }
}

function countNode(node: Node): number {
  switch (node.kind) {
    case 'lit':
      return 1;
    case 'class':
      return node.chars.length;
    case 'alt':
      return node.branches.reduce((sum, b) => sum + countNode(b), 0);
    case 'seq':
      return node.items.reduce((product, item) => product * countNode(item), 1);
    case 'repeat': {
      const per = countNode(node.item);
      let total = 0;
      for (let n = node.min; n <= node.max; n++) total += per ** n;
      return total;
    }
  }
}
