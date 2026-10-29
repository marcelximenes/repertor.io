/* Repertor.io — interface (rotas, telas e interações). */
(function (R) {
  'use strict';
  const A = R.acordes, D = R.dados, C = R.cifra, G = R.diagrama, IM = R.importar;
  const ic = (n, t) => R.icones.svg(n, t);
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const conteudo = $('#conteudo');

  const STATUS = { quero: 'Quero aprender', aprendendo: 'Aprendendo', repertorio: 'No repertório' };
  const INSTR_CORDAS = ['violao', 'ukulele', 'cavaquinho'];

  // ---------- utilidades de interface ----------
  let timerToast;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(timerToast); timerToast = setTimeout(() => (t.hidden = true), 2600);
  }
  function abrirModal(html, aoAbrir) {
    const m = $('#modal'); m.firstElementChild.innerHTML = html; m.hidden = false;
    if (aoAbrir) aoAbrir(m.firstElementChild);
  }
  function fecharModal() { const m = $('#modal'); m.hidden = true; m.firstElementChild.innerHTML = ''; }
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') fecharModal(); });

  function rota() {
    const h = location.hash.replace(/^#/, '') || '/';
    const [caminho, qs] = h.split('?');
    const partes = caminho.split('/').filter(Boolean);
    return { partes, q: new URLSearchParams(qs || '') };
  }
  function irPara(hash) { if (location.hash === hash) render(); else location.hash = hash; }

  function idYoutube(url) {
    const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/.exec(url || '');
    return m ? m[1] : null;
  }
  function inicioYoutube(url) {
    const m = /[?&#](?:t|start)=(\d+h)?(\d+m)?(\d+)s?/.exec(url || '');
    if (!m) return 0;
    return (parseInt(m[1]) || 0) * 3600 + (parseInt(m[2]) || 0) * 60 + (parseInt(m[3]) || 0);
  }

  // ---------- formas de acorde ----------
  const ehTeclado = (instr) => instr === 'teclado';
  /** Forma a partir do texto guardado: "x02210" (cordas) ou "45-57-60-64" (teclado). */
  function formaDeTexto(texto, instr) {
    if (ehTeclado(instr)) return { teclas: A.textoParaTeclado(texto), texto };
    const formas = A.textoParaForma(texto);
    const d = A.dedilhado(formas);
    return { formas, texto, dedos: d.dedos, pestana: d.pestana, mapa: d.mapa };
  }
  /** Lista de formas para um acorde: fixada na música > minhas formas > geradas. */
  function listaFormas(nome, instr, musica) {
    const lista = [], vistos = new Set();
    const add = (f, origem) => { if (f && !vistos.has(f.texto)) { vistos.add(f.texto); lista.push(Object.assign({ origem }, f)); } };
    const fixa = musica && musica.formas ? musica.formas[instr + ':' + nome] : null;
    if (fixa) add(formaDeTexto(fixa, instr), 'fixa');
    for (const t of D.formasPessoais(instr, nome)) add(formaDeTexto(t, instr), 'minha');
    if (ehTeclado(instr)) for (const f of A.gerarFormasTeclado(nome)) add(f, 'gerada');
    else for (const f of A.gerarFormas(nome, instr, 10)) add(f, 'gerada');
    return lista;
  }
  function notasDe(nome, instr, forma) {
    if (ehTeclado(instr)) return forma && forma.teclas ? forma.teclas : A.notasTeclado(nome);
    return forma ? A.notasDaForma(forma.formas, instr) : [];
  }
  function desenhar(nome, instr, forma, opts = {}) {
    const p = A.parse(nome);
    if (ehTeclado(instr)) return G.desenharTeclado(notasDe(nome, instr, forma), { largura: opts.largura || 180, bemol: p && p.bemol, rotulo: 'Teclado: ' + nome });
    return G.desenharDiagrama(forma, instr, Object.assign({ rotulo: 'Diagrama de ' + nome, canhoto: !!D.estado.config.canhoto }, opts));
  }
  const tocarForma = (nome, instr, forma) => G.tocar(notasDe(nome, instr, forma), { junto: ehTeclado(instr) });

  // ---------- barra lateral ----------
  function contagem(campo) {
    const mapa = new Map();
    for (const m of D.estado.musicas) {
      const vals = campo === 'tags' ? (m.tags || []) : [m[campo]];
      for (const v of vals) if (v) mapa.set(v, (mapa.get(v) || 0) + 1);
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }
  function renderSidebar() {
    const { partes, q } = rota();
    const nomeRota = ['nova', 'acordes', 'config', 'importar'].includes(partes[0]) ? partes[0] : 'biblioteca';
    $$('.sb-nav a').forEach((a) => a.classList.toggle('ativo', a.dataset.rota === nomeRota && (nomeRota !== 'biblioteca' || !partes.length)));
    const naBiblioteca = !partes.length;
    const grupo = (titulo, chave, itens, limite = 8) => {
      if (!itens.length) return '';
      const expandido = q.get('mais') === chave;
      const mostrar = expandido ? itens : itens.slice(0, limite);
      return `<div class="filtro-grupo"><h4>${titulo}</h4>${mostrar.map(([v, n]) => {
        const ativo = naBiblioteca && q.get(chave) === v;
        return `<button data-filtro="${chave}" data-valor="${esc(v)}" class="${ativo ? 'ativo' : ''}"><span>${esc(STATUS[v] || v)}</span><span class="n">${n}</span></button>`;
      }).join('')}${itens.length > limite && !expandido ? `<button class="mais" data-mais="${chave}">+ ${itens.length - limite} mais</button>` : ''}</div>`;
    };
    const status = Object.keys(STATUS).map((k) => [k, D.estado.musicas.filter((m) => m.status === k).length]).filter((x) => x[1]);
    const favs = D.estado.musicas.filter((m) => m.favorita).length;
    $('#sbFiltros').innerHTML =
      (favs ? `<div class="filtro-grupo"><button data-filtro="fav" data-valor="1" class="${naBiblioteca && q.get('fav') ? 'ativo' : ''}"><span>Favoritas</span><span class="n">${favs}</span></button></div>` : '') +
      grupo('Status', 'status', status) + grupo('Artistas', 'artista', contagem('artista')) +
      grupo('Gêneros', 'genero', contagem('genero')) + grupo('Tags', 'tag', contagem('tags'));
    renderStatusArquivo();
  }
  $('#sbFiltros').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const { partes, q } = rota();
    const nova = partes.length ? new URLSearchParams() : new URLSearchParams(q);
    if (b.dataset.mais) { nova.set('mais', b.dataset.mais); irPara('#/?' + nova); return; }
    const k = b.dataset.filtro, v = b.dataset.valor;
    if (nova.get(k) === v) nova.delete(k); else nova.set(k, v);
    irPara('#/' + (nova.toString() ? '?' + nova : ''));
  });
  function renderStatusArquivo() {
    const e = D.estado, el = $('#statusArquivo');
    if (e.arquivoStatus === 'ok') el.innerHTML = `<span class="ponto ok"></span>Salvando em <b>${esc(e.arquivo.name)}</b>`;
    else if (e.arquivoStatus === 'precisa-permissao') el.innerHTML = `<span class="ponto aviso"></span>Arquivo desconectado. <button class="btn peq" id="btnReconectar">Reconectar</button>`;
    else if (e.arquivoStatus === 'erro') el.innerHTML = `<span class="ponto aviso"></span>Erro ao salvar no arquivo. <a href="#/config">Ver</a>`;
    else el.innerHTML = `<span class="ponto"></span>Dados só neste navegador. <a href="#/config">Ligar a um arquivo</a>`;
    const b = $('#btnReconectar', el);
    if (b) b.onclick = async () => { if (await D.tentarReconectar(true)) toast('Arquivo reconectado'); };
  }

  // ---------- aparência: fontes, tamanhos, pesos e cores (Ajustes) ----------
  // Só fontes monoespaçadas com a mesma largura de letra (0,6 em): é o que mantém o acorde em cima da sílaba.
  const FONTES = {
    'IBM Plex Mono': null, // já vem no app.css
    'JetBrains Mono': 'JetBrains+Mono:wght@300;400;500;600;700',
    'Fira Mono': 'Fira+Mono:wght@400;500;700',
    'Source Code Pro': 'Source+Code+Pro:wght@300;400;500;600;700',
    'Roboto Mono': 'Roboto+Mono:wght@300;400;500;600;700',
    'Courier Prime': 'Courier+Prime:wght@400;700',
    'DejaVu Sans Mono': null, 'Liberation Mono': null,
  };
  const APAR_PADRAO = { fonteLetra: 'IBM Plex Mono', fonteAcorde: 'IBM Plex Mono', tamLetra: 15, pesoLetra: 400, tamAcorde: 100, pesoAcorde: 500, alturaLinha: 155 };
  const CORES = [['--bg-base', 'Fundo'], ['--surface', 'Cartões e painéis'], ['--text-primary', 'Texto'], ['--text-secondary', 'Texto secundário'], ['--brand', 'Destaque'], ['--acorde', 'Acordes'], ['--letra', 'Letra da cifra'], ['--tab', 'Tablatura'], ['--borda-menu', 'Contorno do menu']];
  function aparencia() {
    const a = Object.assign({}, APAR_PADRAO, D.estado.config.aparencia || {});
    a.cores = Object.assign({ escuro: {}, claro: {} }, (D.estado.config.aparencia || {}).cores || {});
    return a;
  }
  const temaAtual = () => (document.documentElement.getAttribute('data-theme') === 'light' ? 'claro' : 'escuro');
  function aplicarAparencia() {
    const a = aparencia(), st = document.documentElement.style;
    const pilha = (f) => `'${f}', 'IBM Plex Mono', ui-monospace, 'DejaVu Sans Mono', 'Liberation Mono', monospace`;
    st.setProperty('--fonte-letra', pilha(a.fonteLetra));
    st.setProperty('--fonte-acorde', pilha(a.fonteAcorde));
    st.setProperty('--tam-letra', a.tamLetra + 'px');
    st.setProperty('--peso-letra', a.pesoLetra);
    st.setProperty('--tam-acorde', a.tamAcorde / 100);
    st.setProperty('--peso-acorde', a.pesoAcorde);
    st.setProperty('--altura-linha', a.alturaLinha / 100);
    for (const [v] of CORES) st.removeProperty(v);
    const cs = a.cores[temaAtual()] || {};
    for (const k in cs) if (cs[k]) st.setProperty(k, cs[k]);
    // fontes da internet (Google Fonts); sem internet, cai na próxima da lista
    const pedidas = [...new Set([a.fonteLetra, a.fonteAcorde])].filter((f) => FONTES[f]);
    let link = document.getElementById('fontesExtras');
    if (pedidas.length) {
      const href = 'https://fonts.googleapis.com/css2?' + pedidas.map((f) => 'family=' + FONTES[f]).join('&') + '&display=swap';
      if (!link) { link = document.createElement('link'); link.rel = 'stylesheet'; link.id = 'fontesExtras'; document.head.appendChild(link); }
      if (link.getAttribute('href') !== href) link.setAttribute('href', href);
    } else if (link) link.remove();
  }
  /** Cor atual de uma variável, em #rrggbb (para o seletor de cor). */
  function corAtual(variavel) {
    const t = document.createElement('span'); t.style.color = `var(${variavel})`; t.hidden = true; document.body.appendChild(t);
    const rgb = getComputedStyle(t).color; t.remove();
    const m = rgb.match(/[\d.]+/g) || [0, 0, 0];
    return '#' + m.slice(0, 3).map((x) => Math.round(+x).toString(16).padStart(2, '0')).join('');
  }

  // ---------- tema e menu ----------
  function aplicarTema() {
    const t = D.estado.config.tema || 'escuro';
    const claro = t === 'claro' || (t === 'auto' && matchMedia('(prefers-color-scheme: light)').matches);
    if (claro) document.documentElement.setAttribute('data-theme', 'light'); else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('repertorio:tema', t); } catch (e) { /* sem armazenamento */ }
    aplicarAparencia();
    const b = $('#temaBtn'); b.innerHTML = ic(claro ? 'moon' : 'sun'); b.title = 'Tema: ' + t + ' (clique para trocar)';
  }
  $('#temaBtn').onclick = () => {
    const ordem = ['escuro', 'claro', 'auto'];
    const t = ordem[(ordem.indexOf(D.estado.config.tema || 'escuro') + 1) % 3];
    D.salvarConfig({ tema: t }).then(aplicarTema);
  };
  const shell = $('#shell');
  const fecharMenu = () => shell.removeAttribute('data-menu');
  $('#menuBtn').onclick = () => shell.setAttribute('data-menu', 'aberto');
  $('#scrim').onclick = fecharMenu;
  $('#sidebar').addEventListener('click', (e) => { if (e.target.closest('a,button[data-filtro]')) fecharMenu(); });
  // menu recolhível (no computador vira um trilho só de ícones; lembrado neste navegador)
  const recolher = $('#recolherBtn');
  const menuMini = () => document.documentElement.getAttribute('data-menu') === 'mini';
  const aplicarMenu = () => { const t = menuMini() ? 'Expandir menu' : 'Recolher menu'; recolher.title = t; recolher.setAttribute('aria-label', t); recolher.setAttribute('aria-expanded', String(!menuMini())); };
  recolher.onclick = (e) => {
    e.stopPropagation();
    if (menuMini()) document.documentElement.removeAttribute('data-menu'); else document.documentElement.setAttribute('data-menu', 'mini');
    try { localStorage.setItem('repertorio:menu', menuMini() ? 'mini' : ''); } catch (err) { /* sem armazenamento */ }
    aplicarMenu();
    if (painelAberto) posicionarPainel(painelAberto);
  };
  aplicarMenu();

  // =====================================================================
  // BIBLIOTECA
  // =====================================================================
  function normalizar(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function viewBiblioteca(q) {
    const busca = q.get('q') || '';
    const ordem = q.get('ordem') || 'recentes';
    let lista = D.estado.musicas.slice();
    const filtros = [];
    if (q.get('artista')) { lista = lista.filter((m) => m.artista === q.get('artista')); filtros.push(['artista', q.get('artista')]); }
    if (q.get('genero')) { lista = lista.filter((m) => m.genero === q.get('genero')); filtros.push(['genero', q.get('genero')]); }
    if (q.get('tag')) { lista = lista.filter((m) => (m.tags || []).includes(q.get('tag'))); filtros.push(['tag', q.get('tag')]); }
    if (q.get('status')) { lista = lista.filter((m) => m.status === q.get('status')); filtros.push(['status', STATUS[q.get('status')]]); }
    if (q.get('fav')) { lista = lista.filter((m) => m.favorita); filtros.push(['fav', 'Favoritas']); }
    if (busca) {
      const b = normalizar(busca);
      lista = lista.filter((m) => normalizar([m.titulo, m.artista, m.genero, (m.tags || []).join(' '), m.cifra].join(' ')).includes(b));
    }
    const cmp = {
      recentes: (a, b) => (b.abertaEm || b.atualizadoEm || '').localeCompare(a.abertaEm || a.atualizadoEm || ''),
      titulo: (a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'),
      artista: (a, b) => a.artista.localeCompare(b.artista, 'pt-BR') || a.titulo.localeCompare(b.titulo, 'pt-BR'),
      criadas: (a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''),
    }[ordem];
    lista.sort(cmp);
    const total = D.estado.musicas.length;

    conteudo.innerHTML = `
      <div class="cabeca"><div><div class="page-title">Biblioteca</div><div class="sub-titulo" style="margin-bottom:0">${total} ${total === 1 ? 'música' : 'músicas'}</div></div>
        <div class="acoes"><a class="btn ghost" href="#/importar">${ic('paste', 16)}Importar</a><a class="btn prim" href="#/nova">${ic('plus', 16)}Nova</a></div></div>
      <div class="barra-busca">
        <div class="busca">${ic('search', 18).replace('class="icone"', 'class="icone ic"')}<input type="search" id="busca" placeholder="Título, artista, gênero, tag ou trecho da letra" value="${esc(busca)}"></div>
        <select id="ordem" aria-label="Ordenar">
          ${[['recentes', 'Abertas recentemente'], ['titulo', 'Título (A–Z)'], ['artista', 'Artista'], ['criadas', 'Adicionadas por último']].map(([v, t]) => `<option value="${v}" ${v === ordem ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      ${filtros.length ? `<div class="filtros-ativos">${filtros.map(([k, v]) => `<button class="chip" data-tira="${k}">${esc(v)} ${ic('x', 13)}</button>`).join('')}</div>` : ''}
      ${lista.length ? `<div class="lista">${lista.map(itemHtml).join('')}</div>` :
        `<div class="vazio">${total ? 'Nada encontrado com esses filtros.' : 'Sua biblioteca está vazia. <a href="#/nova">Adicione a primeira música</a>.'}</div>`}`;

    const atualizarQ = (k, v) => { const n = new URLSearchParams(q); if (v) n.set(k, v); else n.delete(k); history.replaceState(null, '', '#/' + (n.toString() ? '?' + n : '')); };
    let t;
    $('#busca').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { atualizarQ('q', e.target.value); render({ manterFoco: true }); }, 200); });
    $('#ordem').onchange = (e) => { atualizarQ('ordem', e.target.value === 'recentes' ? '' : e.target.value); render(); };
    $$('[data-tira]').forEach((b) => (b.onclick = () => { const n = new URLSearchParams(q); n.delete(b.dataset.tira); irPara('#/' + (n.toString() ? '?' + n : '')); }));
  }
  function itemHtml(m) {
    const tom = m.tom || C.primeiroAcorde(m.cifra) || '';
    const sub = [m.artista, m.genero].filter(Boolean).map(esc).join(' · ');
    return `<a class="item" href="#/m/${m.id}">
      <div class="item__tom" title="Tom">${esc(tom) || '—'}</div>
      <div class="item__corpo"><div class="titulo">${esc(m.titulo || 'Sem título')}</div><div class="sub">${sub || '&nbsp;'}</div></div>
      <div class="meta">${m.favorita ? `<span class="fav" title="Favorita">${ic('star', 16)}</span>` : ''}${(m.videos || []).length ? `<span title="Tem vídeo">${ic('video', 16)}</span>` : ''}<span class="status-badge ${m.status}">${STATUS[m.status] || ''}</span></div></a>`;
  }

  // =====================================================================
  // MÚSICA — leitura, com trilho de ferramentas no estilo do Cifra Club
  // =====================================================================
  let rolagem = { ativa: false, vel: 4, raf: null, ultimo: 0, acc: 0 };
  function atualizarRolagemUI() {
    const b = $('#trilho [data-painel="rolagem"]'); if (b) b.classList.toggle('marcado', rolagem.ativa);
    const p = $('#rolPlay'); if (p) { p.innerHTML = ic(rolagem.ativa ? 'pause' : 'play', 16) + (rolagem.ativa ? 'Pausar' : 'Iniciar'); p.classList.toggle('prim', rolagem.ativa); }
  }
  function pararRolagem() { rolagem.ativa = false; cancelAnimationFrame(rolagem.raf); atualizarRolagemUI(); }
  function iniciarRolagem() { rolagem.ativa = true; rolagem.ultimo = 0; rolagem.acc = 0; rolagem.raf = requestAnimationFrame(passoRolagem); atualizarRolagemUI(); }
  function passoRolagem(ts) {
    if (!rolagem.ativa) return;
    if (rolagem.ultimo) {
      rolagem.acc += ((ts - rolagem.ultimo) / 1000) * rolagem.vel * 9;
      const px = Math.floor(rolagem.acc);
      if (px) { window.scrollBy(0, px); rolagem.acc -= px; }
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) { pararRolagem(); return; }
    }
    rolagem.ultimo = ts;
    rolagem.raf = requestAnimationFrame(passoRolagem);
  }

  // afinação de leitura: quantos semitons abaixo o instrumento está afinado
  const AFINACOES = [[0, 'Padrão'], [1, '½ tom abaixo'], [2, '1 tom abaixo'], [3, '1 tom e ½ abaixo'], [4, '2 tons abaixo']];
  // ---------- layout em blocos (como um gerenciador de janelas lado a lado) ----------
  // Colunas lado a lado; cada coluna empilha blocos. A coluna da cifra estica, as outras têm largura fixa.
  const BLOCOS = { cifra: 'Cifra', menu: 'Menu da cifra', acordes: 'Acordes', videos: 'Vídeos', notas: 'Notas' };
  const LAYOUT_PADRAO = () => ({ colunas: [{ blocos: ['cifra'] }, { largura: 320, blocos: ['acordes', 'videos', 'notas'] }, { blocos: ['menu'] }], ocultos: [], alturas: {} });
  function normalizarLayout(l) {
    l.colunas = (l.colunas || []).map((c) => ({ largura: Number(c.largura) || null, esticar: typeof c.esticar === 'boolean' ? c.esticar : undefined, blocos: (c.blocos || []).filter((b) => BLOCOS[b]) }));
    // página: distribuição das colunas, alinhamento vertical, espaço entre colunas e margem lateral
    if (!JUSTIFICAR[l.justificar]) l.justificar = 'flex-start';
    if (!ALINHAR[l.alinhar]) l.alinhar = 'flex-start';
    l.espaco = Number.isFinite(+l.espaco) && l.espaco !== null ? Math.max(0, Math.min(120, +l.espaco)) : 24;
    l.margem = Number.isFinite(+l.margem) && l.margem !== null ? Math.max(0, Math.min(400, +l.margem)) : 32;
    l.ocultos = [...new Set((l.ocultos || []).filter((b) => BLOCOS[b] && b !== 'cifra' && b !== 'menu'))];
    l.alturas = l.alturas || {};
    const vistos = new Set();
    for (const c of l.colunas) c.blocos = c.blocos.filter((b) => !vistos.has(b) && !l.ocultos.includes(b) && vistos.add(b));
    l.colunas = l.colunas.filter((c) => c.blocos.length);
    for (const b of Object.keys(BLOCOS)) if (!vistos.has(b) && !l.ocultos.includes(b)) colocarBloco(l, b);
    return l;
  }
  /** Põe um bloco solto numa coluna lateral (que não seja a da cifra nem só do menu); se não houver, cria uma. */
  function colocarBloco(l, b) {
    if (b === 'cifra') { l.colunas.unshift({ blocos: ['cifra'] }); return; }
    const col = l.colunas.find((c) => !c.blocos.includes('cifra') && !(c.blocos.length === 1 && c.blocos[0] === 'menu'));
    if (col) b === 'acordes' ? col.blocos.unshift(b) : col.blocos.push(b);
    else { const i = l.colunas.findIndex((c) => c.blocos.includes('cifra')); l.colunas.splice(i + 1, 0, { largura: b === 'menu' ? null : 320, blocos: [b] }); }
  }
  function lerLayout() {
    const cfg = D.estado.config;
    const l = cfg.layout ? JSON.parse(JSON.stringify(cfg.layout)) : LAYOUT_PADRAO();
    if (!cfg.layout && (cfg.mostrarDiagramas === false || cfg.diagPos === 'oculto')) l.ocultos.push('acordes');
    return normalizarLayout(l);
  }
  const salvarLayout = (l) => D.salvarConfig({ layout: normalizarLayout(l) });
  const soMenu = (c) => c.blocos.length === 1 && c.blocos[0] === 'menu';
  const JUSTIFICAR = { 'flex-start': 'Início', center: 'Centro', 'flex-end': 'Fim', 'space-between': 'Espaço entre', 'space-around': 'Espaço ao redor', 'space-evenly': 'Espaço igual' };
  const ALINHAR = { 'flex-start': 'Topo', center: 'Meio', 'flex-end': 'Base', stretch: 'Esticar' };
  // a coluna estica para ocupar o espaço livre? padrão: só a da cifra
  const esticaCol = (c) => (typeof c.esticar === 'boolean' ? c.esticar : c.blocos.includes('cifra'));
  const minCol = (c) => (soMenu(c) ? 64 : c.blocos.includes('cifra') ? 280 : 140);
  const larguraCol = (c) => Math.max(minCol(c), c.largura || (soMenu(c) ? 64 : c.blocos.includes('cifra') ? 760 : 300));
  let editandoLayout = false;
  const numColunas = () => { const c = D.estado.config.colunas; return c === true ? 2 : Number(c) || 0; };

  function estadoVisual(m) {
    const v = Object.assign({ semitons: 0, capo: Number(m.capo) || 0, afinacao: 0, instrumento: D.estado.config.instrumento || 'violao' }, m.visual || {});
    const teclado = ehTeclado(v.instrumento);
    const tomBase = m.tom || C.primeiroAcorde(m.cifra) || '';
    const tomSoando = tomBase ? A.transporNome(tomBase, v.semitons, v.semitons ? A.tomPedeBemol(A.transporNome(tomBase, v.semitons)) : undefined) : '';
    // o que se lê na cifra: no teclado, o acorde como soa; nas cordas, a forma com capo e afinação
    const deslocamento = teclado ? v.semitons : v.semitons - v.capo + v.afinacao;
    // sustenido ou bemol segue o tom que aparece na tela (o da forma, com capo)
    const tomForma = tomBase ? A.transporNome(tomBase, deslocamento, deslocamento ? A.tomPedeBemol(A.transporNome(tomBase, deslocamento)) : undefined) : '';
    const bemol = tomForma ? A.tomPedeBemol(tomForma) : undefined;
    return { v, teclado, tomBase, tomSoando, tomForma, bemol, deslocamento };
  }

  async function salvarVisual(m, parcial) {
    m.visual = Object.assign({}, m.visual || {}, parcial);
    await D.salvarMusica(m, { silencioso: true, tocarData: false });
  }

  let painelAberto = null;
  function viewMusica(id, opts = {}) {
    const m = D.estado.musicas.find((x) => x.id === id);
    if (!m) { conteudo.innerHTML = '<div class="vazio">Música não encontrada. <a href="#/">Voltar</a></div>'; return; }
    conteudo.onkeydown = null;
    if (opts.abrir) {
      m.abertaEm = new Date().toISOString(); D.salvarMusica(m, { silencioso: true, tocarData: false }); painelAberto = null;
      if (!metro.ativo) { const b = parseInt(m.bpm, 10); metro.bpm = b >= 30 && b <= 260 ? b : 100; }
    }
    const cfg = D.estado.config;
    const ev = estadoVisual(m);
    const { v } = ev;
    const videos = (m.videos || []).filter((x) => x.url);
    const colunas = numColunas();
    const modo = cfg.modo === 'letra' ? 'letra' : 'cifra';
    const layout = lerLayout();
    if (matchMedia('(max-width:700px)').matches) editandoLayout = false;
    // trilho: [id, ícone, rótulo, marcado (fora do padrão)]
    const grupos = [
      [['rolagem', 'scroll', 'Rolagem', rolagem.ativa], ['colunas', 'columns', 'Dividir em colunas', colunas > 0]],
      [['diagramas', 'grid', 'Diagramas', false], ['tom', 'tom', 'Tom', v.semitons !== 0], ['capo', 'capo', 'Capotraste', !ev.teclado && v.capo > 0], ['afinacao', 'tuning', 'Afinação', !ev.teclado && v.afinacao > 0]],
      [['modo', modo === 'letra' ? 'music' : 'letra', modo === 'letra' ? 'Mostrar a cifra' : 'Mostrar só a letra', modo === 'letra'], ['tabs', 'tab', 'Tablaturas', cfg.mostrarTabs === false], ['texto', 'type', 'Texto', (cfg.tamanhoFonte || 100) !== 100]],
      [['live', 'live', 'Live: acordes no tempo do vídeo', !!live.modo], ['palco', 'slides', 'Modo palco (slides)', false], ['metronomo', 'metronome', 'Metrônomo', metro.ativo], ['afinador', 'tuner', 'Afinador', afin.ativo]],
    ];
    // valor pequeno no botão (tom atual, casa do capo)
    const valores = { tom: ev.tomSoando, capo: !ev.teclado && v.capo ? v.capo + 'ª' : '', metronomo: metro.ativo ? metro.bpm : '', live: live.modo === 'gravar' ? 'REC' : live.modo === 'tocar' ? 'ON' : '' };
    const tb = ([pid, icone, rot, marcado]) => {
      const val = valores[pid] ? `<span class="tb__val">${esc(valores[pid])}</span>` : '';
      const acao = pid === 'modo' || pid === 'palco';
      const quem = acao ? `id="tb${pid === 'modo' ? 'Modo' : 'Palco'}" aria-pressed="${marcado}"` : `data-painel="${pid}" aria-expanded="false"`;
      return `<button class="tb${marcado && !acao ? ' marcado' : ''}${val ? ' com-val' : ''}" ${quem} aria-label="${rot}">${ic(icone, 20)}${val}<span class="tb__dica">${rot}${pid === 'tom' && ev.tomSoando ? ': ' + esc(ev.tomSoando) : ''}</span></button>`;
    };
    const trilho = `<nav class="trilho" id="trilho" aria-label="Ferramentas da cifra">
        <div class="trilho__grupo trilho__opcoes">
          <button class="tb" id="tbOpcoes" aria-label="Opções" aria-expanded="false">${ic('more', 20)}<span class="tb__dica">Opções</span></button>
          <div class="trilho__mais" id="trilhoMais" hidden>
            <button class="tb" id="btnFav" aria-pressed="${!!m.favorita}" aria-label="Favorita">${ic('star', 18)}<span class="tb__dica">${m.favorita ? 'Tirar das favoritas' : 'Favoritar'}</span></button>
            <button class="tb" id="btnTxt" aria-label="Baixar cifra">${ic('download', 18)}<span class="tb__dica">Baixar cifra</span></button>
            <button class="tb" id="btnPrint" aria-label="Imprimir">${ic('printer', 18)}<span class="tb__dica">Imprimir</span></button>
            <button class="tb so-desktop" id="btnLayout" aria-label="Personalizar layout">${ic('layout', 18)}<span class="tb__dica">Personalizar layout</span></button>
          </div>
          <a class="tb" href="#/m/${m.id}/editar" aria-label="Editar informações">${ic('file', 20)}<span class="tb__dica">Editar informações</span></a>
        </div>
        ${grupos.map((g) => `<div class="trilho__grupo">${g.map(tb).join('')}</div>`).join('')}
        <div class="trilho__grupo"><button class="tb" id="tbRestaurar" aria-label="Restaurar padrões">${ic('rotate', 20)}<span class="tb__dica">Restaurar padrões</span></button></div>
      </nav>`;

    const editandoAcordes = edAc.ativo && edAc.musica === m.id;
    const cifraHtml = editandoAcordes ? '' : C.renderizar(m.cifra, { semitons: ev.deslocamento, bemol: ev.bemol, mostrarTabs: cfg.mostrarTabs !== false, somenteLetra: modo === 'letra', partes: true });
    const conteudoBloco = {
      menu: trilho,
      cifra: `<header class="cifra-cabeca">
            <div class="cifra-cabeca__txt"><h1>${esc(m.titulo || 'Sem título')}</h1>
              ${m.artista ? `<a class="cifra-artista" href="#/?artista=${encodeURIComponent(m.artista)}">${esc(m.artista)}</a>` : ''}</div>
            <div class="acoes"><button class="btn ghost peq quad so-desktop" id="btnLayout2" title="Personalizar layout" aria-label="Personalizar layout" aria-pressed="${editandoLayout}">${ic('layout', 15)}</button><button class="btn peq${editandoAcordes ? ' prim' : ' ghost'}" id="btnPosicionar" aria-pressed="${editandoAcordes}" title="${editandoAcordes ? 'Sair da edição' : 'Pôr, arrastar e tirar acordes na letra'}">${ic(editandoAcordes ? 'check' : 'pencil', 14)}${editandoAcordes ? 'Concluir' : 'Editar'}</button></div>
          </header>
          ${editandoAcordes ? `<div class="cifra cifra--edicao${colunas ? ' colunas c' + colunas : ''}" id="cifraEd" style="--escala:${(cfg.tamanhoFonte || 100) / 100}"></div>` : ''}
          <div class="cifra${colunas ? ' colunas c' + colunas : ''}" id="cifra" style="--escala:${(cfg.tamanhoFonte || 100) / 100}"${editandoAcordes ? ' hidden' : ''}>${cifraHtml || (editandoAcordes ? '' : '<span class="mut">Sem cifra ainda. Clique em Editar para pôr acordes, ou em Editar informações (no menu) para escrever a letra.</span>')}</div>`,
      acordes: editandoAcordes ? '<div class="ed-paleta" id="edPaleta"></div>' : '<div class="bloco-acordes" id="blocoAcordes"></div>',
      videos: htmlVideos(videos),
      notas: m.notas || m.fonte ? `<div class="bloco"><h3>Notas</h3>${m.fonte ? `<p class="nota-texto"><b>Fonte:</b> ${esc(m.fonte)}</p>` : ''}${m.notas ? `<p class="nota-texto">${esc(m.notas)}</p>` : ''}</div>` : '',
    };
    const vazio = { videos: 'Sem vídeos nesta música.', notas: 'Sem notas nesta música.', acordes: 'Sem acordes na cifra.' };
    const sep = (i) => (editandoLayout ? `<div class="tile-sep redim" data-i="${i}" title="Arraste para os lados para mudar a largura · solte um bloco aqui para criar coluna"></div>` : '');
    const tile = (b) => {
      const h = layout.alturas[b];
      const corpo = conteudoBloco[b] || (editandoLayout ? `<p class="dica tile__vazio">${vazio[b] || ''}</p>` : '');
      if (!corpo) return '';
      return `<section class="tile tile--${b}" data-bloco="${b}"${h && b !== 'cifra' && b !== 'menu' ? ` style="height:${h}px"` : ''}>
        ${editandoLayout ? `<div class="tile__cab" draggable="true" data-arrasta="${b}" title="Arraste para mudar de lugar">${ic('grip', 14)}<span>${BLOCOS[b]}</span>${b !== 'cifra' && b !== 'menu' ? `<button class="tile__ocultar" data-ocultar="${b}" title="Ocultar bloco" aria-label="Ocultar ${BLOCOS[b]}">${ic('x', 13)}</button>` : ''}</div>` : ''}
        <div class="tile__corpo">${corpo}</div>
        ${editandoLayout && b !== 'cifra' && b !== 'menu' ? `<div class="tile__alt" data-alt="${b}" title="Arraste para mudar a altura · dois cliques volta ao automático"></div>` : ''}</section>`;
    };
    const colHtml = (c, i) => {
      const w = larguraCol(c), temCifra = c.blocos.includes('cifra');
      const tiles = c.blocos.map(tile).join('');
      if (!tiles) return '';
      const estica = esticaCol(c);
      const estilo = estica ? `flex:1 1 ${c.largura || 0}px;min-width:${minCol(c)}px` : `flex:0 1 ${w}px;width:${w}px;min-width:${minCol(c)}px`;
      const barra = editandoLayout ? `<div class="col-barra"><button class="col-barra__btn" data-esticar="${i}" aria-pressed="${estica}" title="${estica ? 'Esta coluna ocupa o espaço livre. Clique para fixar a largura' : 'Largura fixa. Clique para ocupar o espaço livre'}">${ic('stretch', 13)}${estica ? 'Estica' : 'Fixa'}</button>
          <label class="col-barra__w" title="Largura em pixels">${estica ? '<span class="mut">auto</span>' : `<input type="number" min="${minCol(c)}" max="2400" step="10" value="${w}" data-largura="${i}" aria-label="Largura da coluna">px`}</label></div>` : '';
      return `<div class="tile-col${temCifra ? ' tem-cifra' : ' fixa'}${c.blocos.includes('menu') ? ' tem-menu' : ''}${estica ? ' estica' : ''}" data-col="${i}" style="${estilo}">${barra}${tiles}</div>`;
    };
    const guardados = guardarVideos(id);
    conteudo.innerHTML = `
      ${editandoLayout ? `<div class="layout-barra">${ic('layout', 16)}<span class="layout-barra__txt">Arraste os blocos pelo título para trocar de lugar, ou solte numa faixa entre colunas para criar outra. Arraste as divisórias para a largura e a borda de baixo de um bloco para a altura.</span>
        ${layout.ocultos.length ? `<span class="layout-ocultos">Ocultos: ${layout.ocultos.map((b) => `<button class="chip" data-mostrar="${b}">${ic('plus', 12)}${BLOCOS[b]}</button>`).join('')}</span>` : ''}
        <button class="btn peq ghost" id="layoutPadrao">Restaurar layout</button><button class="btn peq prim" id="layoutOk">${ic('check', 14)}Concluir</button>
        <div class="layout-ctrl">
          <div class="layout-ctrl__g"><span class="rotulo">Distribuir colunas</span><div class="seg">${Object.entries(JUSTIFICAR).map(([k, t]) => `<button data-lj="${k}" aria-pressed="${layout.justificar === k}">${t}</button>`).join('')}</div></div>
          <div class="layout-ctrl__g"><span class="rotulo">Alinhar na vertical</span><div class="seg">${Object.entries(ALINHAR).map(([k, t]) => `<button data-la="${k}" aria-pressed="${layout.alinhar === k}">${t}</button>`).join('')}</div></div>
          <div class="layout-ctrl__g"><span class="rotulo">Espaço entre colunas</span><div class="passo-mini"><button data-lgap="-8" aria-label="Menos espaço">−</button><span>${layout.espaco}px</span><button data-lgap="8" aria-label="Mais espaço">+</button></div></div>
          <div class="layout-ctrl__g"><span class="rotulo">Margem nas laterais</span><div class="passo-mini"><button data-lmar="-16" aria-label="Menos margem">−</button><span>${layout.margem}px</span><button data-lmar="16" aria-label="Mais margem">+</button></div></div>
          ${layout.colunas.some(esticaCol) ? '<p class="dica layout-ctrl__dica">"Distribuir" só aparece quando sobra espaço: deixe todas as colunas como <b>Fixa</b> para usar Centro, Fim ou Espaço entre.</p>' : ''}
        </div></div>` : ''}
      <div class="tiles${editandoLayout ? ' editando' : ''}" id="tiles" style="justify-content:${layout.justificar};align-items:${layout.alinhar};--tiles-gap:${layout.espaco}px">${sep(0)}${layout.colunas.map((c, i) => colHtml(c, i) + sep(i + 1)).join('')}</div>`;

    devolverVideos(guardados);
    conteudo.classList.add('largo');
    conteudo.style.setProperty('--margem-pagina', layout.margem + 'px');
    const redesenhar = () => viewMusica(id);
    const ba = $('#blocoAcordes');
    if (ba && !renderDiagramas(ba, m, ev, redesenhar)) {
      if (editandoLayout) ba.innerHTML = `<p class="dica tile__vazio">${vazio.acordes}</p>`; else ba.closest('.tile').remove();
    }
    $$('.tile-col').forEach((c) => { if (!c.children.length) c.remove(); });
    // editando acordes com o bloco Acordes oculto: a lista aparece numa coluna flutuante à direita
    if (editandoAcordes && !$('#edPaleta')) conteudo.insertAdjacentHTML('beforeend', '<aside class="ed-paleta flutuante" id="edPaleta"></aside>');
    // menu do lado direito da tela: dicas e painéis abrem para a esquerda
    const tr = $('#trilho');
    if (tr) {
      const colMenu = layout.colunas.find((c) => c.blocos.includes('menu'));
      tr.classList.toggle('horizontal', !soMenu(colMenu)); // dividindo coluna com outros blocos, o menu fica em linha
      tr.classList.toggle('lado-dir', tr.getBoundingClientRect().left > window.innerWidth / 2);
      const rc = ($('#cifraEd:not([hidden])') || $('#cifra')).getBoundingClientRect(), rt = tr.getBoundingClientRect();
      const menuDireita = rt.left >= rc.right - 1;
      // sem espaço do lado de fora (beira da tela), a dica vai para dentro
      const cabeFora = menuDireita ? window.innerWidth - rt.right > 170 : rt.left > 170;
      tr.classList.toggle('dica-fora-dir', menuDireita && cabeFora);
      tr.classList.toggle('dica-fora-esq', !menuDireita && cabeFora);
      // encostado na beira da tela: a dica sobe e fica alinhada com a beira de fora (não cobre a letra)
      tr.classList.toggle('dica-cima-dir', menuDireita && !cabeFora);
      tr.classList.toggle('dica-cima-esq', !menuDireita && !cabeFora);
    }
    ligarLayout(layout, redesenhar);
    const alternarLayout = () => { editandoLayout = !editandoLayout; fecharPainel(); redesenhar(); };
    $('#btnLayout').onclick = alternarLayout;
    $('#btnLayout2').onclick = alternarLayout;

    // trilho
    // trilho
    $$('#trilho [data-painel]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); painelAberto === b.dataset.painel ? fecharPainel() : abrirPainel(b.dataset.painel, m); }));
    $$('[data-abre-painel]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); abrirPainel(b.dataset.abrePainel, m); }));
    $('#tbOpcoes').onclick = (e) => { e.stopPropagation(); const mais = $('#trilhoMais'); mais.hidden = !mais.hidden; e.currentTarget.setAttribute('aria-expanded', String(!mais.hidden)); };
    $('#tbRestaurar').onclick = async () => {
      fecharPainel(); pararRolagem();
      await salvarVisual(m, { semitons: 0, capo: Number(m.capo) || 0, afinacao: 0 });
      await D.salvarConfig({ tamanhoFonte: 100, colunas: 0, mostrarTabs: true, mostrarDiagramas: true, diagPos: 'lateral', diagTam: 100, modo: 'cifra' });
      toast('Padrões restaurados'); redesenhar();
    };
    const alternarEdicao = () => { edAc.ativo = !editandoAcordes; edAc.musica = m.id; edAc.sel = null; edAc.selecao = null; edAc.pilha = []; fecharPainel(); fecharMenuAcorde(); redesenhar(); };
    $('#btnPosicionar').onclick = alternarEdicao;
    if (editandoAcordes) montarEdicao(m, ev, redesenhar, alternarEdicao);
    $('#tbPalco').onclick = () => abrirPalco(m);
    $('#tbModo').onclick = async () => { await D.salvarConfig({ modo: modo === 'letra' ? 'cifra' : 'letra' }); redesenhar(); };
    $('#btnFav').onclick = async () => { m.favorita = !m.favorita; await D.salvarMusica(m, { tocarData: false }); redesenhar(); $('#trilhoMais').hidden = false; };
    $('#btnPrint').onclick = () => window.print();
    $('#btnTxt').onclick = () => {
      const cab = [m.titulo, m.artista, ev.tomSoando ? 'Tom: ' + ev.tomSoando : '', !ev.teclado && v.capo ? 'Capo na ' + v.capo + 'ª casa' : ''].filter(Boolean).join('\n');
      D.baixar((m.titulo || 'cifra').replace(/[^\w\-À-ú ]+/g, '') + '.txt', cab + '\n\n' + C.paraTexto(m.cifra, ev.deslocamento, ev.bemol), 'text/plain');
    };

    // clique em acorde na cifra: ver formas e editar
    const ctxAcorde = (b) => ({
      musica: m, instr: v.instrumento, bemol: ev.bemol, aoMudar: redesenhar,
      editarNoBloco: (nome, forma, pos) => editarNoBloco(m, ev, nome, forma, pos, redesenhar),
      posicao: b.dataset.l != null ? { l: +b.dataset.l, k: +b.dataset.k } : null,
      aoTrocar: async (novo, escopo, pos) => {
        // nome como está escrito no texto (a tela pode estar transposta)
        let orig = pos ? C.acordeEm(m.cifra, pos.l, pos.k) : null;
        if (!orig) C.mapearAcordes(m.cifra, (n) => { if (!orig && A.transporNome(n, ev.deslocamento, ev.bemol) === b.dataset.acorde) orig = n; return null; });
        const po = A.parse(orig);
        const noTexto = ev.deslocamento ? A.transporNome(novo, -ev.deslocamento, po ? po.bemol : undefined) : novo;
        if (orig && noTexto !== orig) m.cifra = escopo === 'todos' || !pos ? C.trocarTodos(m.cifra, orig, noTexto) : C.trocarAcorde(m.cifra, pos.l, pos.k, noTexto);
        await D.salvarMusica(m, { silencioso: true });
        toast(orig && noTexto !== orig ? `${b.dataset.acorde} → ${novo}${escopo === 'todos' || !pos ? ' em toda a música' : ''}` : 'Forma guardada nesta música');
        redesenhar();
      },
      aoTirar: async (escopo, pos) => {
        let orig = pos ? C.acordeEm(m.cifra, pos.l, pos.k) : null;
        if (!orig) C.mapearAcordes(m.cifra, (n) => { if (!orig && A.transporNome(n, ev.deslocamento, ev.bemol) === b.dataset.acorde) orig = n; return null; });
        if (escopo === 'todos' || !pos) {
          if (orig) m.cifra = C.tirarTodos(m.cifra, orig);
          m.bibliotecaAcordes = (m.bibliotecaAcordes || []).filter((x) => x !== orig && A.transporNome(x, ev.deslocamento, ev.bemol) !== b.dataset.acorde);
        } else m.cifra = C.tirarAcorde(m.cifra, pos.l, pos.k);
        await D.salvarMusica(m, { silencioso: true });
        toast(escopo === 'todos' || !pos ? b.dataset.acorde + ' tirado da música' : b.dataset.acorde + ' tirado daqui');
        redesenhar();
      },
    });
    const abrirAcorde = (b) => {
      if (live.modo === 'tocar') { pularPara(b); return; }
      if (live.modo === 'gravar') return;
      abrirPopoverAcorde(b, b.dataset.acorde, ctxAcorde(b));
    };
    $('#cifra').addEventListener('click', (e) => { const b = e.target.closest('.acorde'); if (b) abrirAcorde(b); });
    $('#cifra').addEventListener('keydown', (e) => { const b = e.target.closest('.acorde'); if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrirAcorde(b); } });
    viewMusica.ctxAcorde = ctxAcorde;

    // passar o mouse num acorde acende o diagrama dele (e vice-versa)
    const acender = (nome, on) => {
      $$('#blocoAcordes .cartao-acorde').forEach((c) => { if (c.dataset.acorde === nome) { c.classList.toggle('aceso', on); if (on) rolarSeOculto(c); } });
      $$('#cifra .acorde').forEach((a) => a.classList.toggle('aceso', on && a.dataset.acorde === nome));
    };
    $('#cifra').addEventListener('mouseover', (e) => { const b = e.target.closest('.acorde'); if (b) { acender(b.dataset.acorde, true); mostrarDicaAcorde(b, b.dataset.acorde, m, v.instrumento); } });
    $('#cifra').addEventListener('mouseout', (e) => { const b = e.target.closest('.acorde'); if (b) { acender(b.dataset.acorde, false); esconderDicaAcorde(); } });
    $('#cifra').addEventListener('click', esconderDicaAcorde);
    const blocoAc = $('#blocoAcordes');
    if (blocoAc) {
      blocoAc.addEventListener('mouseover', (e) => { const c = e.target.closest('.cartao-acorde'); if (c && !c.classList.contains('editando')) $$('#cifra .acorde').forEach((a) => a.classList.toggle('aceso', a.dataset.acorde === c.dataset.acorde)); });
      blocoAc.addEventListener('mouseleave', () => $$('#cifra .acorde.aceso').forEach((a) => a.classList.remove('aceso')));
    }

    live.musica = m; live.mudou = true;
    if (live.modo === 'gravar') pintarGravacao();
    if (painelAberto) abrirPainel(painelAberto, m);
  }

  // ---------- vídeos que continuam tocando quando a página redesenha ----------
  let cofreVideos = null;
  function guardarVideos(id) {
    const g = new Map();
    if (!Element.prototype.moveBefore || viewMusica.ultimoId !== id) { viewMusica.ultimoId = id; return g; }
    if (!cofreVideos) { cofreVideos = document.createElement('div'); cofreVideos.className = 'cofre-videos'; document.body.appendChild(cofreVideos); }
    $$('#conteudo .video iframe[data-yid]').forEach((fr) => { try { cofreVideos.moveBefore(fr, null); g.set(fr.dataset.yid, fr); } catch (e) { /* navegador sem moveBefore */ } });
    return g;
  }
  function devolverVideos(g) {
    $$('#conteudo .video iframe[data-yid]').forEach((nv) => {
      const velho = g.get(nv.dataset.yid);
      if (velho) { try { nv.parentNode.moveBefore(velho, nv); nv.remove(); g.delete(nv.dataset.yid); } catch (e) { /* fica o novo */ } }
    });
    g.forEach((fr) => { if (live.frame === fr) { live.player = null; live.frame = null; } fr.remove(); });
  }

  // ---------- LIVE: gravar o segundo de cada acorde no vídeo e tocar acendendo na hora ----------
  const live = { modo: null, musica: null, yid: null, player: null, frame: null, tempos: [], raf: null, idx: -2, janela: 3, mudou: true };
  function carregarYT() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (!carregarYT.p) carregarYT.p = new Promise((ok, falha) => {
      const antes = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (antes) antes(); ok(); };
      const sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api';
      sc.onerror = () => { carregarYT.p = null; falha(new Error('não consegui falar com o YouTube')); };
      document.head.appendChild(sc);
      setTimeout(() => { if (!(window.YT && window.YT.Player)) { carregarYT.p = null; falha(new Error('o YouTube não respondeu')); } }, 12000);
    });
    return carregarYT.p;
  }
  async function playerDe(yid) {
    const fr = $(`.video iframe[data-yid="${yid}"]`) || $('.video iframe[data-yid]');
    if (!fr) throw new Error('vídeo não está na página');
    if (live.player && live.frame === fr) return live.player;
    await carregarYT();
    return new Promise((ok, falha) => {
      const t = setTimeout(() => falha(new Error('o vídeo não respondeu (pode ser que o dono não deixe tocar fora do YouTube)')), 10000);
      const pl = new window.YT.Player(fr, { events: { onReady: () => { clearTimeout(t); ok(pl); } } });
      live.player = pl; live.frame = fr; live.yid = fr.dataset.yid;
    });
  }
  // com o palco aberto, o live acompanha os acordes dos slides (mesma ordem da cifra)
  const palcoAberto = () => { const p = document.getElementById('palco'); return p && !p.hidden; };
  const acordesNaOrdem = () => (palcoAberto() ? $$('#palco .slide .acorde') : $$('#cifra .acorde'));
  function marcarBotaoLive() {
    const b = $('#trilho [data-painel="live"]'); if (!b) return;
    b.classList.toggle('marcado', !!live.modo); b.classList.toggle('com-val', !!live.modo);
    let val = $('.tb__val', b);
    if (live.modo) { if (!val) { val = document.createElement('span'); val.className = 'tb__val'; b.insertBefore(val, $('.tb__dica', b)); } val.textContent = live.modo === 'gravar' ? 'REC' : 'ON'; } else if (val) val.remove();
  }
  function limparClassesLive() {
    conteudo.classList.remove('live-gravando', 'live-tocando');
    const pc = document.getElementById('palco'); if (pc) { pc.classList.remove('live-tocando'); atualizarPalcoLive(); }
    $$('.live-agora,.live-perto,.live-marcado,.live-proximo,.live-passado').forEach((el) => { el.classList.remove('live-agora', 'live-perto', 'live-marcado', 'live-proximo', 'live-passado'); el.style.removeProperty('--prox'); });
  }
  async function iniciarGravacao(m, continuar) {
    if (D.estado.config.modo === 'letra') { await D.salvarConfig({ modo: 'cifra' }); viewMusica(m.id); }
    const els = acordesNaOrdem();
    if (!els.length) { toast('A cifra não tem acordes'); return; }
    try {
      const yidPedido = live.yid || (m.live && m.live.yid);
      const pl = await playerDe(yidPedido);
      live.modo = 'gravar'; live.musica = m;
      live.tempos = continuar && m.live && m.live.tempos ? m.live.tempos.slice() : [];
      const inicio = live.tempos.length ? Math.max(0, live.tempos[live.tempos.length - 1] - 3) : 0;
      pl.seekTo(inicio, true); pl.playVideo();
      pintarGravacao(); marcarBotaoLive(); abrirPainel('live', m);
      toast(continuar ? 'Continuando: espaço a cada acorde' : 'Gravando: aperte espaço a cada acorde');
    } catch (e) { toast('Live: ' + e.message); }
  }
  function pintarGravacao() {
    conteudo.classList.add('live-gravando');
    const els = acordesNaOrdem(), n = live.tempos.length;
    els.forEach((el, i) => { el.classList.toggle('live-marcado', i < n); el.classList.toggle('live-proximo', i === n); });
    const c = $('#liveConta'); if (c) c.textContent = n;
    const prox = els[n]; if (prox) manterVisivel(prox);
  }
  function marcarAcorde() {
    if (live.modo !== 'gravar' || !live.player) return;
    const total = acordesNaOrdem().length;
    if (live.tempos.length >= total) return;
    const t = live.player.getCurrentTime();
    if (live.tempos.length && t < live.tempos[live.tempos.length - 1]) { toast('O vídeo voltou: desfaça até esse ponto antes de marcar'); return; }
    live.tempos.push(+t.toFixed(2));
    pintarGravacao();
    if (live.tempos.length >= total) { pararLive(true); toast('Todos os acordes marcados'); }
  }
  function desfazerMarca() { if (live.modo !== 'gravar' || !live.tempos.length) return; live.tempos.pop(); pintarGravacao(); }
  async function salvarGravacao() {
    const m = live.musica; if (!m) return;
    m.live = { yid: live.yid, tempos: live.tempos.slice(), total: acordesNaOrdem().length, gravadoEm: new Date().toISOString() };
    await D.salvarMusica(m, { silencioso: true, tocarData: false });
  }
  async function pararLive(salvar) {
    const era = live.modo;
    cancelAnimationFrame(live.raf); live.modo = null;
    try { if (live.player && live.player.pauseVideo) live.player.pauseVideo(); } catch (e) { /* sem player */ }
    if (era === 'gravar' && salvar) { await salvarGravacao(); toast(live.tempos.length + ' acordes gravados'); }
    limparClassesLive(); marcarBotaoLive();
    if (painelAberto === 'live' && live.musica) abrirPainel('live', live.musica);
  }
  async function iniciarLive(m) {
    if (!m.live || !m.live.tempos || !m.live.tempos.length) { toast('Grave os acordes primeiro'); return; }
    if (D.estado.config.modo === 'letra') { await D.salvarConfig({ modo: 'cifra' }); viewMusica(m.id); }
    try {
      const pl = await playerDe(m.live.yid);
      live.modo = 'tocar'; live.musica = m; live.tempos = m.live.tempos.slice(); live.idx = -2; live.mudou = true;
      conteudo.classList.add('live-tocando');
      // começa um pouco antes do primeiro acorde, a não ser que o vídeo esteja parado no meio da música
      const t0 = pl.getCurrentTime ? pl.getCurrentTime() : 0, tp = live.tempos;
      if (t0 < 0.5 || t0 >= tp[tp.length - 1] - 1) pl.seekTo(Math.max(0, tp[0] - 3), true);
      pl.playVideo();
      marcarBotaoLive(); abrirPainel('live', m);
      cancelAnimationFrame(live.raf);
      live.raf = requestAnimationFrame(passoLive);
    } catch (e) { toast('Live: ' + e.message); }
  }
  function passoLive() {
    if (live.modo !== 'tocar') return;
    if (!conteudo.classList.contains('live-tocando')) conteudo.classList.add('live-tocando');
    if (palcoAberto()) document.getElementById('palco').classList.add('live-tocando');
    const t = live.player && live.player.getCurrentTime ? live.player.getCurrentTime() : 0;
    const els = acordesNaOrdem(), tp = live.tempos;
    let idx = -1;
    for (let i = 0; i < tp.length; i++) { if (tp[i] <= t) idx = i; else break; }
    const perto = new Map(); // nome do acorde → quão perto (0 a 1) para os diagramas
    els.forEach((el, i) => {
      const agora = i === idx;
      const falta = i < tp.length ? tp[i] - t : Infinity;
      const prox = i > idx && falta <= live.janela ? 1 - falta / live.janela : 0;
      el.classList.toggle('live-agora', agora);
      el.classList.toggle('live-perto', prox > 0);
      if (prox > 0) el.style.setProperty('--prox', prox.toFixed(2)); else el.style.removeProperty('--prox');
      const nome = el.dataset.acorde;
      if (agora) perto.set(nome, 2);
      else if (prox > 0 && (perto.get(nome) || 0) < prox) perto.set(nome, prox);
    });
    $$('#blocoAcordes .cartao-acorde').forEach((c) => {
      const v = perto.get(c.dataset.acorde) || 0;
      c.classList.toggle('live-agora', v === 2);
      c.classList.toggle('live-perto', v > 0 && v < 2);
      if (v > 0 && v < 2) c.style.setProperty('--prox', v.toFixed(2)); else c.style.removeProperty('--prox');
    });
    if (idx !== live.idx) { live.idx = idx; const el = els[Math.max(0, idx)]; if (el) manterVisivel(el); if (palcoAberto()) diagramasPalco(els, idx); }
    live.raf = requestAnimationFrame(passoLive);
  }
  function pularPara(el) {
    const i = acordesNaOrdem().indexOf(el);
    if (i < 0 || i >= live.tempos.length || !live.player) return;
    live.player.seekTo(Math.max(0, live.tempos[i] - 0.3), true); live.player.playVideo();
  }
  /** Mantém o acorde da vez perto do meio da tela (só rola se ele sair da faixa do meio). */
  function manterVisivel(el) {
    const sl = el.closest && el.closest('#palco .slide');
    if (sl) { irSlide(+sl.dataset.i); return; }
    const r = el.getBoundingClientRect(), h = window.innerHeight;
    if (r.top < h * 0.22 || r.bottom > h * 0.72) window.scrollBy({ top: r.top - h * 0.4, behavior: 'smooth' });
  }
  document.addEventListener('keydown', (e) => {
    if (live.modo === 'tocar' && e.code === 'Space' && !(e.target.closest && e.target.closest('input,textarea,select'))) {
      if (palcoAberto()) atualizarPalcoLive();
      e.preventDefault(); e.stopPropagation();
      try { live.player.getPlayerState() === 1 ? live.player.pauseVideo() : live.player.playVideo(); } catch (err) { /* sem player */ }
      return;
    }
    if (live.modo !== 'gravar' || (e.target.closest && e.target.closest('input,textarea,select'))) return;
    if (e.code === 'Space') { e.preventDefault(); e.stopPropagation(); marcarAcorde(); }
    else if (e.key === 'ArrowLeft' || e.key === 'Backspace') { e.preventDefault(); desfazerMarca(); }
    else if (e.key === 'Escape') pararLive(true);
  }, true);
  window.addEventListener('blur', () => { if (live.modo === 'gravar') setTimeout(() => { if (document.activeElement && document.activeElement.tagName === 'IFRAME') toast('O foco foi para o vídeo: clique na cifra para voltar a marcar com espaço'); }, 0); });

  // ---------- MODO PALCO: a cifra em slides grandes, na horizontal; no live, passam sozinhos ----------
  const palco = { i: 0, n: 0, m: null, x0: null };
  /** Junta as linhas renderizadas em slides: por seção, por estrofe (linha vazia) e no máximo 8 linhas. */
  function fatiarSlides(linhas) {
    const slides = []; let atual = [];
    const cheias = (arr) => arr.filter((x) => !x.classList.contains('ln-vazio')).length;
    const fechar = () => { while (atual.length && atual[atual.length - 1].classList.contains('ln-vazio')) atual.pop(); while (atual.length && atual[0].classList.contains('ln-vazio')) atual.shift(); if (cheias(atual)) slides.push(atual); atual = []; };
    const MAX = 8;
    for (let k = 0; k < linhas.length; k++) {
      const ln = linhas[k];
      if (ln.classList.contains('ln-secao')) { fechar(); atual.push(ln); continue; }
      if (ln.classList.contains('ln-vazio')) { if (cheias(atual) >= 2) fechar(); continue; }
      // acorde e a letra de baixo andam juntos
      const un = ln.classList.contains('ln-acordes') && linhas[k + 1] && linhas[k + 1].classList.contains('ln-letra') ? [ln, linhas[++k]] : [ln];
      if (cheias(atual) + un.length > MAX && cheias(atual.filter((x) => !x.classList.contains('ln-secao')))) fechar();
      atual.push(...un);
    }
    fechar();
    return slides;
  }
  function abrirPalco(m) {
    fecharPopover(); fecharPainel(); esconderDicaAcorde();
    const ev = estadoVisual(m), cfg = D.estado.config;
    const tmp = document.createElement('div');
    tmp.innerHTML = C.renderizar(m.cifra, { semitons: ev.deslocamento, bemol: ev.bemol, mostrarTabs: cfg.mostrarTabs !== false });
    const slides = fatiarSlides([...tmp.children]);
    if (!slides.length) { toast('A cifra está vazia'); return; }
    let pc = document.getElementById('palco');
    if (!pc) { pc = document.createElement('div'); pc.id = 'palco'; pc.className = 'palco'; pc.setAttribute('role', 'dialog'); pc.setAttribute('aria-label', 'Modo palco'); document.body.appendChild(pc); }
    palco.m = m; palco.n = slides.length; palco.i = 0;
    const temLive = m.live && m.live.tempos && m.live.tempos.length;
    pc.innerHTML = `<header class="palco__topo">
        <div class="palco__tit"><b>${esc(m.titulo || 'Sem título')}</b>${m.artista ? `<span>${esc(m.artista)}</span>` : ''}${ev.tomSoando ? `<span class="palco__tom">Tom ${esc(ev.tomSoando)}${!ev.teclado && ev.v.capo ? ` · capo ${ev.v.capo}ª` : ''}</span>` : ''}</div>
        <div class="palco__acoes">
          ${temLive ? `<button class="btn peq" id="palcoLive"></button>` : '<span class="dica">Grave os acordes no Live para os slides passarem sozinhos</span>'}
          <span class="palco__n" id="palcoN"></span>
          <button class="btn peq quad ghost" id="palcoAnt" title="Anterior (←)" aria-label="Slide anterior">${ic('left', 18)}</button>
          <button class="btn peq quad ghost" id="palcoProx" title="Próximo (→)" aria-label="Próximo slide">${ic('right', 18)}</button>
          <button class="btn peq quad ghost" id="palcoTela" title="Tela cheia (F)" aria-label="Tela cheia">${ic('expand', 17)}</button>
          <button class="btn peq quad ghost" id="palcoFechar" title="Sair (Esc)" aria-label="Sair do modo palco">${ic('x', 18)}</button>
        </div></header>
      <div class="palco__janela" id="palcoJanela"><div class="palco__trilho" id="palcoTrilho">${slides.map((sl, i) => `<section class="slide" data-i="${i}"><div class="cifra slide__cifra">${sl.map((x) => x.outerHTML).join('')}</div></section>`).join('')}</div></div>
      <div class="palco__diag" id="palcoDiag" hidden></div>
      <div class="palco__pontos" id="palcoPontos">${slides.map((_, i) => `<button data-ir="${i}" aria-label="Slide ${i + 1}"></button>`).join('')}</div>`;
    pc.hidden = false;
    document.documentElement.classList.add('com-palco');
    ajustarFontePalco();
    irSlide(0, true);
    $('#palcoAnt', pc).onclick = () => irSlide(palco.i - 1);
    $('#palcoProx', pc).onclick = () => irSlide(palco.i + 1);
    $('#palcoFechar', pc).onclick = fecharPalco;
    $('#palcoTela', pc).onclick = telaCheiaPalco;
    $$('[data-ir]', pc).forEach((b) => (b.onclick = () => irSlide(+b.dataset.ir)));
    const bl = $('#palcoLive', pc);
    if (bl) bl.onclick = () => { if (live.modo === 'tocar') pararLive(false); else iniciarLive(m).then(() => { fecharPainel(); atualizarPalcoLive(); }); setTimeout(atualizarPalcoLive, 50); };
    atualizarPalcoLive();
    if (live.modo === 'tocar') { live.idx = -2; pc.classList.add('live-tocando'); }
    // clique num acorde no live: pula o vídeo; deslizar para os lados troca de slide
    const jan = $('#palcoJanela', pc);
    jan.onclick = (e) => { const a = e.target.closest('.acorde'); if (a && live.modo === 'tocar') pularPara(a); };
    jan.onpointerdown = (e) => { palco.x0 = e.clientX; };
    jan.onpointerup = (e) => { if (palco.x0 == null) return; const dx = e.clientX - palco.x0; palco.x0 = null; if (Math.abs(dx) > 60) irSlide(palco.i + (dx < 0 ? 1 : -1)); };
  }
  function atualizarPalcoLive() {
    const b = document.getElementById('palcoLive'); if (!b) return;
    b.innerHTML = live.modo === 'tocar' ? ic('pause', 15) + 'Parar o live' : ic('play', 15) + 'Tocar ao vivo';
    b.classList.toggle('prim', live.modo !== 'tocar');
    const d = document.getElementById('palcoDiag'); if (d && live.modo !== 'tocar') d.hidden = true;
  }
  function ajustarFontePalco() {
    const pc = document.getElementById('palco'); if (!pc || pc.hidden) return;
    const jan = $('#palcoJanela', pc);
    const W = jan.clientWidth * 0.9, H = jan.clientHeight * 0.86;
    const base = 20;
    const fits = $$('.slide__cifra', pc).map((c) => { c.style.fontSize = base + 'px'; const w = c.scrollWidth || 1, h = c.scrollHeight || 1; return base * Math.min(W / w, H / h); });
    const menor = Math.min(...fits);
    $$('.slide__cifra', pc).forEach((c, i) => { c.style.fontSize = Math.max(12, Math.min(fits[i], menor * 1.3, 72)).toFixed(1) + 'px'; });
  }
  function irSlide(i, sem) {
    const pc = document.getElementById('palco'); if (!pc || pc.hidden) return;
    palco.i = Math.max(0, Math.min(palco.n - 1, i));
    const tr = $('#palcoTrilho', pc);
    tr.classList.toggle('sem-anim', !!sem);
    tr.style.transform = `translateX(${-palco.i * 100}%)`;
    $$('.slide', pc).forEach((sl, k) => sl.classList.toggle('atual', k === palco.i));
    $('#palcoN', pc).textContent = palco.i + 1 + ' / ' + palco.n;
    $$('[data-ir]', pc).forEach((b, k) => b.classList.toggle('on', k === palco.i));
  }
  /** Agora e próximo acorde, com diagrama, no canto do palco. */
  function diagramasPalco(els, idx) {
    const d = document.getElementById('palcoDiag'); if (!d || !palco.m) return;
    const atual = els[idx], nomeA = atual && atual.dataset.acorde;
    let prox = null; for (let k = idx + 1; k < els.length; k++) if (els[k].dataset.acorde !== nomeA) { prox = els[k].dataset.acorde; break; }
    if (!nomeA) { d.hidden = true; return; }
    const instr = estadoVisual(palco.m).v.instrumento;
    const cartao = (nome, rot) => { const c = document.createElement('div'); c.className = 'palco__card' + (rot === 'Agora' ? ' agora' : ''); c.innerHTML = `<span class="rotulo">${rot}</span><b>${esc(nome)}</b>`; const fs = listaFormas(nome, instr, palco.m); const f = fs[Math.min((palco.m._indices || {})[nome] || 0, Math.max(0, fs.length - 1))]; if (f) c.appendChild(desenhar(nome, instr, f, { largura: ehTeclado(instr) ? 200 : 110, passoY: 20 })); return c; };
    d.innerHTML = ''; d.appendChild(cartao(nomeA, 'Agora')); if (prox) d.appendChild(cartao(prox, 'Depois'));
    d.hidden = false;
  }
  function telaCheiaPalco() {
    const pc = document.getElementById('palco'); if (!pc) return;
    if (document.fullscreenElement) document.exitFullscreen(); else if (pc.requestFullscreen) pc.requestFullscreen().catch(() => {});
  }
  function fecharPalco() {
    const pc = document.getElementById('palco'); if (!pc || pc.hidden) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    pc.hidden = true; pc.classList.remove('live-tocando'); pc.innerHTML = '';
    document.documentElement.classList.remove('com-palco');
    live.idx = -2;
  }
  document.addEventListener('keydown', (e) => {
    if (!palcoAberto() || (e.target.closest && e.target.closest('input,textarea,select'))) return;
    if (e.key === 'Escape') { if (!document.fullscreenElement) fecharPalco(); e.stopPropagation(); }
    else if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.code === 'Space' && !live.modo)) { e.preventDefault(); irSlide(palco.i + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); irSlide(palco.i - 1); }
    else if (e.key === 'f' || e.key === 'F') telaCheiaPalco();
  });
  window.addEventListener('resize', () => { if (palcoAberto()) ajustarFontePalco(); });
  document.addEventListener('fullscreenchange', () => setTimeout(ajustarFontePalco, 60));

  // ---------- metrônomo (WebAudio, agendado à frente para não atrasar) ----------
  const metro = { ativo: false, bpm: 100, compasso: 4, batida: 0, prox: 0, timer: null, toques: [], salvar: null };
  function clique(ac, t, forte) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = forte ? 1600 : 1000;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(forte ? 0.6 : 0.35, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.06);
  }
  function agendarMetro() {
    const ac = G.audio(); if (!ac) return;
    while (metro.prox < ac.currentTime + 0.12) {
      const n = metro.batida % metro.compasso;
      clique(ac, metro.prox, n === 0);
      setTimeout(() => marcarBatida(n), Math.max(0, (metro.prox - ac.currentTime) * 1000));
      metro.prox += 60 / metro.bpm; metro.batida++;
    }
  }
  function marcarBatida(n) {
    $$('#metroBatidas span').forEach((el, k) => el.classList.toggle('on', k === n));
    const b = $('#trilho [data-painel="metronomo"]');
    if (b) { b.classList.remove('pulso'); void b.offsetWidth; b.classList.add('pulso'); }
  }
  function iniciarMetro() { const ac = G.audio(); if (!ac) { toast('Este navegador não tem áudio'); return; } metro.ativo = true; metro.batida = 0; metro.prox = ac.currentTime + 0.06; clearInterval(metro.timer); metro.timer = setInterval(agendarMetro, 25); agendarMetro(); }
  function pararMetro() { metro.ativo = false; clearInterval(metro.timer); $$('#metroBatidas span').forEach((el) => el.classList.remove('on')); }
  function atualizarMetroUI() {
    const pl = $('#metroPlay'); if (pl) { pl.innerHTML = ic(metro.ativo ? 'pause' : 'play', 16) + (metro.ativo ? 'Parar' : 'Iniciar'); pl.classList.toggle('prim', metro.ativo); }
    const b = $('#trilho [data-painel="metronomo"]');
    if (b) {
      b.classList.toggle('marcado', metro.ativo); b.classList.toggle('com-val', metro.ativo);
      let val = $('.tb__val', b);
      if (metro.ativo) { if (!val) { val = document.createElement('span'); val.className = 'tb__val'; b.insertBefore(val, $('.tb__dica', b)); } val.textContent = metro.bpm; } else if (val) val.remove();
    }
  }
  function mudarBpm(m, bpm) {
    metro.bpm = Math.max(30, Math.min(260, Math.round(bpm) || 100));
    const n = $('#metroN'); if (n) n.textContent = metro.bpm;
    const r = $('#metroRange'); if (r && +r.value !== metro.bpm) r.value = metro.bpm;
    atualizarMetroUI();
    clearTimeout(metro.salvar);
    metro.salvar = setTimeout(() => { if (m && String(m.bpm) !== String(metro.bpm)) { m.bpm = String(metro.bpm); D.salvarMusica(m, { silencioso: true, tocarData: false }); } }, 800);
  }

  // ---------- afinador (microfone + autocorrelação) ----------
  const afin = { ativo: false, recusado: false, stream: null, an: null, buf: null, raf: null, ultimo: 0, hist: [], instr: 'violao', abaixo: 0 };
  function detectarFrequencia(buf, sr) {
    let n = buf.length, rms = 0;
    for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
    if (Math.sqrt(rms / n) < 0.012) return -1; // silêncio
    let r1 = 0, r2 = n - 1;
    for (let i = 0; i < n / 2; i++) if (Math.abs(buf[i]) < 0.2) { r1 = i; break; }
    for (let i = 1; i < n / 2; i++) if (Math.abs(buf[n - i]) < 0.2) { r2 = n - i; break; }
    const b = buf.slice(r1, r2); n = b.length;
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) { let soma = 0; for (let j = 0; j < n - i; j++) soma += b[j] * b[j + i]; c[i] = soma; }
    let d = 0; while (d < n - 1 && c[d] > c[d + 1]) d++;
    let max = -1, pos = -1;
    for (let i = d; i < n; i++) if (c[i] > max) { max = c[i]; pos = i; }
    if (pos <= 0 || pos >= n - 1) return -1;
    const x1 = c[pos - 1], x2 = c[pos], x3 = c[pos + 1], a = (x1 + x3 - 2 * x2) / 2, bb = (x3 - x1) / 2;
    const t0 = a ? pos - bb / (2 * a) : pos;
    const f = sr / t0;
    return f > 40 && f < 1500 ? f : -1;
  }
  async function ligarAfinador() {
    const msg = (t) => { const el = $('#afinMsg'); if (el) el.innerHTML = t; };
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg('Este navegador não deixa usar o microfone aqui.'); afin.recusado = true; return; }
    try {
      afin.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (e) {
      afin.recusado = true;
      msg(`Não consegui o microfone (${esc(e.name === 'NotAllowedError' ? 'permissão negada' : e.message)}). Libere o microfone para esta página e clique em <b>Ligar microfone</b>. Dá para afinar de ouvido clicando nas cordas.`);
      const lg = $('#afinLigar'); if (lg) lg.hidden = false;
      return;
    }
    if (painelAberto !== 'afinador') { afin.stream.getTracks().forEach((t) => t.stop()); return; }
    const ac = G.audio();
    const src = ac.createMediaStreamSource(afin.stream);
    afin.an = ac.createAnalyser(); afin.an.fftSize = 2048;
    src.connect(afin.an);
    afin.buf = new Float32Array(afin.an.fftSize);
    afin.ativo = true; afin.hist = [];
    const lg = $('#afinLigar'); if (lg) lg.hidden = true;
    const b = $('#trilho [data-painel="afinador"]'); if (b) b.classList.add('marcado');
    const passo = (ts) => {
      if (!afin.ativo) return;
      if (ts - afin.ultimo > 50) { // ~20 leituras por segundo
        afin.ultimo = ts;
        afin.an.getFloatTimeDomainData(afin.buf);
        const f = detectarFrequencia(afin.buf, ac.sampleRate);
        if (f > 0) { afin.hist.push(f); if (afin.hist.length > 5) afin.hist.shift(); } else if (afin.hist.length) afin.hist.shift();
        desenharAfinador();
      }
      afin.raf = requestAnimationFrame(passo);
    };
    afin.raf = requestAnimationFrame(passo);
  }
  function desligarAfinador() {
    afin.ativo = false; cancelAnimationFrame(afin.raf);
    if (afin.stream) afin.stream.getTracks().forEach((t) => t.stop());
    afin.stream = null; afin.hist = [];
    const b = $('#trilho [data-painel="afinador"]'); if (b) b.classList.remove('marcado');
  }
  function desenharAfinador() {
    const nota = $('#afinNota'); if (!nota) return;
    const ord = afin.hist.slice().sort((a, b) => a - b);
    const f = ord.length >= 2 ? ord[Math.floor(ord.length / 2)] : 0;
    const ag = $('#afinAgulha'), ce = $('#afinCents'), hz = $('#afinHz'), box = $('#afin');
    $$('.afin-corda').forEach((c) => c.classList.remove('perto'));
    if (!f) { nota.textContent = '—'; ce.textContent = afin.ativo ? 'toque uma corda' : 'microfone desligado'; hz.textContent = ''; ag.style.left = '50%'; box.classList.remove('afinado', 'longe'); return; }
    const midi = 69 + 12 * Math.log2(f / 440);
    let alvo = Math.round(midi);
    // perto de uma corda do instrumento? mede em relação a ela
    const inst = A.INSTRUMENTOS[afin.instr];
    if (inst && inst.cordas) {
      const cordas = inst.cordas.map((c) => c - afin.abaixo);
      const perto = cordas.reduce((a, c) => (Math.abs(c - midi) < Math.abs(a - midi) ? c : a), cordas[0]);
      if (Math.abs(perto - midi) < 1.5) { alvo = perto; $$('.afin-corda').forEach((c) => c.classList.toggle('perto', +c.dataset.midi === perto)); }
    }
    const cents = Math.round((midi - alvo) * 100);
    nota.innerHTML = `${esc(A.nomeNota(alvo, afin.abaixo > 0))}<small>${Math.floor(alvo / 12) - 1}</small>`;
    ce.textContent = Math.abs(cents) <= 4 ? 'afinado' : cents < 0 ? `${cents} cents · aperte` : `+${cents} cents · solte`;
    hz.textContent = f.toFixed(1) + ' Hz';
    ag.style.left = 50 + Math.max(-50, Math.min(50, cents)) + '%';
    box.classList.toggle('afinado', Math.abs(cents) <= 4);
    box.classList.toggle('longe', Math.abs(cents) > 20);
  }

  // ---------- diagrama flutuante: aparece em cima do acorde ao passar o mouse ----------
  let timerDica = null;
  function esconderDicaAcorde() { clearTimeout(timerDica); const d = document.getElementById('dicaAcorde'); if (d) d.hidden = true; }
  function mostrarDicaAcorde(alvo, nome, m, instr, edicao = false) {
    clearTimeout(timerDica);
    if (!$('#popover').hidden || matchMedia('(hover: none)').matches) return;
    timerDica = setTimeout(() => {
      let d = document.getElementById('dicaAcorde');
      if (!d) { d = document.createElement('div'); d.id = 'dicaAcorde'; d.className = 'dica-acorde'; d.setAttribute('aria-hidden', 'true'); document.body.appendChild(d); }
      const lista = listaFormas(nome, instr, m);
      const forma = lista[Math.min((m._indices || {})[nome] || 0, Math.max(0, lista.length - 1))];
      d.innerHTML = `<div class="dica-acorde__nome">${esc(nome)}</div>`;
      if (forma) d.appendChild(desenhar(nome, instr, forma, { largura: ehTeclado(instr) ? 190 : 104, passoY: 18 }));
      else d.insertAdjacentHTML('beforeend', '<div class="dica" style="padding:6px">sem forma</div>');
      d.classList.toggle('teclado', ehTeclado(instr)); d.classList.toggle('edicao', edicao);
      d.hidden = false;
      const r = alvo.getBoundingClientRect(), w = d.offsetWidth, h = d.offsetHeight;
      let x = r.left + r.width / 2 - w / 2, y = r.top - h - 8;
      if (y < 8) y = r.bottom + 8;
      x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
      d.style.left = x + 'px'; d.style.top = y + 'px';
    }, 120);
  }
  window.addEventListener('scroll', esconderDicaAcorde, { passive: true });

  /** Rola só a coluna do cartão (não a página) se ele estiver fora da área visível dela. */
  function rolarSeOculto(el) {
    const col = el.closest('.tile__corpo[style], .tile-col.fixa') || el.closest('.tile-col');
    if (!col || col.scrollHeight <= col.clientHeight) return;
    const r = el.getBoundingClientRect(), rc = col.getBoundingClientRect();
    if (r.top < rc.top) col.scrollTop -= rc.top - r.top + 8;
    else if (r.bottom > rc.bottom) col.scrollTop += r.bottom - rc.bottom + 8;
  }

  // ---------- painéis do trilho ----------
  function fecharPainel() {
    if (painelAberto === 'afinador') desligarAfinador();
    painelAberto = null;
    const pn = $('#painel'); pn.hidden = true; pn.innerHTML = '';
    $$('#trilho [data-painel]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }
  function htmlPainel(id, m, ev) {
    const cfg = D.estado.config, v = ev.v;
    const cab = (t, restaurar) => `<div class="painel__cab"><span>${t}</span><span class="painel__acoes">${restaurar ? `<button class="painel__ic" data-p="restaurar" title="Restaurar" aria-label="Restaurar">${ic('rotate', 16)}</button>` : ''}<button class="painel__ic" data-p="fechar" title="Fechar" aria-label="Fechar">${ic('x', 16)}</button></span></div>`;
    const opc = (p, val, rot, ativo, extra = '') => `<button class="painel__opc${ativo ? ' ativo' : ''}" data-p="${p}" data-v="${esc(val)}"><span>${rot}</span>${extra ? `<span class="painel__extra">${extra}</span>` : ''}</button>`;
    const passo = (p, valor, rotMenos = '−', rotMais = '+') => `<div class="painel__passo"><button class="painel__ic grande" data-p="${p}" data-v="-1" aria-label="Diminuir">${rotMenos}</button><span class="painel__valor">${valor}</span><button class="painel__ic grande" data-p="${p}" data-v="1" aria-label="Aumentar">${rotMais}</button></div>`;
    const sec = (t) => `<div class="painel__sec">${t}</div>`;
    const soCordas = '<p class="painel__dica">No teclado não há capotraste nem afinação: os acordes aparecem como soam. Troque o instrumento em Diagramas.</p>';
    switch (id) {
      case 'rolagem':
        return cab('Rolagem') + `<div class="painel__linha"><button class="btn peq${rolagem.ativa ? ' prim' : ''}" id="rolPlay" data-p="rolar">${ic(rolagem.ativa ? 'pause' : 'play', 16)}${rolagem.ativa ? 'Pausar' : 'Iniciar'}</button>${passo('vel', `<span id="rolVel">${rolagem.vel}</span>`)}</div>
          <input type="range" min="1" max="10" value="${rolagem.vel}" id="rolRange" aria-label="Velocidade"><p class="painel__dica">Barra de espaço inicia e pausa.</p>`;
      case 'colunas': {
        const c = numColunas();
        return cab('Dividir em colunas') + opc('colunas', 0, 'Não dividir', c === 0) + opc('colunas', 2, 'Duas colunas', c === 2) + opc('colunas', 3, 'Três colunas', c === 3);
      }
      case 'diagramas': {
        const oculto = lerLayout().ocultos.includes('acordes'), tam = cfg.diagTam || 100;
        return cab('Diagramas') + sec('Acordes para') +
          Object.entries(A.INSTRUMENTOS).map(([k, i]) => opc('instr', k, i.nome, k === v.instrumento)).join('') +
          sec('Bloco de acordes') + opc('mostrardiag', oculto ? 1 : 0, 'Mostrar', !oculto) + opc('mostrardiag', 0, 'Ocultar', oculto) +
          `<button class="painel__opc so-desktop" data-p="layout"><span>Mudar de lugar e tamanho…</span>${ic('layout', 15)}</button>` +
          sec('Tamanho') + passo('diagtam', tam + '%') +
          (ev.teclado ? '' : opc('canhoto', cfg.canhoto ? 0 : 1, 'Canhoto', !!cfg.canhoto, cfg.canhoto ? 'ligado' : ''));
      }
      case 'tom': {
        let tons = '';
        const p = A.parse(ev.tomBase);
        if (p) {
          const menor = p.q.terca === 'm' ? 'm' : '';
          const ordem = ['A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab'];
          tons = `<div class="tons">${ordem.map((n) => {
            let s = A.mod12(A.notaParaPc(n) - p.raiz); if (s > 6) s -= 12;
            return `<button class="tom${s === v.semitons ? ' ativo' : ''}${s === 0 ? ' original' : ''}" data-p="tomabs" data-v="${s}" title="${s === 0 ? 'Tom original' : (s > 0 ? '+' : '') + s / 2 + ' tom'}">${n}${menor}</button>`;
          }).join('')}</div>`;
        }
        return cab('Tom', v.semitons !== 0) + `<div class="painel__passo tom-passo"><button class="btn peq" data-p="tom" data-v="-1">−½ tom</button><span class="tom-atual">${esc(ev.tomSoando || '—')}</span><button class="btn peq" data-p="tom" data-v="1">+½ tom</button></div>` +
          (tons || '<p class="painel__dica">Sem acordes para saber o tom.</p>') + (p ? '<p class="painel__dica">O sublinhado é o tom original.</p>' : '');
      }
      case 'capo':
        if (ev.teclado) return cab('Capotraste') + soCordas;
        return cab('Capotraste', v.capo !== (Number(m.capo) || 0)) + `<div class="painel__lista">${Array.from({ length: 13 }, (_, i) => {
          const forma = ev.tomBase ? A.transporNome(ev.tomBase, v.semitons - i + v.afinacao, ev.bemol) : '';
          return opc('capo', i, i ? i + 'ª casa' : 'Sem capotraste', i === v.capo, forma ? 'forma ' + esc(forma) : '');
        }).join('')}</div>`;
      case 'afinacao': {
        if (ev.teclado) return cab('Afinação') + soCordas;
        const inst = A.INSTRUMENTOS[v.instrumento];
        return cab('Afinação', v.afinacao > 0) + AFINACOES.map(([n, rot]) => opc('afin', n, rot, v.afinacao === n, inst.cordas.map((c) => A.nomeNota(c - n, n > 0)).join(' '))).join('') +
          '<p class="painel__dica">Mostra as formas para o instrumento afinado assim, soando no mesmo tom.</p>' +
          (m.afinacao && m.afinacao !== 'Padrão' ? `<p class="painel__dica">Afinação indicada na música: <b>${esc(m.afinacao)}</b>.</p>` : '');
      }
      case 'tabs': {
        const on = cfg.mostrarTabs !== false;
        return cab('Tablaturas') + opc('tabs', 1, 'Mostrar sempre', on) + opc('tabs', 0, 'Ocultar sempre', !on);
      }
      case 'metronomo': {
        const bat = Array.from({ length: metro.compasso }, (_, k) => `<span class="${k === 0 ? 'forte' : ''}"></span>`).join('');
        return cab('Metrônomo') + `<div class="metro-bpm"><button class="painel__ic grande" data-p="bpm" data-v="-1" aria-label="Menos BPM">−</button><div class="metro-bpm__n"><b id="metroN">${metro.bpm}</b><span>BPM</span></div><button class="painel__ic grande" data-p="bpm" data-v="1" aria-label="Mais BPM">+</button></div>
          <input type="range" min="30" max="260" value="${metro.bpm}" id="metroRange" aria-label="BPM">
          <div class="metro-batidas" id="metroBatidas">${bat}</div>
          <div class="painel__linha" style="margin-top:var(--space-10)"><button class="btn peq${metro.ativo ? ' prim' : ''}" id="metroPlay" data-p="metro">${ic(metro.ativo ? 'pause' : 'play', 16)}${metro.ativo ? 'Parar' : 'Iniciar'}</button><button class="btn peq ghost" data-p="tap" title="Toque no ritmo da música (4 vezes ou mais)">Bater o tempo</button></div>
          ${sec('Compasso')}<div class="seg">${[2, 3, 4, 6].map((n) => `<button data-p="compasso" data-v="${n}" aria-pressed="${metro.compasso === n}">${n === 6 ? '6/8' : n + '/4'}</button>`).join('')}</div>
          <p class="painel__dica">${m.bpm ? 'BPM da música: ' + esc(m.bpm) + '. ' : ''}Mudar o BPM aqui também guarda na música.</p>`;
      }
      case 'live': {
        const vids = (m.videos || []).map((x) => ({ yid: idYoutube(x.url), rot: x.rotulo || 'Vídeo' })).filter((x) => x.yid);
        const total = $$('#cifra .acorde').length;
        const gr = m.live && m.live.tempos ? m.live : null;
        const marcados = live.modo === 'gravar' ? live.tempos.length : gr ? gr.tempos.length : 0;
        let corpo;
        if (!/^https?:$/.test(location.protocol)) corpo = '<p class="painel__dica">Aberto como arquivo, o YouTube não deixa o vídeo tocar aqui. Abra pelo lançador (<b>Repertor.io.desktop</b>).</p>';
        else if (!vids.length) corpo = '<p class="painel__dica">Esta música não tem vídeo do YouTube. Adicione em <b>Editar informações</b>.</p>';
        else if (!$('.video iframe')) corpo = '<p class="painel__dica">O bloco Vídeos está oculto. Mostre ele em Personalizar layout para usar o live.</p>';
        else if (!total) corpo = '<p class="painel__dica">A cifra não tem acordes para marcar.</p>';
        else {
          const yidAtual = live.yid || (gr && gr.yid) || vids[0].yid;
          corpo = `${vids.length > 1 ? `${sec('Vídeo')}<select class="painel__sel" id="liveVideo">${vids.map((x) => `<option value="${x.yid}" ${x.yid === yidAtual ? 'selected' : ''}>${esc(x.rot)}</option>`).join('')}</select>` : ''}
            <div class="live-status"><b id="liveConta">${marcados}</b>/${total} acordes marcados${gr && gr.total && gr.total !== total && live.modo !== 'gravar' ? '<br><span class="aviso">A cifra mudou depois da gravação: os tempos podem não bater.</span>' : ''}</div>
            ${live.modo === 'gravar' ? `<button class="btn prim live-marcar" data-p="livemarcar">${ic('live', 16)}Marcar acorde <kbd>espaço</kbd></button>
              <div class="painel__linha"><button class="btn peq ghost" data-p="livedesfazer">${ic('undo', 14)}Desfazer <kbd>←</kbd></button><button class="btn peq" data-p="liveparar">${ic('pause', 14)}Parar e salvar</button></div>
              <p class="painel__dica">Aperte espaço quando cada acorde entrar, na ordem. O próximo a marcar fica tracejado. Não clique dentro do vídeo (o espaço vai para o YouTube); use estes botões.</p>`
            : live.modo === 'tocar' ? `<div class="painel__linha"><button class="btn peq prim" data-p="liveparar">${ic('pause', 14)}Parar o live</button></div>
              ${sec('Acender antes')}${passo('livejanela', live.janela + ' s')}
              <p class="painel__dica">Clique num acorde da cifra para pular o vídeo até ele.</p>`
            : `<div class="painel__linha"><button class="btn peq prim" data-p="livetocar" ${marcados ? '' : 'disabled'}>${ic('play', 14)}Tocar ao vivo</button><button class="btn peq" data-p="livegravar">${ic('live', 14)}Gravar</button></div>
              ${marcados && marcados < total ? `<button class="painel__opc" data-p="livecontinuar"><span>Continuar a gravação do acorde ${marcados + 1}</span>${ic('right', 14)}</button>` : ''}
              ${marcados ? `<button class="painel__opc" data-p="liveapagar"><span>Apagar os tempos</span>${ic('trash', 14)}</button>` : ''}
              <p class="painel__dica">Gravar: o vídeo toca do começo e você aperta espaço a cada acorde, na ordem da cifra. No live, só o acorde da hora acende; os próximos vão acendendo perto da hora.</p>`}`;
        }
        return cab('Live') + corpo;
      }
      case 'afinador': {
        const inst = A.INSTRUMENTOS[ev.v.instrumento];
        const abaixo = ev.teclado ? 0 : ev.v.afinacao;
        const cordas = inst.cordas ? inst.cordas.map((c, k) => `<button class="afin-corda" data-p="afinref" data-v="${c - abaixo}" data-midi="${c - abaixo}" title="Ouvir ${A.nomeNota(c - abaixo, abaixo > 0)}">${A.nomeNota(c - abaixo, abaixo > 0)}<small>${inst.cordas.length - k}ª</small></button>`).join('') : '';
        return cab('Afinador') + `<div class="afin" id="afin">
            <div class="afin__nota" id="afinNota">—</div>
            <div class="afin__escala"><div class="afin__zero"></div><div class="afin__agulha" id="afinAgulha"></div></div>
            <div class="afin__info"><span id="afinCents">toque uma corda</span><span id="afinHz"></span></div>
          </div>
          ${cordas ? sec(inst.nome + (abaixo ? ' · ' + AFINACOES[abaixo][1] : '')) + `<div class="afin-cordas">${cordas}</div>` : '<p class="painel__dica">Escolha um instrumento de cordas em Diagramas para ver as cordas. A nota tocada aparece mesmo assim.</p>'}
          <p class="painel__dica" id="afinMsg">Usa o microfone só enquanto este painel estiver aberto. Clique numa corda para ouvir a nota.</p>
          <button class="btn peq ghost" data-p="afinligar" id="afinLigar" ${afin.ativo ? 'hidden' : ''}>${ic('volume', 14)}Ligar microfone</button>`;
      }
      case 'texto':
        return cab('Texto', (cfg.tamanhoFonte || 100) !== 100) + passo('fonte', (cfg.tamanhoFonte || 100) + '%', 'A−', 'A+') +
          `<a class="painel__opc" href="#/config" style="margin-top:var(--space-10)"><span>Fontes, pesos e cores…</span>${ic('settings', 15)}</a>`;
    }
    return '';
  }
  function posicionarPainel(id) {
    const pn = $('#painel'), b = $(`#trilho [data-painel="${id}"]`);
    if (!b || matchMedia('(max-width:700px)').matches) { pn.classList.add('embaixo'); pn.style.left = pn.style.top = ''; return; }
    pn.classList.remove('embaixo');
    const r = b.getBoundingClientRect();
    const emLinha = !!b.closest('.horizontal');
    let left = emLinha ? r.left : b.closest('.lado-dir') ? r.left - 10 - pn.offsetWidth : r.right + 10;
    left = Math.max(8, Math.min(left, window.innerWidth - pn.offsetWidth - 8));
    pn.style.left = left + 'px';
    let top = emLinha ? r.bottom + 8 : r.top - 4;
    const h = pn.offsetHeight;
    if (top + h > window.innerHeight - 8) top = Math.max(8, window.innerHeight - h - 8);
    pn.style.top = top + 'px';
  }
  function abrirPainel(id, m) {
    if (painelAberto === 'afinador' && id !== 'afinador') desligarAfinador();
    const ev = estadoVisual(m);
    const pn = $('#painel');
    pn.innerHTML = htmlPainel(id, m, ev);
    pn.hidden = false; pn.dataset.id = id; painelAberto = id;
    $$('#trilho [data-painel]').forEach((b) => b.setAttribute('aria-expanded', String(b.dataset.painel === id)));
    pn.onclick = (e) => { const b = e.target.closest('[data-p]'); if (b) acaoPainel(id, b.dataset.p, b.dataset.v, m, ev); };
    const rg = $('#rolRange', pn);
    if (rg) rg.oninput = () => { rolagem.vel = +rg.value; $('#rolVel').textContent = rolagem.vel; };
    const lv = $('#liveVideo', pn);
    if (lv) lv.onchange = () => { live.yid = lv.value; };
    const mr = $('#metroRange', pn);
    if (mr) mr.oninput = () => mudarBpm(m, +mr.value);
    if (id === 'afinador') { afin.instr = ev.v.instrumento; afin.abaixo = ev.teclado ? 0 : ev.v.afinacao; if (!afin.ativo && !afin.recusado) ligarAfinador(); else desenharAfinador(); }
    posicionarPainel(id);
  }
  async function acaoPainel(id, p, val, m, ev) {
    const cfg = D.estado.config, v = ev.v;
    const lim = (x, a, b) => Math.max(a, Math.min(b, x));
    switch (p) {
      case 'fechar': fecharPainel(); return;
      case 'rolar': rolagem.ativa ? pararRolagem() : iniciarRolagem(); return;
      case 'vel': rolagem.vel = lim(rolagem.vel + +val, 1, 10); $('#rolVel').textContent = rolagem.vel; $('#rolRange').value = rolagem.vel; return;
      case 'restaurar':
        if (id === 'tom') await salvarVisual(m, { semitons: 0 });
        else if (id === 'capo') await salvarVisual(m, { capo: Number(m.capo) || 0 });
        else if (id === 'afinacao') await salvarVisual(m, { afinacao: 0 });
        else if (id === 'texto') await D.salvarConfig({ tamanhoFonte: 100 });
        break;
      case 'colunas': await D.salvarConfig({ colunas: +val }); break;
      case 'instr': await salvarVisual(m, { instrumento: val }); await D.salvarConfig({ instrumento: val }); break;
      case 'mostrardiag': {
        const l = lerLayout();
        if (val === '1') { l.ocultos = l.ocultos.filter((b) => b !== 'acordes'); colocarBloco(l, 'acordes'); } else if (!l.ocultos.includes('acordes')) l.ocultos.push('acordes');
        await salvarLayout(l); break;
      }
      case 'layout': editandoLayout = true; fecharPainel(); viewMusica(m.id); return;
      case 'diagtam': await D.salvarConfig({ diagTam: lim((cfg.diagTam || 100) + +val * 10, 60, 180) }); break;
      case 'canhoto': await D.salvarConfig({ canhoto: val === '1' }); break;
      case 'tom': await salvarVisual(m, { semitons: lim(v.semitons + +val, -6, 6) }); break;
      case 'tomabs': await salvarVisual(m, { semitons: +val }); break;
      case 'capo': await salvarVisual(m, { capo: +val }); break;
      case 'afin': await salvarVisual(m, { afinacao: +val }); break;
      case 'tabs': await D.salvarConfig({ mostrarTabs: val === '1' }); break;
      case 'fonte': await D.salvarConfig({ tamanhoFonte: lim((cfg.tamanhoFonte || 100) + +val * 10, 60, 220) }); break;
      case 'metro': metro.ativo ? pararMetro() : iniciarMetro(); atualizarMetroUI(); return;
      case 'bpm': mudarBpm(m, metro.bpm + +val); return;
      case 'tap': {
        const agora = performance.now();
        metro.toques = metro.toques.filter((t) => agora - t < 2500).concat(agora);
        if (metro.toques.length >= 2) {
          const ints = metro.toques.slice(1).map((t, k) => t - metro.toques[k]).slice(-4);
          mudarBpm(m, Math.round(60000 / (ints.reduce((a, b) => a + b, 0) / ints.length)));
        }
        return;
      }
      case 'compasso': metro.compasso = +val; metro.batida = 0; abrirPainel('metronomo', m); return;
      case 'afinref': G.tocar([+val]); return;
      case 'afinligar': afin.recusado = false; ligarAfinador(); return;
      case 'livegravar': iniciarGravacao(m, false); return;
      case 'livecontinuar': iniciarGravacao(m, true); return;
      case 'livemarcar': marcarAcorde(); return;
      case 'livedesfazer': desfazerMarca(); return;
      case 'liveparar': pararLive(true); return;
      case 'livetocar': iniciarLive(m); return;
      case 'livejanela': live.janela = Math.max(1, Math.min(8, live.janela + +val)); abrirPainel('live', m); return;
      case 'liveapagar': delete m.live; await D.salvarMusica(m, { silencioso: true }); toast('Tempos apagados'); abrirPainel('live', m); return;
      default: return;
    }
    viewMusica(m.id);
  }
  document.addEventListener('click', (e) => {
    const pn = $('#painel');
    if (!pn.hidden && !e.composedPath().some((n) => n === pn || (n.classList && (n.classList.contains('trilho') || n.hasAttribute && n.hasAttribute('data-abre-painel'))))) fecharPainel();
    const mais = $('#trilhoMais');
    if (mais && !mais.hidden && !e.composedPath().some((n) => n.classList && n.classList.contains('trilho__opcoes'))) { mais.hidden = true; $('#tbOpcoes').setAttribute('aria-expanded', 'false'); }
  });
  window.addEventListener('resize', () => { if (painelAberto) posicionarPainel(painelAberto); });
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || !$('#trilho') || live.modo || e.target.closest('input,textarea,select,button,[contenteditable],.acorde')) return;
    e.preventDefault(); rolagem.ativa ? pararRolagem() : iniciarRolagem();
  });

  // ---------- diagramas e lateral ----------
  function renderDiagramas(box, m, ev, aoMudar) {
    const cfg = D.estado.config, instr = ev.v.instrumento;
    const naLetra = C.acordesUsados(C.analisar(m.cifra), ev.deslocamento, ev.bemol);
    const extras = (m.bibliotecaAcordes || []).map((n) => A.transporNome(n, ev.deslocamento, ev.bemol)).filter((n) => !naLetra.includes(n));
    const usados = naLetra.concat([...new Set(extras)]);
    if (!usados.length) return false;
    box.innerHTML = `<div class="diag-cab"><h3>Acordes · ${esc(A.INSTRUMENTOS[instr].nome)}</h3><button class="btn peq ghost" data-abre-painel="diagramas">${ic('settings', 14)}Diagramas</button></div>
      <div class="grade-diagramas${ehTeclado(instr) ? ' teclado' : ''}" style="--diag-tam:${(cfg.diagTam || 100) / 100}"></div>`;
    $('[data-abre-painel]', box).onclick = (e) => { e.stopPropagation(); abrirPainel('diagramas', m); };
    const grade = $('.grade-diagramas', box);
    const indices = (m._indices = m._indices || {});
    for (const nome of usados) {
      const lista = listaFormas(nome, instr, m);
      const card = document.createElement('div');
      card.className = 'cartao-acorde' + (!lista.length ? ' sem-forma' : '') + (naLetra.includes(nome) ? '' : ' fora-da-letra');
      if (!naLetra.includes(nome)) card.title = 'Na biblioteca da música, ainda não está na letra';
      card.dataset.acorde = nome;
      const pinta = () => {
        const i = Math.min(indices[nome] || 0, Math.max(0, lista.length - 1));
        const forma = lista[i];
        card.innerHTML = `<button class="nome${/\*$/.test(nome) ? ' aprox' : ''}" data-acorde="${esc(nome)}" title="Ver e editar ${esc(nome)}">${esc(nome)}</button>${forma && forma.origem === 'fixa' ? '<span class="fixa" title="Forma fixada nesta música"></span>' : ''}<button class="cartao-editar" title="Editar este acorde nesta música" aria-label="Editar ${esc(nome)}">${ic('pencil', 13)}</button>`;
        $('.cartao-editar', card).onclick = (e) => { e.stopPropagation(); editarNoBloco(m, ev, nome, forma, null, aoMudar); };
        $('.nome', card).onclick = (e) => { e.stopPropagation(); abrirPopoverAcorde(e.currentTarget, nome, Object.assign(viewMusica.ctxAcorde(e.currentTarget), { posicao: null })); };
        if (forma) {
          const svg = desenhar(nome, instr, forma);
          svg.addEventListener('click', () => tocarForma(nome, instr, forma));
          card.appendChild(svg);
          if (ehTeclado(instr) && forma.rotulo) card.insertAdjacentHTML('beforeend', `<div class="rotulo-forma">${esc(forma.rotulo)}</div>`);
        } else card.insertAdjacentHTML('beforeend', '<div class="dica" style="padding:14px 4px;text-align:center">sem forma</div>');
        if (lista.length > 1) {
          const nav = document.createElement('div'); nav.className = 'var';
          nav.innerHTML = `<button aria-label="Forma anterior">${ic('left', 14)}</button><span>${i + 1}/${lista.length}</span><button aria-label="Próxima forma">${ic('right', 14)}</button>`;
          const [ant, , prox] = nav.children;
          ant.onclick = () => { indices[nome] = (i - 1 + lista.length) % lista.length; pinta(); };
          prox.onclick = () => { indices[nome] = (i + 1) % lista.length; pinta(); };
          card.appendChild(nav);
        }
      };
      pinta();
      grade.appendChild(card);
    }
    return true;
  }

  /** Abre o editor dentro do cartão do acorde, no bloco Acordes. Devolve false se o cartão não está na tela. */
  function editarNoBloco(m, ev, nome, forma, pos, aoMudar) {
    const achar = () => $$('#blocoAcordes .cartao-acorde').find((c) => c.dataset.acorde === nome);
    if (!achar()) return false;
    if ($('#blocoAcordes .cartao-acorde.editando')) aoMudar(); // um editor por vez: redesenha antes
    const card = achar();
    if (!card) return false;
    const ctx = Object.assign(viewMusica.ctxAcorde(card), { posicao: pos || null });
    card.classList.add('editando'); card.innerHTML = '';
    montarEditor(card, nome, forma, ctx, { aoFechar: aoMudar, aoVoltar: aoMudar });
    card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return true;
  }

  function htmlVideos(videos) {
    if (!videos.length) return '';
    return `<div class="bloco"><h3>Vídeos</h3><div style="display:flex;flex-direction:column;gap:10px">${videos.map((vd) => {
      const yid = idYoutube(vd.url);
      const rot = esc(vd.rotulo || 'Vídeo');
      if (!yid) return `<div class="video"><div class="rot"><span>${rot}</span><a href="${esc(vd.url)}" target="_blank" rel="noopener">Abrir ${ic('external', 13)}</a></div></div>`;
      const ini = inicioYoutube(vd.url);
      const servidor = /^https?:$/.test(location.protocol);
      const corpo = servidor
        ? `<iframe data-yid="${yid}" src="https://www.youtube.com/embed/${yid}?rel=0&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}${ini ? '&start=' + ini : ''}" title="${rot}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`
        : `<button type="button" class="thumb thumb--arquivo" data-tocar-aqui style="background-image:url('https://i.ytimg.com/vi/${yid}/hqdefault.jpg')" title="Tocar aqui"><span class="play-badge">${ic('play', 20)}</span></button>`;
      return `<div class="video">${corpo}<div class="rot"><span>${rot}</span><a href="${esc(vd.url)}" target="_blank" rel="noopener">YouTube ${ic('external', 13)}</a></div></div>`;
    }).join('')}</div>${/^https?:$/.test(location.protocol) ? '<p class="dica" style="margin-top:6px">Se aparecer "vídeo indisponível", o dono do vídeo não deixa tocar fora do YouTube: use o link YouTube.</p>' : `<p class="dica" style="margin-top:6px">Aberto como arquivo, o YouTube só deixa o vídeo tocar aqui com o servidor local ligado. Abra pelo lançador <b>Repertor.io</b> (ou <code>abrir.sh</code>): o app passa para lá sozinho, com as suas músicas.</p>`}</div>`;
  }

  // =====================================================================
  // ACORDES NA LETRA: arrastar para os lados (ou outra linha), clicar para pôr,
  // tirar, e a biblioteca de acordes da música para ir distribuindo
  // =====================================================================
  const edAc = { ativo: false, musica: null, sel: null, pilha: [] };
  const nomeValido = (n) => (A.ehAcorde(n) ? n : A.ehAcorde(n + '*') ? n + '*' : null);
  function conversores(ev) {
    const desl = ev.deslocamento;
    const bemolTexto = ev.tomBase ? A.tomPedeBemol(ev.tomBase) : undefined;
    return { tela: (n) => (desl ? A.transporNome(n, desl, ev.bemol) : n), paraTexto: (n) => (desl ? A.transporNome(n, -desl, bemolTexto) : n) };
  }
  function nomesDaMusica(m) {
    const usados = C.acordesUsados(C.analisar(m.cifra));
    return { usados, todos: [...new Set(usados.concat(m.bibliotecaAcordes || []))] };
  }
  /** Acrescenta um acorde (nome como aparece na tela) à biblioteca da música e já deixa escolhido. */
  async function addBiblioteca(m, ev, nomeTela, redesenhar) {
    const n = nomeValido(String(nomeTela || '').trim());
    if (!n) { toast('Comece o nome pela nota (A a G), ex.: Am7'); return false; }
    const tx = conversores(ev).paraTexto(n);
    m.bibliotecaAcordes = [...new Set([...(m.bibliotecaAcordes || []), tx])];
    edAc.sel = tx;
    await D.salvarMusica(m, { silencioso: true });
    toast(n + ' pronto: puxe para a letra ou clique na sílaba');
    redesenhar();
    return true;
  }

  /** Lista lateral do modo de edição: busca/cria acorde (com diagrama) e acordes da música para puxar. */
  function montarPaleta(m, ev, redesenhar, sair, desfazer) {
    const pal = $('#edPaleta'); if (!pal) return;
    const { tela } = conversores(ev);
    const instr = ev.v.instrumento;
    const { usados, todos } = nomesDaMusica(m);
    const bib = m.bibliotecaAcordes || [];
    pal.innerHTML = `<div class="ed-paleta__topo"><span class="rotulo">Acordes da música</span>
        <span class="ed-paleta__acoes"><button class="btn peq quad ghost" id="edDesfazer" ${edAc.pilha.length ? '' : 'disabled'} title="Desfazer (Ctrl+Z)" aria-label="Desfazer">${ic('undo', 15)}</button><button class="btn peq prim" id="edOk">${ic('check', 14)}Concluir</button></span></div>
      <div class="pal-novo">
        <div class="pal-busca">${ic('search', 15)}<input type="search" id="palBusca" placeholder="Buscar ou criar (ex.: F#m7)" autocomplete="off" spellcheck="false"></div>
        <div class="pal-sugestoes" id="palSug"></div>
        <div class="pal-previa" id="palPrevia" hidden></div>
      </div>
      <p class="dica pal-dica">${edAc.sel ? `<b class="ac">${esc(tela(edAc.sel))}</b> escolhido: clique na letra onde ele entra.` : 'Puxe um acorde para a letra, ou clique nele e depois nas sílabas.'}</p>
      <div class="pal-lista${ehTeclado(instr) ? ' teclado' : ''}" id="palLista">${todos.length ? '' : '<p class="dica">Nenhum acorde ainda. Busque acima para criar.</p>'}</div>`;
    $('#edDesfazer', pal).onclick = desfazer;
    $('#edOk', pal).onclick = sair;
    // cartões arrastáveis (mãozinha)
    const lista = $('#palLista', pal);
    for (const n of todos) {
      const nt = tela(n);
      const fs = listaFormas(nt, instr, m);
      const forma = fs[Math.min((m._indices || {})[nt] || 0, Math.max(0, fs.length - 1))];
      const card = document.createElement('div');
      card.className = 'pal-card' + (edAc.sel === n ? ' sel' : '') + (usados.includes(n) ? '' : ' fora');
      card.dataset.nome = n;
      card.title = usados.includes(n) ? 'Puxe para a letra ou clique para escolher' : 'Ainda não está na letra';
      card.innerHTML = `<span class="pal-card__nome">${esc(nt)}</span>${bib.includes(n) && !usados.includes(n) ? `<button class="pal-x" data-tira-bib="${esc(n)}" title="Tirar da lista" aria-label="Tirar ${esc(nt)} da lista">${ic('x', 11)}</button>` : ''}`;
      if (forma) card.appendChild(desenhar(nt, instr, forma, { largura: ehTeclado(instr) ? 170 : 80, passoY: 15 }));
      lista.appendChild(card);
    }
    $$('[data-tira-bib]', pal).forEach((b) => b.addEventListener('pointerdown', (e) => e.stopPropagation()));
    $$('[data-tira-bib]', pal).forEach((b) => (b.onclick = async (e) => {
      e.stopPropagation();
      m.bibliotecaAcordes = (m.bibliotecaAcordes || []).filter((x) => x !== b.dataset.tiraBib);
      if (edAc.sel === b.dataset.tiraBib) edAc.sel = null;
      await D.salvarMusica(m, { silencioso: true }); redesenhar();
    }));

    // criar novo: busca pelo nome, com o diagrama
    const busca = $('#palBusca', pal), sug = $('#palSug', pal), prev = $('#palPrevia', pal);
    const SUFIXOS = A.MODELOS.map((x) => x.sufixo);
    const sugerir = (q) => {
      q = q.trim().replace(/^[a-g]/, (c) => c.toUpperCase());
      const r = /^([A-G][#b]?)(.*)$/.exec(q);
      if (!r) return [];
      const lista2 = SUFIXOS.map((sf) => r[1] + sf).filter((n) => n.startsWith(q));
      if (A.ehAcorde(q) && !lista2.includes(q)) lista2.unshift(q);
      return lista2.slice(0, 14);
    };
    let escolhido = null, iForma = 0;
    const mostrarPrevia = () => {
      if (!escolhido) { prev.hidden = true; return; }
      const fs = listaFormas(escolhido, instr, m);
      iForma = Math.min(iForma, Math.max(0, fs.length - 1));
      const f = fs[iForma];
      prev.hidden = false;
      prev.innerHTML = `<div class="pal-previa__topo"><b class="ac">${esc(escolhido)}</b><span class="mut">${esc(A.descreverIntervalos(escolhido))}</span></div><div class="pal-previa__diag"></div>
        ${fs.length > 1 ? `<div class="var"><button data-pf="-1" aria-label="Forma anterior">${ic('left', 14)}</button><span>${ehTeclado(instr) && f && f.rotulo ? esc(f.rotulo) : iForma + 1 + '/' + fs.length}</span><button data-pf="1" aria-label="Próxima forma">${ic('right', 14)}</button></div>` : ''}
        <div class="acoes"><button class="btn peq prim" id="palAdd">${ic('plus', 14)}Adicionar</button><button class="btn peq ghost" id="palMontar" title="Tirar ou colocar notas antes de adicionar">${ic('pencil', 13)}Montar notas</button></div>`;
      if (f) { const svg = desenhar(escolhido, instr, f, { largura: ehTeclado(instr) ? 220 : 120, passoY: 20 }); svg.onclick = () => tocarForma(escolhido, instr, f); $('.pal-previa__diag', prev).appendChild(svg); }
      else $('.pal-previa__diag', prev).innerHTML = '<p class="dica">Sem forma pronta: use Montar notas.</p>';
      $$('[data-pf]', prev).forEach((b) => (b.onclick = () => { iForma = (iForma + +b.dataset.pf + fs.length) % fs.length; mostrarPrevia(); }));
      $('#palAdd', prev).onclick = async () => {
        if (f && (iForma > 0 || f.origem !== 'gerada')) { m.formas = m.formas || {}; m.formas[instr + ':' + escolhido] = f.texto; }
        await addBiblioteca(m, ev, escolhido, redesenhar);
      };
      $('#palMontar', prev).onclick = () => {
        prev.innerHTML = ''; prev.classList.add('editando');
        montarEditor(prev, escolhido, f, { musica: m, instr, bemol: ev.bemol, rotuloSalvar: 'Adicionar à música', aoTrocar: (novo) => addBiblioteca(m, ev, novo, redesenhar) },
          { aoFechar: () => { prev.classList.remove('editando'); mostrarPrevia(); }, aoVoltar: () => { prev.classList.remove('editando'); mostrarPrevia(); } });
      };
    };
    const pintarSug = () => {
      const lst = sugerir(busca.value);
      if (busca.value.trim() && !lst.length) { sug.innerHTML = '<span class="dica">Comece pela nota (A a G).</span>'; escolhido = null; mostrarPrevia(); return; }
      sug.innerHTML = lst.map((n) => `<button class="chip${n === escolhido ? ' ativo' : ''}" data-sug="${esc(n)}">${esc(n)}</button>`).join('');
      if (!lst.includes(escolhido)) { escolhido = lst[0] || null; iForma = 0; }
      $$('[data-sug]', sug).forEach((b) => (b.onclick = () => { escolhido = b.dataset.sug; iForma = 0; pintarSug(); }));
      $$('[data-sug]', sug).forEach((b) => b.classList.toggle('ativo', b.dataset.sug === escolhido));
      mostrarPrevia();
    };
    busca.addEventListener('input', pintarSug);
    busca.addEventListener('keydown', (e) => { if (e.key === 'Enter' && escolhido) { e.preventDefault(); $('#palAdd', prev) && $('#palAdd', prev).click(); } });
  }

  // lixeira que aparece enquanto se arrasta um acorde ou uma linha no modo de edição
  function mostrarLixeira() {
    let lx = document.getElementById('edLixeira');
    if (!lx) { lx = document.createElement('div'); lx.id = 'edLixeira'; lx.className = 'ed-lixeira'; lx.innerHTML = `${ic('trash', 18)}<span>Solte aqui para tirar</span>`; document.body.appendChild(lx); }
    lx.classList.remove('alvo'); lx.hidden = false;
    const sb = document.getElementById('edSel'); if (sb) sb.hidden = true;
  }
  function esconderLixeira() { const lx = document.getElementById('edLixeira'); if (lx) { lx.hidden = true; lx.classList.remove('alvo'); } const sb = document.getElementById('edSel'); if (sb) sb.hidden = false; }
  function sobreLixeira(e) {
    const lx = document.getElementById('edLixeira'); if (!lx || lx.hidden) return false;
    const r = lx.getBoundingClientRect(), pad = 12;
    const dentro = e.clientX >= r.left - pad && e.clientX <= r.right + pad && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
    lx.classList.toggle('alvo', dentro); return dentro;
  }
  function fecharMenuAcorde() { const mn = document.getElementById('acMenu'); if (mn) { mn.hidden = true; mn.classList.remove('ed-ml'); } $$('.ac-chip.sel').forEach((c) => c.classList.remove('sel')); $$('.ed-mais.aberto').forEach((b) => b.classList.remove('aberto')); }

  function montarEdicao(m, ev, redesenhar, sair) {
    const box = $('#cifraEd');
    const { tela, paraTexto } = conversores(ev);
    const est = C.estrutura(m.cifra);
    const aplicar = async (msg) => {
      if (!edAc.manterSel) edAc.selecao = null; edAc.manterSel = false; // a seleção de linhas só sobrevive a mudanças que não mexem na ordem
      edAc.pilha.push(m.cifra); if (edAc.pilha.length > 60) edAc.pilha.shift();
      m.cifra = C.serializar(est);
      await D.salvarMusica(m, { silencioso: true });
      if (msg) toast(msg);
      redesenhar();
    };
    const desfazer = async () => { if (!edAc.pilha.length) return; m.cifra = edAc.pilha.pop(); await D.salvarMusica(m, { silencioso: true }); redesenhar(); };
    montarPaleta(m, ev, redesenhar, sair, desfazer);

    // desenha
    // linha nova (botão +): entra só na tela até ganhar texto
    if (edAc.novaLinha != null) est.splice(Math.min(edAc.novaLinha, est.length), 0, { tipo: 'par', acordes: [], letra: '', nova: true });
    // mesmas classes e mesmas partes da leitura, para o espaçamento não mudar
    const cfgEd = D.estado.config || {};
    const linhaHtml = (it, i) => {
      if (it.tipo === 'outro') {
        if (it.classe === 'secao') return { secao: it.exibir || it.texto, attrs: ` data-p="${i}" title="Clique para trocar o nome ou tirar a parte"` };
        if (it.classe === 'tab') return { html: `<div class="ln ln-tab ed-linha" data-p="${i}"${cfgEd.mostrarTabs === false ? ' hidden' : ''}>${esc(it.texto)}</div>` };
        if (!it.texto.trim()) return { html: `<div class="par ed-linha par--branca" data-p="${i}"><div class="par__acordes sem-acordes" data-p="${i}"></div><div class="par__letra" data-p="${i}"> </div></div>`, vazio: true }; // aceita acorde (vira linha de acordes) e texto
        return { html: `<div class="ln ln-outro ed-linha" data-p="${i}">${esc(it.texto)}</div>` };
      }
      const chips = it.acordes.map((a, j) => `<span class="ac-chip${a.nucleo ? '' : ' marca'}${/\*$/.test(a.nucleo || '') ? ' aprox' : ''}" data-p="${i}" data-a="${j}" data-col="${a.col}"${a.nucleo ? ` data-acorde="${esc(tela(a.nucleo))}"` : ''}>${esc(a.nucleo ? a.texto.replace(a.nucleo, tela(a.nucleo)) : a.texto)}</span>`).join('');
      return { html: `<div class="par ed-linha" data-p="${i}"><div class="par__acordes${it.acordes.length ? '' : ' sem-acordes'}" data-p="${i}">${chips}</div><div class="par__letra${it.letra == null ? ' sem-letra' : ''}" data-p="${i}">${it.letra != null ? esc(it.letra) : ''}</div></div>` };
    };
    box.innerHTML = C.partesHtml(est.map(linhaHtml));
    if (!est.length || !est.some((x) => x.tipo === 'par')) box.insertAdjacentHTML('beforeend', '<div class="par ed-linha" data-p="nova"><div class="par__acordes sem-acordes" data-p="nova"></div><div class="par__letra mut" data-p="nova">Sem letra ainda: use o + à esquerda para escrever linhas e pôr partes, ou clique aqui para pôr acordes.</div></div>');
    const med = document.createElement('span'); med.className = 'medidor'; med.textContent = '0'.repeat(40); box.appendChild(med);
    const chW = med.getBoundingClientRect().width / 40 || 9; med.remove();
    box.style.setProperty('--ch', chW + 'px');
    const larg = Math.max(40, ...est.map((it) => (it.tipo === 'par' ? Math.max((it.letra || '').length, ...it.acordes.map((a) => a.col + a.texto.length)) : it.texto.length))) + 12;
    $$('.par', box).forEach((p) => (p.style.minWidth = larg * chW + 'px'));
    $$('.ac-chip', box).forEach((c) => (c.style.left = +c.dataset.col * chW + 'px'));

    const parDe = (el) => { const p = el && el.closest && el.closest('.par'); if (!p) return null; if (p.dataset.p === 'nova') { est.push({ tipo: 'par', acordes: [], letra: null }); p.dataset.p = est.length - 1; } const it = est[+p.dataset.p]; if (it && it.tipo === 'outro') est[+p.dataset.p] = { tipo: 'par', acordes: [], letra: null }; return p; };
    const colDe = (x, par) => Math.max(0, Math.round((x - par.getBoundingClientRect().left) / chW));
    const guia = document.createElement('span'); guia.className = 'ac-guia'; guia.hidden = true;

    // menu pequeno: pôr acorde / trocar / tirar
    const abrirMenu = (x, y, modo, alvo) => {
      let mn = document.getElementById('acMenu');
      if (!mn) { mn = document.createElement('div'); mn.id = 'acMenu'; mn.className = 'ac-menu'; document.body.appendChild(mn); }
      const { todos } = nomesDaMusica(m);
      const ac = modo === 'trocar' ? est[alvo.p].acordes[alvo.a] : null;
      const atual = ac ? (ac.nucleo ? tela(ac.nucleo) : ac.texto) : '';
      mn.innerHTML = `<form class="ac-menu__f"><input type="text" id="acMenuNome" value="${esc(atual)}" placeholder="${modo === 'trocar' ? 'Novo nome' : 'Acorde'}" autocomplete="off" spellcheck="false"><button class="btn peq prim">${modo === 'trocar' ? 'Trocar' : 'Pôr'}</button></form>
        ${todos.length ? `<div class="ac-menu__chips">${todos.slice(0, 16).map((n) => `<button type="button" class="chip" data-por="${esc(n)}">${esc(tela(n))}</button>`).join('')}</div>` : ''}
        ${modo === 'trocar' && ac && ac.nucleo ? `<button type="button" class="btn peq ac-menu__diag" id="acMenuDiag">${ic('grid', 14)}Trocar pelo diagrama<span class="dica">tirar ou pôr notas</span></button>` : ''}
        ${modo === 'trocar' ? `<div class="acoes"><button type="button" class="btn peq perigo" id="acMenuTirar">${ic('x', 13)}Tirar</button><span class="dica">ou tecla Delete</span></div>` : ''}
        <p class="dica ac-menu__aviso" id="acMenuAviso"></p>`;
      mn.hidden = false;
      const w = mn.offsetWidth, h = mn.offsetHeight;
      mn.style.left = Math.max(8, Math.min(x - 20, window.innerWidth - w - 8)) + 'px';
      mn.style.top = (y + h + 12 > window.innerHeight ? Math.max(8, y - h - 12) : y + 12) + 'px';
      const inp = $('#acMenuNome', mn); inp.focus(); inp.select();
      const confirmar = (nomeTela) => {
        const bruto = String(nomeTela || '').trim();
        if (modo === 'trocar' && !est[alvo.p].acordes[alvo.a].nucleo && bruto && !nomeValido(bruto)) {
          // marcação que não é acorde ([Intro], |, (2x)…): edita o texto como está
          const a = est[alvo.p].acordes[alvo.a]; a.texto = bruto.replace(/\s+/g, ''); fecharMenuAcorde(); aplicar(); return;
        }
        const n = nomeValido(bruto);
        if (!n) { $('#acMenuAviso', mn).textContent = 'Comece o nome pela nota (A a G), ex.: Am7.'; return; }
        const tx = paraTexto(n);
        fecharMenuAcorde();
        if (modo === 'trocar') {
          const a = est[alvo.p].acordes[alvo.a];
          a.texto = a.nucleo && a.texto.includes(a.nucleo) ? a.texto.replace(a.nucleo, tx) : tx; a.nucleo = tx;
          aplicar();
        } else { est[alvo.p].acordes.push({ texto: tx, nucleo: tx, col: alvo.col }); aplicar(); }
      };
      $('form', mn).onsubmit = (e) => { e.preventDefault(); confirmar(inp.value); };
      $$('[data-por]', mn).forEach((b) => (b.onclick = () => confirmar(tela(b.dataset.por))));
      const dg = $('#acMenuDiag', mn);
      if (dg) dg.onclick = () => {
        const chip = box.querySelector(`.ac-chip[data-p="${alvo.p}"][data-a="${alvo.a}"]`);
        fecharMenuAcorde();
        abrirPopoverAcorde(chip || dg, tela(ac.nucleo), {
          musica: m, instr: ev.v.instrumento, bemol: ev.bemol, aoMudar: redesenhar, editarDireto: true,
          posicao: { p: alvo.p, a: alvo.a }, rotuloSalvar: 'Trocar todos iguais',
          aoTrocar: async (novoTela, escopo) => {
            const tx = paraTexto(novoTela), velho = ac.nucleo;
            const troca = (x) => { x.texto = x.texto.includes(x.nucleo) ? x.texto.replace(x.nucleo, tx) : tx; x.nucleo = tx; };
            if (escopo === 'aqui') troca(est[alvo.p].acordes[alvo.a]);
            else est.forEach((it) => it.tipo === 'par' && it.acordes.forEach((x) => { if (x.nucleo === velho) troca(x); }));
            await aplicar(velho === tx ? 'Forma guardada nesta música' : `${tela(velho)} → ${novoTela}${escopo === 'aqui' ? '' : ' em toda a música'}`);
          },
        });
      };
      const tr = $('#acMenuTirar', mn);
      if (tr) tr.onclick = () => { fecharMenuAcorde(); est[alvo.p].acordes.splice(alvo.a, 1); aplicar(); };
      inp.onkeydown = (e) => { if (e.key === 'Escape') fecharMenuAcorde(); };
    };

    // arrastar: acordes da cifra e da paleta (mouse e toque)
    let arr = null;
    const inicio = (e) => {
      if (e.button > 0) return;
      if (e.target.closest('.ed-ctl,.parte__rot,.ed-linha-input')) return;
      if (e.shiftKey && e.target.closest('.ed-linha')) return; // Shift+clique = selecionar linhas
      const aberta = box.querySelector('.ed-linha-input'); if (aberta) { aberta.blur(); return; } // clique fora da linha em edição só confirma o texto
      const chip = e.target.closest('.ac-chip'), pal = e.target.closest('.pal-card');
      if (e.target.closest('.pal-x')) return;
      if (chip) { const r = chip.getBoundingClientRect(); arr = { tipo: 'chip', el: chip, p: +chip.dataset.p, a: +chip.dataset.a, dx: e.clientX - r.left, x0: e.clientX, y0: e.clientY, moveu: false, copia: e.altKey || e.ctrlKey }; }
      else if (pal) arr = { tipo: 'paleta', el: pal, nome: pal.dataset.nome, x0: e.clientX, y0: e.clientY, moveu: false };
      else { const par = e.target.closest('.par'); if (!par) return; arr = { tipo: 'clique', par, x0: e.clientX, y0: e.clientY }; }
      e.preventDefault();
      document.addEventListener('pointermove', mover); document.addEventListener('pointerup', fim, { once: true });
    };
    const mover = (e) => {
      if (!arr || arr.tipo === 'clique') return;
      if (!arr.moveu && Math.hypot(e.clientX - arr.x0, e.clientY - arr.y0) < 4) return;
      if (!arr.moveu) {
        arr.moveu = true; fecharMenuAcorde();
        arr.fantasma = document.createElement('span'); arr.fantasma.className = 'ac-fantasma'; arr.fantasma.textContent = arr.tipo === 'paleta' ? tela(arr.nome) : arr.el.textContent;
        document.body.appendChild(arr.fantasma);
        if (arr.tipo === 'chip') { arr.el.classList.add('arrastando'); mostrarLixeira(); }
        box.classList.add('com-arraste');
      }
      arr.fantasma.style.left = e.clientX - (arr.dx || 12) + 'px'; arr.fantasma.style.top = e.clientY - 14 + 'px';
      if (arr.tipo === 'chip') { // Alt ou Ctrl: duplica (o original fica)
        arr.copia = arr.copia || e.altKey || e.ctrlKey;
        arr.el.classList.toggle('arrastando', !arr.copia); arr.fantasma.classList.toggle('copia', arr.copia);
      }
      arr.lixo = arr.tipo === 'chip' && sobreLixeira(e);
      if (arr.lixo) { arr.alvo = null; guia.hidden = true; return; }
      const sob = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.closest && el.closest('#cifraEd .par'));
      const par = sob && sob.closest('.par');
      if (par) { const col = colDe(e.clientX - (arr.dx || 12), par); arr.alvo = { par, col }; const lane = $('.par__acordes', par); if (guia.parentNode !== lane) lane.appendChild(guia); guia.hidden = false; guia.style.left = col * chW + 'px'; }
      else { arr.alvo = null; guia.hidden = true; }
    };
    const fim = (e) => {
      document.removeEventListener('pointermove', mover);
      const a = arr; arr = null; guia.hidden = true; box.classList.remove('com-arraste'); esconderLixeira();
      if (!a) return;
      if (a.fantasma) a.fantasma.remove();
      if (a.tipo === 'clique') {
        if (Math.hypot(e.clientX - a.x0, e.clientY - a.y0) > 6) return;
        const par = parDe(a.par); const p = +par.dataset.p, col = colDe(e.clientX, par);
        if (edAc.sel) { est[p].acordes.push({ texto: edAc.sel, nucleo: edAc.sel, col }); aplicar(); }
        else abrirMenu(e.clientX, e.clientY, 'por', { p, col });
        return;
      }
      if (!a.moveu) {
        if (a.tipo === 'chip') { fecharMenuAcorde(); a.el.classList.add('sel'); edAc.chipSel = { p: a.p, a: a.a }; const r = a.el.getBoundingClientRect(); abrirMenu(r.left, r.bottom, 'trocar', { p: a.p, a: a.a }); }
        else { edAc.sel = edAc.sel === a.nome ? null : a.nome; redesenhar(); }
        return;
      }
      if (a.el) a.el.classList.remove('arrastando');
      if (a.lixo && a.tipo === 'chip') { if (!a.copia) { est[a.p].acordes.splice(a.a, 1); aplicar(); } return; }
      if (!a.alvo) return;
      const destino = parDe(a.alvo.par); const pd = +destino.dataset.p;
      if (a.tipo === 'chip' && (a.copia || e.altKey || e.ctrlKey)) { const o = est[a.p].acordes[a.a]; est[pd].acordes.push({ texto: o.texto, nucleo: o.nucleo, col: a.alvo.col }); }
      else if (a.tipo === 'chip') { const [ac] = est[a.p].acordes.splice(a.a, 1); ac.col = a.alvo.col; est[pd].acordes.push(ac); }
      else est[pd].acordes.push({ texto: a.nome, nucleo: a.nome, col: a.alvo.col });
      aplicar();
    };
    box.addEventListener('pointerdown', inicio);
    $('#palLista').addEventListener('pointerdown', inicio);
    // passar o mouse num acorde mostra o diagrama em cima dele (como na leitura)
    box.addEventListener('mouseover', (e) => {
      const c = e.target.closest('.ac-chip[data-acorde]');
      if (!c || box.classList.contains('com-arraste')) return;
      const mn = document.getElementById('acMenu'); if (mn && !mn.hidden) return;
      mostrarDicaAcorde(c, c.dataset.acorde, m, ev.v.instrumento, true);
    });
    box.addEventListener('mouseout', (e) => { if (e.target.closest('.ac-chip')) esconderDicaAcorde(); });
    box.addEventListener('pointerdown', esconderDicaAcorde);
    ligarLinhas(box, est, aplicar, redesenhar);

    // teclado: Delete tira o acorde escolhido, Ctrl+Z desfaz, Esc solta
    edAc.tecla = (e) => {
      if (!$('#cifraEd') || (e.target.closest && e.target.closest('input,textarea'))) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); desfazer(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && edAc.copiarSelecao && !String(window.getSelection())) { e.preventDefault(); edAc.copiarSelecao(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && edAc.colarAposSelecao && edAc.copia) { e.preventDefault(); edAc.colarAposSelecao(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && edAc.chipSel && $('.ac-chip.sel')) { e.preventDefault(); const { p, a } = edAc.chipSel; edAc.chipSel = null; fecharMenuAcorde(); est[p].acordes.splice(a, 1); aplicar(); return; }
      if (e.key === 'Escape') { fecharMenuAcorde(); if (edAc.sel || edAc.selecao) { edAc.sel = null; edAc.selecao = null; redesenhar(); } }
    };
  }
  // ---------- linhas e partes no modo de edição (botão + à esquerda, como no Notion) ----------
  const PARTES = ['Introdução', 'Verso', 'Pré-refrão', 'Refrão', 'Ponte', 'Solo', 'Interlúdio', 'Final'];
  function ligarLinhas(box, est, aplicar, redesenhar) {
    // botão + que acompanha a linha sob o mouse
    const mais = document.createElement('button');
    mais.type = 'button'; mais.className = 'ed-mais'; mais.title = 'Adicionar linha ou parte'; mais.setAttribute('aria-label', 'Adicionar linha ou parte');
    mais.innerHTML = ic('plus', 13);
    // alça ⋮⋮ ao lado do +: arrastar move a linha (ou a parte inteira, pelo rótulo)
    const alca = document.createElement('span');
    alca.className = 'ed-alca'; alca.title = 'Arraste para mover a linha'; alca.innerHTML = ic('grip', 13);
    const ctl = document.createElement('div'); ctl.className = 'ed-ctl'; ctl.append(alca, mais);
    box.addEventListener('pointermove', (e) => {
      if (box.classList.contains('com-arraste')) return;
      const row = e.target.closest && e.target.closest('.ed-linha');
      if (row && ctl.parentNode !== row && !row.querySelector('.ed-linha-input') && !movendo) row.appendChild(ctl);
    });
    box.addEventListener('pointerleave', () => { if (!mais.classList.contains('aberto') && !movendo) ctl.remove(); });

    const menu = () => {
      let mn = document.getElementById('acMenu');
      if (!mn) { mn = document.createElement('div'); mn.id = 'acMenu'; mn.className = 'ac-menu'; document.body.appendChild(mn); }
      return mn;
    };
    const posicionar = (mn, x, y) => {
      mn.hidden = false;
      const w = mn.offsetWidth, h = mn.offsetHeight;
      mn.style.left = Math.max(8, Math.min(x, window.innerWidth - w - 8)) + 'px';
      mn.style.top = (y + h + 8 > window.innerHeight ? Math.max(8, y - h - 8) : y + 4) + 'px';
    };
    const chipsPartes = (atual) => `<div class="ac-menu__chips">${PARTES.map((n) => `<button type="button" class="chip ed-ml__parte${n === atual ? ' sel' : ''}" data-parte="${esc(n)}">${esc(n)}</button>`).join('')}</div>`;
    const nomeParte = (v) => String(v || '').replace(/[\[\]]/g, '').trim().slice(0, 40);

    // menu do +
    // ---------- copiar / colar / duplicar blocos (partes inteiras ou linhas) ----------
    const ehSecaoK = (k) => est[k] && est[k].tipo === 'outro' && est[k].classe === 'secao';
    const fimParte = (k) => { let j = k + 1; while (j < est.length && !ehSecaoK(j)) j++; while (j - 1 > k && est[j - 1].tipo === 'outro' && est[j - 1].classe === 'vazio') j--; return j; }; // sem as linhas em branco do fim
    const limpo = (itens) => JSON.parse(JSON.stringify(itens)).map((x) => { delete x.nova; return x; });
    const copiar = (itens, rotulo) => {
      edAc.copia = { itens: limpo(itens), rotulo };
      try { navigator.clipboard && navigator.clipboard.writeText(C.serializar(edAc.copia.itens)).catch(() => {}); } catch (e) { /* sem área de transferência: fica só no app */ }
      toast(`Copiado: ${rotulo}. Cole pelo + de qualquer linha`);
    };
    // cola em pos; se cair no meio de uma parte, o que vem depois continua com o nome dela
    const colar = (pos, itens) => {
      const bloco = limpo(itens);
      if (bloco[0] && bloco[0].tipo === 'outro' && bloco[0].classe === 'secao') {
        while (pos > 0 && ehSecaoK(pos - 1)) pos--; // logo depois do nome de uma parte: cola antes dela
        let antigo = null; for (let k = pos - 1; k >= 0; k--) if (ehSecaoK(k)) { antigo = est[k].exibir; break; }
        let resto = false; for (let k = pos; k < est.length && !ehSecaoK(k); k++) if (!(est[k].tipo === 'outro' && est[k].classe === 'vazio')) { resto = true; break; }
        if (resto && antigo != null) bloco.push({ tipo: 'outro', classe: 'secao', texto: '[' + antigo + ']', exibir: antigo });
      }
      est.splice(pos, 0, ...bloco);
      aplicar('Colado');
    };
    edAc.colarAtalho = (pos) => { if (edAc.copia) colar(pos, edAc.copia.itens); };

    const abrirMenuLinha = (p) => {
      const mn = menu(); mn.classList.add('ed-ml');
      const real = p >= 0 && est[p];
      const temTexto = real && (est[p].tipo === 'par' || (est[p].classe === 'vazio'));
      let onde = 'abaixo';
      mn.innerHTML = `<div class="ed-ml__onde" role="group" aria-label="Onde">
          <button type="button" data-onde="abaixo" aria-pressed="true">Abaixo</button><button type="button" data-onde="acima" aria-pressed="false">Acima</button></div>
        ${edAc.copia ? `<button type="button" class="ed-ml__op" data-op="colar">${ic('paste', 15)}<span>Colar ${esc(edAc.copia.rotulo)}</span></button>` : ''}
        <button type="button" class="ed-ml__op" data-op="letra">${ic('type', 15)}<span>Linha de letra<small>Enter cria a próxima</small></span></button>
        <button type="button" class="ed-ml__op" data-op="vazia">${ic('minus', 15)}<span>Linha em branco</span></button>
        ${real && ehLivre(est[p]) ? `<button type="button" class="ed-ml__op" data-op="distribuir">${ic('columns', 15)}<span>Distribuir os acordes<small>espaço igual entre eles (${espaco()})</small></span></button>` : ''}
        <div class="ed-ml__sec">Parte</div>
        ${chipsPartes()}
        <form class="ac-menu__f ed-ml__outra"><input type="text" placeholder="Outro nome (ex.: Riff)" autocomplete="off" spellcheck="false"><button class="btn peq">Pôr</button></form>
        ${real ? `<div class="ed-ml__sep"></div>
        ${temTexto ? `<button type="button" class="ed-ml__op" data-op="editar">${ic('pencil', 15)}<span>Editar o texto desta linha<small>ou dois cliques na letra</small></span></button>` : ''}
        <button type="button" class="ed-ml__op perigo" data-op="apagar">${ic('trash', 15)}<span>Apagar esta linha</span></button>` : ''}
        <p class="dica ed-ml__dica">Shift+clique nas linhas seleciona várias, para marcar como parte ou distribuir acordes.</p>`;
      const r = mais.getBoundingClientRect();
      mais.classList.add('aberto');
      posicionar(mn, r.left, r.bottom);
      const pos = () => (p < 0 ? 0 : onde === 'abaixo' ? p + 1 : p);
      $$('[data-onde]', mn).forEach((b) => (b.onclick = () => { onde = b.dataset.onde; $$('[data-onde]', mn).forEach((x) => x.setAttribute('aria-pressed', x === b)); }));
      const porParte = (nome) => { nome = nomeParte(nome); if (!nome) return; fechar(); est.splice(pos(), 0, { tipo: 'outro', classe: 'secao', texto: '[' + nome + ']', exibir: nome }); aplicar(); };
      $$('[data-parte]', mn).forEach((b) => (b.onclick = () => porParte(b.dataset.parte)));
      $('.ed-ml__outra', mn).onsubmit = (e) => { e.preventDefault(); porParte($('input', e.target).value); };
      $$('[data-op]', mn).forEach((b) => (b.onclick = () => {
        const op = b.dataset.op; fechar();
        if (op === 'letra') { edAc.novaLinha = pos(); redesenhar(); }
        else if (op === 'colar') colar(pos(), edAc.copia.itens);
        else if (op === 'vazia') { est.splice(pos(), 0, { tipo: 'outro', classe: 'vazio', texto: '' }); aplicar(); }
        else if (op === 'editar') abrirInput(p);
        else if (op === 'distribuir') { if (distribuir([p])) aplicar(); }
        else if (op === 'apagar') { est.splice(p, 1); aplicar(); }
      }));
    };
    // menu da parte (clique no rótulo vertical)
    const abrirMenuParte = (rot) => {
      const p = +rot.dataset.p, atual = est[p].exibir || '';
      const mn = menu(); mn.classList.add('ed-ml');
      mn.innerHTML = `<div class="ed-ml__sec">Trocar o nome da parte</div>${chipsPartes(atual)}
        <form class="ac-menu__f ed-ml__outra"><input type="text" value="${esc(atual)}" autocomplete="off" spellcheck="false"><button class="btn peq prim">Salvar</button></form>
        <div class="ed-ml__sep"></div>
        <button type="button" class="ed-ml__op" data-op="copiar">${ic('paste', 15)}<span>Copiar a parte inteira<small>depois cole pelo + de qualquer linha</small></span></button>
        <button type="button" class="ed-ml__op" data-op="duplicar">${ic('more', 15)}<span>Duplicar logo abaixo</span></button>
        <button type="button" class="ed-ml__op perigo" data-op="tirar">${ic('x', 15)}<span>Tirar a parte<small>as linhas continuam</small></span></button>`;
      const r = rot.getBoundingClientRect();
      posicionar(mn, r.right + 4, r.top);
      const trocar = (nome) => { nome = nomeParte(nome); if (!nome) return; fechar(); est[p].texto = '[' + nome + ']'; est[p].exibir = nome; aplicar(); };
      $$('[data-parte]', mn).forEach((b) => (b.onclick = () => trocar(b.dataset.parte)));
      $('.ed-ml__outra', mn).onsubmit = (e) => { e.preventDefault(); trocar($('input', e.target).value); };
      $('[data-op="tirar"]', mn).onclick = () => { fechar(); est.splice(p, 1); aplicar(); };
      $('[data-op="copiar"]', mn).onclick = () => { fechar(); copiar(est.slice(p, fimParte(p)), atual || 'parte'); };
      $('[data-op="duplicar"]', mn).onclick = () => { fechar(); const f = fimParte(p); colar(f, est.slice(p, f)); };
      const inp = $('.ed-ml__outra input', mn); inp.focus(); inp.select();
    };
    const fechar = () => { fecharMenuAcorde(); const mn = document.getElementById('acMenu'); if (mn) mn.classList.remove('ed-ml'); mais.classList.remove('aberto'); };

    // escrever a letra na própria linha (mesma fonte e altura: nada se mexe)
    const abrirInput = (p) => {
      const par = box.querySelector(`.par[data-p="${p}"]`); if (!par || !est[p]) return;
      if (est[p].tipo === 'outro') est[p] = { tipo: 'par', acordes: [], letra: '' }; // linha em branco: passa a ter texto
      const alvo = $('.par__letra', par);
      alvo.classList.remove('sem-letra', 'mut');
      const inp = document.createElement('input');
      inp.type = 'text'; inp.className = 'ed-linha-input'; inp.spellcheck = false; inp.autocomplete = 'off';
      inp.value = est[p].letra || ''; inp.placeholder = est[p].nova ? 'Escreva a linha… (Enter: próxima · Esc: cancelar)' : '';
      alvo.textContent = ''; alvo.appendChild(inp); ctl.remove();
      inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
      let feito = false;
      const salvar = (continuar) => {
        if (feito) return; feito = true;
        const v = inp.value.replace(/\s+$/, '');
        if (est[p].nova && !v) { edAc.novaLinha = null; est.splice(p, 1); redesenhar(); return; }
        est[p].letra = v; delete est[p].nova;
        edAc.novaLinha = continuar ? p + 1 : null;
        aplicar();
      };
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); salvar(!!inp.value.trim()); }
        else if (e.key === 'Escape') { e.preventDefault(); feito = true; edAc.novaLinha = null; redesenhar(); }
      });
      inp.addEventListener('blur', () => salvar(false));
    };

    // ---------- mover linhas e partes ----------
    let movendo = null;
    const fimDoBloco = (p) => { // parte = do rótulo até a próxima parte
      if (!(est[p].tipo === 'outro' && est[p].classe === 'secao')) return p + 1;
      let k = p + 1; while (k < est.length && !(est[k].tipo === 'outro' && est[k].classe === 'secao')) k++; return k;
    };
    const textoDe = (p) => { const it = est[p]; if (!it) return ''; if (it.tipo === 'outro') return it.classe === 'secao' ? 'Parte: ' + (it.exibir || '') : (it.texto.trim() || 'linha em branco'); return (it.letra || it.acordes.map((a) => a.texto).join(' ') || 'linha').trim(); };
    const comecarMover = (e, p, el) => {
      if (e.button > 0 || !est[p]) return;
      e.preventDefault(); e.stopPropagation(); esconderDicaAcorde(); fecharMenuAcorde();
      movendo = { de: p, ate: fimDoBloco(p), el, x0: e.clientX, y0: e.clientY, moveu: false, alvo: null, copia: e.altKey || e.ctrlKey };
      document.addEventListener('pointermove', moverLinha); document.addEventListener('pointerup', soltarLinha, { once: true });
    };
    const guiaLinha = document.createElement('div'); guiaLinha.className = 'ed-guia-linha';
    const moverLinha = (e) => {
      const mv = movendo; if (!mv) return;
      if (!mv.moveu) {
        if (Math.hypot(e.clientX - mv.x0, e.clientY - mv.y0) < 4) return;
        mv.moveu = true; box.classList.add('com-arraste', 'movendo-linha');
        mv.fantasma = document.createElement('span'); mv.fantasma.className = 'ac-fantasma ed-fantasma-linha'; mv.fantasma.textContent = textoDe(mv.de).slice(0, 48);
        document.body.appendChild(mv.fantasma); document.body.appendChild(guiaLinha);
        for (let k = mv.de; k < mv.ate; k++) { const r = box.querySelector(`[data-p="${k}"].ed-linha, .parte__rot[data-p="${k}"]`); if (r) (r.classList.contains('parte__rot') ? r.closest('.parte') : r).classList.add('movendo'); }
        mostrarLixeira();
      }
      mv.fantasma.style.left = e.clientX + 12 + 'px'; mv.fantasma.style.top = e.clientY - 12 + 'px';
      mv.copia = mv.copia || e.altKey || e.ctrlKey; mv.fantasma.classList.toggle('copia', mv.copia);
      mv.lixo = sobreLixeira(e);
      if (mv.lixo) { mv.alvo = null; guiaLinha.hidden = true; return; }
      const sob = document.elementsFromPoint(e.clientX, e.clientY);
      let row = sob.find((x) => x.classList && x.classList.contains('ed-linha') && x.dataset.p !== 'nova');
      const rot = !row && sob.find((x) => x.classList && x.classList.contains('parte__rot') && x.dataset.p != null);
      if (!row && !rot) { // fora das linhas: acima de tudo ou abaixo de tudo
        const rb = box.getBoundingClientRect();
        if (e.clientX < rb.left - 40 || e.clientX > rb.right + 40) { mv.alvo = null; guiaLinha.hidden = true; return; }
        const linhas = $$('.ed-linha:not([data-p="nova"])', box); if (!linhas.length) return;
        row = e.clientY < linhas[0].getBoundingClientRect().top ? linhas[0] : linhas[linhas.length - 1];
      }
      let idx, ref;
      const ehSecao = (k) => est[k] && est[k].tipo === 'outro' && est[k].classe === 'secao';
      if (ehSecao(mv.de)) { // movendo uma parte: só encaixa entre partes (antes ou depois da parte sob o mouse)
        const pt = (rot || row).closest('.parte');
        const lab = pt && pt.querySelector(':scope > .parte__rot[data-p]');
        const ps = $$('[data-p].ed-linha', pt).map((x) => +x.dataset.p).filter((x) => !isNaN(x));
        const ini = lab ? +lab.dataset.p : Math.min(...ps), fim = lab ? fimDoBloco(ini) : Math.max(...ps) + 1;
        const r = pt.getBoundingClientRect(), antes = e.clientY < r.top + r.height / 2;
        idx = antes ? ini : fim; ref = { y: antes ? r.top : r.bottom, el: pt };
      } else if (rot) { const r = rot.getBoundingClientRect(); const pr = +rot.dataset.p; const antes = e.clientY < r.top + 12; idx = antes ? pr : pr + 1; ref = { y: antes ? r.top : r.top + 12, el: rot.closest('.parte') }; }
      else { const r = row.getBoundingClientRect(); const pr = +row.dataset.p; const antes = e.clientY < r.top + r.height / 2; idx = antes ? pr : pr + 1; ref = { y: antes ? r.top : r.bottom, el: row }; }
      if (!mv.copia && idx >= mv.de && idx <= mv.ate) { mv.alvo = null; guiaLinha.hidden = true; return; } // dentro do próprio bloco: não muda nada
      if (mv.copia && idx > mv.de && idx < mv.ate) { mv.alvo = null; guiaLinha.hidden = true; return; }
      mv.alvo = idx;
      const rb = box.getBoundingClientRect();
      guiaLinha.hidden = false; guiaLinha.style.top = ref.y - 1 + 'px'; guiaLinha.style.left = rb.left + 'px'; guiaLinha.style.width = Math.min(rb.width, ref.el.getBoundingClientRect().right - rb.left) + 'px';
    };
    const soltarLinha = (e) => {
      document.removeEventListener('pointermove', moverLinha);
      const mv = movendo; movendo = null;
      guiaLinha.remove(); esconderLixeira(); box.classList.remove('com-arraste', 'movendo-linha'); $$('.movendo', box).forEach((x) => x.classList.remove('movendo'));
      if (!mv) return;
      if (mv.fantasma) mv.fantasma.remove();
      if (!mv.moveu) { if (mv.el === alca) abrirMenuLinha(mv.de); else if (mv.el.classList.contains('parte__rot')) abrirMenuParte(mv.el); return; }
      if (mv.copia || e.altKey || e.ctrlKey) { // duplicar: o original fica
        if (mv.lixo || mv.alvo == null) return;
        est.splice(mv.alvo, 0, ...JSON.parse(JSON.stringify(est.slice(mv.de, mv.ate)))); aplicar(); return;
      }
      if (mv.lixo) { const ehParte = est[mv.de].tipo === 'outro' && est[mv.de].classe === 'secao'; est.splice(mv.de, ehParte ? 1 : mv.ate - mv.de); aplicar(); if (ehParte) toast('Parte tirada (as linhas continuam)'); return; } // parte na lixeira: tira só o rótulo
      if (mv.alvo == null) return;
      const n = mv.ate - mv.de, bloco = est.splice(mv.de, n);
      est.splice(mv.alvo > mv.de ? mv.alvo - n : mv.alvo, 0, ...bloco);
      aplicar();
    };
    alca.addEventListener('pointerdown', (e) => { const row = alca.closest('.ed-linha'); if (!row || row.dataset.p === 'nova') return; if (e.shiftKey) { e.preventDefault(); e.stopPropagation(); selecionar(+row.dataset.p, true); return; } comecarMover(e, +row.dataset.p, alca); });
    box.addEventListener('pointerdown', (e) => { const rot = e.target.closest('.parte__rot[data-p]'); if (rot) comecarMover(e, +rot.dataset.p, rot); });

    mais.addEventListener('click', (e) => {
      e.stopPropagation();
      const row = mais.closest('.ed-linha'); if (!row) return;
      abrirMenuLinha(row.dataset.p === 'nova' ? -1 : +row.dataset.p);
    });
    box.addEventListener('dblclick', (e) => {
      const l = e.target.closest('.par__letra'); if (!l || edAc.sel || l.dataset.p === 'nova') return;
      fecharMenuAcorde(); abrirInput(+l.dataset.p);
    });

    // ---------- selecionar várias linhas (Shift+clique) ----------
    const ehSec = (k) => est[k] && est[k].tipo === 'outro' && est[k].classe === 'secao';
    const ehLivre = (it) => it && it.tipo === 'par' && it.acordes.length && !(it.letra || '').trim();
    const faixa = () => { const s = edAc.selecao; return s ? [Math.min(s.a, s.b), Math.max(s.a, s.b)] : null; };
    function selecionar(p, estender) {
      fecharMenuAcorde();
      if (estender && edAc.selecao) edAc.selecao.b = p; else edAc.selecao = { a: p, b: p };
      pintarSelecao();
    }
    box.addEventListener('pointerdown', (e) => {
      if (!e.shiftKey || e.button > 0) return;
      const row = e.target.closest('.ed-linha'); if (!row || row.dataset.p === 'nova') return;
      e.preventDefault(); selecionar(+row.dataset.p, true);
    });
    const espaco = () => Math.max(1, Math.min(16, +(D.estado.config.espacoAcordes || 4)));
    // linhas sem letra: tira o espaço do começo e deixa um espaço fixo depois de cada acorde (ou marca)
    const distribuir = (idxs) => {
      const gap = espaco(), livres = idxs.filter((k) => ehLivre(est[k]));
      for (const k of livres) {
        let c = 0;
        est[k].acordes = est[k].acordes.slice().sort((x, y) => x.col - y.col).map((a) => { a.col = c; c += a.texto.length + gap; return a; });
      }
      return livres.length;
    };
    // marca as linhas selecionadas como uma parte; o que vem depois continua na parte em que estava
    const marcarParte = (de, ate, nome) => {
      nome = nomeParte(nome); if (!nome) return;
      let antigo = null; for (let k = de - 1; k >= 0; k--) if (ehSec(k)) { antigo = est[k].exibir; break; }
      let depois = antigo; const internas = [];
      for (let k = de; k <= ate; k++) if (ehSec(k)) { internas.push(k); depois = est[k].exibir; }
      let resto = false; for (let k = ate + 1; k < est.length && !ehSec(k); k++) if (!(est[k].tipo === 'outro' && est[k].classe === 'vazio')) { resto = true; break; }
      const sec = (n) => ({ tipo: 'outro', classe: 'secao', texto: '[' + n + ']', exibir: n });
      if (resto && depois != null && depois !== nome) est.splice(ate + 1, 0, sec(depois));
      for (let j = internas.length - 1; j >= 0; j--) est.splice(internas[j], 1);
      if (de > 0 && ehSec(de - 1)) est[de - 1] = sec(nome); else est.splice(de, 0, sec(nome));
      edAc.selecao = null; aplicar(nome + ' marcada');
    };
    function pintarSelecao() {
      $$('.sel-linha', box).forEach((x) => x.classList.remove('sel-linha'));
      let barra = document.getElementById('edSel');
      const f = faixa();
      if (!f) { if (barra) barra.remove(); box.style.paddingBottom = ''; edAc.copiarSelecao = edAc.colarAposSelecao = null; return; }
      const idxs = []; for (let k = f[0]; k <= f[1]; k++) if (est[k] && !ehSec(k)) idxs.push(k);
      idxs.forEach((k) => { const r = box.querySelector(`.ed-linha[data-p="${k}"]`); if (r) r.classList.add('sel-linha'); });
      const nLivres = idxs.filter((k) => ehLivre(est[k])).length;
      if (!barra) { barra = document.createElement('div'); barra.id = 'edSel'; barra.className = 'ed-sel'; (box.closest('.tile-col') || box.parentNode).appendChild(barra); }
      barra.innerHTML = `<div class="ed-sel__linha"><b class="ed-sel__n">${idxs.length} ${idxs.length === 1 ? 'linha' : 'linhas'}</b><span class="dica">Shift+clique em outra linha estende · Esc solta</span><button type="button" class="btn peq quad ghost" id="edSelX" title="Soltar seleção" aria-label="Soltar seleção">${ic('x', 14)}</button></div>
        <div class="ed-sel__linha"><span class="ed-sel__rot">Marcar como</span>${PARTES.map((n) => `<button type="button" class="chip" data-marcar="${esc(n)}">${esc(n)}</button>`).join('')}<form class="ed-sel__outra"><input type="text" placeholder="Outro nome" autocomplete="off" spellcheck="false"><button class="btn peq">OK</button></form></div>
        <div class="ed-sel__linha"><span class="ed-sel__rot">Acordes sem letra</span>
          <span class="ed-sel__gap" title="Espaço entre um acorde e outro"><button type="button" class="btn peq quad ghost" data-gap="-1" aria-label="Menos espaço">${ic('minus', 13)}</button><b>${espaco()}</b><button type="button" class="btn peq quad ghost" data-gap="1" aria-label="Mais espaço">${ic('plus', 13)}</button></span>
          <button type="button" class="btn peq" id="edDistribuir"${nLivres ? '' : ' disabled'} title="${nLivres ? 'Tira os espaços do começo e deixa o mesmo espaço depois de cada acorde' : 'Nenhuma linha só de acordes na seleção'}">${ic('columns', 14)}Distribuir${nLivres ? ` (${nLivres})` : ''}</button>
          <button type="button" class="btn peq ghost" id="edSelCopiar" title="Ctrl+C">${ic('paste', 14)}Copiar</button>
          <button type="button" class="btn peq ghost" id="edSelDuplicar">${ic('more', 14)}Duplicar</button>
          <button type="button" class="btn peq ghost perigo" id="edSelApagar">${ic('trash', 14)}Apagar linhas</button></div>`;
      box.style.paddingBottom = barra.offsetHeight + 40 + 'px'; // folga embaixo: a barra não cobre as últimas linhas
      $('#edSelX', barra).onclick = () => { edAc.selecao = null; pintarSelecao(); };
      $$('[data-marcar]', barra).forEach((b) => (b.onclick = () => marcarParte(f[0], f[1], b.dataset.marcar)));
      $('.ed-sel__outra', barra).onsubmit = (e) => { e.preventDefault(); marcarParte(f[0], f[1], $('input', e.target).value); };
      const aplicarDistr = () => { if (distribuir(idxs)) { edAc.manterSel = true; aplicar(); } };
      $('#edDistribuir', barra).onclick = aplicarDistr;
      $$('[data-gap]', barra).forEach((b) => (b.onclick = async () => {
        await D.salvarConfig({ espacoAcordes: Math.max(1, Math.min(16, espaco() + +b.dataset.gap)) });
        if (nLivres) aplicarDistr(); else pintarSelecao();
      }));
      const blocoSel = () => est.slice(f[0], f[1] + 1);
      $('#edSelCopiar', barra).onclick = () => copiar(blocoSel(), idxs.length === 1 ? '1 linha' : idxs.length + ' linhas');
      $('#edSelDuplicar', barra).onclick = () => colar(f[1] + 1, blocoSel());
      edAc.copiarSelecao = () => $('#edSelCopiar', barra).click();
      edAc.colarAposSelecao = () => edAc.colarAtalho(f[1] + 1);
      $('#edSelApagar', barra).onclick = () => { for (let k = idxs.length - 1; k >= 0; k--) est.splice(idxs[k], 1); aplicar(idxs.length + ' linhas apagadas'); };
    }
    pintarSelecao();
    // linha nova pedida pelo menu: abre já para escrever
    const nova = edAc.novaLinha; edAc.novaLinha = null;
    if (nova != null) abrirInput(Math.min(nova, est.length - 1));
  }
  document.addEventListener('keydown', (e) => { if (edAc.ativo && edAc.tecla) edAc.tecla(e); });
  document.addEventListener('pointerdown', (e) => {
    const mn = document.getElementById('acMenu');
    if (mn && !mn.hidden && !e.target.closest('#acMenu') && !e.target.closest('.ac-chip') && !e.target.closest('.ed-mais')) { fecharMenuAcorde(); mn.classList.remove('ed-ml'); $$('.ed-mais.aberto').forEach((b) => b.classList.remove('aberto')); }
  });

  // ---------- personalizar layout: arrastar blocos, largura das colunas, altura dos blocos ----------
  function ligarLayout(layout, redesenhar) {
    if (!editandoLayout) return;
    const tiles = $('#tiles');
    const salvarERedesenhar = async () => { await salvarLayout(layout); redesenhar(); };
    $('#layoutOk').onclick = () => { editandoLayout = false; redesenhar(); toast('Layout salvo'); };
    $('#layoutPadrao').onclick = async () => { await D.salvarConfig({ layout: LAYOUT_PADRAO() }); redesenhar(); };
    $$('[data-mostrar]').forEach((b) => (b.onclick = () => { layout.ocultos = layout.ocultos.filter((x) => x !== b.dataset.mostrar); colocarBloco(layout, b.dataset.mostrar); salvarERedesenhar(); }));
    $$('[data-ocultar]', tiles).forEach((b) => (b.onclick = () => { layout.ocultos.push(b.dataset.ocultar); salvarERedesenhar(); }));
    $$('[data-lj]').forEach((b) => (b.onclick = () => { layout.justificar = b.dataset.lj; salvarERedesenhar(); }));
    $$('[data-la]').forEach((b) => (b.onclick = () => { layout.alinhar = b.dataset.la; salvarERedesenhar(); }));
    $$('[data-lgap]').forEach((b) => (b.onclick = () => { layout.espaco = Math.max(0, Math.min(120, layout.espaco + +b.dataset.lgap)); salvarERedesenhar(); }));
    $$('[data-lmar]').forEach((b) => (b.onclick = () => { layout.margem = Math.max(0, Math.min(400, layout.margem + +b.dataset.lmar)); salvarERedesenhar(); }));
    $$('[data-esticar]', tiles).forEach((b) => (b.onclick = () => {
      const c = layout.colunas[+b.dataset.esticar];
      const el = b.closest('.tile-col');
      if (esticaCol(c)) { c.esticar = false; c.largura = Math.round(el.getBoundingClientRect().width); } else { c.esticar = true; c.largura = null; }
      salvarERedesenhar();
    }));
    $$('[data-largura]', tiles).forEach((inp) => (inp.onchange = () => {
      const c = layout.colunas[+inp.dataset.largura];
      c.largura = Math.max(minCol(c), Math.min(2400, Math.round(+inp.value) || larguraCol(c))); c.esticar = false;
      salvarERedesenhar();
    }));

    // arrastar blocos
    let arrastando = null;
    const limpar = () => $$('.alvo-antes,.alvo-depois,.alvo-col,.alvo-fim', tiles).forEach((el) => el.classList.remove('alvo-antes', 'alvo-depois', 'alvo-col', 'alvo-fim'));
    const alvoDrop = (e) => {
      const sp = e.target.closest('.tile-sep');
      if (sp) return { tipo: 'coluna', i: +sp.dataset.i, el: sp, cls: 'alvo-col' };
      const t = e.target.closest('.tile');
      if (t && t.dataset.bloco !== arrastando) {
        const r = t.getBoundingClientRect();
        const antes = e.clientY < r.top + r.height / 2;
        return { tipo: 'bloco', bloco: t.dataset.bloco, antes, el: t, cls: antes ? 'alvo-antes' : 'alvo-depois' };
      }
      const c = e.target.closest('.tile-col');
      if (c && !t) return { tipo: 'fim', col: +c.dataset.col, el: c, cls: 'alvo-fim' };
      return null;
    };
    tiles.addEventListener('dragstart', (e) => {
      const cab = e.target.closest('[data-arrasta]'); if (!cab) return;
      arrastando = cab.dataset.arrasta;
      e.dataTransfer.setData('text/plain', arrastando); e.dataTransfer.effectAllowed = 'move';
      cab.closest('.tile').classList.add('arrastando'); tiles.classList.add('com-arraste');
    });
    tiles.addEventListener('dragend', () => { arrastando = null; limpar(); tiles.classList.remove('com-arraste'); $$('.arrastando', tiles).forEach((el) => el.classList.remove('arrastando')); });
    tiles.addEventListener('dragover', (e) => {
      if (!arrastando) return;
      const a = alvoDrop(e); limpar();
      if (!a) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'move'; a.el.classList.add(a.cls);
    });
    tiles.addEventListener('drop', (e) => {
      if (!arrastando) return;
      e.preventDefault();
      const a = alvoDrop(e), id = arrastando; arrastando = null; limpar();
      if (!a) return;
      for (const c of layout.colunas) c.blocos = c.blocos.filter((b) => b !== id); // colunas vazias saem no normalizar
      if (a.tipo === 'coluna') layout.colunas.splice(a.i, 0, { largura: null, blocos: [id] });
      else if (a.tipo === 'fim') layout.colunas[a.col].blocos.push(id);
      else {
        const c = layout.colunas.find((x) => x.blocos.includes(a.bloco));
        const k = c.blocos.indexOf(a.bloco);
        c.blocos.splice(a.antes ? k : k + 1, 0, id);
      }
      salvarERedesenhar();
    });

    // largura: arrastar a divisória entre duas colunas
    $$('.tile-sep.redim', tiles).forEach((sp) => sp.addEventListener('pointerdown', (e) => {
      const i = +sp.dataset.i;
      const esq = layout.colunas[i - 1], dir = layout.colunas[i];
      // muda a coluna de largura fixa ao lado; se as duas esticam, a da esquerda passa a ter largura fixa
      let alvo = esq && !esticaCol(esq) ? esq : dir && !esticaCol(dir) ? dir : esq || dir;
      const sinal = alvo === esq ? 1 : -1;
      const el = $(`.tile-col[data-col="${layout.colunas.indexOf(alvo)}"]`, tiles);
      if (!el) return;
      e.preventDefault(); sp.setPointerCapture(e.pointerId); sp.classList.add('ativo');
      const x0 = e.clientX, w0 = el.getBoundingClientRect().width;
      const min = minCol(alvo);
      let w = w0;
      const mover = (ev) => { w = Math.round(Math.max(min, Math.min(2400, w0 + sinal * (ev.clientX - x0)))); el.style.flex = `0 1 ${w}px`; el.style.width = w + 'px'; };
      const soltar = () => { sp.removeEventListener('pointermove', mover); sp.removeEventListener('pointerup', soltar); sp.classList.remove('ativo'); if (Math.abs(w - w0) > 2) { alvo.largura = w; alvo.esticar = false; } salvarERedesenhar(); };
      sp.addEventListener('pointermove', mover); sp.addEventListener('pointerup', soltar);
    }));

    // altura: arrastar a borda de baixo do bloco (dois cliques volta ao automático)
    $$('[data-alt]', tiles).forEach((al) => {
      al.addEventListener('pointerdown', (e) => {
        const t = al.closest('.tile');
        e.preventDefault(); al.setPointerCapture(e.pointerId);
        const y0 = e.clientY, h0 = t.getBoundingClientRect().height;
        let h = h0;
        const mover = (ev) => { h = Math.round(Math.max(90, h0 + ev.clientY - y0)); t.style.height = h + 'px'; };
        const soltar = () => { al.removeEventListener('pointermove', mover); al.removeEventListener('pointerup', soltar); if (Math.abs(h - h0) > 2) { layout.alturas[al.dataset.alt] = h; salvarLayout(layout); } };
        al.addEventListener('pointermove', mover); al.addEventListener('pointerup', soltar);
      });
      al.addEventListener('dblclick', () => { delete layout.alturas[al.dataset.alt]; salvarERedesenhar(); });
    });
  }

  // ---------- popover de acorde: ver formas e editar notas ----------
  function fecharPopover() { const p = $('#popover'); p.hidden = true; p.classList.remove('editando'); }
  document.addEventListener('click', (e) => {
    const pop = $('#popover');
    if (pop.hidden) return;
    // composedPath guarda o caminho mesmo se o alvo foi redesenhado durante o clique
    if (!e.composedPath().some((n) => n === pop || (n.classList && (n.classList.contains('acorde') || n.classList.contains('nome') || n.classList.contains('ac-menu__diag'))))) fecharPopover();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { fecharPopover(); fecharModal(); fecharPainel(); } });

  function posicionarPopover(alvo) {
    const pop = $('#popover');
    const r = alvo.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let x = r.left, y = r.bottom + 6;
    if (x + w > window.innerWidth - 8) x = Math.max(8, window.innerWidth - w - 8);
    if (y + h > window.innerHeight - 8) y = Math.max(8, r.top - h - 6);
    if (y + h > window.innerHeight - 8) y = Math.max(8, window.innerHeight - h - 8);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  }

  /**
   * Editor de acorde (tirar/colocar notas, reconhecer nome) dentro de box.
   * opts: { aoFechar(), aoVoltar(), aoMudar() (tamanho mudou) }
   */
  function montarEditor(box, nome, forma, ctx, opts) {
    const { musica, instr } = ctx;
    const teclado = ehTeclado(instr), inst = A.INSTRUMENTOS[instr];
    const ed = { manual: false };
    if (teclado) {
      ed.teclas = new Set(forma ? forma.teclas : A.notasTeclado(nome));
      const min = ed.teclas.size ? Math.min(...ed.teclas) : 48;
      ed.oitava = Math.floor(min / 12) * 12;
    } else {
      ed.formas = forma ? forma.formas.slice() : new Array(inst.cordas.length).fill(null);
      const casas = ed.formas.filter((f) => f > 0);
      ed.inicio = casas.length && Math.max(...casas) > 5 ? Math.min(...casas) : 1;
    }
    const alturas = () => (teclado ? [...ed.teclas].sort((a, b) => a - b) : A.notasDaForma(ed.formas, instr));
    const pos = ctx.posicao;
          box.innerHTML = `<div class="topo"><span class="rot-ed">Editar acorde <b class="ac">${esc(nome)}</b></span><button class="btn peq quad ghost" id="edFechar" aria-label="Fechar">${ic('x', 14)}</button></div>
      <p class="dica">${musica && ctx.aoTrocar ? 'Muda só nesta música. ' : ''}${teclado ? 'Clique nas teclas para tirar ou colocar notas.' : 'Clique nas casas para tirar ou colocar notas. Em cima: X = não toca, O = solta.'}</p>
      <div id="edDiag" class="ed-diag"></div>
      <div class="controles">${teclado
        ? `<button class="btn peq quad" id="edMenos" aria-label="Oitava abaixo">${ic('left', 14)}</button><span>oitavas</span><button class="btn peq quad" id="edMais" aria-label="Oitava acima">${ic('right', 14)}</button>`
        : `<button class="btn peq quad" id="edMenos" aria-label="Subir no braço">${ic('minus', 14)}</button><span>a partir da <b id="edCasa">${ed.inicio}</b>ª casa</span><button class="btn peq quad" id="edMais" aria-label="Descer no braço">${ic('plus', 14)}</button>`}
        <button class="btn peq" id="edTocar">${ic('volume', 14)}Tocar</button><button class="btn peq ghost" id="edLimpar" title="Tira todas as notas para montar do zero">Limpar</button></div>
      <div class="ed-resultado" id="edRes"></div>
      <label class="campo"><span>Nome na cifra</span><input type="text" id="edNome" autocomplete="off" spellcheck="false"></label>
      <p class="dica ed-aviso" id="edAviso"></p>
      <div class="acoes ed-acoes">
        ${ctx.aoTrocar ? `<button class="btn peq prim" data-ap="todos" title="Vale só para esta música: a forma fica guardada nela e, se mudou o nome, troca todos os ${esc(nome)} desta cifra">${ic('check', 14)}${ctx.rotuloSalvar || 'Salvar nesta música'}</button>` : ''}
        ${ctx.aoTrocar && pos ? '<button class="btn peq" data-ap="aqui" title="Troca só o acorde em que você clicou">Só neste ponto</button>' : ''}
        ${musica ? '' : '<button class="btn peq prim" data-ap="guardar">Guardar forma</button>'}
        <button class="btn peq ghost" id="edVoltar">Cancelar</button>
      </div>`;
    const inp = $('#edNome', box);
    inp.value = nome;
    inp.oninput = () => { ed.manual = true; atualizarAviso(); };
    let sugestao = nome;
    const atualizarAviso = () => {
      const n = inp.value.trim();
      $('#edAviso', box).textContent = !n ? '' : A.ehAcorde(n) ? '' : A.ehAcorde(n + '*') ? 'Nome fora do padrão: vou guardar como ' + n + '* (o * marca acorde aproximado).' : 'Comece o nome pela nota (A a G), ex.: Am7.';
    };
    const atualizar = () => {
      const dg = $('#edDiag', box); dg.innerHTML = '';
      if (teclado) {
        dg.appendChild(G.desenharTeclado([...ed.teclas], { largura: 200, oitavas: 3, inicio: ed.oitava, bemol: ctx.bemol, onClick: (midi) => { ed.teclas.has(midi) ? ed.teclas.delete(midi) : ed.teclas.add(midi); atualizar(); } }));
      } else {
        dg.appendChild(G.desenharDiagrama({ formas: ed.formas }, instr, {
          editavel: true, casas: 5, inicio: ed.inicio, largura: 190, passoY: 30, rotulosCordas: true, canhoto: !!D.estado.config.canhoto,
          onClick: (corda, traste) => { ed.formas[corda] = traste; atualizar(); },
        }));
      }
      const al = alturas();
      const rec = A.reconhecer(al, { bemol: ctx.bemol });
      const res = $('#edRes', box);
      if (!al.length) { sugestao = ''; res.innerHTML = '<span class="mut">Nenhuma nota. Clique para colocar.</span>'; }
      else if (rec.length) {
        sugestao = rec[0].nome;
        res.innerHTML = `<div><span class="mut">Reconhecido:</span> <b class="ac">${esc(sugestao)}</b> <span class="mut">· ${esc(al.map((a) => A.nomeNota(a, ctx.bemol)).join(' '))}</span></div>
          ${rec.length > 1 ? `<div class="alternativas">${rec.slice(0, 6).map((x) => `<button class="chip" data-nome="${esc(x.nome)}">${esc(x.nome)}</button>`).join('')}</div>` : ''}`;
      } else {
        const prox = A.maisProximo(al, { bemol: ctx.bemol });
        sugestao = prox ? prox.nome + '*' : '';
        const sobra = prox && prox.sobrando.length ? ' · sobra ' + prox.sobrando.map((pc) => A.nomeNota(pc, ctx.bemol)).join(' ') : '';
        const falta = prox && prox.faltando.length ? ' · falta ' + prox.faltando.map((pc) => A.nomeNota(pc, ctx.bemol)).join(' ') : '';
        res.innerHTML = `<div><span class="mut">Não reconheci um nome padrão. Mais próximo:</span> <b class="ac">${esc(sugestao)}</b><span class="mut">${esc(sobra + falta)}</span></div>
          <div class="mut" style="font-size:11.5px;margin-top:2px">Notas: ${esc(al.map((a) => A.nomeNota(a, ctx.bemol)).join(' '))}. Pode digitar outro nome abaixo.</div>`;
      }
      $$('[data-nome]', res).forEach((b) => (b.onclick = () => { inp.value = b.dataset.nome; ed.manual = true; atualizarAviso(); }));
      if (!ed.manual) inp.value = sugestao;
      atualizarAviso();
      if (opts.aoMudar) opts.aoMudar();
    };
    $('#edMenos', box).onclick = () => { if (teclado) ed.oitava = Math.max(24, ed.oitava - 12); else { ed.inicio = Math.max(1, ed.inicio - 1); $('#edCasa', box).textContent = ed.inicio; } atualizar(); };
    $('#edMais', box).onclick = () => { if (teclado) ed.oitava = Math.min(72, ed.oitava + 12); else { ed.inicio = Math.min(12, ed.inicio + 1); $('#edCasa', box).textContent = ed.inicio; } atualizar(); };
    $('#edTocar', box).onclick = () => G.tocar(alturas(), { junto: teclado });
    $('#edLimpar', box).onclick = () => { if (teclado) ed.teclas.clear(); else ed.formas.fill(null); ed.manual = false; atualizar(); };
    $('#edFechar', box).onclick = opts.aoFechar;
    $('#edVoltar', box).onclick = opts.aoVoltar;
    $$('[data-ap]', box).forEach((b) => (b.onclick = async () => {
      let novo = inp.value.trim();
      const al = alturas();
      if (!al.length) { toast('Coloque pelo menos uma nota'); return; }
      if (!novo) { toast('Dê um nome ao acorde'); inp.focus(); return; }
      if (!A.ehAcorde(novo)) { if (A.ehAcorde(novo + '*')) novo += '*'; else { inp.focus(); return; } }
      const texto = teclado ? A.tecladoParaTexto(ed.teclas) : A.formaParaTexto(ed.formas);
      if (b.dataset.ap === 'guardar') { await D.salvarFormaPessoal(instr, novo, texto); toast('Forma guardada: ' + novo); fecharPopover(); if (ctx.aoMudar) ctx.aoMudar(); return; }
      musica.formas = musica.formas || {};
      musica.formas[instr + ':' + novo] = texto;
      if (musica._indices) musica._indices[novo] = 0;
      fecharPopover();
      await ctx.aoTrocar(novo, b.dataset.ap, pos);
    }));
    atualizar();
    inp.focus(); inp.select();
  
  }

  /**
   * ctx: { musica, instr, bemol, posicao:{l,k}|null, aoMudar(), aoTrocar(novoNome, 'aqui'|'todos', posicao) }
   * Sem aoTrocar o editor só guarda a forma.
   */
  function abrirPopoverAcorde(alvo, nome, ctx) {
    const pop = $('#popover');
    const { musica, instr } = ctx;
    const lista = listaFormas(nome, instr, musica);
    let i = 0;
    const pinta = () => {
      pop.classList.remove('editando');
      const forma = lista[i];
      pop.innerHTML = `<div class="topo"><span class="nome${/\*$/.test(nome) ? ' aprox' : ''}">${esc(nome)}</span><span class="acoes"><button class="btn peq" id="popEditar" title="Tirar ou colocar notas">${ic('pencil', 13)}Editar</button>${ctx.aoTirar && ctx.posicao ? `<button class="btn peq quad ghost pop-ic" id="popTirar" title="Excluir este acorde (só aqui)" aria-label="Excluir este acorde">${ic('trash', 14)}</button>` : ''}${ctx.aoTirar ? `<button class="btn peq quad ghost pop-ic" id="popTirarTodos" title="Limpar: tira todos os ${esc(nome)} da música" aria-label="Limpar todos os ${esc(nome)}">${ic('broom', 14)}</button>` : ''}</span></div>
        <div class="intervalos">${/\*$/.test(nome) ? 'aproximado · ' : ''}${esc(A.descreverIntervalos(nome))}</div><div id="popDiag"></div>
        ${lista.length > 1 ? `<div class="nav"><button class="btn peq quad" data-p="-1" aria-label="Forma anterior">${ic('left', 14)}</button><span>${ehTeclado(instr) && forma && forma.rotulo ? esc(forma.rotulo) : 'forma ' + (i + 1) + ' de ' + lista.length}${forma && forma.origem !== 'gerada' ? ' · ' + (forma.origem === 'fixa' ? 'fixada' : 'minha') : ''}</span><button class="btn peq quad" data-p="1" aria-label="Próxima forma">${ic('right', 14)}</button></div>` : ''}
        <div class="acoes"><button class="btn peq" id="popTocar">${ic('volume', 14)}Tocar</button>
        ${musica && forma ? `<button class="btn peq" id="popFixar">${forma.origem === 'fixa' ? 'Desafixar' : 'Usar aqui'}</button>` : ''}</div>`;
      const box = $('#popDiag', pop);
      if (forma) box.appendChild(desenhar(nome, instr, forma, { largura: ehTeclado(instr) ? 200 : 150, passoY: 24 }));
      else box.innerHTML = '<div class="dica">Nenhuma forma pronta para este instrumento. Use Editar para montar.</div>';
      $$('[data-p]', pop).forEach((b) => (b.onclick = () => { i = (i + +b.dataset.p + lista.length) % lista.length; pinta(); }));
      $('#popTocar', pop).onclick = () => tocarForma(nome, instr, forma);
      $('#popEditar', pop).onclick = () => editar(forma);
      const tq = $('#popTirar', pop), tt = $('#popTirarTodos', pop);
      if (tq) tq.onclick = () => { fecharPopover(); ctx.aoTirar('aqui', ctx.posicao); };
      if (tt) tt.onclick = () => { fecharPopover(); ctx.aoTirar('todos', ctx.posicao); };
      const fx = $('#popFixar', pop);
      if (fx) fx.onclick = async () => {
        musica.formas = musica.formas || {};
        const chave = instr + ':' + nome;
        if (forma.origem === 'fixa') delete musica.formas[chave]; else musica.formas[chave] = forma.texto;
        if (musica.id && D.estado.musicas.includes(musica)) await D.salvarMusica(musica, { silencioso: true, tocarData: false });
        if (musica._indices) musica._indices[nome] = 0;
        toast(forma.origem === 'fixa' ? 'Forma desafixada' : 'Forma fixada nesta música');
        fecharPopover(); if (ctx.aoMudar) ctx.aoMudar();
      };
      posicionarPopover(alvo);
    };

    // ----- edição: na música, edita o diagrama no bloco Acordes; sem ele, aqui mesmo -----
    const editar = (forma) => {
      if (ctx.editarNoBloco && ctx.editarNoBloco(nome, forma, ctx.posicao)) { fecharPopover(); return; }
      pop.classList.add('editando');
      montarEditor(pop, nome, forma, ctx, { aoFechar: fecharPopover, aoVoltar: pinta, aoMudar: () => posicionarPopover(alvo) });
    };

    pinta();
    pop.hidden = false;
    posicionarPopover(alvo);
    // modo de edição da cifra: abre já no editor do diagrama
    if (ctx.editarDireto) editar(lista[Math.min((musica._indices || {})[nome] || 0, Math.max(0, lista.length - 1))]);
  }

  // =====================================================================
  // EDITOR
  // =====================================================================
  function viewEditor(id) {
    const existente = id ? D.estado.musicas.find((x) => x.id === id) : null;
    if (id && !existente) { conteudo.innerHTML = '<div class="vazio">Música não encontrada.</div>'; return; }
    const m = existente ? JSON.parse(JSON.stringify(existente)) : D.novaMusica({ instrumento: D.estado.config.instrumento });
    if (!m.videos || !m.videos.length) m.videos = [{ url: '', rotulo: 'De onde tirei' }];
    const lista = (campo) => contagem(campo).map(([v]) => `<option value="${esc(v)}">`).join('');
    const tons = [];
    for (const n of A.SUSTENIDOS.concat(['Db', 'Eb', 'Gb', 'Ab', 'Bb'])) tons.push(n, n + 'm');

    conteudo.innerHTML = `
      <div class="cabeca"><div class="page-title">${existente ? 'Editar música' : 'Nova música'}</div>
        <div class="acoes">${existente ? `<button class="btn perigo" id="btnExcluir">${ic('trash', 16)}Excluir</button>` : ''}
          ${existente ? '' : `<a class="btn ghost" href="#/importar">${ic('paste', 16)}Importar</a>`}<a class="btn ghost" href="${existente ? '#/m/' + m.id : '#/'}">Cancelar</a><button class="btn prim" id="btnSalvar" title="Ctrl+S">${ic('check', 16)}Salvar</button></div></div>
      <div class="form-grade">
        <label class="campo c3"><span>Título *</span><input type="text" id="fTitulo" value="${esc(m.titulo)}" required></label>
        <label class="campo c3"><span>Artista</span><input type="text" id="fArtista" list="lArtistas" value="${esc(m.artista)}" placeholder="Quem canta (ou você)"></label>
        <label class="campo c2"><span>Gênero</span><input type="text" id="fGenero" list="lGeneros" value="${esc(m.genero)}"></label>
        <label class="campo c2"><span>Tags <span class="mut">(separe por vírgula)</span></span><input type="text" id="fTags" value="${esc((m.tags || []).join(', '))}" placeholder="roda, louvor, autoral…"></label>
        <label class="campo c2"><span>Status</span><select id="fStatus">${Object.entries(STATUS).map(([k, t]) => `<option value="${k}" ${k === m.status ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo c1"><span>Tom original</span><input type="text" id="fTom" list="lTons" value="${esc(m.tom)}" placeholder="auto"></label>
        <label class="campo c1"><span>Capotraste</span><input type="number" id="fCapo" min="0" max="11" value="${esc(m.capo || 0)}"></label>
        <label class="campo c2"><span>Afinação</span><input type="text" id="fAfinacao" value="${esc(m.afinacao || 'Padrão')}"></label>
        <label class="campo c1"><span>BPM</span><input type="text" id="fBpm" value="${esc(m.bpm)}"></label>
        <label class="campo c1"><span>Instrumento</span><select id="fInstr">${INSTR_CORDAS.concat('teclado').map((k) => `<option value="${k}" ${k === m.instrumento ? 'selected' : ''}>${A.INSTRUMENTOS[k].nome}</option>`).join('')}</select></label>
      </div>
      <datalist id="lArtistas">${lista('artista')}</datalist><datalist id="lGeneros">${lista('genero')}</datalist>
      <datalist id="lTons">${tons.map((t) => `<option value="${t}">`).join('')}</datalist>

      <div class="secao-form"><h2>Vídeos</h2><p class="dica">Cole o link do YouTube de onde tirou a música, aula, versão de referência… Pode ter vários. Links com tempo (&t=90) começam no ponto certo.</p></div>
      <div class="lista-videos" id="listaVideos"></div>
      <button class="btn peq ghost" id="addVideo" style="margin-top:8px">${ic('plus', 14)}Outro vídeo</button>

      <div class="secao-form"><h2>Cifra</h2>
        <p class="dica">Acorde na linha de cima, letra embaixo (alinhe com espaços) — ou acordes entre colchetes no meio da letra: <code>Eu [Am]vou</code>. Seções: <code>[Refrão]</code>. Tablatura: <code>e|---0---|</code>.</p></div>
      <div class="barra-editor">
        <button class="btn" id="btnMontar">${ic('grid', 16)}Montar acorde</button>
        <span class="rotulo">Transpor texto</span>
        <button class="btn peq quad" data-tr="-1" aria-label="Meio tom abaixo">${ic('minus', 14)}</button><button class="btn peq quad" data-tr="1" aria-label="Meio tom acima">${ic('plus', 14)}</button>
        <span class="dica" id="infoAcordes"></span>
      </div>
      <div class="editor-cifra">
        <textarea id="fCifra" spellcheck="false" placeholder="[Intro] G  D  Em  C&#10;&#10;G              D&#10;Sua letra aqui…">${esc(m.cifra)}</textarea>
        <div class="previa"><div class="cifra" id="previa"></div></div>
      </div>

      <div class="secao-form"><h2>Notas</h2></div>
      <div class="form-grade">
        <label class="campo c6"><span>Fonte (de onde tirou, quem ensinou…)</span><input type="text" id="fFonte" value="${esc(m.fonte)}"></label>
        <label class="campo c6"><span>Anotações</span><textarea id="fNotas" rows="3">${esc(m.notas)}</textarea></label>
      </div>`;

    // vídeos
    const listaV = $('#listaVideos');
    const pintaVideos = () => {
      listaV.innerHTML = m.videos.map((vd, i) => `<div class="linha-video">
        <input type="url" data-i="${i}" data-c="url" placeholder="https://www.youtube.com/watch?v=…" value="${esc(vd.url)}">
        <input type="text" data-i="${i}" data-c="rotulo" placeholder="Rótulo" value="${esc(vd.rotulo)}">
        <button class="btn quad" data-rm="${i}" aria-label="Remover vídeo">${ic('x', 16)}</button></div>`).join('');
      $$('input', listaV).forEach((inp) => (inp.oninput = () => (m.videos[+inp.dataset.i][inp.dataset.c] = inp.value)));
      $$('[data-rm]', listaV).forEach((b) => (b.onclick = () => { m.videos.splice(+b.dataset.rm, 1); pintaVideos(); }));
    };
    pintaVideos();
    $('#addVideo').onclick = () => { m.videos.push({ url: '', rotulo: '' }); pintaVideos(); };

    // prévia
    const ta = $('#fCifra');
    const atualizarPrevia = () => {
      $('#previa').innerHTML = C.renderizar(ta.value) || '<span class="mut">A prévia aparece aqui.</span>';
      const usados = C.acordesUsados(C.analisar(ta.value));
      $('#infoAcordes').textContent = usados.length ? usados.length + ' acordes: ' + usados.slice(0, 14).join(' ') + (usados.length > 14 ? '…' : '') : '';
    };
    ta.addEventListener('input', atualizarPrevia);
    atualizarPrevia();
    $('#previa').addEventListener('click', (e) => {
      const b = e.target.closest('.acorde'); if (!b) return;
      abrirPopoverAcorde(b, b.dataset.acorde, {
        musica: m, instr: $('#fInstr').value, posicao: { l: +b.dataset.l, k: +b.dataset.k },
        aoMudar: atualizarPrevia,
        aoTrocar: (novo, escopo, pos) => {
          const orig = C.acordeEm(ta.value, pos.l, pos.k);
          if (orig && orig !== novo) ta.value = escopo === 'todos' ? C.trocarTodos(ta.value, orig, novo) : C.trocarAcorde(ta.value, pos.l, pos.k, novo);
          atualizarPrevia(); toast(orig !== novo ? orig + ' → ' + novo + ' (salve para guardar)' : 'Forma guardada (salve para guardar)');
        },
      });
    });
    $$('[data-tr]').forEach((b) => (b.onclick = () => {
      const s = +b.dataset.tr;
      ta.value = C.transporTexto(ta.value, s);
      const tom = $('#fTom').value.trim();
      if (tom && A.ehAcorde(tom)) $('#fTom').value = A.transporNome(tom, s);
      atualizarPrevia();
    }));
    $('#btnMontar').onclick = () => abrirMontadorModal($('#fInstr').value, (nome) => {
      const ini = ta.selectionStart, fim = ta.selectionEnd;
      ta.setRangeText(nome, ini, fim, 'end'); ta.focus(); atualizarPrevia();
    });

    const salvar = async () => {
      const titulo = $('#fTitulo').value.trim();
      if (!titulo) { toast('Dê um título para a música'); $('#fTitulo').focus(); return; }
      const alvo = existente || m;
      Object.assign(alvo, {
        titulo, artista: $('#fArtista').value.trim(), genero: $('#fGenero').value.trim(),
        tags: $('#fTags').value.split(',').map((t) => t.trim()).filter(Boolean),
        status: $('#fStatus').value, tom: $('#fTom').value.trim(), capo: Math.max(0, Math.min(11, +$('#fCapo').value || 0)),
        afinacao: $('#fAfinacao').value.trim() || 'Padrão', bpm: $('#fBpm').value.trim(), instrumento: $('#fInstr').value,
        videos: m.videos.filter((x) => x.url.trim()).map((x) => ({ url: x.url.trim(), rotulo: x.rotulo.trim() })),
        cifra: ta.value, fonte: $('#fFonte').value.trim(), notas: $('#fNotas').value, formas: m.formas || {},
      });
      if (alvo.tom && !A.ehAcorde(alvo.tom)) { toast('Tom não reconhecido: ' + alvo.tom); return; }
      if (existente && existente.capo !== alvo.capo && alvo.visual) alvo.visual.capo = alvo.capo;
      delete alvo._indices;
      await D.salvarMusica(alvo);
      toast('Salvo');
      irPara('#/m/' + alvo.id);
    };
    $('#btnSalvar').onclick = salvar;
    conteudo.onkeydown = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); salvar(); } };
    const ex = $('#btnExcluir');
    if (ex) ex.onclick = async () => {
      if (ex.dataset.conf !== '1') { ex.dataset.conf = '1'; ex.textContent = 'Clique de novo para excluir'; return; }
      await D.excluirMusica(existente.id); toast('Música excluída'); irPara('#/');
    };
    if (!existente) $('#fTitulo').focus();
  }

  // =====================================================================
  // ACORDES: dicionário (nome → formas) e montar no braço (formas → nome)
  // =====================================================================
  const montador = { instr: null, formas: null, inicio: 1, teclas: new Set(), escolhido: null };

  function viewAcordes(q) {
    const aba = q.get('aba') || (q.get('n') ? 'nome' : 'montar');
    const instr = q.get('i') || D.estado.config.instrumento || 'violao';
    conteudo.innerHTML = `
      <div class="cabeca"><div><div class="page-title">Acordes</div><div class="sub-titulo" style="margin-bottom:0">Monte no braço ou digite o nome</div></div>
        <div class="acoes"><select id="selInstrDic" aria-label="Instrumento">${Object.entries(A.INSTRUMENTOS).map(([k, i]) => `<option value="${k}" ${k === instr ? 'selected' : ''}>${i.nome}</option>`).join('')}</select></div></div>
      <div class="abas"><button data-aba="montar" class="${aba === 'montar' ? 'ativo' : ''}">Montar no braço</button><button data-aba="nome" class="${aba === 'nome' ? 'ativo' : ''}">Pelo nome</button></div>
      <div id="areaAba"></div>`;
    const mudar = (k, v) => { const n = new URLSearchParams(q); n.set(k, v); irPara('#/acordes?' + n); };
    $$('[data-aba]').forEach((b) => (b.onclick = () => mudar('aba', b.dataset.aba)));
    $('#selInstrDic').onchange = (e) => mudar('i', e.target.value);
    if (aba === 'nome') renderPorNome($('#areaAba'), q.get('n') || '', instr, (n) => { const nq = new URLSearchParams(q); nq.set('n', n); nq.set('aba', 'nome'); history.replaceState(null, '', '#/acordes?' + nq); });
    else renderMontador($('#areaAba'), instr, {});
  }

  function renderPorNome(area, nome, instr, aoMudarNome) {
    area.innerHTML = `<div class="barra-busca"><input type="text" id="nomeAcorde" placeholder="Ex.: Am7, F#m7(b5), G/B, C7M(9), D4…" value="${esc(nome)}" style="font-family:var(--mono)"></div><div id="resNome"></div>`;
    const res = $('#resNome', area);
    const mostrar = (n) => {
      n = n.trim();
      if (!n) { res.innerHTML = '<div class="vazio">Digite o nome de um acorde.</div>'; return; }
      const p = A.parse(n);
      if (!p) { res.innerHTML = `<div class="vazio">Não reconheci “${esc(n)}” como acorde.</div>`; return; }
      const notas = [...p.notas].map((pc) => A.nomeNota(pc, p.bemol)).join(' · ');
      res.innerHTML = `<p style="margin-bottom:14px"><span class="resultado-nome" style="font-size:26px">${esc(n)}</span> <span class="notas-tocadas">&nbsp;${esc(notas)} &nbsp;(${esc(A.descreverIntervalos(n))})</span></p><div class="grade-formas" id="gradeFormas"></div>`;
      const grade = $('#gradeFormas', res);
      const lista = listaFormas(n, instr, null);
      if (!lista.length) { grade.outerHTML = '<div class="vazio">Não achei forma confortável para este instrumento.</div>'; return; }
      if (ehTeclado(instr)) grade.classList.add('teclado');
      for (const f of lista) {
        const card = document.createElement('div'); card.className = 'cartao-acorde' + (ehTeclado(instr) ? ' teclado' : '');
        const svg = desenhar(n, instr, f, { largura: ehTeclado(instr) ? 220 : 110 });
        svg.onclick = () => tocarForma(n, instr, f);
        card.appendChild(svg);
        card.insertAdjacentHTML('beforeend', `<div class="rotulo-forma">${esc(ehTeclado(instr) ? (f.rotulo || f.teclas.map((x) => A.nomeNota(x, p.bemol)).join(' ')) : f.texto)}${f.origem === 'minha' ? ' · minha' : ''}</div>
          <div class="mini-acoes"><button class="btn peq quad" data-tocar aria-label="Tocar">${ic('volume', 14)}</button>${f.origem === 'minha' ? '<button class="btn peq" data-rm>remover</button>' : '<button class="btn peq" data-salvar title="Guardar como minha forma preferida">guardar</button>'}</div>`);
        $('[data-tocar]', card).onclick = () => tocarForma(n, instr, f);
        const sv = $('[data-salvar]', card), rm = $('[data-rm]', card);
        if (sv) sv.onclick = async () => { await D.salvarFormaPessoal(instr, n, f.texto); toast('Guardada em “minhas formas”'); mostrar(n); };
        if (rm) rm.onclick = async () => { await D.removerFormaPessoal(instr, n, f.texto); mostrar(n); };
        grade.appendChild(card);
      }
    };
    let t;
    $('#nomeAcorde', area).addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { mostrar(e.target.value); aoMudarNome && aoMudarNome(e.target.value.trim()); }, 180); });
    mostrar(nome);
    $('#nomeAcorde', area).focus();
  }

  /** opts.aoEscolher(nome) → mostra botão "Inserir" (modo modal do editor). */
  function renderMontador(area, instr, opts) {
    const ehTeclado = instr === 'teclado';
    const inst = A.INSTRUMENTOS[instr];
    if (montador.instr !== instr) { montador.instr = instr; montador.formas = ehTeclado ? null : new Array(inst.cordas.length).fill(null); montador.inicio = 1; montador.teclas = new Set(); montador.escolhido = null; }

    area.innerHTML = `<div class="montar">
        <div class="braco"><div id="bracoSvg"></div>
          ${ehTeclado ? '' : `<div class="controles"><button class="btn peq quad" id="casaMenos" aria-label="Subir no braço">${ic('minus', 14)}</button><span>a partir da <b id="casaIni">${montador.inicio}</b>ª casa</span><button class="btn peq quad" id="casaMais" aria-label="Descer no braço">${ic('plus', 14)}</button></div>`}
          <p class="dica" style="text-align:center;margin-top:8px">${ehTeclado ? 'Clique nas teclas.' : 'Clique nas casas. Em cima: X = não toca, O = solta.'}</p></div>
        <div id="resultadoMontar"></div></div>`;

    const atualizar = () => {
      const box = $('#bracoSvg', area); box.innerHTML = '';
      let alturas;
      if (ehTeclado) {
        alturas = [...montador.teclas].sort((a, b) => a - b);
        const svg = G.desenharTeclado(alturas, { largura: 300, oitavas: 3, inicio: 36, onClick: (midi) => { montador.teclas.has(midi) ? montador.teclas.delete(midi) : montador.teclas.add(midi); montador.escolhido = null; atualizar(); } });
        box.className = 'teclado-grande'; box.appendChild(svg);
      } else {
        const forma = { formas: montador.formas };
        const svg = G.desenharDiagrama(forma, instr, {
          editavel: true, casas: 5, inicio: montador.inicio, largura: 200, passoY: 34, rotulosCordas: true, canhoto: !!D.estado.config.canhoto,
          onClick: (corda, traste) => { montador.formas[corda] = traste; montador.escolhido = null; atualizar(); },
        });
        box.appendChild(svg);
        alturas = A.notasDaForma(montador.formas, instr);
      }
      const nomes = A.reconhecer(alturas);
      const res = $('#resultadoMontar', area);
      if (!alturas.length) { res.innerHTML = '<div class="vazio" style="text-align:left">Monte um acorde ao lado.</div>'; return; }
      const notasTxt = alturas.map((a) => A.nomeNota(a)).join(' ');
      const nomeAtual = montador.escolhido || (nomes[0] && nomes[0].nome);
      res.innerHTML = `
        ${nomeAtual ? `<div class="mut" style="font-size:12px">Este acorde é</div><div class="resultado-nome">${esc(nomeAtual)}</div>` : '<div class="resultado-nome" style="color:var(--mut)">?</div><p class="mut">Não encontrei um nome comum para essas notas.</p>'}
        ${nomes.length > 1 ? `<div class="mut" style="font-size:12px;margin-top:8px">Também pode ser chamado de</div><div class="alternativas">${nomes.slice(0, 8).filter((x) => x.nome !== nomeAtual).map((x) => `<button class="chip" data-nome="${esc(x.nome)}">${esc(x.nome)}</button>`).join('')}</div>` : ''}
        <p class="notas-tocadas">Notas: ${esc(notasTxt)}${ehTeclado ? '' : ' &nbsp;·&nbsp; forma <b>' + esc(A.formaParaTexto(montador.formas)) + '</b>'}</p>
        <div class="acoes" style="margin-top:14px">
          <button class="btn" id="mTocar">${ic('volume', 16)}Tocar</button>
          ${opts.aoEscolher && nomeAtual ? `<button class="btn prim" id="mInserir">Inserir ${esc(nomeAtual)}</button>` : ''}
          ${nomeAtual ? `<button class="btn" id="mGuardar" title="Fica disponível nas suas músicas">Guardar forma</button>` : ''}
          ${nomeAtual && !opts.aoEscolher ? `<a class="btn" href="#/acordes?aba=nome&i=${instr}&n=${encodeURIComponent(nomeAtual)}">Ver outras formas</a>` : ''}
          <button class="btn ghost" id="mLimpar">Limpar</button>
        </div>`;
      $$('[data-nome]', res).forEach((b) => (b.onclick = () => { montador.escolhido = b.dataset.nome; atualizar(); }));
      $('#mTocar', res).onclick = () => G.tocar(alturas, { junto: ehTeclado });
      $('#mLimpar', res).onclick = () => { if (ehTeclado) montador.teclas.clear(); else montador.formas.fill(null); montador.escolhido = null; atualizar(); };
      const ins = $('#mInserir', res); if (ins) ins.onclick = () => opts.aoEscolher(nomeAtual);
      const gd = $('#mGuardar', res);
      if (gd) gd.onclick = async () => { await D.salvarFormaPessoal(instr, nomeAtual, ehTeclado ? A.tecladoParaTexto(alturas) : A.formaParaTexto(montador.formas)); toast('Forma guardada: ' + nomeAtual); };
    };
    if (!ehTeclado) {
      $('#casaMenos', area).onclick = () => { montador.inicio = Math.max(1, montador.inicio - 1); $('#casaIni', area).textContent = montador.inicio; atualizar(); };
      $('#casaMais', area).onclick = () => { montador.inicio = Math.min(12, montador.inicio + 1); $('#casaIni', area).textContent = montador.inicio; atualizar(); };
    }
    atualizar();
  }

  function abrirMontadorModal(instr, aoEscolher) {
    abrirModal(`<div class="cabeca"><h2>Montar acorde</h2><button class="btn quad" id="fecharModal" aria-label="Fechar">${ic('x', 18)}</button></div><div id="areaModal"></div>`, (box) => {
      $('#fecharModal', box).onclick = fecharModal;
      renderMontador($('#areaModal', box), instr, { aoEscolher: (n) => { aoEscolher(n); fecharModal(); toast(n + ' inserido'); } });
    });
  }


  // =====================================================================
  // IMPORTAR (assistido: o usuário copia da página e cola aqui)
  // =====================================================================
  const rascunhoImport = { termo: '', texto: '', link: '', puxado: null };
  function viewImportar(q) {
    const r = rascunhoImport;
    conteudo.innerHTML = `
      <div class="cabeca"><div><div class="page-title">Importar cifra</div><div class="sub-titulo" style="margin-bottom:0">Busque, copie, cole e ajuste</div></div></div>
      <div class="importar">
        <div>
          <div class="passo passo--link"><span class="passo__num">Direto do site</span><h2>Botão Repertor.io</h2>
            <p>Arraste o botão abaixo para a barra de favoritos do navegador. Depois, na página de uma cifra (Cifra Club), clique nele: o Repertor.io abre com título, artista, tom, capo, vídeo e a cifra já preenchidos.</p>
            <div class="acoes"><a class="btn prim botao-favorito" id="impBotao" href="#" title="Arraste para a barra de favoritos">${ic('plus', 16)}Repertor.io</a><span class="dica">← arraste para os favoritos (Ctrl+Shift+B mostra a barra)</span></div></div>
          <div class="passo"><span class="passo__num">Pelo link</span><h2>Cole o link da cifra</h2>
            <div class="add-link"><input type="url" id="impLink" placeholder="https://www.cifraclub.com.br/artista/musica/" value="${esc(r.link)}"><button class="btn prim" id="impPuxar">${ic('download', 16)}Puxar</button></div>
            <p class="dica" id="impLinkInfo">Puxa título, artista, gênero, tom, capo, afinação, vídeo e a cifra. Funciona melhor com o Cifra Club; em outros sites pega o bloco da cifra quando ele existe.</p></div>
          <div class="passo"><span class="passo__num">Ou: passo 1</span><h2>Encontre a música</h2>
            <input type="search" id="impTermo" placeholder="Nome da música - artista" value="${esc(r.termo)}">
            <div class="fontes" id="impFontes"></div>
            <p class="dica">Abre a busca numa aba nova. Na página da cifra, selecione o texto da cifra (do primeiro acorde ao fim) e copie com Ctrl+C.</p></div>
          <div class="passo"><span class="passo__num">Passo 2</span><h2>Cole a cifra</h2>
            <textarea id="impTexto" spellcheck="false" placeholder="Cole a cifra (Ctrl+V)">${esc(r.texto)}</textarea>
            <div class="soltar" id="impSoltar">ou solte aqui um arquivo .txt / .chordpro</div></div>
        </div>
        <div>
          <div class="passo"><span class="passo__num">Revisão</span><h2>Confira e crie</h2>
            <div class="form-grade" style="grid-template-columns:repeat(2,minmax(0,1fr));margin:0">
              <label class="campo c1"><span>Título</span><input type="text" id="impTitulo" value="${esc(r.titulo)}"></label>
              <label class="campo c1"><span>Artista</span><input type="text" id="impArtista" list="lArtImp" value="${esc(r.artista)}"></label>
              <label class="campo c1"><span>Gênero</span><input type="text" id="impGenero" list="lGenImp" value="${esc(r.genero)}"></label>
              <label class="campo c1"><span>Tom <span class="mut">(detectado)</span></span><input type="text" id="impTom" value="${esc(r.tom)}" placeholder="auto"></label>
            </div>
            <datalist id="lArtImp">${contagem('artista').map(([v]) => `<option value="${esc(v)}">`).join('')}</datalist>
            <datalist id="lGenImp">${contagem('genero').map(([v]) => `<option value="${esc(v)}">`).join('')}</datalist>
            <div class="detectado" id="impResumo"></div>
            <div class="previa" style="padding:var(--space-12);background:var(--bg-subtle);border-radius:var(--radius-sm);max-height:420px;overflow:auto"><div class="cifra" id="impPrevia" style="font-size:13px"></div></div>
            <div class="acoes"><button class="btn prim" id="impCriar">${ic('check', 16)}Criar e editar</button><button class="btn ghost" id="impLimpar">Limpar</button></div>
          </div>
        </div>
      </div>`;

    const pintarFontes = () => {
      const termo = $('#impTermo').value;
      $('#impFontes').innerHTML = termo.trim()
        ? IM.linksDeBusca(termo).map((l) => `<a class="btn ghost peq" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.nome)} ${ic('external', 13)}</a>`).join('')
        : '<span class="dica">Digite o nome para ver os links de busca.</span>';
    };
    let resultado = null;
    const analisar = () => {
      r.texto = $('#impTexto').value;
      resultado = IM.limpar(r.texto);
      if (r.puxado) { resultado.capo = resultado.capo || r.puxado.capo || 0; resultado.afinacao = resultado.afinacao || r.puxado.afinacao || ''; }
      const rs = IM.resumo(resultado.cifra);
      if (resultado.tom && !$('#impTom').dataset.editado) $('#impTom').value = resultado.tom;
      const tomAuto = $('#impTom').value || rs.primeiro;
      $('#impPrevia').innerHTML = resultado.cifra ? C.renderizar(resultado.cifra) : '<span class="mut">A prévia aparece aqui.</span>';
      $('#impResumo').innerHTML = resultado.cifra ? [
        `<span class="chip">${rs.usados.length} acordes</span>`,
        `<span class="chip">${rs.letra} ${rs.letra === 1 ? 'linha' : 'linhas'} de letra</span>`,
        rs.tab ? `<span class="chip">${rs.tab} ${rs.tab === 1 ? 'linha' : 'linhas'} de tab</span>` : '',
        tomAuto ? `<span class="chip">Tom ${esc(tomAuto)}</span>` : '',
        resultado.capo ? `<span class="chip">Capo ${resultado.capo}ª</span>` : '',
        resultado.removidas.length ? `<span class="chip" title="${esc(resultado.removidas.join(' | '))}">${resultado.removidas.length} linhas removidas</span>` : '',
      ].join('') : '';
    };
    const sugerirTitulo = () => {
      const t = $('#impTermo').value.trim();
      const partes = t.split(/\s+[-–—]\s+/);
      if (!$('#impTitulo').dataset.editado) $('#impTitulo').value = partes[0] || '';
      if (partes[1] && !$('#impArtista').dataset.editado) $('#impArtista').value = partes[1];
    };
    $('#impTermo').addEventListener('input', () => { r.termo = $('#impTermo').value; pintarFontes(); sugerirTitulo(); });
    $('#impTermo').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const l = IM.linksDeBusca(e.target.value)[0]; if (e.target.value.trim()) window.open(l.url, '_blank', 'noopener'); } });
    ['impTitulo', 'impArtista', 'impTom'].forEach((id) => $('#' + id).addEventListener('input', (e) => { e.target.dataset.editado = '1'; if (id === 'impTom') analisar(); }));
    $('#impTexto').addEventListener('input', analisar);
    const soltar = $('#impSoltar');
    ['dragenter', 'dragover'].forEach((ev) => soltar.addEventListener(ev, (e) => { e.preventDefault(); soltar.classList.add('ativo'); }));
    ['dragleave', 'drop'].forEach((ev) => soltar.addEventListener(ev, () => soltar.classList.remove('ativo')));
    soltar.addEventListener('drop', async (e) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0]; if (!f) return;
      $('#impTexto').value = await f.text();
      if (!$('#impTitulo').value) $('#impTitulo').value = f.name.replace(/\.[^.]+$/, '');
      analisar();
    });
    $('#impLimpar').onclick = () => { Object.assign(rascunhoImport, { termo: '', texto: '', link: '', puxado: null }); viewImportar(); };
    const info = $('#impLinkInfo');
    function aplicarPuxado(d, url) {
      r.link = url || d.fonte || ''; r.puxado = d;
      $('#impLink').value = r.link;
      $('#impTitulo').value = d.titulo || ''; $('#impTitulo').dataset.editado = '1';
      $('#impArtista').value = d.artista || ''; $('#impArtista').dataset.editado = '1';
      $('#impGenero').value = d.genero || '';
      $('#impTom').value = d.tom || ''; if (d.tom) $('#impTom').dataset.editado = '1';
      $('#impTexto').value = d.cifra || '';
      analisar();
      info.innerHTML = `Puxado de <b>${esc(d.site || '')}</b>${d.versao ? ' · versão ' + esc(d.versao) : ''}${(d.videos || []).length ? ' · ' + d.videos.length + ' vídeo(s)' : ''}. Confira ao lado e clique em <b>Criar e editar</b>.`;
      toast('Cifra puxada');
    }
    const puxar = async () => {
      const url = $('#impLink').value.trim();
      if (!/^https?:\/\//i.test(url)) { toast('Cole um link começando com http'); $('#impLink').focus(); return; }
      const btn = $('#impPuxar'); btn.disabled = true; btn.innerHTML = ic('download', 16) + 'Puxando…';
      try {
        aplicarPuxado(await IM.porLink(url), url);
      } catch (e) {
        const bloqueado = /403|429/.test(e.message);
        info.innerHTML = `<span style="color:var(--perigo)">${esc(e.message)}</span>${bloqueado ? ' O site bloqueia leitura fora do navegador. Use o <b>botão Repertor.io</b> acima, na própria página da cifra.' : ''}`;
      } finally { btn.disabled = false; btn.innerHTML = ic('download', 16) + 'Puxar'; }
    };
    $('#impPuxar').onclick = puxar;
    $('#impLink').addEventListener('keydown', (e) => { if (e.key === 'Enter') puxar(); });
    $('#impLink').addEventListener('paste', () => setTimeout(puxar, 0));
    // link colado no lugar da cifra também funciona
    $('#impTexto').addEventListener('paste', (e) => {
      const t = (e.clipboardData && e.clipboardData.getData('text') || '').trim();
      if (/^https?:\/\/\S+$/.test(t)) { e.preventDefault(); $('#impLink').value = t; puxar(); }
    });
    const botao = $('#impBotao');
    botao.href = IM.codigoBotao(location.origin + location.pathname);
    botao.onclick = (e) => { e.preventDefault(); toast('Arraste o botão para a barra de favoritos'); };
    if (q && q.get('pacote')) {
      try { aplicarPuxado(IM.lerPacote(q.get('pacote'))); }
      catch (e) { info.innerHTML = `<span style="color:var(--perigo)">Não consegui ler os dados enviados pelo botão (${esc(e.message)}).</span>`; }
      history.replaceState(null, '', '#/importar');
    }
    IM.servidorDisponivel().then((ok) => {
      if (ok) return;
      $('#impPuxar').disabled = true;
      if (r.puxado) return;
      info.innerHTML = /^https?:$/.test(location.protocol)
        ? 'O servidor rodando é o da versão anterior (sem importação por link). Abra de novo pelo lançador (<code>abrir.sh</code> ou <code>Repertor.io.desktop</code>): ele troca pelo servidor novo.'
        : 'Para puxar pelo link, abra o app pelo lançador (<code>abrir.sh</code> ou <code>Repertor.io.desktop</code>). Aberto como arquivo, o navegador não deixa ler outros sites.';
    });
    $('#impCriar').onclick = async () => {
      analisar();
      if (!resultado || !resultado.cifra.trim()) { toast('Cole a cifra primeiro'); $('#impTexto').focus(); return; }
      const titulo = $('#impTitulo').value.trim() || 'Sem título';
      const tom = $('#impTom').value.trim();
      if (tom && !A.ehAcorde(tom)) { toast('Tom não reconhecido: ' + tom); return; }
      const m = D.novaMusica({
        titulo, artista: $('#impArtista').value.trim(), genero: $('#impGenero').value.trim(),
        tom, capo: resultado.capo || 0, afinacao: resultado.afinacao || 'Padrão', cifra: resultado.cifra,
        instrumento: D.estado.config.instrumento, status: 'aprendendo',
        fonte: r.puxado ? r.puxado.fonte : (rascunhoImport.termo ? 'Importada (busca: ' + rascunhoImport.termo + ')' : 'Importada'),
        videos: r.puxado ? (r.puxado.videos || []) : [],
        notas: r.puxado && (r.puxado.compositores || []).length ? 'Composição: ' + r.puxado.compositores.join(', ') : '',
      });
      await D.salvarMusica(m);
      Object.assign(rascunhoImport, { termo: '', texto: '', link: '', puxado: null });
      toast('Música criada, revise e salve');
      irPara('#/m/' + m.id + '/editar');
    };
    pintarFontes();
    if (r.texto) analisar(); else $('#impPrevia').innerHTML = '<span class="mut">A prévia aparece aqui.</span>';
    $('#impLink').focus();
  }

  // =====================================================================
  // CONFIGURAÇÕES
  // =====================================================================
  function viewConfig() {
    const e = D.estado, cfg = e.config;
    const suporta = D.suportaArquivo();
    let arquivoHtml;
    if (!suporta) arquivoHtml = '<p class="mut">Este navegador não permite gravar direto num arquivo. Use o Chrome, ou faça backup manual abaixo.</p>';
    else if (e.arquivoStatus === 'ok') arquivoHtml = `<p>Cada alteração é gravada em <b class="mono">${esc(e.arquivo.name)}</b>${e.arquivoUltimaGravacao ? ' (última gravação ' + new Date(e.arquivoUltimaGravacao).toLocaleTimeString('pt-BR') + ')' : ''}.</p>
      <div class="acoes"><button class="btn" id="cfgSync">Sincronizar agora</button><button class="btn" id="cfgDesv">Desvincular</button></div>`;
    else if (e.arquivoStatus === 'precisa-permissao') arquivoHtml = `<p>O arquivo <b class="mono">${esc(e.arquivo.name)}</b> está vinculado, mas o Chrome pede permissão de novo a cada sessão.</p><div class="acoes"><button class="btn prim" id="cfgRecon">Reconectar</button><button class="btn" id="cfgDesv">Desvincular</button></div>`;
    else arquivoHtml = `<p>Os dados ficam no navegador. Para guardar também numa pasta (e não perder se limpar o navegador), vincule um arquivo — sugestão: <span class="mono">Rpertor.io/dados/repertorio.json</span>.</p>
      <div class="acoes"><button class="btn prim" id="cfgNovo">Criar/escolher arquivo para salvar</button><button class="btn" id="cfgAbrir">Abrir arquivo existente</button></div>`;
    if (e.arquivoStatus === 'erro') arquivoHtml = `<p style="color:#b3261e">Erro ao gravar: ${esc(e.arquivoErro || '')}</p>` + arquivoHtml;

    conteudo.innerHTML = `<div class="cabeca"><div class="page-title">Ajustes</div></div>
      <div class="cartao"><h2>Instrumento padrão</h2><p class="mut">Usado nos diagramas das músicas novas e no dicionário.</p>
        <select id="cfgInstr" style="width:auto">${Object.entries(A.INSTRUMENTOS).map(([k, i]) => `<option value="${k}" ${k === cfg.instrumento ? 'selected' : ''}>${i.nome}</option>`).join('')}</select></div>
      <div class="cartao cartao--largo" id="cfgAparencia"></div>
      <div class="cartao"><h2>Arquivo de dados</h2>${arquivoHtml}</div>
      <div class="cartao"><h2>Backup</h2><p>Exporta tudo (músicas e suas formas de acorde) num .json. Importar junta com o que já existe: vale a versão mais nova de cada música.</p>
        <div class="acoes"><button class="btn" id="cfgExport">${ic('download', 16)}Exportar backup</button><label class="btn">${ic('file', 16)}Importar backup<input type="file" id="cfgImport" accept=".json,application/json" hidden></label></div></div>
      <div class="cartao"><h2>Sobre</h2><p class="mut">${e.musicas.length} músicas · ${Object.keys(e.formasPessoais).length} acordes com forma própria · aberto via <span class="mono">${esc(location.protocol.replace(':', ''))}</span></p>
        <p class="dica">Abrindo como arquivo (file://) e pelo lançador (http://127.0.0.1) o navegador guarda dados separados. O arquivo vinculado junta os dois.</p></div>`;

    $('#cfgInstr').onchange = (ev) => D.salvarConfig({ instrumento: ev.target.value }).then(() => toast('Salvo'));
    renderAparencia($('#cfgAparencia'));
    $('#cfgExport').onclick = () => D.exportar();
    $('#cfgImport').onchange = async (ev) => {
      const f = ev.target.files[0]; if (!f) return;
      try { const r = await D.importarPacote(JSON.parse(await f.text())); toast(`${r.novas} novas, ${r.atualizadas} atualizadas`); viewConfig(); }
      catch (err) { toast('Não consegui importar: ' + err.message); }
    };
    const acao = (sel, fn) => { const b = $(sel); if (b) b.onclick = async () => { try { const r = await fn(); if (r && 'novas' in r) toast(`Vinculado · ${r.novas} novas, ${r.atualizadas} atualizadas do arquivo`); viewConfig(); } catch (err) { if (err.name !== 'AbortError') toast(err.message); } }; };
    acao('#cfgNovo', D.vincularNovoArquivo);
    acao('#cfgAbrir', D.abrirArquivoExistente);
    acao('#cfgRecon', () => D.tentarReconectar(true));
    acao('#cfgSync', () => D.tentarReconectar(true));
    acao('#cfgDesv', D.desvincular);
  }

  const EXEMPLO_APARENCIA = '[Refrão]\nG          D/F#        Em7\nA estrada é longa, eu sigo devagar\n    C7M          D4    D\nCom o violão no colo e o céu a clarear';
  function renderAparencia(box) {
    const a = aparencia(), tema = temaAtual();
    const faixa = (k, rot, min, max, passo, un) => `<label class="apar-campo"><span>${rot} <b id="v_${k}">${a[k]}${un}</b></span><input type="range" data-ap-k="${k}" data-un="${un}" min="${min}" max="${max}" step="${passo}" value="${a[k]}"></label>`;
    const fonte = (k, rot) => `<label class="apar-campo"><span>${rot}</span><select data-ap-k="${k}">${Object.keys(FONTES).map((f) => `<option ${f === a[k] ? 'selected' : ''} style="font-family:'${f}'">${f}</option>`).join('')}</select></label>`;
    box.innerHTML = `<h2>Aparência</h2><p class="mut">Fontes, tamanhos, pesos e cores. Vale para todas as músicas e é salvo na hora.</p>
      <div class="apar">
        <div class="apar__ctrl">
          <div class="apar__sec">Letra</div>
          ${fonte('fonteLetra', 'Fonte')}${faixa('tamLetra', 'Tamanho', 11, 28, 1, 'px')}${faixa('pesoLetra', 'Peso', 300, 700, 100, '')}${faixa('alturaLinha', 'Altura da linha', 120, 220, 5, '%')}
          <div class="apar__sec">Acordes</div>
          ${fonte('fonteAcorde', 'Fonte')}${faixa('tamAcorde', 'Tamanho (em relação à letra)', 80, 130, 5, '%')}${faixa('pesoAcorde', 'Peso', 300, 700, 100, '')}
          <p class="dica">⚠️ Só fontes com letras da mesma largura (monoespaçadas), para o acorde ficar em cima da sílaba certa. Acorde maior ou menor que a letra é compensado no espaçamento; em alguma fonte pode desalinhar um pouco.</p>
        </div>
        <div class="apar__previa"><div class="apar__sec">Prévia</div><div class="cifra" id="aparPrevia" style="--escala:1">${C.renderizar(EXEMPLO_APARENCIA)}</div></div>
      </div>
      <div class="apar__sec" style="margin-top:var(--space-16)">Cores do tema ${tema} <span class="mut" style="text-transform:none;letter-spacing:0;font-weight:400">· troque o tema (botão no rodapé do menu) para ajustar o outro</span></div>
      <div class="apar__cores">${CORES.map(([v, rot]) => `<label class="apar-cor"><input type="color" data-cor="${v}" value="${corAtual(v)}"><span>${rot}</span>${a.cores[tema][v] ? `<button class="btn peq ghost" data-cor-padrao="${v}" title="Voltar à cor padrão">padrão</button>` : ''}</label>`).join('')}</div>
      <div class="acoes" style="margin-top:var(--space-16)"><button class="btn ghost" id="aparPadrao">${ic('rotate', 16)}Restaurar aparência padrão</button></div>`;
    let t;
    const salvar = (parcial, redesenhar) => {
      const atual = D.estado.config.aparencia || {};
      D.estado.config.aparencia = Object.assign({}, atual, parcial); // aplica já; grava logo depois
      aplicarAparencia();
      clearTimeout(t); t = setTimeout(() => D.salvarConfig({ aparencia: D.estado.config.aparencia }).then(() => redesenhar && renderAparencia(box)), 250);
    };
    $$('[data-ap-k]', box).forEach((el) => (el.oninput = () => {
      const k = el.dataset.apK, val = el.tagName === 'SELECT' ? el.value : +el.value;
      const rot = $('#v_' + k, box); if (rot) rot.textContent = val + (el.dataset.un || '');
      salvar({ [k]: val });
    }));
    $$('[data-cor]', box).forEach((el) => (el.oninput = () => {
      const a2 = aparencia();
      a2.cores[tema] = Object.assign({}, a2.cores[tema], { [el.dataset.cor]: el.value });
      salvar({ cores: a2.cores }, false);
    }));
    $$('[data-cor]', box).forEach((el) => (el.onchange = () => renderAparencia(box)));
    $$('[data-cor-padrao]', box).forEach((b) => (b.onclick = () => {
      const a2 = aparencia(); const c = Object.assign({}, a2.cores[tema]); delete c[b.dataset.corPadrao];
      a2.cores[tema] = c; salvar({ cores: a2.cores }, true);
    }));
    $('#aparPadrao', box).onclick = async () => { await D.salvarConfig({ aparencia: {} }); aplicarAparencia(); renderAparencia(box); toast('Aparência padrão'); };
  }

  // =====================================================================
  // ROTEAMENTO
  // =====================================================================
  function render(opts = {}) {
    const { partes, q } = rota();
    fecharPopover(); fecharPainel(); esconderDicaAcorde(); fecharMenuAcorde();
    if (edAc.ativo && rota().partes[1] !== edAc.musica) edAc.ativo = false;
    if (metro.ativo) pararMetro();
    if (live.modo) pararLive(live.modo === 'gravar');
    fecharPalco();
    if (rolagem.ativa) pararRolagem();
    const foco = opts.manterFoco ? document.activeElement && document.activeElement.id : null;
    const pos = foco && document.activeElement.selectionStart;
    conteudo.onkeydown = null;
    conteudo.classList.remove('largo'); conteudo.style.removeProperty('--margem-pagina');
    if (!partes.length) viewBiblioteca(q);
    else if (partes[0] === 'nova') viewEditor(null);
    else if (partes[0] === 'm' && partes[2] === 'editar') viewEditor(partes[1]);
    else if (partes[0] === 'm') viewMusica(partes[1], { abrir: true });
    else if (partes[0] === 'acordes') viewAcordes(q);
    else if (partes[0] === 'config') viewConfig();
    else if (partes[0] === 'importar') viewImportar(q);
    else conteudo.innerHTML = '<div class="vazio">Página não encontrada. <a href="#/">Biblioteca</a></div>';
    renderSidebar();
    R.icones.aplicar(document);
    if (foco && $('#' + foco)) { const el = $('#' + foco); el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) { /* ok */ } }
    else if (!opts.manterFoco) window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', () => render());
  D.aoMudar((motivo) => { if (motivo === 'arquivo' || motivo === 'formas') renderSidebar(); else if (motivo === 'musica') renderSidebar(); });

  R.icones.aplicar(document);
  // ---------- aberto como arquivo (file://): passa para o servidor local, onde o vídeo toca na tela ----------
  const SERVIDOR = 'http://127.0.0.1:4321/';
  const ehArquivo = location.protocol === 'file:';
  async function servidorNoAr() {
    try { const ctl = new AbortController(); setTimeout(() => ctl.abort(), 1500); const r = await fetch(SERVIDOR + 'api/status', { signal: ctl.signal, cache: 'no-store' }); return r.ok && (await r.json()).app === 'Repertor.io'; } catch (e) { return false; }
  }
  /** Leva as músicas mudadas desde a última passagem para o banco do servidor e abre o app lá. */
  function passarParaServidor() {
    return new Promise((ok) => {
      let ultima = ''; try { ultima = localStorage.getItem('repertorio:passouEm') || ''; } catch (e) { /* ok */ }
      const pac = D.pacote();
      pac.musicas = pac.musicas.filter((m) => !ultima || (m.atualizadoEm || '') > ultima);
      const local = {}; ['repertorio:tema', 'repertorio:menu'].forEach((k) => { try { const v = localStorage.getItem(k); if (v != null) local[k] = v; } catch (e) { /* ok */ } });
      const fr = document.createElement('iframe'); fr.hidden = true; fr.src = SERVIDOR + 'receber.html';
      const fim = (deu) => { window.removeEventListener('message', ouvir); clearTimeout(t); fr.remove(); ok(deu); };
      const ouvir = (e) => {
        if (e.origin !== SERVIDOR.slice(0, -1) || !e.data) return;
        if (e.data.tipo === 'repertorio:pronto') fr.contentWindow.postMessage({ tipo: 'repertorio:migrar', pacote: pac, config: D.estado.config, local }, SERVIDOR.slice(0, -1));
        if (e.data.tipo === 'repertorio:migrado') {
          if (!e.data.ok) { console.warn('Repertor.io: não passei as músicas para o servidor:', e.data.erro); fim(false); return; }
          try { localStorage.setItem('repertorio:passouEm', new Date().toISOString()); } catch (er) { /* ok */ }
          fim(true); location.replace(SERVIDOR + location.hash);
        }
      };
      const t = setTimeout(() => fim(false), 8000);
      window.addEventListener('message', ouvir); document.body.appendChild(fr);
    });
  }
  // vídeo clicado no modo arquivo: vai para o servidor (toca na tela); sem servidor, explica no próprio lugar
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-tocar-aqui]'); if (!b) return;
    e.preventDefault();
    b.classList.add('carregando');
    if (await servidorNoAr()) { if (await passarParaServidor()) return; }
    b.classList.remove('carregando');
    const caixa = document.createElement('div'); caixa.className = 'video-aviso';
    caixa.innerHTML = `<b>O vídeo só toca aqui com o servidor local ligado.</b><span>Abra o Repertor.io pelo lançador (ícone Repertor.io ou <code>abrir.sh</code>). As suas músicas vão junto.</span><button type="button" class="btn peq" data-tentar>${ic('rotate', 14)}Tentar de novo</button>`;
    b.replaceWith(caixa);
    $('[data-tentar]', caixa).onclick = async () => { if (!(await R.app.tentarServidor())) toast('O servidor local ainda não está ligado'); };
  });
  R.app = R.app || {};
  R.app.tentarServidor = async () => { if (ehArquivo && (await servidorNoAr())) return passarParaServidor(); return false; };

  D.iniciar().then(async () => {
    if (ehArquivo && (await servidorNoAr()) && (await passarParaServidor())) return; // foi para o servidor
    aplicarTema(); render();
  }).catch((e) => {
    console.error(e);
    conteudo.innerHTML = `<div class="vazio">Não consegui abrir o banco de dados do navegador: ${esc(e.message)}</div>`;
  });

  Object.assign(R.app = R.app || {}, { render, listaFormas, detectarFrequencia });
})(window.Repertorio = window.Repertorio || {});
