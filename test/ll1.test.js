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

test('assorbimento del FOLLOW: la ricorsione indiretta diventa LL(1)', () => {
  const r = gram('S -> A a | b\nA -> A c | S d | f');
  assert.equal(r.ll1, true);
  assert.ok(r.steps.some(s => s.title === 'Assorbimento del FOLLOW'));
  assert.equal(LL1.parse(r.g, r.T, [...'fcadca']).ok, true);
  assert.equal(LL1.parse(r.g, r.T, [...'fcad']).ok, false);
});

test('assorbimento del FOLLOW: A seguito da un terminale del suo FIRST', () => {
  const r = gram('S -> A a\nA -> a A | ε');
  assert.equal(r.ll1, true);
  assert.equal(LL1.parse(r.g, r.T, [...'aaa']).ok, true);
});

test("dangling else: l'assorbimento non si chiude e torna indietro", () => {
  const r = gram('S -> i E t S | i E t S e S | o\nE -> b');
  assert.ok(r.steps.some(s => s.title === 'Torno indietro'));
  assert.equal(LL1.text(r.g), "S → i E t S S' | o\nE → b\nS' → ε | e S");
});

test('left factoring riusa un non terminale con le stesse alternative', () => {
  const r = gram('S -> A | B\nA -> a A | b\nB -> a B | c');
  assert.equal(r.status, 'ok');
  assert.equal(r.ll1, true);
});

test('Rosenkrantz-Stearns: aⁿw con w in {b, c, bd}ⁿ è LL(1), con bbd no', () => {
  assert.equal(gram('S -> a S A | ε\nA -> b d | b | c').ll1, true);
  assert.equal(gram('S -> a S A | ε\nA -> b b d | b | c').ll1, false);
});

test('aⁿ c bⁿ ∪ aⁿ d b²ⁿ (deterministico ma non LL) va in loop', () => {
  assert.equal(lang('a^n c b^n | a^n d b^{2n}', 'n>=0').status, 'loop');
});
