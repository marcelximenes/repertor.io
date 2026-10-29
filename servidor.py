#!/usr/bin/env python3
"""Repertor.io — servidor local (só 127.0.0.1).

Serve o app (pasta app/) e uma rota de importação:
  GET /api/importar?url=<link de uma cifra>
Busca UMA página, a pedido do usuário, e devolve a cifra estruturada
(título, artista, gênero, tom, capo, afinação, vídeo e o texto da cifra)
para entrar no repertório pessoal e ser editada.

Sem dependências: só biblioteca padrão do Python 3.
"""
import html
import ipaddress
import json
import re
import socket
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PASTA_APP = Path(__file__).resolve().parent / 'app'
PORTA = int(sys.argv[1]) if len(sys.argv) > 1 else 4321
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'
LIMITE_BYTES = 4 * 1024 * 1024


# ---------------------------------------------------------------- rede
def host_publico(host):
    """Recusa endereços locais/privados (o servidor não vira proxy da rede de casa).
    Se o DNS falhar aqui (ex.: rede atrás de proxy), deixa a requisição tentar."""
    if host in ('localhost',) or host.endswith('.local'):
        return False
    try:
        ip = ipaddress.ip_address(host)
        return not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved)
    except ValueError:
        pass
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return True
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            return False
    return True


def baixar(url):
    partes = urllib.parse.urlsplit(url)
    if partes.scheme not in ('http', 'https') or not partes.hostname:
        raise ValueError('Link inválido: use um endereço http(s).')
    if not host_publico(partes.hostname):
        raise ValueError('Endereço não permitido.')
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9'})
    with urllib.request.urlopen(req, timeout=15) as r:
        bruto = r.read(LIMITE_BYTES + 1)
        if len(bruto) > LIMITE_BYTES:
            raise ValueError('Página grande demais.')
        charset = r.headers.get_content_charset() or 'utf-8'
        return bruto.decode(charset, errors='replace'), r.geturl()


