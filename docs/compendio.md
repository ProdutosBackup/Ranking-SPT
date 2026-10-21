# Calculadora SPT: contexto do projeto

Documento de referência do projeto Calculadora Ranking (Suprema Poker Tour). Todo agente que trabalhar neste projeto usa este documento como fonte única de regras, dados e decisões. O que não está aqui não deve ser suposto: deve ser perguntado ao usuário.

Última atualização: 18/10/2026, 21h45 (inspeção da API, respostas do usuário, stack definida).

Legenda de confiabilidade usada neste documento:

- **[OFICIAL]**: está no regulamento oficial do ranking.
- **[CONFIRMADO]**: confirmado pelo usuário ou pelo responsável.
- **[OBSERVADO]**: visto diretamente na calculadora do site, no ranking publicado ou na API.
- **[INFERIDO]**: deduzido por cálculo a partir de dados observados. Não é fato até ser confirmado.
- **[PENDENTE]**: ainda sem resposta. Não pode ser usado como regra.

---

## 1. O problema

O ranking do Suprema Poker Tour soma a pontuação de cada jogador em cada torneio. Os valores do ranking ficam divergentes a partir de algum ponto, e não se sabe onde.

- O ranking teve 3 etapas até agora. **[CONFIRMADO]**
- A **etapa 1 está correta** e serve de base de referência ("tira-teima"). **[CONFIRMADO]**
- **Foco atual: corrigir a etapa 2.** O ranking da etapa 3 ainda não foi publicado e vai subir em alguns dias; a etapa 2 precisa estar corrigida antes disso. **[CONFIRMADO]**

| Etapa | Nome | Código (stage) | Ranking publicado? |
|---|---|---|---|
| 1 | Tauá Resort Atibaia 2026 | `taua-2026` | Sim (correto) |
| 2 | Vale Suíço Resort 2026 | `vale-suico-2026` | Sim (com erro) |
| 3 | Bendito Cacao Family Resort 2026 | `bendito-cacao-2026` | Não, sobe em alguns dias |

- Não se sabe quais jogadores estão errados nas etapas 2 e 3, nem o valor correto esperado. **[CONFIRMADO]**
- As regras não mudaram entre as etapas. **[CONFIRMADO]**
- São poucos dados, então a ferramenta pode recalcular tudo para encontrar o erro. **[CONFIRMADO]**

## 2. O que a ferramenta deve fazer

**Natureza da ferramenta [CONFIRMADO em 18/10/2026]:** primeiro ela é um **auditor**, criado para encontrar erros. Só depois será transformada em calculadora. Toda decisão de construção prioriza a auditoria.

Requisitos definidos pelo usuário **[CONFIRMADO]**:

1. **Duas formas de entrada [CONFIRMADO em 18/10/2026]**, em duas fases:
   - **Fase 1 (prioridade): leitura direta do site.** A ferramenta lê os rankings das etapas direto do site (API, seção 8) e audita, sem o usuário montar planilha.
   - **Fase 2 (só depois de a fase 1 estar funcionando): área de upload.** Uma área dentro do app para o usuário carregar um arquivo e auditá-lo ali. O usuário ainda precisa ver como o arquivo vem; por isso o formato do arquivo **[PENDENTE]** e esta fase não deve ser planejada em detalhe antes de a fase 1 funcionar.
2. **Cálculo normal:** a partir dos dados de entrada (buy-in, field, posição, nº de premiados), calcular a pontuação esperada e comparar com a pontuação registrada.
3. **Cálculo inverso:** destrinchar os dados registrados e devolver um documento em tabela, com destaque, mostrando onde o cálculo quebrou, para saber a partir de onde está errado.
4. Ser uma ferramenta simples, mas muito funcional.
5. [CONFIRMADO 21/10/2026] Satélites não pontuam. O esperado de uma linha de satélite é 0; registrado maior que 0 é Erro (causa: Satélite com pontos registrados, hipótese).
6. **Relatório de revisão para download (requisito central) [CONFIRMADO].** Um relatório em Excel que o usuário baixa para revisar a etapa (prioridade: etapa 2). Ele precisa:
   - detalhar **cálculo por cálculo**: cada resultado de cada jogador em cada torneio, com a conta feita passo a passo;
   - **mostrar onde está errado**, com destaque visual nas linhas divergentes;
   - ser um relatório de fato, pronto para leitura e revisão, e não apenas uma exportação de dados brutos.
7. **Exportação de dados para download [CONFIRMADO].** Além do relatório, a ferramenta deve ter uma opção separada de exportar os dados (os dados extraídos e calculados, sem a formatação de relatório). As duas opções coexistem: **Relatório** e **Exportação de dados**.

   Conteúdo mínimo **sugerido** por linha do relatório (item 6) (o layout final é definido com o usuário) **[PENDENTE]**: jogador; torneio; posição; premiação; buy-in; inscritos; pontos base; fator de participantes; fator buy-in; a conta escrita (ex.: 250 × 0,84 × 1,5); pontos esperados; pontos registrados no site; diferença; situação (correto / erro / provável arredondamento / suspeito); causa provável do erro. Sugestão adicional: um resumo no início (total de linhas, quantas corretas, quantas com erro, por torneio) e uma conferência da soma por jogador.

