/* Repertor.io — motor de acordes
 * Parser de nomes (notação brasileira e americana), gerador de formas por
 * instrumento, reconhecimento de acorde a partir de notas e transposição.
 * Script clássico (sem módulos) para funcionar abrindo o arquivo direto no Chrome.
 */
(function (R) {
  'use strict';

  // ---------- Notas ----------
  const SUSTENIDOS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const BEMOIS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const NOMES_PT = ['dó', 'dó#', 'ré', 'ré#', 'mi', 'fá', 'fá#', 'sol', 'sol#', 'lá', 'lá#', 'si'];
  // Tons que costumam ser escritos com bemol
  const TONS_BEMOL = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

  const mod12 = (n) => ((n % 12) + 12) % 12;

  function notaParaPc(nome) {
    const m = /^([A-G])([#b♯♭]*)$/.exec(nome);
    if (!m) return null;
    let pc = BASE[m[1]];
    for (const a of m[2]) pc += (a === '#' || a === '♯') ? 1 : -1;
    return mod12(pc);
  }
  function nomeNota(pc, bemol) { return (bemol ? BEMOIS : SUSTENIDOS)[mod12(pc)]; }

  // ---------- Parser de nome de acorde ----------
  const INTERVALO_TENSAO = { '9': 2, 'b9': 1, '#9': 3, '11': 5, '#11': 6, '13': 9, 'b13': 8, '2': 2, '4': 5 };

  /** Interpreta o sufixo do acorde. Retorna null se não reconhecer tudo. */
  function interpretarSufixo(sufixo) {
    let s = sufixo
      .replace(/♯/g, '#').replace(/♭/g, 'b')
      .replace(/[º°]/g, 'dim7').replace(/ø/g, 'm7b5').replace(/Δ/g, 'maj7')
      .replace(/–/g, '-');

    const q = { terca: 'M', quinta: 'J', setima: null, sexta: false, tensoes: new Set(), add: false, power: false, explicito: '' };
    let majPendente = false;
    let i = 0, emParenteses = 0, ultimoFoiBarra = false;

    const resto = () => s.slice(i);
    while (i < s.length) {
      const r = resto();
      let m;
      if (r[0] === '(') { emParenteses++; i++; continue; }
      if (r[0] === ')') { emParenteses = Math.max(0, emParenteses - 1); i++; continue; }
      if (r[0] === ',' || r[0] === ' ' || r[0] === '.') { i++; continue; }
      if (r[0] === '/') { ultimoFoiBarra = true; i++; continue; }

      if ((m = /^(maj|Maj|MAJ|ma)(?=\d|$)/.exec(r))) { majPendente = true; i += m[0].length; continue; }
      if ((m = /^(7M|M7|7\+(?!\d))/.exec(r))) { q.setima = 'M'; i += m[0].length; continue; }
      if ((m = /^dim7/.exec(r))) { q.terca = 'm'; q.quinta = 'b5'; q.setima = 'd'; i += 4; continue; }
      if ((m = /^dim/.exec(r))) { q.terca = 'm'; q.quinta = 'b5'; i += 3; continue; }
      if ((m = /^(aug|\+)(?![0-9])/.exec(r))) { q.quinta = '#5'; i += m[0].length; continue; }
      if ((m = /^(min|mi|m)(?!aj)/.exec(r))) {
        if (m[0] === 'm' && /^m7b5|^m7\(b5\)|^m7\/5-|^m7\(5-\)/.test(r)) { /* tratado abaixo */ }
        q.terca = 'm'; i += m[0].length; continue;
      }
      if ((m = /^M(?![a-z0-9])/.exec(r))) { i += 1; continue; } // maior explícito
      if ((m = /^sus4|^sus(?![0-9])/.exec(r))) { q.terca = 'sus4'; i += m[0].length; continue; }
      if ((m = /^sus2/.exec(r))) { q.terca = 'sus2'; i += 4; continue; }
      if ((m = /^add\s*([b#\-+]?)(\d+)/.exec(r))) {
        const ac = m[1] === '-' ? 'b' : m[1] === '+' ? '#' : m[1];
        const k = ac + m[2];
        if (!(k in INTERVALO_TENSAO)) return null;
        q.tensoes.add(k === '2' ? '9' : k === '4' ? '11' : k); q.add = true; i += m[0].length; continue;
      }
      if ((m = /^([b#\-+]?)(\d{1,2})([\-+]?)/.exec(r))) {
        let ac = m[1] || m[3];
        ac = ac === '-' ? 'b' : ac === '+' ? '#' : ac;
        const n = m[2];
        i += m[0].length;
        if (n === '5') {
          if (ac === 'b') q.quinta = 'b5';
          else if (ac === '#') q.quinta = '#5';
          else q.power = true;
          continue;
        }
        if (ac) {
          const k = ac + n;
          if (!(k in INTERVALO_TENSAO)) return null;
          q.tensoes.add(k);
          if (!emParenteses && !ultimoFoiBarra && !q.setima && !q.sexta && (n === '9' || n === '13')) q.setima = '7';
          ultimoFoiBarra = false;
          continue;
        }
        if (n === '7') { q.setima = majPendente ? 'M' : (q.setima === 'd' ? 'd' : '7'); majPendente = false; ultimoFoiBarra = false; continue; }
        if (n === '6') { q.sexta = true; ultimoFoiBarra = false; continue; }
        if (n === '4') { q.terca = 'sus4'; ultimoFoiBarra = false; continue; }
        if (n === '2') { q.tensoes.add('9'); q.add = true; ultimoFoiBarra = false; continue; }
        if (n === '9' || n === '11' || n === '13') {
          q.tensoes.add(n);
          const implicaSetima = !emParenteses && !ultimoFoiBarra && !q.add && !q.sexta;
          if (implicaSetima && !q.setima) q.setima = majPendente ? 'M' : '7';
          if (implicaSetima && n === '11') q.tensoes.add('9');
          if (implicaSetima && n === '13') q.tensoes.add('9');
          majPendente = false; ultimoFoiBarra = false;
          continue;
        }
        return null;
      }
      return null; // caractere não reconhecido
    }
    if (majPendente) q.setima = 'M';
    if (q.power) { q.terca = null; }
    return q;
  }

  /** Converte a estrutura em intervalos: { todos:Set, obrigatorios:Set } */
  function intervalosDe(q) {
    const todos = new Set([0]);
    const obrig = new Set([0]);
    const terca = { M: 4, m: 3, sus4: 5, sus2: 2 }[q.terca];
    if (terca != null) { todos.add(terca); obrig.add(terca); }
    const quinta = { J: 7, b5: 6, '#5': 8 }[q.quinta];
    todos.add(quinta);
    const temExtensao = q.setima || q.sexta || q.tensoes.size;
    if (q.quinta !== 'J' || !temExtensao || q.power) obrig.add(quinta);
    if (q.setima) { const s7 = { '7': 10, M: 11, d: 9 }[q.setima]; todos.add(s7); obrig.add(s7); }
    if (q.sexta) { todos.add(9); obrig.add(9); }
    for (const t of q.tensoes) {
      const iv = INTERVALO_TENSAO[t];
      todos.add(iv); obrig.add(iv);
    }
    // Em acordes de 13 o 9 é opcional; em acordes de 11 natural com terça maior, a terça vira opcional
    if (q.tensoes.has('13') && q.tensoes.has('9') && q.setima) obrig.delete(2);
    if (q.tensoes.has('11') && q.terca === 'M' && q.setima) obrig.delete(4);
    return { todos, obrigatorios: obrig };
  }

  const cacheParse = new Map();
  /**
   * Interpreta um nome de acorde. Retorna null se não for acorde válido.
   * Nome terminado em "*" = acorde aproximado/personalizado (o Marcel montou
   * notas que não batem com um nome padrão). "Am7*" vale como Am7; um nome
   * livre com "*" ("Am(meu)*") vale desde que comece com a nota (A–G): as notas
   * teóricas viram a tríade da fundamental e a forma real fica fixada na música.
   */
  function parse(nome) {
    if (nome == null) return null;
    nome = String(nome).trim();
    if (cacheParse.has(nome)) return cacheParse.get(nome);
    let res = null;
    if (/\*$/.test(nome)) {
      const base = nome.replace(/\*+$/, '');
      let p = base ? parse(base) : null;
      if (!p) {
        const livre = /^([A-G])([#b♯♭]?)(\S*)$/.exec(base);
        const r = livre ? parse(livre[1] + livre[2]) : null;
        if (r) p = Object.assign({}, r, { sufixo: livre[3], livre: true });
      }
      if (p) res = Object.assign({}, p, { nome, estrela: true });
      cacheParse.set(nome, res);
      return res;
    }
    const m = /^([A-G])([#b♯♭]?)(.*?)(?:\/([A-G][#b♯♭]?))?$/.exec(nome);
    if (m) {
      const raiz = notaParaPc(m[1] + (m[2] || ''));
      const q = interpretarSufixo(m[3] || '');
      if (q && raiz != null) {
        const iv = intervalosDe(q);
        const baixo = m[4] ? notaParaPc(m[4]) : null;
        res = {
          nome, raiz, raizTexto: m[1] + (m[2] || '').replace('♯', '#').replace('♭', 'b'),
          sufixo: m[3] || '', baixo, baixoTexto: m[4] || null,
          bemol: /b|♭/.test(m[2] || '') || (m[4] ? /b|♭/.test(m[4].slice(1)) : false),
          q, intervalos: iv.todos, obrigatorios: iv.obrigatorios,
          notas: new Set([...iv.todos].map((x) => mod12(raiz + x))),
          notasObrig: new Set([...iv.obrigatorios].map((x) => mod12(raiz + x))),
        };
        if (baixo != null) res.notas.add(baixo);
      }
    }
    cacheParse.set(nome, res);
    return res;
  }

  const ehAcorde = (token) => parse(token) !== null;

  // ---------- Transposição ----------
  function transporNome(nome, semitons, bemol) {
    const p = parse(nome);
    if (!p || !semitons) return nome;
    const usarBemol = bemol != null ? bemol : p.bemol;
    let novo = nomeNota(p.raiz + semitons, usarBemol) + p.sufixo;
    if (p.baixo != null && !p.livre) novo += '/' + nomeNota(p.baixo + semitons, usarBemol);
    return novo + (p.estrela ? '*' : '');
  }
  /** Decide se o tom de destino pede bemóis. tom é um nome de acorde (ex. "Am", "Bb"). */
  function tomPedeBemol(tom) {
    const p = parse(tom);
    if (!p) return false;
    const menor = p.q.terca === 'm';
    const chave = nomeNota(p.raiz, true) + (menor ? 'm' : '');
    const chaveS = nomeNota(p.raiz, false) + (menor ? 'm' : '');
    return TONS_BEMOL.has(chave) && !TONS_BEMOL.has(chaveS) ? true : TONS_BEMOL.has(chave);
  }
  const TONS = SUSTENIDOS.map((_, i) => i);

  // ---------- Instrumentos ----------
  // Afinação em notas MIDI, da corda mais grave para a mais aguda.
  const INSTRUMENTOS = {
    violao: { nome: 'Violão e guitarra', cordas: [40, 45, 50, 55, 59, 64], rotulos: ['E', 'A', 'D', 'G', 'B', 'E'], trastes: 15, minCordas: 4, abertura: 4 },
    ukulele: { nome: 'Ukulele', cordas: [67, 60, 64, 69], rotulos: ['G', 'C', 'E', 'A'], trastes: 15, minCordas: 4, abertura: 4, reentrante: true },
    cavaquinho: { nome: 'Cavaquinho', cordas: [62, 67, 71, 74], rotulos: ['D', 'G', 'B', 'D'], trastes: 15, minCordas: 4, abertura: 4 },
    teclado: { nome: 'Teclado e piano', teclado: true },
  };

  // ---------- Gerador de formas ----------
  /** Conta dedos e detecta pestana. Retorna {dedos, pestana:{traste,de,ate}|null, mapa:[dedo|0|null]} */
  function dedilhado(formas) {
    const tocadas = formas.map((f, i) => ({ f, i })).filter((x) => x.f != null && x.f > 0);
    if (!tocadas.length) return { dedos: 0, pestana: null, mapa: formas.map((f) => (f == null ? null : 0)) };
    const min = Math.min(...tocadas.map((x) => x.f));
    const noMin = tocadas.filter((x) => x.f === min);
    let pestana = null;
    let dedosSemPestana = tocadas.length;
    let usarPestana = false;
    if (noMin.length >= 2) {
      const de = noMin[0].i, ate = noMin[noMin.length - 1].i;
      // Pestana só é possível se nenhuma corda entre "de" e "ate" estiver solta (0)
      let ok = true;
      for (let k = de; k <= ate; k++) if (formas[k] === 0) ok = false;
      if (ok) {
        const acima = tocadas.filter((x) => x.f > min).length;
        let cheia = true;
        for (let k = de; k <= ate; k++) if (formas[k] == null || formas[k] < min) cheia = false;
        if (dedosSemPestana > 4 || (noMin.length >= 3 && cheia && acima + 1 < dedosSemPestana)) { usarPestana = true; pestana = { traste: min, de, ate }; }
      }
    }
    const mapa = formas.map((f) => (f == null ? null : 0));
    let dedos;
    if (usarPestana) {
      const acima = tocadas.filter((x) => x.f > min).sort((a, b) => a.f - b.f || a.i - b.i);
      dedos = 1 + acima.length;
      for (const x of tocadas) if (x.f === min && x.i >= pestana.de && x.i <= pestana.ate) mapa[x.i] = 1;
      let dedo = 2;
      // agrupa por traste para numerar 2,3,4 de forma natural
      for (const x of acima) mapa[x.i] = Math.min(4, dedo++);
    } else {
      dedos = tocadas.length;
      const ord = [...tocadas].sort((a, b) => a.f - b.f || a.i - b.i);
      let dedo = 1;
      const base = min;
      for (const x of ord) {
        // dedo aproximado pela distância ao menor traste
        const sugerido = Math.min(4, Math.max(dedo, 1 + (x.f - base)));
        mapa[x.i] = sugerido; dedo = sugerido + 1;
      }
    }
    return { dedos, pestana, mapa };
  }

  function formaParaTexto(formas) { return formas.map((f) => (f == null ? 'x' : f > 9 ? '(' + f + ')' : String(f))).join(''); }
  function textoParaForma(txt) {
    const out = [];
    const re = /\((\d+)\)|([xX0-9])/g;
    let m;
    while ((m = re.exec(txt))) out.push(m[1] ? +m[1] : /x/i.test(m[2]) ? null : +m[2]);
    return out;
  }

  const cacheFormas = new Map();
  /**
   * Gera formas para um acorde num instrumento.
   * Retorna lista ordenada de { formas:[traste|null], texto, dedos, pestana, mapa, pontuacao }.
   */
  function gerarFormas(nomeOuParse, instrumentoId = 'violao', limite = 12) {
    const p = typeof nomeOuParse === 'string' ? parse(nomeOuParse) : nomeOuParse;
    const inst = INSTRUMENTOS[instrumentoId];
    if (!p || !inst || inst.teclado) return [];
    const chave = p.nome + '|' + instrumentoId;
    if (cacheFormas.has(chave)) return cacheFormas.get(chave).slice(0, limite);

    const cordas = inst.cordas, n = cordas.length;
    const notas = p.notas, obrig = p.notasObrig;
    const baixoAlvo = p.baixo != null ? p.baixo : p.raiz;
    const quatroCordas = n === 4;
    const resultados = new Map();

    for (let base = 0; base <= 12; base++) {
      const lo = Math.max(1, base), hi = base + inst.abertura - 1;
      const opcoes = cordas.map((nota0) => {
        const ops = [];
        if (!quatroCordas) ops.push(null);
        if (notas.has(mod12(nota0))) ops.push(0);
        for (let f = lo; f <= Math.min(hi, inst.trastes); f++) if (notas.has(mod12(nota0 + f))) ops.push(f);
        if (quatroCordas && !ops.length) ops.push(null);
        return ops;
      });
      const atual = new Array(n);
      const rec = (k) => {
        if (k === n) { avaliar(atual.slice()); return; }
        for (const o of opcoes[k]) { atual[k] = o; rec(k + 1); }
      };
      rec(0);
    }

    function avaliar(f) {
      const tocadas = [];
      for (let k = 0; k < n; k++) if (f[k] != null) tocadas.push(k);
      if (tocadas.length < Math.min(inst.minCordas, n)) return;
      const frets = f.filter((x) => x != null && x > 0);
      if (frets.length) {
        const span = Math.max(...frets) - Math.min(...frets);
        if (span > inst.abertura - 1) return;
      }
      // notas soando
      const alturas = tocadas.map((k) => cordas[k] + f[k]);
      const pcs = new Set(alturas.map(mod12));
      for (const o of obrig) if (!pcs.has(o)) return;
      if (p.baixo != null && !pcs.has(p.baixo)) return;
      // nota mais grave precisa ser a fundamental (ou o baixo indicado)
      const grave = Math.min(...alturas);
      if (!quatroCordas || !inst.reentrante) {
        if (mod12(grave) !== baixoAlvo) {
          // em 4 cordas não reentrantes tolera inversão com penalidade
          if (!quatroCordas) return;
        }
      }
      const d = dedilhado(f);
      if (d.dedos > 4) return;

      // mudos: contar internos (entre cordas tocadas) e agudos
      const primeira = tocadas[0], ultima = tocadas[tocadas.length - 1];
      let mudosInternos = 0;
      for (let k = primeira; k <= ultima; k++) if (f[k] == null) mudosInternos++;
      const mudosAgudos = n - 1 - ultima;
      const mudosGraves = primeira;
      if (mudosInternos > 1 || mudosAgudos > 1) return;

      const minTraste = frets.length ? Math.min(...frets) : 0;
      const maxTraste = frets.length ? Math.max(...frets) : 0;
      const soltasAntes = f.filter((x) => x === 0).length;
      let pts = 0;
      pts += minTraste * 0.8 + maxTraste * 0.5;
      // corda solta junto com traste alto = esticada desconfortável
      if (soltasAntes && maxTraste >= 4) pts += 1 + (maxTraste - 3) * 2.5;
      pts += mudosGraves * 1.2 + mudosInternos * 5 + mudosAgudos * 3;
      pts += d.dedos * 0.6;
      if (d.pestana) pts += 2 + (d.pestana.ate - d.pestana.de < 2 ? 1 : 0);
      if (!pcs.has(mod12(p.raiz + 7)) && p.intervalos.has(7)) pts += 0.8;
      // inversão (só em 4 cordas não reentrantes)
      if (mod12(grave) !== baixoAlvo && !inst.reentrante) pts += 4;
      // cordas soltas em acorde aberto ajudam; em posição alta atrapalham
      const soltas = f.filter((x) => x === 0).length;
      if (minTraste <= 3) pts -= soltas * 0.3; else pts += soltas * 1.5;
      // prefere a nota mais aguda dentro do acorde sem repetir demais o mesmo traste
      pts -= tocadas.length * 0.4;

      const texto = formaParaTexto(f);
      const ant = resultados.get(texto);
      if (!ant || ant.pontuacao > pts) resultados.set(texto, { formas: f, texto, dedos: d.dedos, pestana: d.pestana, mapa: d.mapa, pontuacao: pts });
    }

    const lista = [...resultados.values()].sort((a, b) => a.pontuacao - b.pontuacao);
    cacheFormas.set(chave, lista);
    return lista.slice(0, limite);
  }

  /** Notas MIDI soando numa forma. */
  function notasDaForma(formas, instrumentoId = 'violao') {
    const inst = INSTRUMENTOS[instrumentoId];
    return formas.map((f, k) => (f == null ? null : inst.cordas[k] + f)).filter((x) => x != null);
  }

  /** Voicing simples para teclado: fundamental na oitava 3, resto acima. */
  function notasTeclado(nome) {
    const p = parse(nome);
    if (!p) return [];
    const raiz = 48 + p.raiz;
    const ivs = [...p.intervalos].sort((a, b) => a - b);
    const notas = ivs.map((iv) => raiz + iv);
    if (p.baixo != null && p.baixo !== p.raiz) notas.unshift(36 + p.baixo);
    return notas;
  }

  // ---------- Piano: formas (voicings) ----------
  // Texto de uma forma de teclado: notas MIDI separadas por "-" (ex. "45-57-60-64").
  const tecladoParaTexto = (teclas) => [...teclas].sort((a, b) => a - b).join('-');
  const textoParaTeclado = (t) => String(t || '').split(/[-\s,.]+/).map(Number).filter((n) => Number.isFinite(n) && n >= 21 && n <= 108);

  /**
   * Formas de piano: mão direita em posição fundamental e inversões, perto do
   * dó central; mão esquerda com a fundamental (ou o baixo da barra) uma oitava
   * abaixo. Também uma versão só com a mão direita.
   * Retorna [{ teclas:[midi], texto, rotulo }].
   */
  function gerarFormasTeclado(nomeOuParse, limite = 8) {
    const p = typeof nomeOuParse === 'string' ? parse(nomeOuParse) : nomeOuParse;
    if (!p) return [];
    // notas do acorde (sem repetir o baixo de barra que não pertence ao acorde)
    let ivs = [...p.intervalos].sort((a, b) => a - b);
    // acordes muito cheios: tira a 5ª justa da mão direita (é a primeira a sair no piano)
    if (ivs.length > 4 && ivs.includes(7) && !p.obrigatorios.has(7)) ivs = ivs.filter((x) => x !== 7);
    const pcs = ivs.map((iv) => mod12(p.raiz + iv));
    const baixoPc = p.baixo != null ? p.baixo : p.raiz;
    const baixo = 36 + mod12(baixoPc - 36) + (mod12(baixoPc) < 4 ? 12 : 0); // entre E2 e D#3
    const out = [], vistos = new Set();
    const nomesInv = ['posição fundamental', '1ª inversão', '2ª inversão', '3ª inversão', '4ª inversão'];
    for (let inv = 0; inv < pcs.length; inv++) {
      const ordem = pcs.slice(inv).concat(pcs.slice(0, inv));
      // primeira nota entre F3 (53) e E4 (64)
      let atual = 53 + mod12(ordem[0] - 53);
      const mao = [atual];
      for (let k = 1; k < ordem.length; k++) { atual = atual + 1 + mod12(ordem[k] - atual - 1); mao.push(atual); }
      const teclas = [baixo, ...mao];
      const texto = tecladoParaTexto(teclas);
      if (!vistos.has(texto)) { vistos.add(texto); out.push({ teclas, texto, rotulo: nomesInv[inv] || inv + 'ª inversão' }); }
    }
    // só mão direita, posição fundamental (com o baixo da barra embaixo, se houver)
    const so = out[0] ? out[0].teclas.slice(1) : [];
    if (p.baixo != null && p.baixo !== p.raiz) so.unshift(so[0] - 1 - mod12(so[0] - 1 - p.baixo));
    const t = tecladoParaTexto(so);
    if (so.length && !vistos.has(t)) out.push({ teclas: so, texto: t, rotulo: 'só mão direita' });
    return out.slice(0, limite);
  }

  /**
   * Acorde com nome padrão mais próximo das notas tocadas (quando reconhecer()
   * não acha nenhum). Pontua notas sobrando e notas obrigatórias faltando.
   * Retorna { nome, sobrando:[pc], faltando:[pc] } ou null.
   */
  function maisProximo(alturas, opcoes = {}) {
    if (!alturas || !alturas.length) return null;
    const pcs = new Set(alturas.map(mod12));
    const baixo = mod12(Math.min(...alturas));
    const bemol = !!opcoes.bemol;
    let melhor = null;
    for (let raiz = 0; raiz < 12; raiz++) {
      for (const mdl of MODELOS) {
        if (mdl.sufixo === '5') continue;
        const sobrando = [...pcs].filter((pc) => !mdl.intervalos.has(mod12(pc - raiz)) && pc !== baixo);
        const faltando = [...mdl.obrigatorios].filter((iv) => !pcs.has(mod12(raiz + iv))).map((iv) => mod12(raiz + iv));
        const baixoFora = !mdl.intervalos.has(mod12(baixo - raiz));
        let pts = sobrando.length * 1.6 + faltando.length * 1.4 + mdl.tamanho * 0.15;
        if (!pcs.has(raiz)) pts += 1.5;
        if (baixo !== raiz) pts += baixoFora ? 1.2 : 0.8;
        if (!melhor || pts < melhor.pts) {
          let nome = nomeNota(raiz, bemol) + mdl.sufixo;
          if (baixo !== raiz) nome += '/' + nomeNota(baixo, bemol);
          melhor = { nome, pts, sobrando, faltando };
        }
      }
    }
    return melhor && { nome: melhor.nome, sobrando: melhor.sobrando, faltando: melhor.faltando };
  }

  // ---------- Reconhecimento ----------
  // Sufixos usados para dar nome (estilo brasileiro, como nas cifras).
  const MODELOS = [
    '', 'm', '5', 'dim', '+', 'sus2', 'sus4', '6', 'm6', '7', 'm7', '7M', 'm7M', '°', 'm7(b5)',
    '7sus4', 'add9', 'm(add9)', '6(9)', 'm6(9)', '7(9)', 'm7(9)', '7M(9)', '7(b9)', '7(#9)', '7(#5)',
    '7(b5)', '7(13)', '7(b13)', 'm7(11)', '7(#11)', '7M(#11)', '7(9,13)', '7(b9,b13)', '7sus4(9)', 'm7M(9)',
  ].map((suf) => {
    const p = parse('C' + suf);
    return { sufixo: suf, intervalos: p.intervalos, obrigatorios: p.obrigatorios, tamanho: p.intervalos.size };
  });

  /**
   * Reconhece acordes a partir de notas MIDI (ou pitch classes) e do baixo.
   * Retorna [{nome, raiz, sufixo, faltando:[], pontuacao}] ordenado.
   */
  function reconhecer(alturas, opcoes = {}) {
    if (!alturas || !alturas.length) return [];
    const pcs = new Set(alturas.map(mod12));
    const baixo = mod12(Math.min(...alturas));
    const bemol = !!opcoes.bemol;
    const res = [];
    for (let raiz = 0; raiz < 12; raiz++) {
      const rel = new Set([...pcs].map((x) => mod12(x - raiz)));
      for (const mdl of MODELOS) {
        // todas as notas tocadas pertencem ao modelo (o baixo pode estar fora: vira barra)
        let fora = 0;
        for (const r of rel) if (!mdl.intervalos.has(r)) fora++;
        const baixoRel = mod12(baixo - raiz);
        const baixoFora = !mdl.intervalos.has(baixoRel);
        if (fora > (baixoFora ? 1 : 0)) continue;
        if (fora === 1 && !baixoFora) continue;
        if (fora === 1) {
          // o baixo fora do acorde só é aceito se aparecer apenas como baixo
          const outras = alturas.filter((a) => mod12(a) === baixo).length;
          if (outras > 1 && ![...alturas].every((a) => mod12(a) !== baixo || a === Math.min(...alturas))) continue;
        }
        const faltando = [...mdl.obrigatorios].filter((iv) => !rel.has(iv));
        if (faltando.length) continue;
        const faltaFundamental = !pcs.has(raiz);
        if (faltaFundamental) continue;
        const opcionaisFaltando = [...mdl.intervalos].filter((iv) => !rel.has(iv)).length;
        let pts = mdl.tamanho * 0.5 + opcionaisFaltando * 1.2;
        let nome = nomeNota(raiz, bemol) + mdl.sufixo;
        if (baixo !== raiz) { nome += '/' + nomeNota(baixo, bemol); pts += baixoFora ? 4 : 2.5; }
        if (mdl.sufixo === '5' && rel.size > 2) continue;
        res.push({ nome, raiz, sufixo: mdl.sufixo, pontuacao: pts });
      }
    }
    const vistos = new Set();
    return res.sort((a, b) => a.pontuacao - b.pontuacao).filter((x) => (vistos.has(x.nome) ? false : vistos.add(x.nome)));
  }

  function descreverIntervalos(nome) {
    const p = parse(nome);
    if (!p) return '';
    const NOMES = { 0: '1', 1: 'b9', 2: '9', 3: 'b3', 4: '3', 5: '4/11', 6: 'b5/#11', 7: '5', 8: '#5/b13', 9: '6/13', 10: 'b7', 11: '7M' };
    return [...p.intervalos].sort((a, b) => a - b).map((iv) => NOMES[iv]).join(' · ');
  }

  R.acordes = {
    SUSTENIDOS, BEMOIS, NOMES_PT, INSTRUMENTOS, TONS, MODELOS,
    mod12, notaParaPc, nomeNota, parse, ehAcorde, transporNome, tomPedeBemol,
    gerarFormas, notasDaForma, notasTeclado, reconhecer, dedilhado,
    formaParaTexto, textoParaForma, descreverIntervalos,
    gerarFormasTeclado, tecladoParaTexto, textoParaTeclado, maisProximo,
  };
})(window.Repertorio = window.Repertorio || {});