# ---------------------------------------------------------------- <pre> → texto
class PreParaTexto(HTMLParser):
    """Extrai o texto de cada <pre>, mantendo quebras de linha e alinhamento.
    Acordes em <b>/<span> viram texto normal; blocos (div, tablatura) viram linhas."""
    BLOCOS = {'div', 'p', 'br', 'li', 'tr'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.pres, self.prof, self.buf, self.ign = [], 0, [], 0

    def _nova_linha(self):
        if self.buf and not ''.join(self.buf[-1:]).endswith('\n'):
            self.buf.append('\n')

    def handle_starttag(self, tag, attrs):
        if tag == 'pre':
            self.prof += 1
            if self.prof == 1:
                self.buf = []
        elif self.prof:
            if tag in ('script', 'style', 'button'):
                self.ign += 1
            elif tag in self.BLOCOS:
                self._nova_linha()

    def handle_endtag(self, tag):
        if tag == 'pre' and self.prof:
            self.prof -= 1
            if self.prof == 0:
                self.pres.append(''.join(self.buf))
        elif self.prof:
            if tag in ('script', 'style', 'button'):
                self.ign = max(0, self.ign - 1)
            elif tag in self.BLOCOS:
                self._nova_linha()
            elif tag == 'span' and self.buf and self.buf[-1].strip().startswith(('E|', 'B|', 'G|', 'D|', 'A|', 'e|', 'b|', 'g|', 'd|', 'a|')):
                self._nova_linha()

    def handle_startendtag(self, tag, attrs):
        if self.prof and tag == 'br':
            self.buf.append('\n')

    def handle_data(self, data):
        if self.prof and not self.ign:
            self.buf.append(data)


def textos_pre(pagina):
    p = PreParaTexto()
    p.feed(pagina)
    saida = []
    for t in p.pres:
        t = t.replace('\r\n', '\n').replace('\r', '\n').replace(' ', ' ').replace('\t', '    ')
        t = re.sub(r'\n{3,}', '\n\n', t).strip('\n')
        if t.strip():
            saida.append(t)
    return saida


# ---------------------------------------------------------------- metadados
def meta_tag(pagina, prop):
    m = re.search(r'<meta[^>]+(?:property|name)=["\']%s["\'][^>]*content=["\']([^"\']*)' % re.escape(prop), pagina, re.I)
    if not m:
        m = re.search(r'<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']%s["\']' % re.escape(prop), pagina, re.I)
    return html.unescape(m.group(1)).strip() if m else ''


def json_ld(pagina):
    itens = []
    for bloco in re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', pagina, re.S | re.I):
        try:
            d = json.loads(bloco)
        except ValueError:
            continue
        itens.extend(d if isinstance(d, list) else [d])
    return itens


def objeto_balanceado(texto, inicio):
    """Recorta um objeto JSON {...} a partir de `inicio`, respeitando strings."""
    prof, dentro, esc = 0, False, False
    for j in range(inicio, len(texto)):
        c = texto[j]
        if dentro:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == '"':
                dentro = False
            continue
        if c == '"':
            dentro = True
        elif c in '{[':
            prof += 1
        elif c in '}]':
            prof -= 1
            if prof == 0:
                return texto[inicio:j + 1]
    return None


def song_data_cifraclub(pagina):
    """O Cifra Club (Next.js) embute os dados da música em self.__next_f.push([1,"..."])."""
    partes = []
    for m in re.finditer(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)', pagina):
        try:
            partes.append(json.loads(m.group(1)))
        except ValueError:
            pass
    fluxo = ''.join(partes)
    i = fluxo.find('"songData":')
    if i < 0:
        return None
    bruto = objeto_balanceado(fluxo, fluxo.find('{', i))
    try:
        return json.loads(bruto) if bruto else None
    except ValueError:
        return None


NOTAS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
BEMOIS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']


def transpor_tom(tom, semitons):
    m = re.match(r'^([A-G])([#b]?)(m?)$', tom or '')
    if not m or not semitons:
        return tom or ''
    pc = (NOTAS.index(m.group(1)) + {'#': 1, 'b': -1, '': 0}[m.group(2)] + semitons) % 12
    return (BEMOIS if m.group(2) == 'b' else NOTAS)[pc] + m.group(3)


def id_youtube(txt):
    m = re.search(r'(?:youtu\.be/|youtube(?:-nocookie)?\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/|live/))([\w-]{11})', txt or '')
    return m.group(1) if m else None


# ---------------------------------------------------------------- extratores
def extrair_cifraclub(pagina, url):
    pres = textos_pre(pagina)
    if not pres:
        raise ValueError('Não achei a cifra nesta página do Cifra Club.')
    r = {'cifra': max(pres, key=len)}
    sd = song_data_cifraclub(pagina) or {}
    musica, artista = sd.get('song') or {}, sd.get('artist') or {}
    cfg, meta = sd.get('config') or {}, sd.get('metadata') or {}
    r['titulo'] = musica.get('name') or ''
    r['artista'] = artista.get('name') or ''
    r['genero'] = (artista.get('genre') or {}).get('name') or ''
    capo = cfg.get('capo') or 0
    r['capo'] = capo if isinstance(capo, int) else 0
    afin = (cfg.get('tuning') or '').strip()
    r['afinacao'] = 'Padrão' if afin in ('', 'E A D G B E') else afin
    # keyShape = forma que se toca; com capo, o tom que soa fica `capo` semitons acima (⚠️ premissa)
    forma = cfg.get('keyShape') or ''
    r['tom'] = transpor_tom(forma, r['capo']) if forma else ''
    r['instrumento'] = (sd.get('instrument') or {}).get('slug') or ''
    r['versao'] = (sd.get('label') or {}).get('name') or ''
    r['compositores'] = sd.get('composers') or []
    videos = []
    yid = meta.get('youtubeID')
    if yid:
        videos.append({'url': 'https://www.youtube.com/watch?v=' + yid, 'rotulo': 'Vídeo oficial'})
    aula = meta.get('videoLesson') or {}
    if aula.get('youtubeID') and aula.get('youtubeID') != yid:
        videos.append({'url': 'https://www.youtube.com/watch?v=' + aula['youtubeID'], 'rotulo': 'Videoaula'})
    r['videos'] = videos
    if not r['titulo'] or not r['artista']:
        completar_generico(r, pagina)
    return r


def completar_generico(r, pagina):
    for item in json_ld(pagina):
        if item.get('@type') in ('MusicRecording', 'MusicComposition'):
            r['titulo'] = r.get('titulo') or item.get('name') or ''
            by = item.get('byArtist')
            if isinstance(by, dict):
                r['artista'] = r.get('artista') or by.get('name') or ''
    if not r.get('titulo'):
        t = meta_tag(pagina, 'og:title') or (re.search(r'<title[^>]*>(.*?)</title>', pagina, re.S | re.I) or [None, ''])[1]
        t = html.unescape(re.sub(r'\s+', ' ', t)).strip()
        # padrão comum: "Música - Artista - Site"
        pedacos = [p.strip() for p in re.split(r'\s+[-–|]\s+', t) if p.strip()]
        if pedacos:
            r['titulo'] = re.sub(r'\s*\((?:cifra|cifras|acordes|tab).*?\)\s*$', '', pedacos[0], flags=re.I)
        if len(pedacos) > 2 and not r.get('artista'):
            r['artista'] = pedacos[1]
    if not r.get('videos'):
        yid = id_youtube(pagina)
        if yid:
            r['videos'] = [{'url': 'https://www.youtube.com/watch?v=' + yid, 'rotulo': 'Vídeo da página'}]


def extrair_generico(pagina, url):
    pres = textos_pre(pagina)
    if not pres:
        raise ValueError('Não achei uma cifra (bloco <pre>) nesta página. Use copiar e colar.')
    r = {'cifra': max(pres, key=len), 'titulo': '', 'artista': '', 'genero': '', 'capo': 0, 'afinacao': 'Padrão', 'tom': '', 'videos': []}
    completar_generico(r, pagina)
    return r


def importar(url):
    pagina, final = baixar(url)
    host = urllib.parse.urlsplit(final).hostname or ''
    r = extrair_cifraclub(pagina, final) if host.endswith('cifraclub.com.br') else extrair_generico(pagina, final)
    r['fonte'] = final
    r['site'] = host.removeprefix('www.')
    return r


# ---------------------------------------------------------------- HTTP
class Manipulador(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(PASTA_APP), **kw)

    def log_message(self, fmt, *args):
        pass

    def _json(self, codigo, corpo, cors=False):
        dados = json.dumps(corpo, ensure_ascii=False).encode('utf-8')
        self.send_response(codigo)
        if cors:  # só o /api/status: o app aberto como arquivo (file://) pergunta se o servidor está de pé
            self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(dados)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(dados)

    def do_GET(self):
        partes = urllib.parse.urlsplit(self.path)
        if partes.path == '/api/status':
            return self._json(200, {'ok': True, 'app': 'Repertor.io'}, cors=True)
        if partes.path == '/api/importar':
            url = (urllib.parse.parse_qs(partes.query).get('url') or [''])[0].strip()
            try:
                return self._json(200, importar(url))
            except ValueError as e:
                return self._json(400, {'erro': str(e)})
            except urllib.error.HTTPError as e:
                return self._json(502, {'erro': f'O site respondeu {e.code}.'})
            except Exception as e:  # rede, tempo esgotado, etc.
                return self._json(502, {'erro': f'Não consegui abrir o link ({type(e).__name__}).'})
        return super().do_GET()


if __name__ == '__main__':
    servidor = ThreadingHTTPServer(('127.0.0.1', PORTA), Manipulador)
    print(f'Repertor.io em http://127.0.0.1:{PORTA}/')
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass
