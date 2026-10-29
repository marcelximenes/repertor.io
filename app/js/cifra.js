/* Repertor.io — leitura, transposição e renderização de cifras.
 * Formatos aceitos (pode misturar):
 *  1) acorde em cima da letra (linha só de acordes, alinhada por espaços)
 *  2) ChordPro inline: "Eu [Am]vou ca[G]minhar"
 *  3) seções: "[Intro]", "[Refrão]", "Refrão:" sozinho na linha
 *  4) tablatura: linhas tipo "e|---0---|"
 */
(function (R) {
  'use strict';
  const A = R.acordes;

  const RE_TAB = /^\s*[A-Ga-g]?[#b]?\s*\|[-0-9hpbrxs\/\\|~^*()<>.=\s]+$/;
  const RE_SECAO = /^\s*\[([^\]\[]{1,40})\]\s*$/;
  const RE_SECAO_DOIS_PONTOS = /^\s*(intro|introdução|refrão|refrao|ponte|pré-refrão|pre-refrao|solo|final|outro|verso|estrofe|interlúdio|coda|parte \d+|primeira parte|segunda parte)\s*(\(\d+x\))?:?\s*$/i;
  // tokens tolerados numa linha de acordes que não são acordes
  const RE_TOKEN_NEUTRO = /^(\||\|\||-+|\/|%|x\d+|\(?\d+x\)?|\(|\)|\.{2,}|[:,]|N\.?C\.?|→|\*)$/i;
  const RE_ROTULO = /^(\[[^\]]+\]|[A-Za-zÀ-ú]+:)$/;

  function tokens(linha) {
    const out = [];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(linha))) out.push({ texto: m[0], col: m.index });
    return out;
  }

  /** Separa parênteses grudados: "(G" → "(", "G" — só para teste de acorde. */
  function limparToken(t) {
    // só tira parênteses que sobram: "(G" → "G", "Am)" → "Am", mas "C7(9)" fica inteiro
    const conta = (x, c) => x.split(c).length - 1;
    t = t.replace(/^\[+/, '').replace(/[\],]+$/, '');
    while (t[0] === '(' && conta(t, '(') > conta(t, ')')) t = t.slice(1);
    while (t.endsWith(')') && conta(t, ')') > conta(t, '(')) t = t.slice(0, -1);
    if (/^\(.*\)$/.test(t) && !A.ehAcorde(t) && A.ehAcorde(t.slice(1, -1))) t = t.slice(1, -1); // "(Am)"
    return t;
  }

  function ehLinhaDeAcordes(linha) {
    const ts = tokens(linha);
    if (!ts.length) return false;
    let acordes = 0, outros = 0;
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i].texto;
      if (A.ehAcorde(t) || A.ehAcorde(limparToken(t))) acordes++;
      else if (RE_TOKEN_NEUTRO.test(t)) continue;
      else if (i === 0 && RE_ROTULO.test(t)) continue;
      else outros++;
    }
    return acordes > 0 && outros === 0;
  }

  /** Analisa o texto da cifra em linhas tipadas. */
  function analisar(texto) {
    const linhas = String(texto || '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
    // idx = número da linha no texto original (para trocar um acorde clicado)
    return linhas.map((l, idx) => {
      if (!l.trim()) return { tipo: 'vazio', texto: '', idx };
      if (RE_TAB.test(l) && /-{3,}/.test(l)) return { tipo: 'tab', texto: l, idx };
      const sec = RE_SECAO.exec(l);
      if (sec && !A.ehAcorde(sec[1].trim())) return { tipo: 'secao', texto: sec[1].trim(), idx };
      if (ehInline(l) && !sec) return inlineParaPar(l).map((x) => Object.assign(x, { idx, inline: true }));
      if (ehLinhaDeAcordes(l)) return { tipo: 'acordes', texto: l, idx };
      if (RE_SECAO_DOIS_PONTOS.test(l)) return { tipo: 'secao', texto: l.trim().replace(/:$/, ''), idx };
      return { tipo: 'letra', texto: l, idx };
    }).flat();
  }

  /** ChordPro inline: só se todos os colchetes contiverem acordes. */
  function ehInline(l) {
    if (!/\[[^\]]+\]/.test(l) || RE_SECAO.test(l)) return false;
    const dentro = [...l.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim());
    return dentro.length > 0 && dentro.every((x) => A.ehAcorde(x));
  }

  /** "Eu [Am]vou" → par de linhas acordes + letra. */
  function inlineParaPar(l) {
    let letra = '', acordes = '';
    const re = /\[([^\]]+)\]/g;
    let ultimo = 0, m;
    while ((m = re.exec(l))) {
      letra += l.slice(ultimo, m.index);
      const col = Math.max(letra.length, acordes.length ? acordes.length + 1 : 0);
      while (letra.length < col) letra += ' ';
      while (acordes.length < col) acordes += ' ';
      acordes += m[1].trim();
      ultimo = m.index + m[0].length;
    }
    letra += l.slice(ultimo);
    const pares = [{ tipo: 'acordes', texto: acordes }];
    if (letra.trim()) pares.push({ tipo: 'letra', texto: letra.replace(/\s+$/, '') });
    return pares;
  }

  /** Transpõe uma linha de acordes preservando a coluna de cada acorde. */
  function transporLinha(linha, semitons, bemol) {
    if (!semitons) return linha;
    let out = '';
    for (const t of tokens(linha)) {
      const nucleo = limparToken(t.texto);
      let novo = t.texto;
      if (A.ehAcorde(nucleo)) novo = t.texto.replace(nucleo, A.transporNome(nucleo, semitons, bemol));
      const col = Math.max(t.col, out.length ? out.length + 1 : 0);
      out = out.padEnd(col, ' ') + novo;
    }
    return out;
  }

  /** Lista de acordes únicos na ordem em que aparecem (já transpostos). */
  function acordesUsados(linhasAnalisadas, semitons = 0, bemol) {
    const vistos = new Set(), lista = [];
    for (const l of linhasAnalisadas) {
      if (l.tipo !== 'acordes') continue;
      for (const t of tokens(l.texto)) {
        const nucleo = limparToken(t.texto);
        if (!A.ehAcorde(nucleo)) continue;
        const nome = A.transporNome(nucleo, semitons, bemol);
        if (!vistos.has(nome)) { vistos.add(nome); lista.push(nome); }
      }
    }
    return lista;
  }

  /** Primeiro acorde da música (palpite de tom). */
  function primeiroAcorde(texto) { return acordesUsados(analisar(texto))[0] || null; }

  /** Transpõe o texto inteiro (para "aplicar tom" de forma permanente). */
  function transporTexto(texto, semitons, bemol) {
    if (!semitons) return texto;
    return String(texto).replace(/\r\n?/g, '\n').split('\n').map((l) => {
      if (/\[[^\]]+\]/.test(l)) {
        const dentro = [...l.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim());
        if (dentro.length && dentro.every((x) => A.ehAcorde(x)))
          return l.replace(/\[([^\]]+)\]/g, (_, c) => '[' + A.transporNome(c.trim(), semitons, bemol) + ']');
      }
      return ehLinhaDeAcordes(l) ? transporLinha(l, semitons, bemol) : l;
    }).join('\n');
  }

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /** Renderiza em HTML. Acordes viram <b class="acorde" data-acorde="..."> */
  function renderizar(texto, { semitons = 0, bemol, mostrarTabs = true, somenteLetra = false, partes = false } = {}) {
    const linhas = analisar(texto);
    const html = [];
    const itens = []; // para o modo com partes: { html, vazio? } ou { secao }
    const por = (h, extra) => { html.push(h); itens.push(Object.assign({ html: h }, extra)); };
    for (const l of linhas) {
      if (l.tipo === 'vazio') { por('<div class="ln ln-vazio"> </div>', { vazio: true }); continue; }
      if (l.tipo === 'secao') { por(`<div class="ln ln-secao">${esc(l.texto)}</div>`, { secao: l.texto }); continue; }
      if (l.tipo === 'tab') { if (mostrarTabs && !somenteLetra) por(`<div class="ln ln-tab">${esc(l.texto)}</div>`); continue; }
      if (l.tipo === 'letra') { por(`<div class="ln ln-letra">${esc(somenteLetra ? l.texto.replace(/\s{2,}/g, ' ').trim() : l.texto)}</div>`); continue; }
      if (somenteLetra) continue;
      // acordes (data-l = linha no texto, data-k = posição do acorde na linha)
      const linha = transporLinha(l.texto, semitons, bemol);
      let out = '', pos = 0, k = 0;
      for (const t of tokens(linha)) {
        out += esc(linha.slice(pos, t.col));
        const nucleo = limparToken(t.texto);
        if (A.ehAcorde(nucleo)) {
          const i = t.texto.indexOf(nucleo);
          out += esc(t.texto.slice(0, i)) + `<b class="acorde${/\*$/.test(nucleo) ? ' aprox' : ''}" data-acorde="${esc(nucleo)}" data-l="${l.idx}" data-k="${k++}" tabindex="0">${esc(nucleo)}</b>` + esc(t.texto.slice(i + nucleo.length));
        } else out += `<span class="ln-marca">${esc(t.texto)}</span>`;
        pos = t.col + t.texto.length;
      }
      por(`<div class="ln ln-acordes">${out}</div>`);
    }
    return partes ? partesHtml(itens) : html.join('');
  }

  /**
   * Agrupa linhas em partes (Introdução, Refrão…): rótulo vertical pequeno à esquerda e uma linha
   * que acompanha a parte. Linhas vazias no fim de uma parte ficam fora dela.
   * linhas: [{ html } | { html, vazio:true } | { secao:'Refrão', attrs?, cru? }]  (cru = nome já escapado)
   */
  function partesHtml(linhas) {
    const out = []; let cur = null;
    const fechar = () => {
      if (!cur) return;
      const sobra = [];
      while (cur.corpo.length && cur.corpo[cur.corpo.length - 1].vazio) sobra.unshift(cur.corpo.pop());
      if (cur.nome != null || cur.corpo.length) {
        const rot = cur.nome != null ? `<span class="parte__linha"></span><span class="parte__nome">${cur.cru ? cur.nome : esc(cur.nome)}</span><span class="parte__linha"></span>` : '';
        out.push(`<div class="parte${cur.nome == null ? ' parte--solta' : ''}"><div class="parte__rot"${cur.attrs || ''}>${rot}</div><div class="parte__corpo">${cur.corpo.map((x) => x.html).join('')}</div></div>`);
      }
      // linhas vazias que sobram ficam fora da parte, mas com a mesma calha à esquerda
      if (sobra.length) out.push(`<div class="parte parte--solta"><div class="parte__rot"></div><div class="parte__corpo">${sobra.map((x) => x.html).join('')}</div></div>`);
      cur = null;
    };
    for (const l of linhas) {
      if (l.secao != null) { fechar(); cur = { nome: l.secao, cru: l.cru, attrs: l.attrs, corpo: [] }; continue; }
      if (!cur) cur = { nome: null, corpo: [] };
      cur.corpo.push(l);
    }
    fechar();
    return out.join('');
  }

  /** Converte para texto puro com acordes em cima (para exportar .txt). */
  function paraTexto(texto, semitons = 0, bemol) {
    return analisar(texto).map((l) => (l.tipo === 'acordes' ? transporLinha(l.texto, semitons, bemol) : l.tipo === 'secao' ? '[' + l.texto + ']' : l.texto)).join('\n');
  }

  /**
   * Troca acordes no texto da cifra mantendo o alinhamento com a letra.
   * fn(nucleo, linha, k) devolve o novo nome ou null para manter.
   * Vale para linhas de acordes e para acordes entre colchetes.
   */
  function mapearAcordes(texto, fn) {
    const linhas = String(texto || '').replace(/\r\n?/g, '\n').split('\n');
    return linhas.map((l, idx) => {
      if (ehInline(l)) {
        let k = 0;
        return l.replace(/\[([^\]]+)\]/g, (tudo, c) => { const novo = fn(c.trim(), idx, k++); return novo === '' ? '' : novo ? '[' + novo + ']' : tudo; });
      }
      if (!ehLinhaDeAcordes(l)) return l;
      let out = '', pos = 0, k = 0, sobra = 0; // sobra = caracteres a mais que precisam ser absorvidos
      for (const t of tokens(l)) {
        let gap = l.slice(pos, t.col);
        if (sobra > 0 && gap.length) { const tira = Math.min(sobra, gap.length - 1); gap = gap.slice(tira); sobra -= tira; }
        else if (sobra < 0) { gap = ' '.repeat(-sobra) + gap; sobra = 0; }
        out += gap;
        const nucleo = limparToken(t.texto);
        let tok = t.texto;
        if (A.ehAcorde(nucleo)) {
          const novo = fn(nucleo, idx, k++);
          if (novo === '') tok = ' '.repeat(t.texto.length); // tirar o acorde: vira espaço, o resto não anda
          else if (novo) { tok = t.texto.replace(nucleo, novo); sobra += tok.length - t.texto.length; }
        }
        out += tok; pos = t.col + t.texto.length;
      }
      out += l.slice(pos);
      return out.trim() ? out.replace(/\s+$/, '') : null; // linha de acordes que ficou vazia sai
    }).filter((l) => l !== null).join('\n');
  }
  /** Troca só o acorde da linha l, posição k. */
  const trocarAcorde = (texto, l, k, novo) => mapearAcordes(texto, (_, li, ki) => (li === l && ki === k ? novo : null));
  /** Troca todas as ocorrências de um acorde. */
  const trocarTodos = (texto, antigo, novo) => mapearAcordes(texto, (n) => (n === antigo ? novo : null));
  /** Tira o acorde da linha l, posição k (se a linha ficar sem acordes, ela sai). */
  const tirarAcorde = (texto, l, k) => mapearAcordes(texto, (_, li, ki) => (li === l && ki === k ? '' : null));
  /** Tira todas as ocorrências de um acorde. */
  const tirarTodos = (texto, nome) => mapearAcordes(texto, (n) => (n === nome ? '' : null));

  // ---------- estrutura para o modo de edição (posicionar acordes na letra) ----------
  /**
   * Agrupa a cifra em pares (linha de acordes + linha de letra) e outras linhas.
   * par: { tipo:'par', acordes:[{ texto, nucleo|null, col }], letra:string|null }
   * outro: { tipo:'outro', texto } (vazias, seções, tabs — mantidas como estão)
   * Acordes entre colchetes viram par (acorde em cima da letra).
   */
  function estrutura(texto) {
    const crus = String(texto || '').replace(/\r\n?/g, '\n').split('\n');
    const an = analisar(texto);
    const toks = (linha) => tokens(linha).map((t) => { const n = limparToken(t.texto); return { texto: t.texto, nucleo: A.ehAcorde(n) ? n : null, col: t.col }; });
    const itens = [];
    for (let k = 0; k < an.length; k++) {
      const a = an[k], prox = an[k + 1];
      if (a.tipo === 'acordes') {
        const junto = prox && prox.tipo === 'letra' && (a.inline ? prox.inline && prox.idx === a.idx : !prox.inline && prox.idx === a.idx + 1);
        itens.push({ tipo: 'par', acordes: toks(a.texto), letra: junto ? prox.texto : null });
        if (junto) k++;
      } else if (a.tipo === 'letra') itens.push({ tipo: 'par', acordes: [], letra: a.texto });
      else itens.push({ tipo: 'outro', classe: a.tipo, exibir: a.texto, texto: (crus[a.idx] || '').replace(/\t/g, '    ') });
    }
    return itens;
  }
  /** Volta a estrutura para texto. Acordes encostados são empurrados para a direita. */
  function serializar(itens) {
    const out = [];
    for (const it of itens) {
      if (it.tipo !== 'par') { out.push(it.texto); continue; }
      const ac = it.acordes.slice().sort((a, b) => a.col - b.col);
      if (ac.length) {
        let linha = '';
        for (const a of ac) { const col = Math.max(a.col, linha.length ? linha.length + 1 : 0); linha = linha.padEnd(col, ' ') + a.texto; }
        out.push(linha);
      }
      if (it.letra != null) out.push(it.letra);
    }
    return out.join('\n');
  }

  /** Nome do acorde na linha l, posição k (como está escrito no texto). */
  function acordeEm(texto, l, k) { let achado = null; mapearAcordes(texto, (n, li, ki) => { if (li === l && ki === k) achado = n; return null; }); return achado; }

  R.cifra = { partesHtml, mapearAcordes, trocarAcorde, trocarTodos, tirarAcorde, tirarTodos, estrutura, serializar, acordeEm, analisar, ehLinhaDeAcordes, transporLinha, transporTexto, acordesUsados, primeiroAcorde, renderizar, paraTexto };
})(window.Repertorio = window.Repertorio || {});
