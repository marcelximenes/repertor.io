# Engenharia reversa — Cifra Club (biblioteca + página de cifra)

> Levantamento de 22/10/2026, feito no navegador do app (sem login).
> Escopo: **estrutura** da página de cifra e da biblioteca. Nenhum artista foi raspado e nenhum conteúdo de música (letra, cifra, formatos de acorde) foi copiado. Uma única página de cifra pública foi aberta só como amostra de estrutura.
>
> Legenda: ✅ **observado** (visto no DOM/dados) · ⚠️ **suposição** (inferido; pode ser diferente na realidade — precisa confirmar)

---

## 1. Stack e arquitetura

- ✅ Front em **Next.js (App Router)** com React Server Components: dados vêm embutidos no HTML via `self.__next_f.push(...)` (flight data). Bundles em `akamai.sscdn.co/ccn/_next/static/...`.
- ✅ A página de cifra é **renderizada no servidor**: ao abrir, não há chamada XHR/fetch de API para o conteúdo — só o documento HTML.
- ✅ CDN de imagens: `akamai.sscdn.co/letras/180x180/albuns/...` (mesma infraestrutura do Letras.mus.br — grupo Studio Sol).
- ✅ Login em domínio separado: `id.cifraclub.com.br` (script `id/v2/pt-br/client.mdr.latest.js`) + Google One Tap (`accounts.google.com/gsi/client`).
- ✅ Muitos scripts de anúncio (GPT, Prebid, Amazon APS, Criteo etc.) — ruído; não interessa para o Repertor.io.
- ✅ Tema: Automático / Claro / Escuro, escolhido no rodapé; um script inline força tema em algumas rotas.

## 2. Rotas (padrões de URL)

| Padrão | O que é | Status |
|---|---|---|
| `/{artista}/{musica}/` | Página de cifra (versão principal) | ✅ |
| `/{artista}/` | Página do artista | ✅ (não explorado — fora do escopo) |
| `/{artista}/{musica}/imprimir.html` | Versão de impressão | ✅ (visto no script que detecta `/imprimir`) |
| `/musico/{id}/` | **Biblioteca / listas do usuário** | ✅ link existe; ⚠️ conteúdo não visto (exige login) |
| `/musico/` sem login | Redireciona para a home | ✅ |
| `/estilos/{genero}/`, `/explorar/musicas/`, `/novidades/` | Descoberta | ✅ |
| `/afinador/`, `/metronomo/`, `/dicionario-de-acordes/` | Ferramentas | ✅ |

⚠️ Outras versões da mesma música (por instrumento) provavelmente seguem `/{artista}/{musica}/{slug-da-versao}.html` ou similar — não confirmado.

## 3. Página de cifra

### 3.1 Layout (DOM)

```
main#chordPage.chordPage.gridContainer
├── div (slot de anúncio topo)
└── div
    ├── aside (coluna lateral rolável — painel de ferramentas)
    └── div[data-song-card][data-fullscreen]
        ├── cabeçalho (h1 = nome da música, h2 = artista)
        ├── div.mainContainer
        │   └── article
        │       └── pre            ← a cifra
        ├── span[data-current-tool][data-floating]   ← ferramenta aberta no momento
        └── section (vídeos / mídia / versões)
```

✅ Classes CSS são **hasheadas** (`_crVx`, `kvMV`, `EsuY0`…) e mudam a cada deploy — não servem de seletor estável. Os atributos `data-*` e as tags são o que é estável.

### 3.2 Como a cifra é marcada dentro do `<pre>`

- ✅ Texto pré-formatado, monoespaçado; alinhamento acorde/sílaba é feito **por espaços**, linha de acorde acima da linha de letra.
- ✅ Cada acorde é um `<b>` com atributos:
  - `data-chord-name` — nome do acorde
  - `data-chord-original-text` — texto original (antes de transpor)
  - `data-chord-original-trailing` — espaços depois do acorde (para preservar alinhamento ao transpor)
  - `data-chord-index` — posição sequencial
  - `data-chord-scope-id` — escopo/bloco ao qual pertence
- ✅ Tablaturas ficam em `div.tabs` contendo `span.tab` (uma linha de tab por span).
- ✅ Há `div` vazios separando blocos (provavelmente marcadores de seção/quebra).
- ⚠️ **Transposição de tom é feita no cliente**: os atributos "original-text" + "original-trailing" indicam que o JS recalcula o nome do acorde e reajusta os espaços sem pedir nada ao servidor.

### 3.3 Modelo de dados (`songData`, embutido no flight data)

Só os nomes e tipos dos campos (valores omitidos):

