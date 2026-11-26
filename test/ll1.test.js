const test = require('node:test');
const assert = require('node:assert/strict');
const LL1 = require('../src/ll1.js');

const lang = (l, c) => LL1.solve('lang', l, c);
const gram = (g) => LL1.solve('gram', g);

test('a^n b^m c^n con n>=1, m>=0 è LL(1)', () => {
  const r = lang('a^n b^m c^n', 'n>=1, m>=0');
  assert.equal(r.error, undefined);
  assert.equal(r.status, 'ok');
  assert.equal(r.ll1, true);
  assert.equal(LL1.text(r.g), 'S → a A c\nA → a A c | B\nB → b B | ε');
});

test('normalizzazione di a^{2n} e b^{n+1}', () => {
  const r = lang('a^{2n} b^{n+1}', 'n>=0');
  assert.deepEqual(r.normalized, ['(aa)^n · b^n · b']);
  assert.equal(r.ll1, true);
});

test('a^n b^n ∪ a^n c^n va in loop', () => {
  const r = lang('a^n b^n | a^n c^n', 'n>=1');
  assert.equal(r.status, 'loop');
  assert.equal(r.ll1, false);
});

test('a^n b^n c^n viene rifiutato perché non è context-free', () => {
  const r = lang('a^n b^n c^n', 'n>=1');
  assert.match(r.error, /non è context-free/);
});

test('esponenti incrociati vengono rifiutati', () => {
  const r = lang('a^n b^m c^n d^m', '');
  assert.match(r.error, /si incrociano/);
});

test('grammatica delle espressioni: tolta la ricorsione sinistra è LL(1)', () => {
  const r = gram('E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id');
  assert.equal(r.ll1, true);
  assert.deepEqual(r.g.P.get('F'), [['(', 'E', ')'], ['id']]);
  assert.deepEqual([...r.sets.FO.get('E')].sort(), ['$', ')']);
});

test('dangling else: conflitto FIRST/FOLLOW', () => {
  const r = gram('S -> i E t S | i E t S e S | o\nE -> b');
  assert.equal(r.status, 'ok');
  assert.equal(r.ll1, false);
  assert.deepEqual(r.conflicts.map(c => [c.t, c.kind]), [['e', 'FIRST/FOLLOW']]);
});

test('il parser accetta e rifiuta le stringhe giuste', () => {
  const r = lang('a^n b^m c^n', 'n>=1, m>=0');
  assert.equal(LL1.parse(r.g, r.T, [...'aabbcc']).ok, true);
  assert.equal(LL1.parse(r.g, r.T, [...'aabc']).ok, false);
});