Comportamentos discutidos e aceitos durante o planejamento:

- **Conferência da soma:** o total de pontos de cada jogador deve ser igual à soma dos torneios dele. **[CONFIRMADO]**: o ranking é a soma simples de todos os torneios.
- **Regras em aberto como configuração:** para os pontos da seção 6 que ainda não estão definidos, a ferramenta calcula as variantes possíveis e mostra qual delas reproduz os valores registrados. A etapa 1, por ser correta, indica qual variante vale.
- **Inverso tem mais de uma solução:** o mesmo valor pode vir de combinações diferentes de posição, field e buy-in. A ferramenta deve listar as combinações possíveis e indicar qual bate com os dados reais do torneio.
- **Diferenças pequenas:** diferenças de até 1 ponto devem ser destacadas separadamente, como provável questão de arredondamento, e não como erro grave, até a regra de arredondamento ser definida.
- **Comparação com decimais [CONFIRMADO em 18/10/2026]:** a ferramenta compara com o valor da API (com decimais) e mostra ao lado o valor inteiro exibido no site (seção 6.1).

## 3. Regulamento oficial do ranking

Transcrição das partes do regulamento usadas no cálculo. **[OFICIAL]**

### 3.1 Fórmula

> Pontos = Pontos_Base_Posição × Fator_Participantes × Fator_Buy-in

A pontuação é calculada individualmente para cada torneio e somada aos pontos acumulados anteriormente.

### 3.2 Pontos base por posição

| Posição final | Pontos base |
|---|---|
| 1º | 1000 |
| 2º | 800 |
| 3º | 700 |
| 4º | 600 |
| 5º | 500 |
| 6º | 450 |
| 7º | 400 |
| 8º | 350 |
| 9º | 300 |
| 10º ao 12º | 250 |
| 13º ao 18º | 200 |
| Próximos 10% premiados | 100 |
| Demais participantes | 10 |

O torneio Main Event recebe fator de multiplicação 1.0, por ser o torneio especial da série.

### 3.3 Fator de participantes

> Fator_Participantes = (Número_de_Participantes / 100) + 0.5

Exemplos do regulamento: 50 participantes = 1.0; 100 participantes = 1.5; 200 participantes = 2.5.

### 3.4 Fator buy-in

| Buy-in | Fator |
|---|---|
| R$ 500 a R$ 1.000 | 1.0 |
| R$ 1.001 a R$ 1.999 | 1.2 |
| R$ 2.000 a R$ 2.999 | 1.5 |
| R$ 3.000 ou mais | 2.5 |

### 3.5 Outras regras do regulamento

