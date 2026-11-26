// Motore LL(1): dal linguaggio (o da una grammatica) alla verifica con FIRST/FOLLOW
const LL1 = (() => {
  const EPS = 'ε';

  // ---------- grammatica ----------
  const mk = (start) => ({ start, order: [], P: new Map(), meta: new Map() });
  const addNT = (g, A, alts) => { if (!g.P.has(A)) g.order.push(A); g.P.set(A, alts); };
  const clone = (g) => ({ start: g.start, order: [...g.order], P: new Map(g.order.map(A => [A, g.P.get(A).map(a => [...a])])), meta: new Map(g.meta) });
  const isNT = (g, s) => g.P.has(s);
  const key = (a) => a.join('\u0001');
  const dedupe = (alts) => { const s = new Set(); return alts.filter(a => { const k = key(a); if (s.has(k)) return false; s.add(k); return true; }); };
  const size = (g) => g.order.reduce((n, A) => n + g.P.get(A).reduce((m, a) => m + a.length + 1, 0), 0);
  const fresh = (g, base) => { let n = base + "'"; while (g.P.has(n)) n += "'"; return n; };
  const altText = (a) => a.length ? a.join(' ') : EPS;
  const text = (g) => g.order.map(A => `${A} → ${g.P.get(A).map(altText).join(' | ')}`).join('\n');
  const terminals = (g) => { const t = []; for (const A of g.order) for (const a of g.P.get(A)) for (const s of a) if (!isNT(g, s) && !t.includes(s)) t.push(s); return t; };

  // ---------- annullabili, FIRST, FOLLOW ----------
  function firstSeq(g, seq, F, N) {
    const r = new Set();
    for (const s of seq) {
      if (!isNT(g, s)) { r.add(s); return r; }
      for (const t of F.get(s)) r.add(t);
      if (!N.has(s)) return r;
    }
    r.add(EPS); return r;
  }
  function sets(g) {
    const N = new Set(), F = new Map(), FO = new Map();
    for (const A of g.order) { F.set(A, new Set()); FO.set(A, new Set()); }
    let ch = true;
    while (ch) {
      ch = false;
      for (const A of g.order) for (const a of g.P.get(A)) {
        if (!N.has(A) && a.every(s => N.has(s))) { N.add(A); ch = true; }
        for (const t of firstSeq(g, a, F, N)) if (t !== EPS && !F.get(A).has(t)) { F.get(A).add(t); ch = true; }
      }
    }
    FO.get(g.start).add('$');
    ch = true;
    while (ch) {
      ch = false;
      for (const A of g.order) for (const a of g.P.get(A)) a.forEach((B, i) => {
        if (!isNT(g, B)) return;
        const fr = firstSeq(g, a.slice(i + 1), F, N), fb = FO.get(B);
        for (const t of fr) if (t !== EPS && !fb.has(t)) { fb.add(t); ch = true; }
        if (fr.has(EPS)) for (const t of FO.get(A)) if (!fb.has(t)) { fb.add(t); ch = true; }
      });
    }
    return { N, F, FO };
  }
  function table(g, S) {
    const T = new Map(), conflicts = [];
    for (const A of g.order) {
      const row = new Map();
      const put = (t, i) => { if (!row.has(t)) row.set(t, []); if (!row.get(t).includes(i)) row.get(t).push(i); };
      g.P.get(A).forEach((a, i) => {
        const fs = firstSeq(g, a, S.F, S.N);
        for (const t of fs) if (t !== EPS) put(t, i);
        if (fs.has(EPS)) for (const t of S.FO.get(A)) put(t, i);
      });
      T.set(A, row);
      for (const [t, idx] of row) if (idx.length > 1) {
        const inFirst = idx.filter(i => firstSeq(g, g.P.get(A)[i], S.F, S.N).has(t)).length;
        conflicts.push({ A, t, idx, kind: inFirst > 1 ? 'FIRST/FIRST' : 'FIRST/FOLLOW' });
      }
    }
    return { T, conflicts };
  }

  // ---------- lettura della grammatica scritta ----------
  function parseGrammar(src) {
    const lines = src.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    if (!lines.length) throw new Error('Scrivi almeno una produzione, ad esempio S → a S b | ε');
    const raw = [];
    for (const l of lines) {
      const m = /^(\S+?)\s*(?:->|→|::=|:)\s*(.*)$/.exec(l);
      if (!m) throw new Error(`Riga non riconosciuta: «${l}». Usa la forma A → α | β`);
      raw.push([m[1], m[2]]);
    }
    const g = mk(raw[0][0]);
    for (const [A] of raw) if (!g.P.has(A)) addNT(g, A, []);
    let spaced = false;
    const tok = (s) => {
      s = s.trim();
      if (!s || /^(ε|eps|epsilon)$/i.test(s)) return [];
      if (spaced) return s.split(/\s+/).filter(x => x && x !== EPS);
      const out = [], re = /[A-Z][0-9]*'*|./gu; let m;
      while ((m = re.exec(s))) if (m[0] !== EPS) out.push(m[0]);
      return out;
    };
    spaced = raw.some(([, rhs]) => rhs.split('|').some(x => /\S\s+\S/.test(x.trim())));
    for (const [A, rhs] of raw) g.P.get(A).push(...rhs.split('|').map(tok));
    for (const A of g.order) g.P.set(A, dedupe(g.P.get(A)));
    const warn = [];
    for (const A of g.order) for (const a of g.P.get(A)) for (const s of a)
      if (/^[A-Z][0-9]*'*$/.test(s) && !isNT(g, s) && !warn.includes(s)) warn.push(s);
    return { g, warn };
  }

  // ---------- lettura del linguaggio ----------
  function parseExp(e) {
    const x = e.replace(/[\s*]/g, '');
    const m = /^(\d*)([a-z])?(?:\+(\d+))?$/.exec(x);
    if (!m || (!m[1] && !m[2])) throw new Error(`Esponente non riconosciuto: «${e}». Forme ammesse: n, 2n, n+1, 2n+1, 3`);
    if (!m[2]) return { k: 0, v: null, c: +m[1] + (+m[3] || 0) };
    return { k: m[1] ? +m[1] : 1, v: m[2], c: +m[3] || 0 };
  }
  function parseTerm(t) {
    const s = t.replace(/[·]/g, ' '), blocks = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      let base;
      if (c === '(') {
        const j = s.indexOf(')', i);
        if (j < 0) throw new Error('Parentesi non chiusa');
        base = s.slice(i + 1, j).replace(/\s+/g, ''); i = j + 1;
        if (!base) throw new Error('Parentesi vuote');
      } else if ('^){}'.includes(c)) throw new Error(`Simbolo inatteso «${c}»`);
      else { base = c; i++; }
      let k = i; while (s[k] === ' ') k++;
      let exp = { k: 0, v: null, c: 1 };
      if (s[k] === '^') {
        k++; while (s[k] === ' ') k++;
        if (s[k] === '{') {
          const j = s.indexOf('}', k);
          if (j < 0) throw new Error('Graffa non chiusa');
          exp = parseExp(s.slice(k + 1, j)); i = j + 1;
        } else {
          const raw = /^\d*[a-z]?(?:\+\d+)?/.exec(s.slice(k))[0];
          if (!raw) throw new Error('Esponente mancante dopo ^');
          exp = parseExp(raw); i = k + raw.length;
        }
      }
      blocks.push({ base, ...exp });
    }
    return blocks;
  }
  const pw = (w, v) => (w.length > 1 ? `(${w})` : w) + '^' + v;

  function fromLanguage(src, consSrc) {
    const notes = [], mins = {}, given = new Set();
    const re = /([a-z])\s*(>=|≥|=>|>|=)\s*(\d+)/g; let m;
    while ((m = re.exec(consSrc || ''))) {
      if (m[2] === '=') throw new Error(`Vincolo «${m[0]}» non supportato: scrivi direttamente l'esponente costante`);
      mins[m[1]] = +m[3] + (m[2] === '>' ? 1 : 0); given.add(m[1]);
    }
    if (/[a-z]\s*(<|≤|<=)\s*[a-z]|[a-z]\s*(>=|≥|>)\s*[a-z]/.test(consSrc || ''))
      throw new Error('Vincoli tra variabili (come n ≥ m) non sono supportati: il metodo copre esponenti indipendenti o uguali');
    const terms = src.split(/\s*(?:\||∪|U(?=\s))\s*/).map(t => t.trim()).filter(Boolean);
    if (!terms.length) throw new Error('Scrivi il linguaggio, ad esempio a^n b^m c^n');
    const g = mk('S'); addNT(g, 'S', []);
    const pool = 'ABCDEFGHIJKLMNOPQRTUVWXYZ'.split('');
    const newNT = () => { const n = pool.find(x => !g.P.has(x)); if (!n) throw new Error('Troppi blocchi'); addNT(g, n, []); return n; };
    const defaulted = new Set(), normalized = [];
    for (const t of terms) {
      const blocks = parseTerm(t), occ = {};
      blocks.forEach((b, i) => { if (b.v) (occ[b.v] = occ[b.v] || []).push(i); });
      for (const v in occ) {
        if (occ[v].length > 2) throw new Error(`La variabile ${v} compare ${occ[v].length} volte in «${t}»: un linguaggio così (come aⁿbⁿcⁿ) non è context-free, quindi non ha nessuna grammatica LL(1)`);
        if (!given.has(v)) defaulted.add(v);
      }
      const items = [];
      blocks.forEach((b, i) => {
        if (!b.v) { if (b.c) items.push({ fixed: b.base.repeat(b.c) }); return; }
        const min = mins[b.v] || 0, fc = b.k * min + b.c, unit = b.base.repeat(b.k);
        const it = { v: b.v, unit, fixed: b.base.repeat(fc) };
        const orig = b.base.length > 1 ? `(${b.base})` : b.base;
        const ex = `${b.k > 1 ? b.k : ''}${b.v}${b.c ? '+' + b.c : ''}`;
        if (fc || b.k > 1) notes.push(`${orig}^${ex.length > 1 ? '{' + ex + '}' : ex}${min ? ` con ${b.v} ≥ ${min}` : ''}  ⟶  ${fc ? b.base.repeat(fc) + ' · ' : ''}${pw(unit, b.v)} con ${b.v} ≥ 0`);
        const second = occ[b.v].length === 2 && occ[b.v][1] === i;
        if (fc && !second) items.push({ fixed: it.fixed });
        items.push(it);
        if (fc && second) items.push({ fixed: it.fixed });
      });
      const pos = {};
      items.forEach((it, i) => { if (it.v) (pos[it.v] = pos[it.v] || []).push(i); });
      const pairs = Object.values(pos).filter(p => p.length === 2);
      for (const [a, b] of pairs) for (const [c, d] of pairs)
        if (a < c && c < b && b < d) throw new Error(`In «${t}» gli esponenti si incrociano (come aⁿ bᵐ cⁿ dᵐ): il linguaggio non è context-free`);
      const partner = {}; for (const [a, b] of pairs) partner[a] = b;
      normalized.push(items.map(it => it.v ? pw(it.unit, it.v) : it.fixed).join(' · '));
      const build = (i, j) => {
        const seq = [];
        for (let k = i; k <= j;) {
          const it = items[k];
          if (!it.v) { seq.push(...it.fixed); k++; continue; }
          const X = newNT();
          if (partner[k] !== undefined) {
            const p = partner[k];
            g.P.set(X, [[...it.unit, X, ...items[p].unit], build(k + 1, p - 1)]);
            seq.push(X); k = p + 1;
          } else { g.P.set(X, [[...it.unit, X], []]); seq.push(X); k++; }
        }
        return seq;
      };
      g.P.get('S').push(build(0, items.length - 1));
    }
    g.P.set('S', dedupe(g.P.get('S')));
    for (const v of defaulted) notes.unshift(`${v}: nessun vincolo indicato, assumo ${v} ≥ 0`);
    // ordine: S prima, poi gli altri come creati
    return { g, notes, normalized };
  }

  // ---------- Fase 2: trasformazioni ----------
  function leftEdges(g, N, hidden) {
    const E = new Map(g.order.map(A => [A, new Set()]));
    for (const A of g.order) for (const a of g.P.get(A)) for (const s of a) {
      if (!isNT(g, s)) break;
      E.get(A).add(s);
      if (!hidden || !N.has(s)) break;
    }
    return E;
  }
  const reach = (E, from, to) => { const seen = new Set(), st = [...E.get(from)]; while (st.length) { const x = st.pop(); if (x === to) return true; if (seen.has(x)) continue; seen.add(x); st.push(...(E.get(x) || [])); } return false; };
  function leftRec(g) {
    const { N } = sets(g);
    const D = leftEdges(g, N, false), H = leftEdges(g, N, true);
    return { direct: g.order.filter(A => reach(D, A, A)), hidden: g.order.filter(A => reach(H, A, A) && !reach(D, A, A)) };
  }
  function removeLR(g, log) {
    const ord = [...g.order];
    for (let i = 0; i < ord.length; i++) {
      const Ai = ord[i];
      for (let j = 0; j < i; j++) {
        const Aj = ord[j], D = leftEdges(g, null, false);
        if (!reach(D, Aj, Ai) || !reach(D, Ai, Ai)) continue;
        let did = false; const out = [];
        for (const a of g.P.get(Ai)) {
          if (a[0] === Aj) { did = true; for (const b of g.P.get(Aj)) out.push([...b, ...a.slice(1)]); } else out.push(a);
        }
        if (did) { g.P.set(Ai, dedupe(out)); log('Ricorsione sinistra indiretta', `Sostituisco ${Aj} a inizio delle produzioni di ${Ai}, così la ricorsione diventa diretta.`); }
      }
      const alts = g.P.get(Ai), rec = alts.filter(a => a[0] === Ai && a.length > 1), non = alts.filter(a => a[0] !== Ai);
      if (!rec.length) continue;
      if (!non.length) throw new Error(`${Ai} ha solo produzioni ricorsive a sinistra: non genera nessuna stringa`);
      const A2 = fresh(g, Ai);
      g.P.set(Ai, non.map(b => [...b, A2]));
      addNT(g, A2, [...rec.map(a => [...a.slice(1), A2]), []]);
      log('Ricorsione sinistra', `${Ai} → ${[...rec, ...non].map(altText).join(' | ')} è ricorsiva a sinistra. Diventa ${Ai} → ${g.P.get(Ai).map(altText).join(' | ')} e ${A2} → ${g.P.get(A2).map(altText).join(' | ')}.`);
    }
  }
  function sig(alts, g) {
    return alts.map(a => {
      const out = [];
      for (const s of a) {
        const x = isNT(g, s) ? s.replace(/'+$/, '') : s;
        const last = out[out.length - 1];
        if (isNT(g, s)) out.push(x);
        else if (last !== x + '+') out.push(x + '+');
      }
      return out.join(' ');
    }).sort().join(' | ');
  }
  function factorOnce(g, log, sigs) {
    for (const A of g.order) {
      const alts = dedupe(g.P.get(A)); g.P.set(A, alts);
      const groups = new Map();
      alts.forEach(a => { if (a.length) { if (!groups.has(a[0])) groups.set(a[0], []); groups.get(a[0]).push(a); } });
      const grp = [...groups.values()].find(x => x.length > 1);
      if (!grp) continue;
      let p = 0; while (grp.every(a => p < a.length && a[p] === grp[0][p])) p++;
      const prefix = grp[0].slice(0, p);
      const before = `${A} → ${alts.map(altText).join(' | ')}`;
      const suff = dedupe(grp.map(a => a.slice(p)));
      const ck = suff.map(key).sort().join('\u0002');
      // stesse alternative di un non terminale già creato: lo riuso (stesso linguaggio)
      const old = [...sigs.entries()].find(([X, o]) => o.ck === ck && g.P.has(X));
      const A2 = old ? old[0] : fresh(g, A);
      const nw = []; let placed = false;
      for (const a of alts) { if (grp.includes(a)) { if (!placed) { nw.push([...prefix, A2]); placed = true; } } else nw.push(a); }
      g.P.set(A, nw);
      if (old) {
        log('Left factoring', `${before}: le alternative ${grp.map(altText).join(', ')} iniziano con ${altText(prefix)}. Quello che resta (${suff.map(altText).join(' | ')}) è uguale alle produzioni con cui avevo creato ${A2}: riuso ${A2}.`);
        return { done: true };
      }
      addNT(g, A2, suff);
      g.meta.set(A2, { parent: A });
      const s = sig(suff, g), len = suff.reduce((n, a) => n + a.length, 0);
      sigs.set(A2, { s, len, ck });
      log('Left factoring', `${before}: le alternative ${grp.map(altText).join(', ')} iniziano con ${altText(prefix)}. Raccolgo il prefisso e creo ${A2}.`);
      for (let q = A; q; q = g.meta.get(q)?.parent) {
        const o = sigs.get(q);
        if (o && o.s === s && len > o.len) return { loop: { A: A2, B: q } };
      }
      return { done: true };
    }
    return null;
  }
  function substOnce(g, log) {
    const S = sets(g);
    for (const A of g.order) {
      const alts = g.P.get(A);
      const fs = alts.map(a => { const f = firstSeq(g, a, S.F, S.N); f.delete(EPS); return f; });
      const hit = [];
      alts.forEach((a, i) => {
        if (!a.length || !isNT(g, a[0]) || a[0] === A) return;
        if (alts.some((b, j) => j !== i && [...fs[i]].some(t => fs[j].has(t)))) hit.push(i);
      });
      if (!hit.length) continue;
      const out = [];
      alts.forEach((a, i) => { if (hit.includes(i)) for (const b of g.P.get(a[0])) out.push([...b, ...a.slice(1)]); else out.push(a); });
      g.P.set(A, dedupe(out));
      log('Sostituzione', `In ${A} le alternative ${hit.map(i => altText(alts[i])).join(', ')} iniziano con un non terminale il cui FIRST si sovrappone a un'altra alternativa. Lo sostituisco con le sue produzioni per far emergere il prefisso comune.`);
      return true;
    }
    return false;
  }
  // Regola d: assorbire il FOLLOW. Se A è annullabile e t sta sia in FIRST di
  // un'alternativa di A sia in FOLLOW(A), il blocco "A β" che porta t diventa
  // un nuovo non terminale T, con le produzioni di A seguite da β.
  const POOL = 'TUVWZYXRQPONMLKJIHGFEDCBA'.split('');
  function fold(seq, A, beta, T) {
    const out = [];
    for (let i = 0; i < seq.length;) {
      if (seq[i] === A && beta.every((s, k) => seq[i + 1 + k] === s)) { out.push(T); i += 1 + beta.length; }
      else out.push(seq[i++]);
    }
    return out;
  }
  function absorbFor(g, S, A, t, log, depth) {
    if (depth > 3) return false;
    const occ = [];
    for (const X of g.order) for (const a of g.P.get(X)) a.forEach((s, p) => { if (s === A) occ.push({ X, beta: a.slice(p + 1) }); });
    const direct = occ.filter(o => o.beta.length && firstSeq(g, o.beta, S.F, S.N).has(t));
    if (!direct.length) {
      // t arriva dal FOLLOW di chi contiene A in fondo: risalgo
      const up = occ.find(o => o.X !== A && firstSeq(g, o.beta, S.F, S.N).has(EPS) && S.FO.get(o.X).has(t));
      return up ? absorbFor(g, S, up.X, t, log, depth + 1) : false;
    }
    const beta = direct[0].beta, T = POOL.find(x => !g.P.has(x));
    if (!T) return false;
    const prods = dedupe(g.P.get(A).map(γ => fold([...γ, ...beta], A, beta, T)));
    for (const X of g.order) g.P.set(X, dedupe(g.P.get(X).map(a => fold(a, A, beta, T))));
    addNT(g, T, prods);
    log('Assorbimento del FOLLOW', `${depth ? `Il conflitto su ${t} arriva da FOLLOW(${A}). ` : `${A} è annullabile e ${t} sta sia nel FIRST di una sua alternativa sia in FOLLOW(${A}). `}${A} compare seguito da ${altText(beta)}: creo ${T} = ${A} ${altText(beta)}, con le produzioni di ${A} seguite da ${altText(beta)}, e sostituisco ${A} ${altText(beta)} con ${T} ovunque.`);
    return true;
  }
  function absorbOnce(g, log) {
    const S = sets(g);
    for (const c of table(g, S).conflicts) if (c.kind === 'FIRST/FOLLOW' && absorbFor(g, S, c.A, c.t, log, 0)) return true;
    return false;
  }
  function transform(g, log) {
    const sigs = new Map(); let warnedHidden = false, snap = null, absorbs = 0;
    const back = (why) => {
      g.order = snap.order; g.P = snap.P; g.meta = snap.meta;
      log('Torno indietro', `${why} Riprendo la grammatica com'era prima dell'assorbimento del FOLLOW.`);
      return { status: 'ok' };
    };
    for (let it = 0; it < 80; it++) {
      if (size(g) > 500) return snap ? back('La grammatica cresce senza fermarsi.') : { status: 'big' };
      const lr = leftRec(g);
      if (lr.direct.length) { removeLR(g, log); continue; }
      if (lr.hidden.length && !warnedHidden) { warnedHidden = true; log('Attenzione', `${lr.hidden.join(', ')}: ricorsione sinistra nascosta dietro un non terminale annullabile. Il metodo non la elimina; la verifica mostrerà il conflitto.`); }
      const f = factorOnce(g, log, sigs);
      if (f?.loop) return snap ? back(`L'assorbimento del FOLLOW va in loop (${f.loop.A} ripete la forma di ${f.loop.B}).`) : { status: 'loop', loop: f.loop };
      if (f) continue;
      if (substOnce(g, log)) continue;
      const before = clone(g);
      if (absorbOnce(g, log)) {
        if (!snap) snap = before;
        if (++absorbs > 6) return back("L'assorbimento del FOLLOW continua senza risolvere il conflitto.");
        continue;
      }
      return { status: 'ok' };
    }
    return snap ? back('Le trasformazioni non si chiudono.') : { status: 'limit' };
  }

  // ---------- Fase 3: semplificazione ----------
  function replaceAll(g, from, to) { for (const A of g.order) g.P.set(A, dedupe(g.P.get(A).map(a => a.map(s => s === from ? to : s)))); }
  function simplify(g, log) {
    for (const A of g.order) g.P.set(A, dedupe(g.P.get(A)));
    const sa = g.P.get(g.start);
    if (sa.length === 1 && sa[0].length === 1 && isNT(g, sa[0][0]) && sa[0][0] !== g.start) {
      const X = sa[0][0];
      g.P.set(g.start, g.P.get(X).map(a => [...a])); g.order = g.order.filter(n => n !== X); g.P.delete(X);
      replaceAll(g, X, g.start);
      log('Produzione unitaria', `${g.start} → ${X} e basta: rinomino ${X} in ${g.start}.`);
    }
    for (let ch = true; ch;) {
      ch = false;
      const seen = new Map();
      for (const A of g.order) {
        const k = g.P.get(A).map(a => a.map(s => s === A ? '@' : s).join(' ')).sort().join('|');
        if (seen.has(k) && A !== g.start) {
          const B = seen.get(k);
          g.order = g.order.filter(n => n !== A); g.P.delete(A); replaceAll(g, A, B);
          log('Non terminali uguali', `${A} e ${B} hanno le stesse produzioni: tengo ${B}.`);
          ch = true; break;
        }
        seen.set(k, A);
      }
    }
    const R = new Set([g.start]), st = [g.start];
    while (st.length) for (const a of g.P.get(st.pop())) for (const s of a) if (isNT(g, s) && !R.has(s)) { R.add(s); st.push(s); }
    const un = g.order.filter(A => !R.has(A));
    if (un.length) { g.order = g.order.filter(A => R.has(A)); un.forEach(A => g.P.delete(A)); log('Irraggiungibili', `Elimino ${un.join(', ')}: ${un.length > 1 ? 'non si raggiungono' : 'non si raggiunge'} da ${g.start}.`); }
  }

  // ---------- analisi di una stringa ----------
  function parse(g, T, tokens) {
    const stack = ['$', g.start], inp = [...tokens, '$'], rows = []; let ip = 0;
    for (let n = 0; n < 400; n++) {
      const top = stack[stack.length - 1], a = inp[ip];
      const row = { stack: [...stack].reverse().join(' '), input: inp.slice(ip).join(' ') };
      if (top === '$' && a === '$') { rows.push({ ...row, act: 'Accetto' }); return { ok: true, rows }; }
      if (!isNT(g, top)) {
        if (top === a) { stack.pop(); ip++; rows.push({ ...row, act: `Confronto ${a}` }); continue; }
        rows.push({ ...row, act: `Errore: atteso ${top}, trovato ${a}` }); return { ok: false, rows };
      }
      const cell = T.get(top).get(a);
      if (!cell) { rows.push({ ...row, act: `Errore: M[${top}, ${a}] è vuota` }); return { ok: false, rows }; }
      const alt = g.P.get(top)[cell[0]];
      stack.pop(); for (let i = alt.length - 1; i >= 0; i--) stack.push(alt[i]);
      rows.push({ ...row, act: `${top} → ${altText(alt)}` });
    }
    return { ok: false, rows };
  }

  // ---------- tutto il procedimento ----------
  function solve(mode, a, b) {
    const R = { mode, steps: [], simp: [], notes: [], normalized: [], warn: [] };
    try {
      let g;
      if (mode === 'lang') { const r = fromLanguage(a, b); g = r.g; R.notes = r.notes; R.normalized = r.normalized; }
      else { const r = parseGrammar(a); g = r.g; R.warn = r.warn; }
      R.g1 = clone(g);
      const tr = transform(g, (title, txt) => R.steps.push({ title, txt, g: clone(g) }));
      R.status = tr.status; R.loop = tr.loop;
      if (tr.status === 'ok') simplify(g, (title, txt) => R.simp.push({ title, txt }));
      R.g = g; R.sets = sets(g);
      const t = table(g, R.sets); R.T = t.T; R.conflicts = t.conflicts; R.terms = [...terminals(g), '$'];
      R.ll1 = tr.status === 'ok' && !t.conflicts.length;
    } catch (e) { R.error = e.message; }
    return R;
  }

  return { solve, parse, text, altText, firstSeq, isNT, EPS };
})();
if (typeof module !== 'undefined') module.exports = LL1;
