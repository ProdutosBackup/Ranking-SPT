# Interface travada

**Data: 19/10/2026. Aprovada pelo usuário. Não alterar sem autorização explícita.**

Esta é a estrutura da tela de auditoria. Ela está registrada em `app/components/estrutura.ts` (constantes que os componentes importam) e protegida por `tests/interface.test.ts`. Cores, espaçamento e acabamento visual podem ser ajustados; nomes, ordem, abas, seções, blocos, parâmetros do endereço e atalhos, não.

## Barra superior fixa
Itens, nesta ordem: **Etapa** (seletor com os nomes por extenso) · **Auditar etapa** · **Enviar planilha** (botão secundário; abre o seletor de arquivo .xlsx) · **Baixar relatório** · **Exportar dados** · **Consolidado** (botão secundário, separado das abas; abre a visão do ranking acumulado) · **faixa de confiança** (data dos dados em horário de Brasília, identificador curto e o selo "Conta conferida por dois cálculos independentes"). O progresso da leitura aparece nesta barra.

**Planilha carregada** (autorizado em 21/10/2026): quando há planilha guardada no servidor, a barra mostra a marca "Planilha carregada: arquivo · enviada em data (Brasília)" com o botão **X** ("Remover planilha"), que pede confirmação ("Remover a planilha para todos? Sim / Não"). Quando a origem dos dados é a planilha, a faixa de confiança diz "Dados da planilha arquivo, enviada em data (Brasília)" e o aviso de dados trocados diz "A planilha foi trocada ou removida depois desta auditoria. Audite de novo." Acima das abas aparece o bloco **O que foi lido** (torneios, jogadores e resultados; origem dos inscritos do Dia Final; "Premiados inferidos pelos pontos da planilha"; avisos recolhidos), que pode ser fechado e reabre pela marca. Nas telas e nos arquivos Excel o prêmio de um resultado vindo de planilha aparece como "—".

## Consolidado (autorizado em 21/10/2026)
Visão que substitui o conteúdo abaixo da barra (as 7 abas e a ordem continuam iguais; o botão volta para a auditoria, e **Esc** também sai). Padrão: lista com busca. Tem o seletor **Etapa** (Etapa 1, 2 e 3; a Etapa 3 fica desabilitada com "Sem dados nesta etapa" quando não há planilha carregada nem ranking no site), a busca **Buscar jogador** e a tabela do ranking correto acumulado: **Posição**, **Jogador**, **Pontos acumulados** e uma coluna por etapa incluída. Soma dos pontos corretos (do motor, nunca os publicados) da Etapa 1 até a etapa escolhida. Resultados "aguardando regra" ficam fora da soma, com o aviso fixo "{n} resultados aguardando regra não entram na soma" (detalhe por etapa). Desempate pelo regulamento: mais primeiros lugares; quem continua empatado divide a posição. Endereço: `visao=consolidado&etapa=...`.

## Abas (botões segmentados, nesta ordem)
1. **Resumo**: visão geral em 10 segundos.
2. **Erros** (contador): os resultados com pontuação diferente da regra, com filtros por causa e por torneio e ordenação (maior diferença, jogador, torneio). Cada linha mostra "Site X → Correto Y" e a diferença.
3. **Divergências de inscritos** (contador): um cartão por torneio cujo número de inscritos na API difere do que reproduz os pontos do site. Não prova que o site esteja certo.
4. **Jogadores** (contador): busca sem diferenciar acentos e maiúsculas, filtro "Só com erro", total no site, total correto e diferença.
5. **Torneios** (contador): lista com o estado de cada torneio (sem problema, com erro, inscritos diferentes, sem resultados, aguardando regra). Cada torneio mostra **Buy-ins**, **Re-entries** e **Ações** (buy-ins + re-entries; autorizado em 21/10/2026): vêm do bloco lateral da planilha; o site não informa, e aí aparece "—" com "não informado pelo site". Uma marca discreta aparece quando Buy-ins difere de Inscritos. O Dia Final mostra **Com posição** e **Participação de flight** em campos separados.
6. **Aguardando regra** (contador): resultados que ainda não têm regra, agrupados por motivo, com a decisão que resolve. Vazia, mostra "Nenhum resultado aguardando regra." Motivos de flights e do Dia Final (autorizado em 21/10/2026): **Flights sem as ações** ("faltam as ações deste flight") e **Dia Final sem posição registrada** ("não se sabe em qual flight o jogador jogou, então o multiplicador não pode ser calculado; o site pagou 10"). As linhas aguardando continuam com a etiqueta explicativa **Participação de flight** ("Vale 10 × fatores com o campo em ações (buy-ins + re-entries). Sem as ações do flight, ou sem posição no Dia Final, aguarda regra."). Flight com as ações conhecidas é Correto ou Erro, sem tolerância.
7. **Regras**: a fórmula, o bloco **Participação nos flights** (a regra de 10 × fatores com o campo em ações, a fonte "decisão do responsável do ranking, confirmada em 21/10/2026" e a hipótese inferida), as tabelas do regulamento, as regras usadas nesta auditoria (inclui o **Campo do torneio**) e as opções avançadas, que ganharam **Campo do torneio**: "Inscritos (só buy-ins)" (padrão) ou "Ações (buy-ins + re-entries)" (autorizado em 21/10/2026; onde não há ações informadas usa os inscritos, e a tela lista esses torneios).

