import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { expand, expansionCount, PatternError } from './StringExpansion';

describe('expand', () => {
  const cases: [pattern: string, expected: string[]][] = [
    ['a[bcd]', ['ab', 'ac', 'ad']],
    ['(ab|c)d?', ['ab', 'abd', 'c', 'cd']],
    ['a{1,3}', ['a', 'aa', 'aaa']],
    ['[0-2]x', ['0x', '1x', '2x']],
    ['(a|b){2}', ['aa', 'ab', 'ba', 'bb']],
    ['', ['']],
    ['(a|)b', ['ab', 'b']],
    ['(?:x|y)z', ['xz', 'yz']],
    ['\\x41\\-[a\\]]', ['A-a', 'A-]']],
    ['[-a]', ['-', 'a']],
    ['[aab-c]', ['a', 'b', 'c']],
    ['a{2}', ['aa']],
    ['[a]{0,2}', ['', 'a', 'aa']],
    ['\\n\\t\\u0041', ['\n\tA']],
  ];
  for (const [pattern, expected] of cases) {
    it(JSON.stringify(pattern), () => {
      assert.deepEqual([...expand(pattern)], expected);
    });
  }

  it('is lazy: yields without exhausting huge expansions', () => {
    const gen = expand('\\w{8}');
    assert.equal(gen.next().value, '00000000');
    assert.equal(gen.next().value, '00000001');
  });
});

describe('expansionCount', () => {
  const cases: [pattern: string, expected: number][] = [
    ['\\d', 10],
    ['\\w{2}', 63 * 63],
    ['\\s', 25],
    ['(ab|c)d?[0-4]', 2 * 2 * 5],
    ['a{1,3}', 3],
    ['', 1],
    ['x?', 2],
  ];
  for (const [pattern, expected] of cases) {
    it(`${JSON.stringify(pattern)} -> ${expected}`, () => {
      assert.equal(expansionCount(pattern), expected);
    });
  }

  it('matches the number of strings actually generated', () => {
    for (const pattern of ['a[bcd]', '(ab|c)d?', '(a|b){0,3}', '\\d\\d']) {
      assert.equal(expansionCount(pattern), [...expand(pattern)].length);
    }
  });
});

describe('round-trip: every expansion matches its pattern as a regex', () => {
  const patterns = ['a[bcd]', '(ab|c)d?', 'a{1,3}', '(a|b){2}', '\\d[x-z]{2}', '\\s', '\\x41[\\--\\.]'];
  for (const pattern of patterns) {
    it(JSON.stringify(pattern), () => {
      const re = new RegExp(`^(?:${pattern})$`, 'u');
      for (const s of expand(pattern)) {
        assert.ok(re.test(s), `${JSON.stringify(s)} does not match /${pattern}/`);
      }
    });
  }
});

describe('rejected syntax throws PatternError', () => {
  const cases: [name: string, pattern: string][] = [
    ['dot', 'a.b'],
    ['star', 'a*'],
    ['plus', 'a+'],
    ['open-ended brace', 'a{2,}'],
    ['caret anchor', '^a'],
    ['dollar anchor', 'a$'],
    ['word boundary', 'a\\b'],
    ['negated class', '[^a]'],
    ['negated shorthand', '\\D'],
    ['lookahead', '(?=a)b'],
    ['named group', '(?<x>a)'],
    ['backreference', '(a)\\1'],
    ['lazy modifier', 'a{1,2}?'],
    ['bare brace', 'a{x'],
    ['brace quantifier out of order', 'a{3,1}'],
    ['quantifier with no target', '?a'],
    ['unterminated group', '(ab'],
    ['unmatched close paren', 'ab)'],
    ['unmatched close bracket', 'ab]'],
    ['unterminated class', '[ab'],
    ['empty class', '[]'],
    ['class range out of order', '[z-a]'],
    ['shorthand as range endpoint', '[a-\\d]'],
    ['unknown escape', '\\q'],
    ['dangling backslash', 'a\\'],
    ['bad hex escape', '\\xZZ'],
  ];
  for (const [name, pattern] of cases) {
    it(`${name}: ${JSON.stringify(pattern)}`, () => {
      assert.throws(() => [...expand(pattern)], PatternError);
    });
  }

  it('PatternError carries pattern and index', () => {
    try {
      [...expand('ab*')];
      assert.fail('expected throw');
    } catch (err) {
      assert.ok(err instanceof PatternError);
      assert.equal(err.pattern, 'ab*');
      assert.equal(err.index, 2);
    }
  });
});
