# Backlog — Repertor.io

## Now
- [ ] Marcel usar com as primeiras músicas dele e apontar o que incomoda (leitura, editor, diagramas)
- [ ] Revisar as premissas de notação (`°`, `C2`, `4`, `*`). Ver AGENTS.md → Decisões e premissas
- [ ] Testar a edição de acordes e o piano com músicas reais e dizer se o teclado deve respeitar o capotraste

## Next
- [ ] Testar a importação por link com links reais na máquina do Marcel e ajustar o que vier torto (espaços, seções, tom)
- [ ] Escolher a versão na importação (Cifra Club tem versões por instrumento: principal, simplificada, ukulele…)
- [ ] Listas / setlists (ordem de apresentação, tom por música dentro da lista), como as "Listas" do Cifra Club
- [ ] Batidas (ritmo): editor simples de padrão ↓↑ com BPM, como o `strummings` do Cifra Club (botão já previsto no trilho)
- [ ] Diagramas "no corpo da cifra" (em cima de cada acorde), como opção do painel Diagramas do Cifra Club
- [ ] Viola caipira (afinações cebolão em Mi e em Ré)
- [ ] Atalhos de teclado na leitura (espaço = rolar, ←/→ = tom)
- [ ] Importar .txt / ChordPro em lote

## Later
- [ ] Usar no celular (PWA ou sincronização pela pasta)
- [ ] Ver a biblioteca do Cifra Club logado (`/musico/{id}/`) só como referência de fluxo. Precisa que o Marcel entre na conta
- [ ] Reconhecer acorde pelo microfone

## Feito
- [x] 28/10/2026: edição da cifra com o mesmo espaçamento da leitura (só muda a cor); + à esquerda para adicionar linhas e partes; partes com rótulo vertical e linha à esquerda; arrastar linhas e partes; lixeira para tirar acordes e linhas; diagrama ao passar o mouse na edição
- [x] 27/10/2026: modo palco — slides horizontais grandes que passam sozinhos no Live, com o diagrama de agora e do próximo
- [x] 27/10/2026: modo Live — gravar o segundo de cada acorde com espaço enquanto o vídeo toca; tocar acendendo só o acorde da hora (cifra e diagramas)
- [x] 26/10/2026: metrônomo e afinador no menu da cifra; diagrama flutuante ao passar o mouse no acorde; blocos empilhados não se sobrepõem mais
- [x] 26/10/2026: v0.5 — acordes de piano (inversões, nomes nas teclas), editar acorde na cifra (tirar/colocar notas, nome reconhecido ou mais próximo com `*`, trocar aqui ou na música toda), página da cifra com trilho de ferramentas e painéis no estilo do Cifra Club, abas Cifra/Letra, diagramas no início/lateral/fim, canhoto, afinação de leitura, menu lateral recolhível
- [x] 22/10/2026: engenharia reversa da página de cifra do Cifra Club (estrutura e modelo de dados)
- [x] 22/10/2026: v0.4 com o botão Repertor.io (favoritos), que importa direto da página da cifra. Conferido na página real só por estrutura: 650 linhas, tabs inteiras, metadados certos
- [x] 22/10/2026: v0.3 com importação pelo link (servidor.py): puxa título, artista, gênero, tom, capo, afinação, vídeos e a cifra
- [x] 22/10/2026: v0.2 com visual System.DS (igual Memor.io/Letters) e importação assistida (buscar → copiar → colar → revisar)
- [x] 22/10/2026: v0.1 com biblioteca, cifra (tom, capo, rolagem, colunas, tabs), diagramas em 4 instrumentos, montador de acordes, vídeos YouTube e dados local-first
