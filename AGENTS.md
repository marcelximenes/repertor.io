# Repertor.io — Instruções para Agentes

Fonte de verdade do projeto. Ler **antes** de qualquer tarefa.

## O que é

Repertório pessoal de cifras do Marcel: biblioteca, leitura de cifra e diagramas de acorde, num app web estático e local-first. Muitas cifras são **escritas por ele**. Visão e funções estão em `README.md`.

### Fronteira com outros projetos

- **Music.io** (`06_music-io`) é o professor de música: aulas e trilha. Não mexer nele daqui.
- **Pauta** é o produto de estudo de música, outro projeto. Se algo daqui servir lá, anotar no backlog como ideia, sem misturar código.

## Regras

1. Português em tudo (interface, código, comentários, docs).
2. **Não copiar conteúdo de terceiros** para dentro do app ou do repositório: nada de letra, cifra ou exemplo tirado de sites ou artistas. O app guarda o que o Marcel digita; exemplos e testes usam texto original. A engenharia reversa registra estrutura, modelo de dados e fluxos, nunca conteúdo.
3. Formas de acorde vêm do **gerador** (`acordes.js`) ou das formas que o Marcel guarda. Não colar tabelas de outros sites.
4. Suposição, dúvida ou premissa: marcar explicitamente como **⚠️ suposição** nos docs, dizendo que pode ser diferente na realidade. Fato observado/testado: ✅.
5. Estrutura enxuta: nada de pasta vazia, nada de subpasta sem necessidade.
6. Sem build: scripts clássicos (`<script src>`), sem módulos ES. Assim o app funciona abrindo o `index.html` direto (file://) e também pelo servidor local.
7. Verificar trabalho visual por asserções no DOM ou saída de texto (Playwright), **sem gerar screenshots/PNGs**.
8. Backlog no esquema Now/Next/Later em `docs/BACKLOG.md`.
9. **Visual = System.DS** (`app/ds/`, cópia do DS usado no Memor.io e no Letters). O `app.css` só sobrescreve tokens (cinza do Letters + laranja de marca `--brand`, cor dos acordes `--acorde`) e define componentes. Escuro por padrão, claro via `html[data-theme="light"]`. Rótulos em CAIXA ALTA com tracking largo, ícones de linha fina (`js/icones.js`), sem emoji.
10. **Importação, uma música por vez.** Caminho principal: o **botão de favoritos** (`IM.codigoBotao`). Ele roda na página que o Marcel está vendo, lê o `<pre>` e o `songData` dos `<script>` e abre `#/importar?pacote=<base64>`. O Cifra Club responde 403 ao `servidor.py` (bloqueia leitura fora do navegador), e isso **não deve ser contornado**: a leitura pelo servidor fica só para outros sites. O `servidor.py` busca só a página que o Marcel colou, para o repertório pessoal dele. Não fazer busca em lote, varredura de catálogo nem cache de páginas. A música importada guarda o link de origem em `fonte`. Testes usam páginas fictícias. Para conferir contra o site real, contar só estrutura (linhas, tags), sem copiar conteúdo.

## Arquitetura

| Arquivo | Responsabilidade |
|---|---|
| `app/js/acordes.js` | notas, parser de nome de acorde (BR + US, e `*` = aproximado/nome livre), transposição, instrumentos/afinações, gerador de formas com pontuação de conforto, dedilhado/pestana, **formas de piano** (`gerarFormasTeclado`), reconhecimento por notas e **acorde mais próximo** (`maisProximo`) |
| `app/js/diagrama.js` | SVG do diagrama (estático, clicável, canhoto), teclado com nome das notas e baixo destacado (cresce de 2 oitavas para caber), som (Karplus-Strong) |
| `app/js/cifra.js` | classifica linhas (acordes, letra, seção, tab, ChordPro inline), transpõe preservando colunas, renderiza HTML (cada acorde leva `data-l` = linha no texto e `data-k` = posição na linha; modo só letra), troca acordes no texto mantendo o alinhamento (`trocarAcorde`, `trocarTodos`), agrupa em **partes** (`partesHtml`: seção `[Refrão]` vira, à esquerda, uma linha vertical com o nome no meio e traços horizontais marcando o começo e o fim; partes coladas ganham um espaço entre si; usado na leitura com `partes:true` e no modo de edição) |
| `servidor.py` | servidor local (127.0.0.1): serve `app/` e `GET /api/importar?url=`. No Cifra Club lê o `<pre>` da cifra e o `songData` (título, artista, gênero, capo, afinação, forma, vídeos, compositores). Em outros sites pega o maior `<pre>` e metadados (JSON-LD, og:title). Recusa endereços locais ou privados |
| `app/receber.html` | página invisível do servidor: recebe por `postMessage` (só de origem `null` = file://) as músicas do app aberto como arquivo e mescla no banco do servidor (`importarPacote`, a mais nova vence, nada é apagado); leva também tema/menu e a config se o servidor ainda não tem layout/aparência |
| `app/js/importar.js` | importação por link (`porLink`), links de busca, limpeza do texto colado (espaços invisíveis, recuo comum, rótulos de interface), extração de tom/capo/afinação |
| `app/js/icones.js` | ícones de linha (geometria Lucide, ISC) |
| `app/js/dados.js` | IndexedDB (`repertor-io`), espelho em arquivo JSON (File System Access), import/export |
| `app/js/app.js` | rotas por hash (`#/`, `#/m/{id}`, `#/m/{id}/editar`, `#/nova`, `#/importar`, `#/acordes`, `#/config`) e telas |
| `app/js/exemplos.js` | música de exemplo da primeira abertura (texto original) |

### Modelo de dados (música)

```
id, titulo, artista, genero, tags[], status (quero|aprendendo|repertorio), favorita,
tom, capo, afinacao, bpm, instrumento, videos[{url, rotulo}], fonte, notas, cifra (texto),
bibliotecaAcordes ["Am7", …]   ← acordes guardados na música (nomes como no texto) para distribuir na letra
live { yid, tempos:[seg por acorde, na ordem da cifra], total, gravadoEm }   ← gravação do modo Live
formas { "violao:Am": "x02210", "teclado:Am": "45-57-60-64" }   ← forma fixada nesta música (teclado = notas MIDI)
visual { semitons, capo, afinacao (semitons abaixo), instrumento } ← últimas escolhas de leitura
criadoEm, atualizadoEm, abertaEm
```

`formasPessoais` (global): `{ "violao:Am": ["x02210", ...] }`.

### Layout da página da música

`config.aparencia = { fonteLetra, fonteAcorde, tamLetra (px), pesoLetra, tamAcorde (% da letra), pesoAcorde, alturaLinha (%), cores: { escuro: { '--var': '#hex' }, claro: {...} } }` vira variáveis CSS no `<html>` (`aplicarAparencia`).

`config.layout = { colunas: [{ largura, esticar, blocos: [...] }], ocultos: [...], alturas: { bloco: px }, justificar, alinhar, espaco, margem }` (justificar/alinhar = valores de `justify-content`/`align-items`; a página da música não tem largura máxima, a margem lateral vem de `margem`), blocos `cifra | menu | acordes | videos | notas`. A coluna com a cifra estica; as outras têm largura fixa (padrão 300, só menu = 52) e ficam grudadas no topo ao rolar. Menu sozinho na coluna = trilho vertical; dividindo coluna = em linha. Menu na metade direita da tela: dicas e painéis abrem para a esquerda. No celular (≤700px) os blocos empilham e o layout não se edita. `normalizarLayout` garante que cada bloco aparece uma vez; cifra e menu não podem ser ocultados.

### Decisões e premissas

- ✅ Testado no Chromium: file:// e http://127.0.0.1 são contexto seguro e permitem gravar em arquivo.
- ⚠️ suposição: `°`/`º` é lido como **diminuto com sétima** (uso comum no Brasil), enquanto `dim` é a tríade. Pode não bater com o costume do Marcel.
- ⚠️ suposição: `C2` é lido como `C(add9)` (com terça), não como `sus2`.
- ⚠️ suposição: `4` sozinho (`D4`, `G7/4`) é suspenso (`sus4`).
- ⚠️ Em file://, o YouTube recusa tocar o vídeo embutido (não há referer). Por isso o app mostra a miniatura com link, e o lançador existe para os vídeos tocarem dentro do app.
- ⚠️ file:// e http://127.0.0.1 têm armazenamentos separados no navegador. O arquivo `dados/repertorio.json` é o que une os dois (sincroniza por música, vale a versão mais nova).
- ⚠️ suposição: no Cifra Club, `config.keyShape` é a forma tocada e o tom que soa é a forma + capo. Pode haver diferença em músicas com afinação alterada.
- ⚠️ suposição: em sites que não são o Cifra Club, a importação só funciona se a cifra estiver num bloco `<pre>`. Se não estiver, a saída é copiar e colar.
- ✅ 22/10/2026: na página real do Cifra Club, o HTML traz um único `<pre>` com a cifra (acordes em `<b>`, tabs em `span.tab` já separados por quebra de linha) e o `songData` com `keyShape`. Conferido contando só estrutura.
- ⚠️ suposição: a limpeza do texto colado foi testada com texto inventado, não com páginas reais. Pode sobrar ou faltar alguma linha. As linhas removidas aparecem no resumo (passar o mouse em "N linhas removidas").
- ✅ 26/10/2026: menu da cifra conferido no Cifra Club real (só estrutura, pelo navegador): trilho vertical de botões só com ícone (48px, raio 12, rótulo ao passar o mouse) em grupos — Rolagem, Dividir em colunas | Diagramas, Tom, Capotraste, Afinação | Tablaturas, Texto, Batidas | Afinador, Metrônomo, Tocar junto, Pedal | Restaurar padrões; no topo, "Abrir menu de opções" (imprimir, salvar em lista, baixar, corrigir, compartilhar). Cada botão abre um painel flutuante ao lado (fundo #222, raio 16). O Repertor.io copiou a estrutura, não o visual (segue o System.DS) e deixou de fora Batidas, Afinador, Metrônomo, Tocar junto e Pedal (estão no backlog).
- ⚠️ suposição: `Nome*` = acorde aproximado ou com nome livre. A cifra o lê como o nome antes do `*` (ou só a fundamental, se o nome for livre) e a forma real fica fixada na música. Se o Marcel já usar `*` com outro sentido nas cifras dele, isso conflita.
- ⚠️ suposição: no **teclado** a cifra mostra os acordes como soam (ignora capotraste e afinação), porque piano não tem capo. Pode não ser o que o Marcel espera se ele tocar junto com alguém de capo.
- ⚠️ suposição: o painel **Afinação** é uma escolha de leitura ("estou afinado ½ tom abaixo, mostre as formas para soar no mesmo tom"): sobe as formas. Ele não lê o campo `afinacao` da música (que vem da importação), para não mexer nas cifras importadas, que já vêm com as formas para a afinação indicada.
- ⚠️ suposição: formas de piano geradas = mão esquerda com a fundamental (ou o baixo da barra) entre E2 e D#3, mão direita em posição fundamental e inversões começando entre F3 e E4; acordes com 5+ notas perdem a 5ª justa. É um ponto de partida; o Marcel ajusta e fixa a dele.
- ⚠️ suposição: as fontes oferecidas em Aparência têm letra de 0,6 em de largura (IBM Plex Mono, JetBrains Mono, Fira Mono, Source Code Pro, Roboto Mono, Courier Prime, DejaVu, Liberation). O acorde com tamanho diferente da letra é compensado com `letter-spacing` calculado nessa largura; numa fonte de outra largura pode desalinhar. As fontes de fora vêm do Google Fonts (precisa de internet; sem ela cai na IBM Plex Mono/fonte do sistema).
- `limparToken` (cifra.js) só tira parêntese que sobra: `C7(9)` fica inteiro, `(Am)` vira `Am`. Antes `C7(9)` virava `C7(9` e, ao trocar o acorde, sobrava `)`.
- ⚠️ Afinador: autocorrelação no `AnalyserNode` (2048 amostras, ~20 leituras/s, mediana das 5 últimas). Testado com ondas sintéticas de 82 a 440 Hz (erro < 0,1 Hz); **não testado com microfone de verdade** — pode precisar ajustar o limiar de silêncio (`0.012`) para o microfone do Marcel. Precisa de contexto seguro (file:// e 127.0.0.1 servem).
- Metrônomo: cliques agendados no relógio do WebAudio (125 ms à frente), não em `setInterval` puro, para não atrasar.
- Acordes na letra: `C.estrutura` agrupa linha de acordes + letra em pares (`{acordes:[{texto,nucleo,col}], letra}`), `C.serializar` volta para texto empurrando acordes encostados para a direita. Acordes entre colchetes (`Eu [Am]vou`) viram acorde em cima da letra quando a música é editada nesse modo. Na tela os nomes aparecem transpostos (tom/capo) e voltam para o tom do texto ao salvar.
- ⚠️ Vídeo: o player usa `youtube.com/embed` com `origin` e `referrerpolicy=strict-origin-when-cross-origin`. Aberto como arquivo (file://) o YouTube recusa tocar (não há referer); pelo lançador deve tocar. Vídeos com incorporação desativada pelo dono não tocam fora do YouTube. ⚠️ Não testado tocando de verdade (o ambiente de teste não acessa o YouTube).
- Live: usa a IFrame API do YouTube (`youtube.com/iframe_api`, iframe com `enablejsapi=1`). Os tempos são por posição do acorde na cifra (1º espaço = 1º acorde). ⚠️ Se a cifra ganhar ou perder acordes depois da gravação, os tempos deslocam — o painel avisa quando o total mudou. Para o vídeo não recomeçar quando a página redesenha (mudar tom, capo…), o iframe é guardado e devolvido com `moveBefore` (Chrome 133+); em navegador sem isso, o vídeo recarrega. ⚠️ Testado com um YouTube falso (simulado); não testado com o YouTube de verdade.
- ⚠️ "Mais próximo" é uma heurística (pontua notas sobrando e faltando contra os modelos de acorde). Pode sugerir um nome estranho em clusters; por isso o nome continua editável.
- Gerador de formas: busca em janelas de 4 casas, exige baixo = fundamental (ou o baixo da barra), no máximo 4 dedos (com pestana) e pontua conforto (posição, esticadas com corda solta, cordas mudas, pestana).

## Como testar

```
python3 servidor.py 4321
```
Depois, testes Playwright com asserções no DOM. Os casos mínimos são:
- biblioteca lista e filtra
- a cifra renderiza acordes clicáveis
- tom e capo transpõem
- o popover fixa a forma
- os diagramas aparecem nos 4 instrumentos
- o montador reconhece `x32010` = C
- o trilho abre os painéis (tom, capo, afinação, diagramas, texto) e Restaurar padrões volta tudo
- editar acorde: tirar/colocar nota reconhece o nome; Trocar aqui / Em toda a música altera o texto e fixa a forma
- piano: formas com inversões e nomes nas teclas
- menu recolhível persiste depois de recarregar
- layout: arrastar bloco (usar mouse.down/move/up; `drag_and_drop` do Playwright não dispara o dragstart aqui), criar coluna, largura, altura, ocultar/mostrar, persistir
- o vídeo vira iframe em http e miniatura em file://
- os dados persistem depois de recarregar

### Modo de edição da cifra

Mesmas medidas da leitura (mesmas linhas, mesmas partes, acordes nas mesmas colunas); só a cor muda, para magenta (`--acorde-edicao`, `--letra-edicao`). Passar o mouse num acorde mostra o diagrama em cima dele, como na leitura (com borda magenta). O **+** à esquerda da linha sob o mouse abre o menu: linha de letra (escreve na própria linha; Enter cria a próxima, Esc cancela), linha em branco, parte (Introdução, Verso, Pré-refrão, Refrão, Ponte, Solo, Interlúdio, Final ou outro nome), editar texto e apagar linha; acima ou abaixo. Clique no rótulo da parte troca o nome ou tira a parte. Dois cliques na letra editam o texto. Linhas em branco também aceitam acorde (clique ou arraste; viram linha de acordes) e texto (dois cliques). Ao lado do + fica a alça ⋮⋮: arrastar move a linha; arrastar o rótulo de uma parte move a parte inteira (só encaixa entre partes). Enquanto se arrasta um acorde ou uma linha aparece uma **lixeira** embaixo, no centro: soltar nela tira o acorde ou apaga a linha; uma parte solta na lixeira perde só o rótulo (as linhas ficam). Segurar **Alt ou Ctrl** ao arrastar um acorde ou uma linha **duplica** (o original fica; o fantasma ganha um +). Ctrl porque no Linux o Alt+arrastar costuma ser pego pelo gerenciador de janelas. Clicar num acorde → **Trocar pelo diagrama** abre o editor de acorde (o mesmo da leitura) já em edição: tirar/pôr notas, nome reconhecido; "Só neste ponto" ou "Trocar todos iguais". **Shift+clique** seleciona várias linhas (barra embaixo): *Marcar como* parte (se a seleção fica no meio de uma parte, o que vem depois volta a ter o nome antigo; rótulos dentro da seleção somem), *Distribuir* acordes das linhas sem letra: tira o espaço do começo e deixa um espaço fixo depois de cada acorde ou marca (`config.espacoAcordes`, padrão 4, ajustável no −/+), *Apagar linhas*. O + de uma linha só de acordes também tem *Distribuir*. **Copiar/colar blocos:** no menu da parte, *Copiar a parte inteira* (sem as linhas em branco do fim) e *Duplicar logo abaixo*; na barra de seleção, *Copiar* (Ctrl+C) e *Duplicar*; *Colar* aparece no + de qualquer linha (Ctrl+V cola depois da seleção). A cópia fica em `edAc.copia` (vale entre músicas na mesma sessão) e vai também como texto para a área de transferência. Colar uma parte no meio de outra devolve o nome antigo às linhas que vêm depois. Ctrl+Z desfaz. As partes são gravadas no texto como `[Nome]`.

### Vídeo na tela (arquivo × servidor)

O YouTube só toca dentro da página quando o app está em `http://127.0.0.1:4321` (servidor local). Aberto como arquivo (`index.html`, file://), o app pergunta ao servidor (`/api/status`, com CORS só nessa rota) e, se ele estiver ligado, passa para lá sozinho: manda as músicas mudadas desde a última passagem (`localStorage repertorio:passouEm`) via `receber.html` e abre a mesma rota no servidor. Sem servidor, a miniatura do vídeo não abre outra janela: mostra no lugar um aviso para abrir pelo lançador, com *Tentar de novo*. ⚠️ suposição: o bloqueio do YouTube em file:// (vídeo sem referência de origem) foi tomado como fato pela mensagem que já estava no app; não testei contra o YouTube real daqui (sem rede para o YouTube).
