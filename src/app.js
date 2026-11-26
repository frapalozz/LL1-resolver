// Interfaccia: legge l'input, chiama LL1.solve e disegna le fasi
{
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const EX = [
  { n: 'aⁿ bᵐ cⁿ', m: 'lang', a: 'a^n b^m c^n', b: 'n>=1, m>=0' },
  { n: 'aⁿbⁿ ∪ aⁿcⁿ', m: 'lang', a: 'a^n b^n | a^n c^n', b: 'n>=1' },
  { n: 'a²ⁿ bⁿ⁺¹', m: 'lang', a: 'a^{2n} b^{n+1}', b: 'n>=0' },
  { n: 'aⁿ bᵐ cᵐ dⁿ', m: 'lang', a: 'a^n b^m c^m d^n', b: 'n>=1, m>=1' },
  { n: '(ab)ⁿ cᵐ', m: 'lang', a: '(ab)^n c^m d', b: 'n>=1, m>=0' },
  { n: 'Espressioni', m: 'gram', a: 'E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id' },
  { n: 'If-then-else', m: 'gram', a: 'S -> i E t S | i E t S e S | o\nE -> b' },
  { n: 'Ricorsione indiretta', m: 'gram', a: 'S -> A a | b\nA -> A c | S d | f' }
];
let mode = 'lang', R = null;

const isNT = (g, s) => g.P.has(s);
const altH = (g, a) => a.length ? a.map(s => isNT(g, s) ? `<b>${esc(s)}</b>` : `<span>${esc(s)}</span>`).join(' ') : '<i>ε</i>';
const gH = (g, hot) => `<div class="g">${g.order.map(A => `<div class="r${hot && hot.includes(A) ? ' hot' : ''}"><b class="l">${esc(A)}</b><span class="ar">→</span><span class="rh">${g.P.get(A).map(a => altH(g, a)).join('<em> | </em>')}</span></div>`).join('')}</div>`;
const setH = s => '{ ' + [...s].map(esc).join(', ') + ' }';
const phase = (n, title, lead, body, last) => `<section class="phase${last ? ' last' : ''}"><div class="num">${n}</div><div><h2>${title}</h2>${lead ? `<p class="lead">${lead}</p>` : ''}${body}</div></section>`;

function verdict() {
  const v = $('verdict'), w = $('why');
  v.className = 'verdict bad';
  if (R.error) { v.textContent = 'Da correggere'; w.textContent = R.error; $('final').innerHTML = ''; return; }
  $('final').innerHTML = gH(R.g, R.conflicts.map(c => c.A).concat(R.loop ? [R.loop.A, R.loop.B] : []));
  if (R.status === 'loop') { v.textContent = 'Va in loop'; w.textContent = `${R.loop.A} ha la stessa forma di ${R.loop.B}, solo con più simboli in coda: sostituzione e left factoring si ripeterebbero all'infinito. Il linguaggio molto probabilmente non è LL(1): il parser dovrebbe contare prima di poter scegliere.`; return; }
  if (R.status !== 'ok') { v.textContent = 'Non converge'; w.textContent = 'Le trasformazioni continuano senza chiudersi. Il linguaggio molto probabilmente non è LL(1), oppure serve una grammatica di partenza diversa.'; return; }
  if (R.ll1) { v.className = 'verdict'; v.textContent = 'È LL(1)'; w.textContent = 'Nessuna cella della tabella ha due produzioni: questa grammatica è LL(1), quindi lo è anche il linguaggio.'; return; }
  const c = R.conflicts.map(c => `M[${c.A}, ${c.t}] (${c.kind})`).join(', ');
  v.textContent = 'Grammatica non LL(1)';
  w.textContent = `La grammatica ottenuta ha ${R.conflicts.length === 1 ? 'un conflitto' : R.conflicts.length + ' conflitti'}: ${c}. Il risolutore non ha trovato una grammatica LL(1). Se la scelta la impone il linguaggio, come nel dangling else, il linguaggio non è LL(1); altrimenti potrebbe averne una che queste regole non raggiungono.`;
}

function phases() {
  if (R.error) { $('phases').innerHTML = ''; return; }
  const out = [];
  if (R.mode === 'lang') {
    out.push(phase(0, 'Normalizza il linguaggio', 'Ogni esponente deve partire da 0; i pezzi fissi escono dal blocco.',
      (R.notes.length ? R.notes.map(n => `<p class="note">${esc(n)}</p>`).join('') : '<p class="note">Già in forma normale.</p>') +
      `<h3>Linguaggio normalizzato</h3>${R.normalized.map(t => `<p class="pill">${esc(t)}</p>`).join(' ∪ ')}`));
  } else out.push(phase(0, 'Normalizza il linguaggio', '', '<p class="note">Parti da una grammatica: questa fase non serve.</p>'));
  out.push(phase(1, 'Grammatica iniziale', R.mode === 'lang' ? 'Blocco indipendente αⁿ: X → α X | ε. Blocchi legati αⁿ γ βⁿ: X → α X β | γ. Unione: S → S₁ | S₂.' : '',
    gH(R.g1) + R.warn.map(s => `<p class="alert">${esc(s)} non ha produzioni: lo tratto come terminale.</p>`).join('')));
  out.push(phase(2, 'Trasforma', 'Ricorsione sinistra, poi left factoring, poi sostituzione dei non terminali a inizio produzione quando i FIRST si sovrappongono. Solo quando nessuna di queste si applica: assorbimento del FOLLOW per i conflitti FIRST/FOLLOW. Si ripete finché non cambia più nulla.',
    R.steps.length ? `<ol class="steps">${R.steps.map(s => `<li><strong>${esc(s.title)}</strong>${esc(s.txt)}${gH(s.g)}</li>`).join('')}</ol>` +
      (R.status === 'loop' ? `<p class="alert">Loop: ${esc(R.loop.A)} ripete la forma di ${esc(R.loop.B)}. Mi fermo qui.</p>` : '')
      : '<p class="note">Nessuna trasformazione necessaria.</p>'));
  out.push(phase(3, 'Semplifica', 'Unisco i non terminali con produzioni identiche ed elimino quelli irraggiungibili.',
    R.status !== 'ok' ? '<p class="note">Saltata: il procedimento non si è chiuso.</p>' :
      R.simp.length ? `<ol class="steps">${R.simp.map(s => `<li><strong>${esc(s.title)}</strong>${esc(s.txt)}</li>`).join('')}</ol>${gH(R.g)}` : '<p class="note">Niente da semplificare.</p>'));
  const g = R.g, S = R.sets;
  const rows = g.order.map(A => `<tr><td><b>${esc(A)}</b></td><td>${S.N.has(A) ? 'sì' : 'no'}</td><td class="set">${setH(S.F.get(A))}</td><td class="set">${setH(S.FO.get(A))}</td></tr>`).join('');
  const prods = g.order.flatMap(A => g.P.get(A).map(a => {
    const f = LL1.firstSeq(g, a, S.F, S.N);
    return `<tr><td><b>${esc(A)}</b> → ${altH(g, a)}</td><td class="set">${setH(f)}</td><td class="set">${f.has('ε') ? setH(S.FO.get(A)) : '–'}</td></tr>`;
  })).join('');
  const mt = `<tr><th></th>${R.terms.map(t => `<th>${esc(t)}</th>`).join('')}</tr>` + g.order.map(A => `<tr><td>${esc(A)}</td>${R.terms.map(t => {
    const c = R.T.get(A).get(t) || [];
    return `<td class="${c.length > 1 ? 'c' : ''}">${c.map(i => esc(A + ' → ' + LL1.altText(g.P.get(A)[i]))).join('<br>')}</td>`;
  }).join('')}</tr>`).join('');
  out.push(phase(4, 'Verifica', 'Per ogni A → α | β: FIRST(α) ∩ FIRST(β) = ∅ e, se α è annullabile, FIRST(β) ∩ FOLLOW(A) = ∅.' + (R.status !== 'ok' ? ' Qui la verifica riguarda la grammatica al momento in cui mi sono fermato.' : ''),
    `<h3>Annullabili, FIRST e FOLLOW</h3><div class="scroll"><table><tr><th>Non terminale</th><th>Annullabile</th><th>FIRST</th><th>FOLLOW</th></tr>${rows}</table></div>
     <h3>Per produzione</h3><div class="scroll"><table><tr><th>Produzione</th><th>FIRST</th><th>FOLLOW se annullabile</th></tr>${prods}</table></div>
     <h3>Tabella di parsing M</h3><div class="scroll"><table class="mt">${mt}</table></div>` +
    R.conflicts.map(c => `<p class="alert">Conflitto ${esc(c.kind)} in M[${esc(c.A)}, ${esc(c.t)}]: ${c.idx.map(i => esc(c.A + ' → ' + LL1.altText(g.P.get(c.A)[i]))).join(' e ')}.</p>`).join('')));
  const tester = R.ll1 ? `<h3>Prova una stringa</h3><label for="str">Stringa da analizzare</label>
      <div class="tools" style="margin-top:0"><input id="str" style="max-width:340px" spellcheck="false" value="${esc(sample())}"><button class="btn" id="go" type="button">Analizza</button></div>
      <div id="trace"></div>` : '';
  out.push(phase(5, 'Concludi', '', `<p>${esc($('why').textContent)}</p>${tester}`, true));
  $('phases').innerHTML = out.join('');
  if (R.ll1) { $('go').onclick = trace; $('str').onkeydown = e => { if (e.key === 'Enter') trace(); }; trace(); }
}

function sample() {
  const g = R.g, S = R.sets, out = [];
  const gen = (A, d) => {
    const alts = g.P.get(A);
    const pick = d > 3 ? (alts.find(a => a.every(s => !isNT(g, s) || S.N.has(s))) || alts[alts.length - 1]) : alts[0];
    for (const s of pick) { if (out.length > 30) return; if (isNT(g, s)) gen(s, d + 1); else out.push(s); }
  };
  try { gen(g.start, 0); } catch (e) { return ''; }
  return out.join(out.some(s => s.length > 1) ? ' ' : '');
}
function trace() {
  const v = $('str').value.trim(), g = R.g;
  const multi = R.terms.some(t => t !== '$' && t.length > 1);
  const toks = multi || /\s/.test(v) ? v.split(/\s+/).filter(Boolean) : [...v];
  const r = LL1.parse(g, R.T, toks);
  $('trace').innerHTML = `<p class="res${r.ok ? '' : ' bad'}">${r.ok ? 'Stringa accettata' : 'Stringa rifiutata'}</p><div class="scroll"><table class="trace"><tr><th>Pila</th><th>Input</th><th>Azione</th></tr>${r.rows.map(x => `<tr><td>${esc(x.stack)}</td><td>${esc(x.input)}</td><td>${esc(x.act)}</td></tr>`).join('')}</table></div>`;
}

function run() {
  R = mode === 'lang' ? LL1.solve('lang', $('lang').value, $('cons').value) : LL1.solve('gram', $('gram').value);
  verdict(); phases();
  try { localStorage.setItem('ll1', JSON.stringify({ mode, lang: $('lang').value, cons: $('cons').value, gram: $('gram').value })); } catch (e) {}
}
function setMode(m) {
  mode = m;
  $('tLang').setAttribute('aria-pressed', m === 'lang'); $('tGram').setAttribute('aria-pressed', m === 'gram');
  $('pLang').hidden = m !== 'lang'; $('pGram').hidden = m !== 'gram';
}
$('tLang').onclick = () => { setMode('lang'); run(); };
$('tGram').onclick = () => { setMode('gram'); run(); };
$('ex').innerHTML = EX.map((e, i) => `<button type="button" data-i="${i}">${esc(e.n)}</button>`).join('');
$('ex').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  const x = EX[+b.dataset.i]; setMode(x.m);
  if (x.m === 'lang') { $('lang').value = x.a; $('cons').value = x.b; } else $('gram').value = x.a;
  run();
};
let tm; $('f').oninput = () => { clearTimeout(tm); tm = setTimeout(run, 250); };
$('f').onsubmit = e => { e.preventDefault(); run(); };
$('copy').onclick = () => {
  if (!R || R.error) return;
  navigator.clipboard.writeText(LL1.text(R.g)).then(() => { $('copied').textContent = 'Copiata'; }, () => { $('copied').textContent = 'Copia non disponibile qui'; });
};
try { const s = JSON.parse(localStorage.getItem('ll1') || 'null'); if (s) { $('lang').value = s.lang; $('cons').value = s.cons; $('gram').value = s.gram; setMode(s.mode); } } catch (e) {}
run();
}
