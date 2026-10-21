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
6. **Aguardando regra** (contador): resultados que ainda não têm regra, agrupados por motivo, com a decisão que resolve. Vazia, mostra "Nenhum resultado aguardando regra." Flights e Dia Final sem posição **não** aguardam: são **Participação de flight** (autorizado em 21/10/2026), categoria própria com a explicação "10 pontos fixos, sem fatores nem tabela de posição. Vale também para quem aparece sem posição no Dia Final.", mostrada nas linhas, no painel e como causa quando o valor registrado não é 10.
7. **Regras**: a fórmula, o bloco **Participação nos flights** (a regra, a fonte "confirmado com o responsável do ranking em 21/10/2026" e a hipótese inferida), as tabelas do regulamento, as regras usadas nesta auditoria e as opções avançadas.

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

O painel também abre para um jogador (todos os resultados dele) e para um torneio (todas as linhas).

## Endereço da página
Parâmetros: `etapa`, `aba`, `causa`, `torneio`, `busca`, `ordem` e `ver` (o item aberto no painel). Existem ainda `soerro` (filtro "Só com erro") e `visao` (`visao=consolidado` abre o Consolidado; nele, `etapa` é a etapa até onde acumula). O antigo `sat` foi removido e, se vier num link antigo, é ignorado. Um link com `?aba=erros&causa=...` abre direto na aba filtrada.

## Atalhos de teclado (painel lateral)
← item anterior · → próximo item · Esc fecha o painel.