## Seções da aba Resumo (nesta ordem)
1. **Veredito**: uma frase com o estado da etapa.
2. **Indicadores**: cartões clicáveis (erros, pontos em discordância, jogadores afetados, divergências de inscritos, aguardando regra, percentual de corretos), cada um abre a aba correspondente.
3. **Composição**: barra horizontal com corretos, corretos com inscritos do site, erros, revisar e aguardando, com legenda.
4. **Principais causas**: cada causa (sempre como hipótese) com casos e pontos; abre a aba Erros já filtrada.
5. **Torneios com problema**: só os que têm erro ou divergência; abre o painel do torneio.

## Painel lateral (tela cheia no celular), blocos nesta ordem
1. **Resultado**: jogador, torneio, posição, prêmio, inscritos e buy-in.
2. **Conta correta**: três blocos lado a lado, **Base da posição** × **Fator de participantes** × **Fator de buy-in**, e o resultado **Pontos corretos** em destaque.
3. **Registrado no site**: o valor registrado e a diferença.
4. **Hipótese da causa**: a frase, a conta que reproduz o valor do site (quando há) e o cálculo inverso recolhido.

**Acordo** (autorizado em 21/10/2026; lugar, pergunta e textos refeitos com nova autorização do usuário na mesma data): o rodapé do painel tem só **Anterior**, **Próximo** e **Marcar como revisado**. O acordo é um cartão **Acordo** no corpo do painel, logo abaixo de "Conta correta" (antes de "Registrado no site"). Sem acordo, o cartão mostra a caixa **"Houve acordo neste torneio"**; marcar abre o campo numérico **"Pontuam como qual colocação?"** (rótulo visível, dica "De 2 a P (premiados do torneio)", validado ao sair do campo: inteiro, de 2 até os premiados) e o botão **Aplicar**. Com acordo salvo, o cartão mostra o resumo em uma linha ("Acordo: os K primeiros pontuam como Kº colocado") e o link **Remover acordo**, com a confirmação inline "Remover o acordo deste torneio para todos? **Remover** / **Cancelar**" (Cancelar com o foco; Esc cancela). Para jogadores fora das posições 1 a K, o cartão mostra só o aviso "Este torneio tem acordo: os K primeiros pontuam como Kº colocado", sem edição. O acordo vale para o torneio e para todos (salvo no servidor, sem login). No bloco "Conta correta" das posições 1 a K aparece "Acordo: pontua como Kº colocado" e a conta da base de K × fatores = valor. As linhas ganham a etiqueta **Acordo**, a aba Torneios mostra "Acordo: os K primeiros, como Kº colocado", o Relatório e a Exportação trazem a coluna ("Os K primeiros, como Kº colocado") e a conta, e a faixa de confiança acrescenta "Acordos aplicados: N torneio(s)" quando há acordo.

O painel também abre para um jogador (todos os resultados dele) e para um torneio (todas as linhas).

## Endereço da página
Parâmetros: `etapa`, `aba`, `causa`, `torneio`, `busca`, `ordem` e `ver` (o item aberto no painel). Existem ainda `soerro` (filtro "Só com erro") e `visao` (`visao=consolidado` abre o Consolidado; nele, `etapa` é a etapa até onde acumula). O antigo `sat` foi removido e, se vier num link antigo, é ignorado. Um link com `?aba=erros&causa=...` abre direto na aba filtrada.

## Atalhos de teclado (painel lateral)
← item anterior · → próximo item · Esc fecha o painel.
