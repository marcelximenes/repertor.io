/* Repertor.io — diagramas de acorde (SVG), teclado, braço clicável e som. */
(function (R) {
  'use strict';
  const A = R.acordes;
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs = {}, pai) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (pai) pai.appendChild(e);
    return e;
  }

  /**
   * Desenha um diagrama de acorde de cordas.
   * forma: { formas:[traste|null], mapa:[dedo], pestana }
   * opts: { casas: 5, largura: 110, editavel, onClick(corda, traste), inicio }
   */
  function desenharDiagrama(forma, instrumentoId = 'violao', opts = {}) {
    const inst = A.INSTRUMENTOS[instrumentoId];
    const n = inst.cordas.length;
    const casas = opts.casas || 5;
    const formas = forma ? forma.formas : new Array(n).fill(null);
    const tocadas = formas.filter((f) => f != null && f > 0);
    let inicio = opts.inicio;
    if (inicio == null) {
      const max = tocadas.length ? Math.max(...tocadas) : 0;
      const min = tocadas.length ? Math.min(...tocadas) : 1;
      inicio = max <= casas ? 1 : min;
    }
    const W = opts.largura || 110;
    const margemX = 18, topo = 26, base = 10;
    const passoX = (W - margemX * 2) / (n - 1);
    const xc = (k) => margemX + (opts.canhoto ? n - 1 - k : k) * passoX; // canhoto espelha as cordas
    const passoY = opts.passoY || 20;
    const H = topo + passoY * casas + base;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'diagrama' + (opts.editavel ? ' editavel' : ''), role: 'img' });
    svg.setAttribute('aria-label', opts.rotulo || 'Diagrama de acorde');

    // traste de início / pestana do instrumento (nut)
    if (inicio === 1) el('rect', { x: margemX - 1, y: topo - 4, width: passoX * (n - 1) + 2, height: 4, class: 'pestana-nut' }, svg);
    else el('text', { x: 2, y: topo + passoY * 0.65, class: 'diag-casa' }, svg).textContent = inicio + 'ª';

    for (let c = 0; c <= casas; c++) el('line', { x1: margemX, x2: margemX + passoX * (n - 1), y1: topo + c * passoY, y2: topo + c * passoY, class: 'diag-traste' }, svg);
    for (let k = 0; k < n; k++) el('line', { x1: margemX + k * passoX, x2: margemX + k * passoX, y1: topo, y2: topo + casas * passoY, class: 'diag-corda' }, svg);

    // X / O acima
    for (let k = 0; k < n; k++) {
      const x = xc(k), y = topo - 10;
      const f = formas[k];
      const g = el('g', { class: 'diag-topo' + (opts.editavel ? ' clicavel' : ''), 'data-corda': k }, svg);
      if (opts.editavel) el('rect', { x: x - passoX / 2, y: 0, width: passoX, height: topo - 3, class: 'alvo' }, g);
      if (f == null) {
        el('path', { d: `M${x - 3.5} ${y - 3.5} L${x + 3.5} ${y + 3.5} M${x + 3.5} ${y - 3.5} L${x - 3.5} ${y + 3.5}`, class: 'diag-x' }, g);
      } else if (f === 0) {
        el('circle', { cx: x, cy: y, r: 3.6, class: 'diag-o' }, g);
      }
      if (opts.editavel) g.addEventListener('click', () => opts.onClick && opts.onClick(k, f == null ? 0 : null));
    }

    // pestana (barra)
    if (forma && forma.pestana && !opts.editavel) {
      const { traste, de, ate } = forma.pestana;
      const lin = traste - inicio;
      if (lin >= 0 && lin < casas) {
        const y = topo + lin * passoY + passoY / 2;
        const x1 = Math.min(xc(de), xc(ate)), x2 = Math.max(xc(de), xc(ate));
        el('rect', { x: x1 - 6, y: y - 6, width: x2 - x1 + 12, height: 12, rx: 6, class: 'diag-barra' }, svg);
        const t = el('text', { x: xc(de), y: y + 3.5, class: 'diag-dedo' }, svg);
        t.textContent = '1';
      }
    }

    // pontos
    for (let k = 0; k < n; k++) {
      const f = formas[k];
      if (f == null || f === 0) continue;
      const lin = f - inicio;
      if (lin < 0 || lin >= casas) continue;
      const naBarra = forma && forma.pestana && !opts.editavel && f === forma.pestana.traste && k >= forma.pestana.de && k <= forma.pestana.ate;
      if (naBarra) continue;
      const x = xc(k), y = topo + lin * passoY + passoY / 2;
      el('circle', { cx: x, cy: y, r: 7, class: 'diag-ponto' }, svg);
      const dedo = forma && forma.mapa ? forma.mapa[k] : null;
      if (dedo && !opts.editavel) { const t = el('text', { x, y: y + 3.5, class: 'diag-dedo' }, svg); t.textContent = dedo; }
    }

    // áreas clicáveis do braço
    if (opts.editavel) {
      for (let k = 0; k < n; k++) for (let c = 0; c < casas; c++) {
        const traste = inicio + c;
        const r = el('rect', { x: xc(k) - passoX / 2, y: topo + c * passoY, width: passoX, height: passoY, class: 'alvo clicavel', 'data-corda': k, 'data-traste': traste }, svg);
        r.addEventListener('click', () => opts.onClick && opts.onClick(k, formas[k] === traste ? 0 : traste));
      }
    }

    // rótulos das cordas (embaixo, só no editor)
    if (opts.rotulosCordas) {
      svg.setAttribute('viewBox', `0 0 ${W} ${H + 12}`);
      for (let k = 0; k < n; k++) el('text', { x: xc(k), y: H + 8, class: 'diag-rotulo' }, svg).textContent = inst.rotulos[k];
    }
    return svg;
  }

  /**
   * Teclado com as notas do acorde destacadas e o nome de cada nota.
   * Mostra no mínimo 2 oitavas e cresce para caber todas as notas.
   * opts: { largura (por 2 oitavas), onClick(midi), rotulos (true), bemol, baixo (destaca a nota mais grave) }
   */
  function desenharTeclado(notasMidi, opts = {}) {
    const notas = [...notasMidi];
    const min = notas.length ? Math.min(...notas) : 48;
    const max = notas.length ? Math.max(...notas) : 71;
    let oitavaIni = Math.floor(min / 12) * 12;
    if (opts.inicio != null) oitavaIni = opts.inicio;
    const oitavas = Math.max(opts.oitavas || 2, Math.ceil((max + 1 - oitavaIni) / 12));
    const brancas = [0, 2, 4, 5, 7, 9, 11];
    const pretas = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 };
    const totalBrancas = oitavas * 7;
    const W = (opts.largura || 220) * oitavas / 2, H = 70;
    const bw = W / totalBrancas;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H + 1}`, class: 'diagrama teclado', role: 'img' });
    svg.setAttribute('aria-label', opts.rotulo || 'Teclado');
    const ativos = new Set(notas);
    const grave = notas.length > 1 && opts.baixo !== false ? min : null;
    const rot = opts.rotulos !== false;
    const nomeDe = (midi) => A.nomeNota(midi, opts.bemol);
    const marcar = (r, midi) => { if (opts.onClick) { r.classList.add('clicavel'); r.addEventListener('click', () => opts.onClick(midi)); } };
    for (let i = 0; i < totalBrancas; i++) {
      const midi = oitavaIni + Math.floor(i / 7) * 12 + brancas[i % 7];
      const r = el('rect', { x: i * bw + 0.5, y: 0.5, width: bw - 1, height: H, rx: 2, class: 'tecla-branca' + (ativos.has(midi) ? ' ativa' : '') + (midi === grave ? ' grave' : ''), 'data-midi': midi }, svg);
      marcar(r, midi);
      if (rot && ativos.has(midi)) el('text', { x: i * bw + bw / 2, y: H - 6, class: 'tecla-nome' }, svg).textContent = nomeDe(midi);
      else if (brancas[i % 7] === 0 && i === 0) el('text', { x: i * bw + bw / 2, y: H - 6, class: 'tecla-c' }, svg).textContent = 'C' + (Math.floor(midi / 12) - 1);
    }
    for (let o = 0; o < oitavas; o++) for (const pc in pretas) {
      const midi = oitavaIni + o * 12 + +pc;
      const x = (o * 7 + pretas[pc] + 1) * bw - bw * 0.3;
      const r = el('rect', { x, y: 0.5, width: bw * 0.6, height: H * 0.6, rx: 1.5, class: 'tecla-preta' + (ativos.has(midi) ? ' ativa' : '') + (midi === grave ? ' grave' : ''), 'data-midi': midi }, svg);
      marcar(r, midi);
      if (rot && ativos.has(midi)) { const t = el('text', { x: x + bw * 0.3, y: H * 0.6 - 4, class: 'tecla-nome preta' }, svg); t.textContent = nomeDe(midi); }
    }
    return svg;
  }

  // ---------- Som (Karplus-Strong) ----------
  let ctx = null;
  function audio() {
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function corda(ac, midi, quando, dur = 2.2) {
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const sr = ac.sampleRate, len = Math.floor(sr * dur);
    const buf = ac.createBuffer(1, len, sr), d = buf.getChannelData(0);
    const periodo = Math.max(2, Math.round(sr / freq));
    const linha = new Float32Array(periodo);
    for (let i = 0; i < periodo; i++) linha[i] = Math.random() * 2 - 1;
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const prox = (idx + 1) % periodo;
      const v = 0.996 * 0.5 * (linha[idx] + linha[prox]);
      d[i] = linha[idx]; linha[idx] = v; idx = prox;
    }
    const src = ac.createBufferSource(); src.buffer = buf;
    const g = ac.createGain(); g.gain.value = 0.22;
    src.connect(g).connect(ac.destination); src.start(quando);
  }
  function tocar(notasMidi, opts = {}) {
    const ac = audio(); if (!ac || !notasMidi.length) return;
    const t0 = ac.currentTime + 0.02;
    const passo = opts.junto ? 0 : 0.035;
    [...notasMidi].sort((a, b) => a - b).forEach((m, i) => corda(ac, m, t0 + i * passo));
  }

  R.diagrama = { desenharDiagrama, desenharTeclado, tocar, audio };
})(window.Repertorio = window.Repertorio || {});
