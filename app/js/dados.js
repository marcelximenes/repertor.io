/* Repertor.io — dados local-first.
 * Fonte principal: IndexedDB do navegador ("repertor-io").
 * Espelho opcional: um arquivo JSON na pasta do projeto (dados/repertorio.json),
 * vinculado pelo Chrome (File System Access API). Salva sozinho a cada mudança.
 */
(function (R) {
  'use strict';
  const DB_NOME = 'repertor-io', VERSAO = 1;
  let db = null;
  const estado = { musicas: [], formasPessoais: {}, config: {}, arquivo: null, arquivoStatus: 'desligado', salvoEm: null };
  const ouvintes = new Set();

  function abrir() {
    return new Promise((ok, erro) => {
      const req = indexedDB.open(DB_NOME, VERSAO);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('musicas')) d.createObjectStore('musicas', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      };
      req.onsuccess = () => ok(req.result);
      req.onerror = () => erro(req.error);
    });
  }
  function tx(store, modo, fn) {
    return new Promise((ok, erro) => {
      const t = db.transaction(store, modo);
      const s = t.objectStore(store);
      const r = fn(s);
      t.oncomplete = () => ok(r && 'result' in r ? r.result : undefined);
      t.onerror = () => erro(t.error);
    });
  }
  const kvGet = (k) => new Promise((ok) => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => ok(r.result); r.onerror = () => ok(undefined); });
  const kvSet = (k, v) => tx('kv', 'readwrite', (s) => s.put(v, k));

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  const agora = () => new Date().toISOString();

  function novaMusica(campos = {}) {
    return Object.assign({
      id: uid(), titulo: '', artista: '', genero: '', tags: [], status: 'aprendendo', favorita: false,
      tom: '', capo: 0, afinacao: 'Padrão', bpm: '', instrumento: 'violao',
      videos: [], fonte: '', notas: '', cifra: '', formas: {},
      criadoEm: agora(), atualizadoEm: agora(), abertaEm: null,
    }, campos);
  }

  function avisar(motivo) { for (const f of ouvintes) try { f(motivo); } catch (e) { console.error(e); } }

  async function iniciar() {
    db = await abrir();
    estado.musicas = await tx('musicas', 'readonly', (s) => s.getAll()) || [];
    estado.formasPessoais = (await kvGet('formasPessoais')) || {};
    estado.config = Object.assign({ instrumento: 'violao', tema: 'escuro', tamanhoFonte: 100, colunas: false, mostrarDiagramas: true, mostrarTabs: true }, (await kvGet('config')) || {});
    estado.salvoEm = (await kvGet('salvoEm')) || null;
    if (!estado.musicas.length && !(await kvGet('jaIniciou'))) {
      for (const m of R.exemplos || []) await salvarMusica(novaMusica(m), { silencioso: true });
      await kvSet('jaIniciou', true);
    }
    const h = await kvGet('arquivoHandle');
    if (h) { estado.arquivo = h; estado.arquivoStatus = 'precisa-permissao'; await tentarReconectar(false); }
    avisar('iniciado');
  }

  async function marcarSalvo() { estado.salvoEm = agora(); await kvSet('salvoEm', estado.salvoEm); agendarArquivo(); }

  async function salvarMusica(m, { silencioso = false, tocarData = true } = {}) {
    if (tocarData) m.atualizadoEm = agora();
    await tx('musicas', 'readwrite', (s) => s.put(m));
    const i = estado.musicas.findIndex((x) => x.id === m.id);
    if (i >= 0) estado.musicas[i] = m; else estado.musicas.push(m);
    await marcarSalvo();
    if (!silencioso) avisar('musica');
    return m;
  }
  async function excluirMusica(id) {
    await tx('musicas', 'readwrite', (s) => s.delete(id));
    estado.musicas = estado.musicas.filter((m) => m.id !== id);
    await marcarSalvo(); avisar('musica');
  }
  async function salvarConfig(parcial) {
    Object.assign(estado.config, parcial);
    await kvSet('config', estado.config);
    avisar('config');
  }
  async function salvarFormaPessoal(instrumento, nome, texto) {
    const chave = instrumento + ':' + nome;
    estado.formasPessoais[chave] = estado.formasPessoais[chave] || [];
    if (!estado.formasPessoais[chave].includes(texto)) estado.formasPessoais[chave].unshift(texto);
    await kvSet('formasPessoais', estado.formasPessoais);
    await marcarSalvo(); avisar('formas');
  }
  async function removerFormaPessoal(instrumento, nome, texto) {
    const chave = instrumento + ':' + nome;
    estado.formasPessoais[chave] = (estado.formasPessoais[chave] || []).filter((t) => t !== texto);
    if (!estado.formasPessoais[chave].length) delete estado.formasPessoais[chave];
    await kvSet('formasPessoais', estado.formasPessoais);
    await marcarSalvo(); avisar('formas');
  }
  const formasPessoais = (instrumento, nome) => estado.formasPessoais[instrumento + ':' + nome] || [];

  // ---------- Exportar / importar ----------
  function pacote() {
    return { app: 'Repertor.io', versao: 1, salvoEm: estado.salvoEm || agora(), musicas: estado.musicas, formasPessoais: estado.formasPessoais };
  }
  async function importarPacote(p, { substituir = false } = {}) {
    if (!p || !Array.isArray(p.musicas)) throw new Error('Arquivo não parece um backup do Repertor.io.');
    if (substituir) { await tx('musicas', 'readwrite', (s) => s.clear()); estado.musicas = []; }
    let novas = 0, atualizadas = 0;
    for (const m of p.musicas) {
      const atual = estado.musicas.find((x) => x.id === m.id);
      if (!atual) novas++;
      else if ((m.atualizadoEm || '') > (atual.atualizadoEm || '')) atualizadas++;
      else continue;
      await tx('musicas', 'readwrite', (s) => s.put(novaMusica(m)));
      const i = estado.musicas.findIndex((x) => x.id === m.id);
      if (i >= 0) estado.musicas[i] = novaMusica(m); else estado.musicas.push(novaMusica(m));
    }
    if (p.formasPessoais) {
      for (const k in p.formasPessoais) {
        const lista = new Set([...(estado.formasPessoais[k] || []), ...p.formasPessoais[k]]);
        estado.formasPessoais[k] = [...lista];
      }
      await kvSet('formasPessoais', estado.formasPessoais);
    }
    estado.salvoEm = p.salvoEm && p.salvoEm > (estado.salvoEm || '') ? p.salvoEm : agora();
    await kvSet('salvoEm', estado.salvoEm);
    avisar('musica');
    return { novas, atualizadas };
  }
  function baixar(nome, conteudo, tipo = 'application/json') {
    const blob = new Blob([conteudo], { type: tipo + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function exportar() { baixar('repertorio-' + agora().slice(0, 10) + '.json', JSON.stringify(pacote(), null, 2)); }

  // ---------- Arquivo vinculado (File System Access) ----------
  const suportaArquivo = () => 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
  let timerArquivo = null;
  function agendarArquivo() {
    if (!estado.arquivo || estado.arquivoStatus !== 'ok') return;
    clearTimeout(timerArquivo);
    timerArquivo = setTimeout(escreverArquivo, 800);
  }
  async function escreverArquivo() {
    try {
      const w = await estado.arquivo.createWritable();
      await w.write(JSON.stringify(pacote(), null, 2));
      await w.close();
      estado.arquivoStatus = 'ok'; estado.arquivoUltimaGravacao = agora();
    } catch (e) {
      console.warn('Falha ao gravar arquivo', e);
      estado.arquivoStatus = 'erro'; estado.arquivoErro = e.message;
    }
    avisar('arquivo');
  }
  async function lerArquivo() {
    const f = await estado.arquivo.getFile();
    const txt = await f.text();
    return txt.trim() ? JSON.parse(txt) : null;
  }
  /** Sincroniza com o arquivo: o que for mais novo, por música, prevalece. */
  async function sincronizarComArquivo() {
    const p = await lerArquivo();
    let r = { novas: 0, atualizadas: 0 };
    if (p) r = await importarPacote(p);
    await escreverArquivo();
    return r;
  }
  async function vincularNovoArquivo() {
    const h = await window.showSaveFilePicker({ suggestedName: 'repertorio.json', types: [{ description: 'Repertório (JSON)', accept: { 'application/json': ['.json'] } }] });
    estado.arquivo = h; estado.arquivoStatus = 'ok';
    await kvSet('arquivoHandle', h);
    return sincronizarComArquivo();
  }
  async function abrirArquivoExistente() {
    const [h] = await window.showOpenFilePicker({ types: [{ description: 'Repertório (JSON)', accept: { 'application/json': ['.json'] } }] });
    const perm = await h.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') throw new Error('Permissão de escrita negada.');
    estado.arquivo = h; estado.arquivoStatus = 'ok';
    await kvSet('arquivoHandle', h);
    return sincronizarComArquivo();
  }
  /** pedir=true só pode ser chamado a partir de um clique. */
  async function tentarReconectar(pedir) {
    if (!estado.arquivo) return false;
    try {
      let perm = await estado.arquivo.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted' && pedir) perm = await estado.arquivo.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') { estado.arquivoStatus = 'ok'; await sincronizarComArquivo(); avisar('arquivo'); return true; }
      estado.arquivoStatus = 'precisa-permissao';
    } catch (e) { estado.arquivoStatus = 'erro'; estado.arquivoErro = e.message; }
    avisar('arquivo');
    return false;
  }
  async function desvincular() {
    estado.arquivo = null; estado.arquivoStatus = 'desligado';
    await tx('kv', 'readwrite', (s) => s.delete('arquivoHandle'));
    avisar('arquivo');
  }

  R.dados = {
    estado, iniciar, novaMusica, salvarMusica, excluirMusica, salvarConfig,
    salvarFormaPessoal, removerFormaPessoal, formasPessoais,
    exportar, importarPacote, baixar, pacote,
    suportaArquivo, vincularNovoArquivo, abrirArquivoExistente, tentarReconectar, desvincular, escreverArquivo,
    aoMudar: (f) => { ouvintes.add(f); return () => ouvintes.delete(f); },
    uid,
  };
})(window.Repertorio = window.Repertorio || {});