```ts
type SongData = {
  id: number
  status: number
  lastUpdate: string            // ISO 8601 com fuso, ex. "AAAA-MM-DDThh:mm:ss-03:00"
  content: string               // ⚠️ curto — referência; o texto da cifra vem no HTML (<pre>), não aqui
  song:   { id: number; name: string; slug: string; source: string; image: { x1: string; x2: string } }
  artist: { id: number; name: string; slug: string; genre: { id: number; name: string; slug: string } }
  composers: string[]
  instrument: { kind: number; name: string; slug: string }   // ex. kind 1 = cifra (violão/guitarra), kind 11 = letra
  label: { name: string; slug: string }                       // nome da versão ("Principal" etc.)
  config: { capo: number; keyShape: string; tuning: string }  // tom de referência, capotraste, afinação ("E A D G B E")
  chords: Array<{
    chord: string; alt: string
    shapes: {                     // um ou vários desenhos por instrumento
      guitar: string[]            // 6 posições separadas por espaço: X = não toca, número = casa
      ukulele: string[]           // 4 posições
      cavaco: string[]            // 4 posições, com prefixo
      viola: string[]; violaMi: string[]; violaRa: string[]   // 5 posições (afinações de viola caipira)
      keyboard: string[]          // notas/índices de teclas
    }
  }>
  strummings: Array<{             // "Batidas"
    id: number; bpm: number; section: string
    pattern: number[]             // ⚠️ códigos numéricos de golpe (baixo/cima/abafado…) — tabela não mapeada
    timeSignature: string[]       // contagem por tempo (números e letras, ex. "1 e 2 e")
  }>
  contributions: Array<{ status: number; user: { id: number; name: string; avatar: string } }>
  metadata: {
    description: string
    verified: boolean
    tabRecognized: boolean
    listAppearances: number       // em quantas listas de usuários a música aparece
    hits: { all_time_hits: number; language: string }
    instrumentsCount: Record<string, number>
    priorityVersions: Array<{ id; instrument; label; metadata: { listAppearances; verified } }>
    youtubeID: string
    videoLesson: { id; title; youtubeID; thumbnailURL; closedCaptions; version: { id; instrument } }
    lyricsSlug: string
    blocks: { ads: { blocked: boolean }; contrib: { blocked: boolean; reasons: string[] } }
  }
}
```

✅ Também há JSON-LD (schema.org) na página: `MusicRecording`, `MusicComposition`, `BreadcrumbList`.

### 3.4 Ferramentas (painel lateral / barra)

✅ Botões principais: **Tom · Rolagem · Mídia · Opções**.

✅ Painel "Opções" (cards):

| Ferramenta | Valor padrão visto | Observação |
|---|---|---|
| Rolagem (auto-scroll) | — | |
| Dividir em colunas | — | |
| Diagramas | Violão e guitarra | troca instrumento dos diagramas |
| Tom | — | transposição |
| Capotraste | Sem capotraste | |
| Afinação | Padrão | |
| Tablaturas | Mostrar sempre | |
| Texto | 100% | tamanho da fonte |
| Batidas | Mostrar sempre | |
| Tocar junto | **PRO** | pago |
| Pedal passador | **PRO** | pago (controle por pedal bluetooth) |
| Trocar para versão anterior | — | histórico de versões |
| Restaurar padrões | — | reset |

✅ Menu de ações: **Imprimir · Salvar em uma lista · Baixar cifra · Corrigir · Compartilhar**.

✅ Bloco de acordes: lista de diagramas com botão **"Tocar acorde"** (áudio), navegação "Avançar", **"Desafixar acordes"** (barra de acordes fixa), seletor de forma do acorde.

✅ Seletor de versões: "Principal" + "Salvar versão principal" (usuário escolhe qual versão abre por padrão).

## 4. Biblioteca (listas do usuário)

- ✅ Entrada: botão **"Listas"** no cabeçalho → `/musico/{id}/`. Sem login o link sai como `/musico/undefined/`, e `/musico/` redireciona para a home.
- ✅ Na cifra, "Salvar em uma lista" adiciona a música a uma lista.
- ✅ Campo `metadata.listAppearances` conta em quantas listas a música está — indica que **lista é entidade de servidor**, ligada à conta.
- ✅ **Histórico local (sem login)**: `localStorage["@cifra/cc_user_recent_songs_0"]` = `{ order: number[], items: { [songId]: number[] } }` — músicas recentes, por id.
- ✅ **Preferências por música (sem login)**: `localStorage["chords_{artista}_{musica}"]` — array (vazio quando nada foi alterado). ⚠️ provavelmente guarda tom/capo/forma escolhidos para aquela música.
- ⚠️ **Não visto ainda** (precisa login): tela da biblioteca, se há pastas/listas/favoritos, ordenação, se a lista guarda tom personalizado por música, endpoints de API (criar lista, adicionar, remover, reordenar).

## 5. O que isso sugere para o Repertor.io (premissas)

- ⚠️ Separar **música** (metadados) de **versão** (instrumento + label) de **arranjo pessoal** (tom, capo, afinação, forma) — o Cifra Club faz essa separação.
- ⚠️ Guardar acordes como **tokens com posição** (nome original + espaçamento) para transpor sem quebrar alinhamento.
- ⚠️ Diagramas como string compacta por instrumento ("X 0 2 2 1 0" é o formato geral para violão).
- ⚠️ Biblioteca local-first: recentes + preferências por música já funcionam no Cifra Club sem conta.

## 6. Pendências

1. Ver a biblioteca logado (precisa que o Marcel entre na conta no navegador do app) — tela, entidades e chamadas de API.
2. Abrir o modal "Salvar em uma lista" e registrar o fluxo.
3. Confirmar transposição no cliente (mudar o tom e ver se há requisição).
4. Mapear códigos de `strummings.pattern`.
5. Padrão de URL de versões alternativas.
