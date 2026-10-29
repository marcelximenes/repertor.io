# Repertor.io

Repertório pessoal de cifras do Marcel. É uma biblioteca das músicas que ele toca, escreve ou está aprendendo, com as funções principais de leitura de cifra: diagramas, troca de tom, capotraste e rolagem. Também tem o caminho contrário: ele monta o acorde no braço e o app diz o nome.

Começou com uma engenharia reversa do Cifra Club (`docs/engenharia-reversa-cifraclub.md`), mas **não copia o site**. A ideia é ter as funções que importam num app local, com as cifras que o próprio Marcel escreve.

## Como abrir

- **Jeito recomendado:** clique duas vezes em `Repertor.io.desktop` ou rode `./abrir.sh`. Isso sobe o `servidor.py` (só Python 3, nada para instalar) em `http://127.0.0.1:4321` e abre o navegador. Assim os vídeos tocam dentro do app e a importação por link funciona.
- **Jeito rápido:** abra `app/index.html` no Chrome. Funciona tudo, menos importar por link e ver vídeo dentro do app (os vídeos abrem no YouTube).

Na primeira vez, vá em **Configurações → Arquivo de dados → Abrir arquivo existente** e escolha `dados/repertorio.json`. A partir daí cada mudança é gravada nesse arquivo, além do navegador.

## O que faz

| Área | Funções |
|---|---|
| **Biblioteca** | busca por título, artista, gênero, tag e trecho da letra · filtros por status, artista, gênero, tag e favoritas · ordenação |
| **Música** | página no estilo do Cifra Club: **trilho de ferramentas à esquerda** (Rolagem, Colunas · Diagramas, Tom, Capotraste, Afinação · Tablaturas, Texto · Restaurar padrões; no topo, Opções: editar, favoritar, baixar, imprimir), cada botão abre um painel ao lado · Cifra/Letra é um botão no menu; o Tom e a casa do capotraste aparecem no próprio botão · no celular o trilho vira barra embaixo |
| **Aparência** | Ajustes → Aparência: fonte, tamanho, peso e altura da linha da letra; fonte, tamanho e peso dos acordes; cores do sistema (fundo, cartões, texto, destaque, acordes, letra, tablatura, contorno do menu) separadas para o tema escuro e o claro, com prévia ao vivo |
| **Layout em blocos** | a página da música é feita de blocos (Cifra, Menu da cifra, Acordes, Vídeos, Notas) em colunas, como um gerenciador de janelas lado a lado. Em **Personalizar layout** (ícone ao lado de Editar, ou Opções no menu): arraste um bloco pelo título para outro lugar ou para a faixa entre colunas (cria coluna nova), arraste a divisória para mudar a largura e a borda de baixo para a altura (dois cliques volta ao automático), oculte e mostre blocos. A página usa a tela toda: cada coluna pode **esticar** (ocupa o espaço livre) ou ter **largura fixa** (digitada ou arrastando qualquer divisória, inclusive a da cifra e as das pontas); dá para **distribuir** as colunas (início, centro, fim, espaço entre, ao redor, igual), **alinhar na vertical** (topo, meio, base, esticar) e ajustar o espaço entre colunas e a margem lateral. Padrão: cifra à esquerda, acordes/vídeos/notas no meio, menu à direita. O layout vale para todas as músicas |
| **Acordes na letra** | botão **Editar** no cabeçalho da música (as informações da música — título, letra, vídeos — ficam em **Editar informações**, no menu da cifra): os acordes viram etiquetas. Arraste para os lados ou para outra linha; clique na letra para pôr um acorde ali; clique num acorde para trocar o nome ou tirar (ou Delete); Ctrl+Z desfaz. Ao lado (no lugar do bloco Acordes, ou numa coluna flutuante se ele estiver oculto) fica a lista de acordes da música com os diagramas: puxe com a mãozinha para a letra, ou clique num e vá clicando nas sílabas. Em cima da lista, **busca pelo nome** para criar um acorde novo: mostra as sugestões e o diagrama (‹ › troca a forma), **Adicionar** ou **Montar notas** antes |
| **Tirar acorde** | no balão do acorde, em cima: lixeira = excluir só este; vassoura = limpar todos iguais da música (e da lista). No editor de notas, **Limpar** zera o diagrama |
| **Acorde aceso** | passar o mouse num acorde da cifra mostra o diagrama dele flutuando em cima do acorde e acende o diagrama no bloco Acordes (e vice-versa) |
| **Live** | botão Live no menu da cifra (precisa do vídeo do YouTube na página, abrindo pelo lançador). **Gravar**: o vídeo toca do começo e você aperta **espaço** a cada acorde, na ordem da cifra (← desfaz, Esc para e salva; dá para continuar depois). **Tocar ao vivo**: só o acorde da hora acende, na cifra e nos diagramas; os próximos vão acendendo aos poucos perto da hora ("Acender antes" ajusta quantos segundos); a cifra rola sozinha; clicar num acorde pula o vídeo até ele; espaço pausa. Mudar o tom ou o capo no meio não para o vídeo |
| **Modo palco** | botão de slides no menu da cifra: a cifra em tela cheia, na horizontal, em slides grandes (um por seção/estrofe, até 8 linhas), com a fonte ajustada para caber. Setas, Page Up/Down, espaço ou deslizar trocam de slide; F = tela cheia; Esc sai. Com o Live gravado, **Tocar ao vivo** faz os slides passarem sozinhos com a música, acendendo só o acorde da hora, e mostra no canto o diagrama do acorde de agora e do próximo |
| **Metrônomo e afinador** | no menu da cifra. Metrônomo: BPM (−/+, barra ou bater o tempo), compasso 2/4, 3/4, 4/4, 6/8, primeiro tempo acentuado; começa no BPM da música e guarda o BPM novo nela. Afinador: pelo microfone mostra a nota, a frequência e quantos cents falta, destaca a corda mais perto (do instrumento escolhido e da afinação de leitura) e toca a nota de cada corda para afinar de ouvido. O microfone só fica ligado com o painel aberto |
| **Editar acorde na cifra** | clique no acorde → **Editar** (ou o lápis no diagrama): o diagrama vira editor ali mesmo, no bloco Acordes. Tire ou coloque notas no braço ou no teclado; o app reconhece o nome. Se não reconhecer, sugere o mais próximo com `*` (ex.: `Em7*`), ou você digita o nome. **Salvar nesta música** guarda a forma só nesta música (e, se mudou o nome, troca todos iguais desta cifra); **Só neste ponto** troca só o acorde clicado. Não mexe em outras músicas nem nas suas formas guardadas |
| **Diagramas** | violão/guitarra (com modo canhoto), ukulele, cavaquinho e **teclado/piano** · no piano: posição fundamental, inversões e só mão direita, com o nome de cada nota na tecla e o baixo (mão esquerda) destacado · várias formas por acorde (‹ ›) · "Usar aqui" fixa a forma · clique no diagrama para ouvir |
| **Acordes** | **Montar no braço:** clica nas casas e ele diz o nome, com alternativas · **Pelo nome:** digita e vê todas as formas · "Guardar" cria as suas formas preferidas |
| **Vídeos** | vários links do YouTube por música, com rótulo ("de onde tirei", "aula"…); links com `&t=` começam no ponto certo |
| **Classificação** | artista, gênero, tags livres, status (quero aprender / aprendendo / no repertório), favorita, tom, capo, afinação, BPM |
| **Importar** | **botão Repertor.io** (favoritos): na página da cifra, um clique abre o app com tudo preenchido · **pelo link:** cola o endereço da cifra e o app puxa título, artista, gênero, tom, capo, afinação, vídeo e a cifra, pronto para editar (melhor no Cifra Club) · **ou** busca, copia e cola, e o app limpa o texto |
| **Dados** | local-first: IndexedDB no navegador + espelho em `dados/repertorio.json` + backup exportável |

