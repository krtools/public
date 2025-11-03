import assert from 'node:assert';
import {suite} from 'uvu';
import {ItemSelector} from './ItemSelector.js';

const test = suite('ItemSelector');

const assertSel = (sel: ItemSelector, items: number[], cursor?: number, anchor?: number) => {
  assert.deepEqual(sel.toArray(), items);
  if (cursor !== undefined) assert.equal(sel.cursor, cursor);
  if (anchor !== undefined) assert.equal(sel.anchor, anchor);
};

test('selectOnly', () => {
  const sel = new ItemSelector();
  sel.select(4, {ctrl: false, shift: false});
  assertSel(sel, [4], 4, 4);

  sel.select(4, {ctrl: false, shift: false});
  assertSel(sel, [4], 4, 4);
});

test('ctrl+click toggles on off', () => {
  const sel = new ItemSelector();
  sel.select(4, {ctrl: true, shift: false});
  assertSel(sel, [4], 4, 4);
  sel.select(4, {ctrl: true, shift: false});
  assertSel(sel, [], 4, 4);
  sel.select(4, {ctrl: true, shift: false});
  assertSel(sel, [4], 4, 4);
});

test('ctrl+click does not affect other selected states', () => {
  const sel = new ItemSelector();
  [1, 2, 3].forEach((e) => sel.items.add(e));
  assertSel(sel, [1, 2, 3], undefined, undefined);

  sel.select(4, {ctrl: true, shift: false});
  assertSel(sel, [1, 2, 3, 4], 4, 4);
  sel.select(4, {ctrl: true, shift: false});
  assertSel(sel, [1, 2, 3], 4, 4);
});

test('shift+click selects range', () => {
  const sel = new ItemSelector();
  sel.select(4, {ctrl: false, shift: true});
  assertSel(sel, [0, 1, 2, 3, 4], undefined, 4);

  sel.select(2, {ctrl: false, shift: true});
  assertSel(sel, [0, 1, 2], undefined, 2);
});

test.run();
