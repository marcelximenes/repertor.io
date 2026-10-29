/* Repertor.io — importação assistida de cifra.
 * Dois caminhos: (1) pelo link, via servidor.py (uma página por vez, a pedido do usuário);
 * (2) o Marcel copia a cifra da página e cola aqui.
 * Este módulo limpa o texto colado, separa metadados (tom, capo, afinação)
 * e devolve a cifra pronta para revisar no editor.
 */
(function (R) {
  'use strict';
  const A = R.acordes, C = R.cifra;

  /** Links de busca abertos numa aba nova — quem navega e copia é o usuário. */
  function linksDeBusca(termo) {
    const q = encodeURIComponent(termo.trim());
    const qc = encodeURIComponent((termo.trim() + ' cifra').trim());
    return [
      { nome: 'Cifra Club', url: `https://www.cifraclub.com.br/?q=${q}` },
      { nome: 'Cifras.com.br', url: `https://www.cifras.com.br/busca?query=${q}` },
      { nome: 'Google', url: `https://www.google.com/search?q=${qc}` },
      { nome: 'YouTube', url: `https://www.youtube.com/results?search_query=${q}` },
    ];
  }

  const RE_TOM = /^\s*(?:tom|key)\s*[:\-]\s*([A-G][#b]?m?)\b.*$/i;
  const RE_CAPO = /^\s*(?:capo(?:traste)?)\s*(?:na|no|em|:|-)?\s*(\d{1,2})\s*[ªaº°]?\s*(?:casa|traste|fret)?.*$/i;
  const RE_CAPO2 = /^\s*(?:capo(?:traste)?)\s*[:\-]?\s*(?:na\s+)?(\d{1,2})/i;
  const RE_AFINACAO = /^\s*afina[çc][ãa]o\s*[:\-]\s*(.+)$/i;
  const RE_RUIDO = /^\s*(?:composi[çc][ãa]o|enviad[ao] por|colabora[çc][ãa]o|revis(?:ão|ado) por|exibir|imprimir|compartilhar|baixar cifra|corrigir|v[íi]deo ?aulas?|ver v[íi]deo|tocar junto|rolagem|dicion[áa]rio de acordes)(?=\s|:|$)[^|]*$/i;

  /**
   * Limpa um texto colado.
   * Retorna { cifra, tom, capo, afinacao, removidas:[linhas descartadas] }
   */
  function limpar(texto) {
    let t = String(texto || '')
      .replace(/\r\n?/g, '\n')
      .replace(/ /g, ' ')          // espaço não separável vira espaço
      .replace(/[​-‍﻿]/g, '') // caracteres invisíveis
      .replace(/\t/g, '    ');
    const linhas = t.split('\n').map((l) => l.replace(/\s+$/, ''));
    const meta = { tom: '', capo: 0, afinacao: '' };
    const removidas = [];
    const saida = [];
    for (const l of linhas) {
      let m;
      if (!meta.tom && (m = RE_TOM.exec(l)) && A.ehAcorde(m[1])) { meta.tom = m[1]; removidas.push(l.trim()); continue; }
      if (!meta.capo && ((m = RE_CAPO.exec(l)) || (m = RE_CAPO2.exec(l)))) { meta.capo = Math.min(11, +m[1]); removidas.push(l.trim()); continue; }
      if (!meta.afinacao && (m = RE_AFINACAO.exec(l))) { meta.afinacao = m[1].trim(); removidas.push(l.trim()); continue; }
      // botões/rótulos de interface que vêm junto quando se seleciona a página inteira
      if (RE_RUIDO.test(l) && !C.ehLinhaDeAcordes(l) && l.trim().split(/\s+/).length <= 4) { removidas.push(l.trim()); continue; }
      saida.push(l);
    }
    // tira linhas vazias do começo/fim e junta sequências longas de vazias
    let cifra = saida.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\s*\n+|\n+\s*$/g, '');
    // remove recuo comum a todas as linhas (acontece ao copiar de algumas páginas)
    const recuos = cifra.split('\n').filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length);
    const comum = recuos.length ? Math.min(...recuos) : 0;
    if (comum > 0) cifra = cifra.split('\n').map((l) => l.slice(Math.min(comum, l.match(/^ */)[0].length))).join('\n');
    return { cifra, tom: meta.tom, capo: meta.capo, afinacao: meta.afinacao, removidas };
  }

  /** Resumo para mostrar antes de criar a música. */
  function resumo(cifra) {
    const linhas = C.analisar(cifra);
    const cont = { acordes: 0, letra: 0, tab: 0, secao: 0 };
    for (const l of linhas) if (l.tipo in cont) cont[l.tipo]++;
    const usados = C.acordesUsados(linhas);
    return { ...cont, usados, primeiro: usados[0] || '' };
  }

  /** Pede ao servidor local (servidor.py) para buscar UMA página de cifra. */
  async function porLink(url) {
    let r;
    try { r = await fetch('/api/importar?url=' + encodeURIComponent(url)); }
    catch (e) { throw new Error('Servidor local fora do ar. Abra pelo lançador.'); }
    const d = await r.json().catch(() => ({ erro: 'Resposta inválida do servidor local.' }));
    if (!r.ok || d.erro) throw new Error(d.erro || 'Não consegui puxar este link.');
    const limpo = limpar(d.cifra || '');
    d.cifra = limpo.cifra;
    if (!d.tom && limpo.tom) d.tom = limpo.tom;
    if (!d.capo && limpo.capo) d.capo = limpo.capo;
    if (!A.ehAcorde(d.tom || '')) d.tom = '';
    return d;
  }
  let statusServidor = null;
  function servidorDisponivel() {
    if (!/^https?:$/.test(location.protocol)) return Promise.resolve(false);
    if (!statusServidor) statusServidor = fetch('/api/status').then((r) => r.ok).catch(() => false);
    return statusServidor;
  }

  /**
   * Botão de favoritos ("bookmarklet"). Roda na página da cifra que o Marcel
   * está vendo no próprio navegador: lê o bloco da cifra e os dados da música
   * da página já carregada e abre o Repertor.io com tudo preenchido.
   * Não faz nenhuma requisição ao site — só lê o que já está na tela.
   */
  function codigoBotao(appUrl) {
    const fn = function (APP) {
      try {
        var pre = document.querySelector('article pre') || document.querySelector('pre');
        if (!pre) { alert('Repertor.io: não achei a cifra nesta página.'); return; }
        /* innerText respeita as quebras visuais; se a página estiver oculta, cai para textContent */
        var txt = pre.innerText && pre.innerText.trim() ? pre.innerText : pre.textContent;
        var d = { cifra: txt, fonte: location.href, site: location.hostname.replace(/^www\./, ''), videos: [] };
        try {
          /* o Next.js esvazia self.__next_f depois de carregar: lê direto dos <script> */
          var f = '';
          [].forEach.call(document.scripts, function (sc) {
            if (sc.textContent.indexOf('songData') < 0) return;
            sc.textContent.replace(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g, function (m, g) { try { f += JSON.parse(g); } catch (e2) {} });
          });
          if (!f) f = (self.__next_f || []).map(function (x) { return x[1] || ''; }).join('');
          var i = f.indexOf('"songData":');
          if (i >= 0) {
            var a = f.indexOf('{', i), p = 0, s = false, e = false, j;
            for (j = a; j < f.length; j++) {
              var c = f[j];
              if (s) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') s = false; continue; }
              if (c === '"') s = true; else if (c === '{' || c === '[') p++; else if (c === '}' || c === ']') { p--; if (!p) break; }
            }
            var sd = JSON.parse(f.slice(a, j + 1));
            d.titulo = (sd.song || {}).name; d.artista = (sd.artist || {}).name;
            d.genero = ((sd.artist || {}).genre || {}).name;
            var cfg = sd.config || {}; d.capo = cfg.capo || 0; d.forma = cfg.keyShape || '';
            d.afinacao = cfg.tuning && cfg.tuning !== 'E A D G B E' ? cfg.tuning : 'Padrão';
            d.versao = (sd.label || {}).name; d.compositores = sd.composers || [];
            var me = sd.metadata || {};
            if (me.youtubeID) d.videos.push({ url: 'https://www.youtube.com/watch?v=' + me.youtubeID, rotulo: 'Vídeo oficial' });
            var vl = me.videoLesson || {};
            if (vl.youtubeID && vl.youtubeID !== me.youtubeID) d.videos.push({ url: 'https://www.youtube.com/watch?v=' + vl.youtubeID, rotulo: 'Videoaula' });
          }
        } catch (err) { /* sem metadados: segue só com a cifra */ }
        if (!d.titulo) { var h1 = document.querySelector('h1'); d.titulo = h1 ? h1.innerText.trim() : document.title; }
        if (!d.artista) { var h2 = document.querySelector('h1 + h2, h2'); d.artista = h2 ? h2.innerText.trim() : ''; }
        var json = JSON.stringify(d);
        var b64 = btoa(unescape(encodeURIComponent(json)));
        window.open(APP + '#/importar?pacote=' + encodeURIComponent(b64), '_blank');
      } catch (err) { alert('Repertor.io: ' + err.message); }
    };
    return 'javascript:(' + fn.toString().replace(/\s*\n\s*/g, ' ') + ')(' + JSON.stringify(appUrl) + ');void 0';
  }

  /** Lê o pacote que o botão mandou pela URL. */
  function lerPacote(b64) {
    const json = decodeURIComponent(escape(atob(b64)));
    const d = JSON.parse(json);
    const limpo = limpar(d.cifra || '');
    d.cifra = limpo.cifra;
    if (d.forma && A.ehAcorde(d.forma)) d.tom = A.transporNome(d.forma, d.capo || 0);
    if (!d.tom && limpo.tom) d.tom = limpo.tom;
    if (!d.capo && limpo.capo) d.capo = limpo.capo;
    if (!A.ehAcorde(d.tom || '')) d.tom = '';
    return d;
  }

  R.importar = { linksDeBusca, limpar, resumo, porLink, servidorDisponivel, codigoBotao, lerPacote };
})(window.Repertorio = window.Repertorio || {});