## Como escrever a cifra

```
[Intro] G  D/F#  Em7  C7M          ← linha só de acordes

G               D/F#               ← acorde em cima…
Letra embaixo, alinhada com espaço ← …letra embaixo

Também [C]vale a[G]ssim            ← acorde entre colchetes no meio da letra

[Refrão]                           ← seção
e|---0---3---|                     ← tablatura
```

Acorde com `*` no fim (`Em7*`, `Gmeu*`) é um acorde aproximado ou com nome livre: vale como o nome antes do `*` e a forma que você montou fica guardada na música.

Notação brasileira e americana: `7M`/`maj7`, `m7(b5)`/`ø`, `°`, `4`/`sus4`, `7/4`, `7(9)`, `6(9)`, `add9`, `5-`/`b5`, baixo com `/`.

## Estrutura

```
Rpertor.io/
├── README.md · AGENTS.md · CLAUDE.md
├── abrir.sh · Repertor.io.desktop   ← lançador
├── servidor.py                      ← servidor local + importação por link
├── app/                             ← o app (abrir index.html)
│   ├── index.html · app.css
│   ├── ds/                          ← System.DS (o mesmo do Memor.io e do Letters)
│   └── js/  icones · acordes · diagrama · cifra · importar · dados · app · exemplos
├── dados/repertorio.json            ← seus dados (espelho gravado pelo app)
└── docs/  BACKLOG.md · engenharia-reversa-cifraclub.md
```

## Situação (26/10/2026)

v0.5: piano (formas com inversões), edição de acorde direto na cifra (tirar/colocar notas, nome reconhecido ou aproximado com `*`), página da cifra no estilo do Cifra Club (trilho de ferramentas com painéis) e menu lateral recolhível. v0.3: importação pelo link. v0.2: visual do System.DS (igual Memor.io/Letters: escuro por padrão, IBM Plex, rótulos em caixa alta, gaveta lateral) e importação assistida. v0.1 pronta e testada no Chromium (biblioteca, cifra, tom, capo, diagramas nos 4 instrumentos, montador, vídeos, persistência, abrindo pelo arquivo e pelo servidor). Próximos passos em `docs/BACKLOG.md`.