- **Desempate**, nesta ordem: maior número de primeiros lugares; maior número de mesas finais; maior número de participações; maior soma de buy-ins investidos.
- **Elegibilidade:** todos os torneios da série oficial, de qualquer modalidade (Texas Hold'em, Omaha, Mixed Games) ou estrutura (Turbo, Regular).
- **Cancelamento:** torneios sem no mínimo 4 jogadores inscritos até o final do 2º nível de blinds são cancelados automaticamente.
- **Auditoria:** todos os cálculos são auditáveis; jogadores podem solicitar revisão.
- **Premiação do ranking geral:** 1º R$ 100.000,00 + Bracelete Dourado; 2º R$ 50.000,00; 3º R$ 30.000,00; 4º R$ 20.000,00.

## 4. Calculadora do site

O site tem uma calculadora com 4 campos: Buy-in (R$), Field (nº de inscritos), Posição final e Nº de premiados (ITM). Ela foi testada em 23 casos. **[OBSERVADO]**

### 4.1 Texto do site

> Apenas quem está no ITM (com premiação > 0) pontua pela tabela. Jogadores fora do ITM recebem 10 pontos fixos, mesmo que tenham bounties/KOs. Bounty ≠ ITM. Fórmula final: Pontos = Pontos_Base × Fator_Participantes × Fator_Buy-in × MultiplicadorMainEvent (1,0×). Fator de participantes = (n / 100) + 0,5.

> Só quem fica no ITM pontua pela tabela; fora do ITM são 10 pts fixos. Se não souber quantos foram premiados, a calculadora estima 20% do field e o resultado fica aproximado.

### 4.2 Resultados dos testes

| Teste | Buy-in | Field | Posição | ITM | Resultado | Conta exibida |
|---|---|---|---|---|---|---|
| Exemplo | 1.000 | 100 | 20 | 100 | 150 | 100 × 1,5 × 1,0 |
| T1 | 1.000 | 100 | 50 | 20 | 10 | fora do ITM: 10 pts fixos |
| T2 | 3.000 | 200 | 50 | 20 | 10 | fora do ITM: 10 pts fixos |
| T3 | 1.500 | 137 | 20 | 137 | 224,4 | 100 × 1,87 × 1,2 |
| T4 | 1.500 | 133 | 20 | 133 | 219,6 | 100 × 1,83 × 1,2 |
| T5 | 300 | 100 | 1 | 100 | 1.500 | 1.000 × 1,5 × 1,0 |
| T6 | 499 | 100 | 1 | 100 | 1.500 | 1.000 × 1,5 × 1,0 |
| T7 | 1.001 | 100 | 1 | 100 | 1.800 | 1.000 × 1,5 × 1,2 |
| T8 | 1.999 | 100 | 1 | 100 | 1.800 | 1.000 × 1,5 × 1,2 |
| T9 | 2.999 | 100 | 1 | 100 | 2.250 | 1.000 × 1,5 × 1,5 |
| T10 | 3.000 | 100 | 1 | 100 | 3.750 | 1.000 × 1,5 × 2,5 |
| T11 | 1.000 | 100 | 10 | 100 | 375 | 250 × 1,5 × 1,0 |
| T12 | 1.000 | 100 | 12 | 100 | 375 | 250 × 1,5 × 1,0 |
| T13 | 1.000 | 100 | 13 | 100 | 300 | 200 × 1,5 × 1,0 |
| T14 | 1.000 | 100 | 18 | 100 | 300 | 200 × 1,5 × 1,0 |
| T15 | 1.000 | 100 | 19 | 100 | 150 | 100 × 1,5 × 1,0 |
| T16 | 1.000 | 100 | 20 | vazio (estimado 20) | 150 | 100 × 1,5 × 1,0 |
| T17 | 1.000 | 100 | 21 | vazio (estimado 20) | 10 | fora do ITM: 10 pts fixos |
| T18 | 1.000 | 10 | 1 | 10 | 600 | 1.000 × 0,6 × 1,0 |
| T19 | 1.000 | 1.000 | 1 | 1.000 | 10.500 | 1.000 × 10,5 × 1,0 |
| T20 | 1.000 | 107 | 22 | vazio (estimado 22) | 157 | 100 × 1,57 × 1,0 |
| T21 | 1.000 | 109 | 22 | vazio (estimado 22) | 159 | 100 × 1,59 × 1,0 |
| T22 | 3.000 | 67 | 9 | 67 | 877,5 | 300 × 1,17 × 2,5 |
| T23 | 3.000 | 67 | 8 | 67 | 1.023,75 | 350 × 1,17 × 2,5 |

### 4.3 O que os testes mostram sobre a calculadora

- Fora do ITM, a calculadora dá **10 pontos fixos, sem nenhum multiplicador** (T1, T2, T17).
- A calculadora **não arredonda**: exibe o valor exato, com até 2 casas decimais (T3, T4, T22, T23).
- Buy-in abaixo de R$ 500 usa fator 1,0 (T5, T6). Atenção: existem torneios com buy-in abaixo de R$ 500 nas duas etapas (seção 6.8).
- As faixas de buy-in e a tabela de posições funcionam como no regulamento (T7 a T15).
- Com ITM em branco, a calculadora estima o nº de premiados como **20% do field arredondado para cima** (T16, T17, T20, T21).
- O fator de participantes não tem limite mínimo nem máximo (T18, T19).
- Todos os premiados depois do 18º recebem base 100 na calculadora (T15, T16, T20, T21).

### 4.4 Divergências entre a calculadora e o regulamento

| Ponto | Regulamento | Calculadora |
|---|---|---|
| Quem fica fora do ITM | "Demais participantes" têm **base 10**, que passa pela fórmula com os fatores | **10 pontos fixos**, sem fatores |
| Premiados depois do 18º | Base 100 só para os "próximos 10% premiados" | Base 100 para **todos** os premiados depois do 18º |

O ranking da etapa 1 (correta) segue o regulamento no primeiro ponto: quem fica fora do ITM recebe 10 × fatores (ver seção 7). **[OBSERVADO]** A calculadora do site está simplificada e não deve ser usada como referência para quem está fora do ITM.

Na etapa 2, a API mostra **10 pontos fixos** para jogadores sem prêmio em vários torneios (seção 6.7). **[OBSERVADO]** Isso reforça a hipótese de que a etapa 2 foi calculada com a regra da calculadora. **[INFERIDO]**

## 5. Decisões confirmadas

| Tema | Decisão | Fonte |
|---|---|---|
| Fórmula | Base × Fator_Participantes × Fator_Buy-in | [OFICIAL] |
| Main Event | Multiplicador sempre 1,0; não existe outro valor | [OFICIAL] e [CONFIRMADO] |
| Quem fica fora do ITM | Base 10, multiplicada pelos fatores | [OFICIAL], coerente com a etapa 1 [OBSERVADO] |
| Total do jogador | Soma simples de todos os torneios | [OFICIAL] e [CONFIRMADO] |
| Bounty / KO | Não entra na pontuação; vale só a posição final | [CONFIRMADO] |
| Critério de ITM | "Ambos": posição dentro do nº de premiados **e** premiação maior que zero | [CONFIRMADO] |
| Flights do Main Event | Regra informada: **flight não conta ponto**; só o dia final pontua. O usuário acredita que flights não pontuam, mas pediu verificação, porque a etapa 1 mostra pontos em flights (seção 6.4) | [CONFIRMADO], em verificação |
| Field | O site conta **só buy-ins**, não ações [CONFIRMADO em 18/10]. Qual campo da API corresponde a isso está em aberto (seção 6.2) | [CONFIRMADO] |
| Referência de verdade | Etapa 1 é o tira-teima. Em qualquer dúvida de regra, vale a variante que reproduz a etapa 1 | [CONFIRMADO em 18/10] |
| Arredondamento na tela | O site exibe pontos como número inteiro; a API guarda com decimais | [CONFIRMADO em 18/10] e [OBSERVADO] |
| Stack | Next.js com TypeScript (página e rotas de servidor); ExcelJS para o Excel | [CONFIRMADO em 18/10] |
| Acesso à API | Por rota de servidor (a API não envia CORS) | [OBSERVADO] |
| Mudança de regra entre etapas | Não houve | [CONFIRMADO] |

Observação sobre o critério de ITM: quando os dois critérios divergirem em um jogador (por exemplo, posição dentro do ITM mas premiação zero), a ferramenta deve marcar a linha como suspeita.

## 6. Pontos em aberto

Estes pontos não podem ser tratados como regra. A ferramenta deve testar as variantes e mostrar qual reproduz os valores da etapa 1.

### 6.1 Arredondamento dos pontos

- O regulamento não diz nada sobre arredondamento.
- **A API guarda os pontos com decimais** **[OBSERVADO]**: 877,5; 29,25; 38,4; 11,4; 12,1. Os totais também têm decimais (Carlos Vulpini 1.757,25; Vinicius Biesek 3.565,5; Anderson Costa 1.101,9).
- **O site exibe número inteiro** **[CONFIRMADO em 18/10]**.
- A regra de arredondamento usada na tela continua **[PENDENTE]**: o responsável disse "arredonda pra cima", mas o Compêndio registrou 877,5 exibido como 877 (para baixo). Não se sabe se o site arredonda cada torneio ou só o total.
- Decisão para a ferramenta: comparar com o valor da API (com decimais) e mostrar o inteiro ao lado, sem tratar a diferença de arredondamento como erro.

### 6.2 O que conta como "número de participantes" (field) [PENDENTE]

- O regulamento diz "Número_de_Participantes", sem tratar re-entries. O usuário confirmou que o site conta **só buy-ins, não ações**. **[CONFIRMADO]**
- Campo `players` da API comparado com o field deduzido dos pontos:

| Etapa | Torneio | `players` na API | Field deduzido dos pontos | Bate? |
|---|---|---|---|---|
| 1 | 200K Omaha 5 K.O (buy-in 3.000) | 26 | 26 (1900÷1000 = 1,90 ÷ 2,5 = 0,76) | Sim |
| 1 | 100K OMAHA Mystery Bounty (buy-in 2.500) | 25 | 26 (513÷450 = 1,14 ÷ 1,5 = 0,76) | Não, diferença de 1 |
| 1 | 200k High Roller (buy-in 3.000) | 85 | 67 (2340÷800 = 2,925 ÷ 2,5 = 1,17) | Não |
| 1 | Final Main Event (buy-in 1.000) | 135 | 334 (fator 3,84) | Não |
| 1 | Second Chance 20K (buy-in 250) | 95 | 100 (375÷250 = 1,50, com fator buy-in 1,0) | Não |
| 2 | EV #2 200K PLO 5 K.O (buy-in 2.000) | 34 | 34 (seção 7.4) | Sim |
| 2 | EV #8 SUPER HIGH ROLLER 200K (buy-in 3.000) | 82 | 82 (2640÷800 = 3,3 ÷ 2,5 = 1,32) | Sim |

Os campos deduzidos são **[INFERIDO]**. O responsável havia informado 46 buy-ins (80 ações) para o 200k High Roller da etapa 1; nenhum desses números reproduz os pontos.

- Main Event: ver seção 7.6 (field do dia final = soma dos flights). **[INFERIDO]**
- A ferramenta deve testar `players` como field e, quando não reproduzir a etapa 1, mostrar o field deduzido pelo cálculo inverso.

### 6.3 "Próximos 10% premiados" [PENDENTE]

O regulamento dá base 100 aos "próximos 10% premiados" e base 10 aos "demais participantes". Não está definido:

- se os 10% são calculados sobre o nº de premiados ou sobre o field;
- o que acontece com premiados que ficam depois desses 10% (base 100 ou base 10);
- como pontuam as posições 1 a 18 quando há menos premiados do que isso.

A calculadora do site dá base 100 a todos os premiados depois do 18º. No Dia Final da etapa 2, as posições 19 a 63 têm todas 381 pontos (100 × 3,81), coerente com a calculadora. **[OBSERVADO / INFERIDO]**

### 6.4 Flights do Main Event [PENDENTE: verificar]

- Regra informada: **flight não conta ponto**. O usuário acredita que não pontuam, mas pediu verificação varrendo o site. **[CONFIRMADO em 18/10]**
- Etapa 1: os flights (Dia 1A, 1C, 1D, 1E) aparecem nos resultados de **todos** os participantes, com prize 0. Exemplo: Anderson De Carvalho Costa, Dia 1D, posição 1, **12,1 pontos**. **[OBSERVADO]** Pela regra, deveria ser 0.
- 12,1 pontos equivalem a base 10 × fator 1,21; com buy-in 1.000, o field seria 71, mas a API traz 55 jogadores no Dia 1D. **[INFERIDO]**
- Etapa 1 não tem Dia 1B na API (só 1A, 1C, 1D, 1E). **[OBSERVADO]**
- Etapa 2: a API **não traz nenhum resultado** dos flights (Dia 1A a 1E). **[OBSERVADO]**
- O usuário pode fornecer a página do site com a grade completa dos torneios, para conferência. **[CONFIRMADO]**

### 6.5 Nº de premiados (ITM)

- A API não tem campo de nº de premiados. **[OBSERVADO]**
- Etapa 1: todos os participantes aparecem nos resultados (linhas = `players` em todos os 11 torneios), então o ITM sai de `prize > 0`. **[OBSERVADO]**
- Etapa 2: só aparece quem pontuou, então não dá para contar participantes pelos resultados; o ITM sai de `prize > 0`. **[OBSERVADO]**
- A estimativa de 20% do field da calculadora não é necessária enquanto `prize` estiver disponível. Se foi usada no ranking real continua **[PENDENTE]**.

### 6.6 Satélites [CONFIRMADO 21/10/2026]

- A etapa 2 tem satélites com buy-in de R$ 300 ("Satélite PLO 200K", 15 inscritos; "SATELITE CHAMPIONSHIP", 15 inscritos). A etapa 1 não tem. **[OBSERVADO]**
- Na API, os satélites da etapa 2 **não têm nenhum resultado**, ou seja, hoje não pontuam no site. O mesmo acontece com "EV #7 LADIES ESPECIAL" (R$ 300, 29 inscritos) e "EV #4 HORSE" (R$ 500, 12 inscritos). **[OBSERVADO]**
- O regulamento não define fator buy-in abaixo de R$ 500.
- Satélites não contam para o ranking: regra confirmada pelo usuário em 21/10/2026 (linha abaixo).
- [CONFIRMADO 21/10/2026] Satélites não pontuam. O esperado de uma linha de satélite é 0; registrado maior que 0 é Erro (causa: Satélite com pontos registrados, hipótese).
- **[PENDENTE]** Por que Ladies e HORSE não têm resultado na API.

### 6.7 Pontos fixos de 10 na etapa 2 [OBSERVADO]

Na etapa 2, a API mostra 10 pontos sem multiplicador nestes casos:

| Torneio | Jogadores | position | prize | points |
|---|---|---|---|---|
| Main Event SPT — Dia Final | 126 jogadores (ex.: Auro Damazio De Assis) | null | null | 10 |
| Main Event SPT — Dia Final | Edson Santos Ribeiro | 64 | null | 10 |
| EV #8 SUPER HIGH ROLLER 200K | Ramon Victor fernandes ambrozio, Diones da Silva lopes, LEONARDO DURANTE DOMINGUES | 14, 15, 16 | null | 10 |
| EV #11 HIGH ROLLER 50K | Renan Esteves | 8 | null | 10 |

Pela regra da seção 5 (base 10 × fatores), esses jogadores deveriam ter 10 × fator do torneio (ex.: 33 no EV #8, com fator total 3,3). São candidatos fortes a erro. **[INFERIDO]**

**[PENDENTE: responder em 19/10]** Os 126 jogadores sem posição do Dia Final entram na conferência como "fora do ITM" (base 10 × fatores), ou ficam de fora?

### 6.8 Buy-in abaixo de R$ 500 [OBSERVADO]

O Compêndio registrava que não havia buy-in abaixo de R$ 500 na etapa 1. A API mostra **"Second Chance 20K" com buy-in 250** na etapa 1 (correta), e "EV #10 SECOND CHANCE 20K" com buy-in 250 na etapa 2. Os pontos da etapa 1 (12º = 375) são compatíveis com fator buy-in 1,0. **[INFERIDO]** Qual fator vale abaixo de R$ 500: **[PENDENTE]** (a calculadora do site usa 1,0).

## 7. Dados de referência da etapa 1

Cinco jogadores da etapa 1 (correta). Valores conferidos na API em 18/10 (pontos com decimais). **[OBSERVADO]**

### 7.1 Jogadores

**Arnaldo Fernandes**: 5.137 pontos, 4 torneios, 1 primeiro lugar.

| Colocação | Torneio | Premiação (R$) | Pontos (API) |
|---|---|---|---|
| 2º | 200k High Roller | 51.650 | 2.340 |
| 1º | 200K Omaha 5 K.O | 33.000 | 1.900 |
| 6º | 100K OMAHA Mystery Bounty | 3.200 | 513 |
| 24º | Final Main Event (Main Event) | 2.600 | 384 |

**Carlos Eduardo Vulpini**: 1.757,25 pontos, 2 torneios.

| Colocação | Torneio | Premiação (R$) | Pontos (API) |
|---|---|---|---|
| 6º | Final Main Event (Main Event) | 18.000 | 1.728 |
| 22º | 200k High Roller | 0 | 29,25 |

**Vinicius Biesek**: 3.565,5 pontos, 2 torneios.

| Colocação | Torneio | Premiação (R$) | Pontos (API) |
|---|---|---|---|
| 3º | Final Main Event (Main Event) | 38.000 | 2.688 |
| 9º | 200k High Roller | 8.000 | 877,5 |

**Felipe De Aguirre Faria**: 1.344 pontos, 1 torneio.

| Colocação | Torneio | Premiação (R$) | Pontos (API) |
|---|---|---|---|
| 8º | Final Main Event (Main Event) | 9.300 | 1.344 |

**Anderson De Carvalho Costa**: 1.101,9 pontos, 5 torneios, 1 primeiro lugar.

| Colocação | Torneio | Premiação (R$) | Pontos (API) |
|---|---|---|---|
| 8º | 200K Omaha 5 K.O | 5.000 | 665 |
| 12º | Second Chance 20K | 700 | 375 |
| 76º | Final Main Event (Main Event) | 0 | 38,4 |
| 1º | Main Event 400k Dia 1D (flight) | 0 | 12,1 |
| 12º | 100K OMAHA Mystery Bounty | 0 | 11,4 |

Nos cinco jogadores, o total é igual à soma dos torneios. **[OBSERVADO]**

### 7.2 Fator total deduzido por torneio

Fator total = pontos ÷ pontos base da posição. **[INFERIDO]**

| Torneio | Buy-in (API) | Cálculo | Fator total |
|---|---|---|---|
| Final Main Event | 1.000 | 1728÷450, 1344÷350, 2688÷700, 384÷100, 38,4÷10 | 3,84 |
| 200k High Roller | 3.000 | 2340÷800, 877,5÷300, 29,25÷10 | 2,925 |
| 200K Omaha 5 K.O | 3.000 | 1900÷1000, 665÷350 | 1,90 |
| 100K OMAHA Mystery Bounty | 2.500 | 513÷450, 11,4÷10 | 1,14 |
| Second Chance 20K | 250 | 375÷250 | 1,50 |
| Main Event 400k Dia 1D | 1.000 | 12,1÷10 | 1,21 |

### 7.3 Jogadores sem premiação na etapa 1

| Jogador | Torneio | Pontos (API) | Pela calculadora (10 fixos) | Base 10 × fator total |
|---|---|---|---|---|
| Carlos Vulpini | 200k High Roller | 29,25 | 10 | 29,25 |
| Anderson Costa | Final Main Event | 38,4 | 10 | 38,4 |
| Anderson Costa | 100K OMAHA Mystery Bounty | 11,4 | 10 | 11,4 |
| Anderson Costa | Main Event 400k Dia 1D | 12,1 | 10 | 12,1 |

Os valores da etapa 1 batem exatamente com base 10 × fator total, e não com 10 fixos. **[OBSERVADO]**

### 7.4 Caso verificado na etapa 2

Rafael Bryan, 10º no "EV #2 200K PLO 5 K.O" (buy-in R$ 2.000, 34 inscritos), premiação R$ 3.500:

250 × (34/100 + 0,5) × 1,5 = 250 × 0,84 × 1,5 = **315**. O ranking mostra **315**. **[OBSERVADO]**

O erro da etapa 2 não está em todos os torneios; a ferramenta precisa conferir linha a linha.

### 7.5 Torneios das etapas (API, 18/10/2026) [OBSERVADO]

**Etapa 1 (`taua-2026`)**: 11 torneios, todos `role = STANDALONE`, `flightLabel = null`, `rebuy = null`, `addon = null`, `bountyType = NONE`, `status = FINISHED`. Linhas de resultado = `players` em todos.

| Torneio | buyIn | players | prize > 0 |
|---|---|---|---|
| Main Event 400K Dia 1A | 1000 | 83 | 0 |
| 200K Omaha 5 K.O | 3000 | 26 | 9 |
| 50K Cucurucho | 1500 | 28 | 6 |
| Main Event 400K Dia 1C | 1000 | 47 | 0 |
| 100K OMAHA Mystery Bounty | 2500 | 25 | 6 |
| Main Event 400k Dia 1D | 1000 | 55 | 0 |
| 200k High Roller | 3000 | 85 | 15 |
| Main Event 400K Dia 1E | 1000 | 17 | 0 |
| Final Main Event | 1000 | 135 | 71 |
| Second Chance 20K | 250 | 95 | 23 |
| High Roller 50K | 2000 | 46 | 9 |

**Etapa 2 (`vale-suico-2026`)**: 19 torneios. `addon` sempre null. Só aparecem nos resultados os jogadores que pontuaram.

| Torneio | buyIn | players | rebuy | bountyType | role | flightLabel | Linhas | Com position | prize > 0 |
|---|---|---|---|---|---|---|---|---|---|
| ME SPT - Dia 1A | 1000 | 96 | 1000 | NONE | FLIGHT | 1A | 0 | 0 | 0 |
| Satélite PLO 200K | 300 | 15 | 300 | NONE | STANDALONE | – | 0 | 0 | 0 |
| EV #2 200K PLO 5 K.O | 2000 | 34 | 2000 | KO (1000) | STANDALONE | – | 12 | 12 | 12 |
| EV #3 30K SUPER K.O | 500 | 44 | 500 | KO | STANDALONE | – | 9 | 9 | 9 |
| ME SPT - Dia 1B | 1000 | 50 | 1000 | NONE | FLIGHT | 1B | 0 | 0 | 0 |
| ME SPT - Dia 1C | 1000 | 64 | 1000 | NONE | FLIGHT | 1C | 0 | 0 | 0 |
| SATELITE CHAMPIONSHIP | 300 | 15 | 300 | NONE | STANDALONE | – | 0 | 0 | 0 |
| EV #5 100K OMAHA MYSTERY BOUNTY | 1500 | 12 | 1500 | MYSTERY | STANDALONE | – | 6 | 6 | 6 |
| EV #6 8-GAME | 1200 | 7 | 1200 | NONE | STANDALONE | – | 3 | 3 | 3 |
| EV #7 LADIES ESPECIAL | 300 | 29 | 300 | NONE | STANDALONE | – | 0 | 0 | 0 |
| EV #8 CHAMPIONSHIP SUPER HIGH ROLLER 200K | 3000 | 82 | 3000 | NONE | STANDALONE | – | 16 | 16 | 13 |
| ME SPT - Dia 1D - TURBO | 1000 | 67 | 1000 | NONE | FLIGHT | 1D | 0 | 0 | 0 |
| EV #9 DOUBLE BOARD TURBO PIJAMA | 500 | 16 | 500 | NONE | STANDALONE | – | 3 | 3 | 3 |
| ME SPT - Dia 1E - Turbo | 1000 | 54 | 1000 | NONE | FLIGHT | 1E | 0 | 0 | 0 |
| Main Event SPT — Dia Final | 0 | 92 | null | NONE | FINAL | – | 190 | 64 | 63 |
| EV #10 SECOND CHANCE 20K | 250 | 94 | 250 | NONE | STANDALONE | – | 23 | 23 | 23 |
| EV #11 HIGH ROLLER 50K | 2000 | 35 | 2000 | NONE | STANDALONE | – | 8 | 8 | 7 |
| EV #4 HORSE | 500 | 12 | 500 | NONE | STANDALONE | – | 0 | 0 | 0 |
| Main Event SPT | 0 | 0 | null | NONE | PARENT (CANCELED) | – | 0 | 0 | 0 |

Nenhum jogador tem mais de uma linha no mesmo torneio. Nenhuma linha tem `tournamentId` fora da lista de torneios. **[OBSERVADO]**

### 7.6 Main Event da etapa 2: achados [INFERIDO]

- **Buy-in do Dia Final:** a API traz `buyIn = 0`. Interpretação registrada em 18/10: usar R$ 1.000, o mesmo valor dos flights e do Final Main Event da etapa 1 (fator 1,0, também por ser Main Event). **[INFERIDO, confirmar]**
- **Field do Dia Final:** Rafael Bryan, 7º, 1.524 pontos. 1524 ÷ 400 = 3,81 → field 331. A soma dos `players` dos cinco flights é 96 + 50 + 64 + 67 + 54 = **331**. Indica que o field do Dia Final é a soma dos flights, e não os 92 do campo `players`. **[INFERIDO]**
- Na etapa 1, o field deduzido do Final Main Event é 334; a soma dos flights da API (1A, 1C, 1D, 1E) é 202, e não há Dia 1B. Diferença de 132. **[INFERIDO]**: pode corresponder ao Dia 1B ausente; não verificado.
- **Posições 1 a 4 do Dia Final com 2.286 pontos cada:** 2286 ÷ 3,81 = 600, que é a base do 4º lugar. Pelo regulamento, 1º = 3.810, 2º = 3.048, 3º = 2.667, 4º = 2.286. Candidato forte a erro (ou acordo entre jogadores não registrado). **[INFERIDO]**
- Posições 19 a 63 com 381 pontos cada (base 100 × 3,81). **[OBSERVADO]**
- Posição 64 e 126 jogadores sem posição com 10 pontos fixos (seção 6.7). **[OBSERVADO]**
- 190 linhas de resultado contra 92 em `players` e 331 na soma dos flights. **[OBSERVADO]**

## 8. Fonte dos dados: API do site

O site supremapokertour.com tem uma API pública (sem login) que devolve os dados em JSON. **[OBSERVADO]**

| O que traz | Endereço | Resposta |
|---|---|---|
| Ranking da etapa | `https://supremapokertour.com/api/spt/ranking?stage={stage}` | `{updatedAt, ranking: [{rank, name, avatarUrl, points, tournaments, breakdown: [{tournamentId, tournamentName, position, points, factor}]}]}` |
| Torneios de um jogador | `https://supremapokertour.com/api/spt/player-summary?stage={stage}&name={nome}` | `{name, avatarUrl, totalPoints, tournaments, results: [{tournamentId, tournamentName, position, points, prize, stage}]}` |
| Torneios da etapa | `https://supremapokertour.com/api/spt/tournaments?stage={stage}` | `{updatedAt, tournaments: [{id, name, buyIn, players, rebuy, addon, bountyType, bountyAmount, role, flightLabel, stage, status, guaranteedPrize, scheduledAt, startedAt, finishedAt, currentLevel, lateRegistrationLevel, isPaused, featured}]}` |

Comportamento confirmado na inspeção de 18/10/2026 **[OBSERVADO]**:

- **`stage` funciona.** Etapa 1 = 11 torneios; etapa 2 = 19 torneios. Sem `stage`, a API devolve a etapa corrente (hoje, a etapa 2). Stage inexistente devolve lista vazia com HTTP 200.
- **Jogadores no ranking:** etapa 1 = 278; etapa 2 = 208.
- **`ranking.points` = `player-summary.totalPoints`** para todos os 486 jogadores.
- **`breakdown.factor` é sempre 1** (642 ocorrências na etapa 1, 270 na etapa 2). Não serve para o cálculo.
- O ranking não traz prize, field nem buy-in; o `player-summary` traz `prize`.
- **Chave de ligação:** `tournaments.id` = `results.tournamentId`.
- **Parâmetro `name`:** usar `encodeURIComponent`. O nome precisa ser **idêntico** ao do ranking (maiúsculas e acentos). Nome errado devolve HTTP 200 com `totalPoints: 0` e `results: []`, sem erro. **A extração precisa conferir que todo jogador do ranking voltou com resultados e que a soma bate com `ranking.points`.**
- **CORS:** a API não envia cabeçalhos `Access-Control-*`. O navegador não consegue chamá-la a partir de outro domínio. **A leitura precisa passar por rota de servidor do Next.js.**
- **`updatedAt`** muda entre consultas (dados recalculados continuamente). A ferramenta deve registrar o `updatedAt` usado em cada auditoria.
- **Flights:** na etapa 1 só são identificados pelo nome ("Dia 1A/1C/1D/1E"); na etapa 2, por `role = FLIGHT` e `flightLabel`. Dia final da etapa 2: `role = FINAL`. Agregador: `role = PARENT` (CANCELED, sem resultados).
- **Diferença de estrutura entre etapas:** na etapa 1 aparecem todos os participantes; na etapa 2 só os que pontuaram.
- `avatarUrl`: null na etapa 1; URL de api.stackplus.com.br na etapa 2. Sem uso no cálculo.
- O WebFetch do Claude é bloqueado pelo robots.txt do site; consultas exploratórias rodam na máquina do usuário (Claude Code).

## 9. Pendências gerais

- **Formato da ferramenta [CONFIRMADO]:** página no navegador, publicável no **Vercel**, que **gera relatórios em Excel** (.xlsx) para download.
- **Stack [CONFIRMADO em 18/10/2026]:** Next.js com TypeScript; ExcelJS.
- **CORS [OBSERVADO]:** resolvido com rota de servidor.
- **Entrada da ferramenta [CONFIRMADO em 18/10/2026]:** fase 1 = leitura direta do site pela API; fase 2 = upload de arquivo, depois que a fase 1 funcionar. Formato do arquivo: **[PENDENTE]**.
- **Prazo [CONFIRMADO em 18/10/2026]:** fase 1 até 18/10/2026, para verificar a etapa 2.
- **[PENDENTE, responder em 19/10]** Os 126 jogadores sem posição do Dia Final da etapa 2 entram na conferência? (seção 6.7)
- **[PENDENTE]** Buy-in do Dia Final da etapa 2 (seção 7.6).
- **[PENDENTE]** Field: `players` ou soma dos flights / deduzido (seções 6.2 e 7.6).
- **[PENDENTE]** Flights pontuam? Verificar (seção 6.4). Usuário pode fornecer a grade de torneios do site.
- **[PENDENTE]** Fator buy-in abaixo de R$ 500 (seção 6.8).
- **[CONFIRMADO 21/10/2026]** Satélites não pontuam (seção 6.6).
- **[PENDENTE]** Regra de arredondamento exibida no site (seção 6.1).
- Pontos 6.3 e 6.5. **[PENDENTE]**

## 10. Glossário

- **Buy-in:** valor de entrada do torneio, em R$.
- **Field:** número de inscritos no torneio. O site conta só buy-ins, não ações; o campo da API correspondente está pendente (seção 6.2).
- **ITM (In The Money):** jogadores premiados no torneio.
- **Flight:** dia classificatório de um torneio com vários dias (ex.: "Main Event 400k Dia 1D").
- **Re-entry:** nova entrada do mesmo jogador no mesmo torneio.
- **Bounty / KO:** prêmio por eliminar outro jogador. Não entra na pontuação do ranking.
- **Main Event:** torneio principal da série, marcado com estrela no ranking. Multiplicador 1,0.
- **Etapa:** cada fase do ranking. A etapa 1 é a referência correta (tira-teima).
- **Auditor:** função principal da ferramenta nesta fase: encontrar erros no ranking publicado.
- **Cálculo normal:** dos dados do torneio para os pontos esperados.
- **Cálculo inverso:** dos pontos registrados para os fatores, a posição e o field que os gerariam.
