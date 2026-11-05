# Regras de pontuação para validação

**Documento para o responsável do ranking validar.** Reúne tudo o que a ferramenta de auditoria aplica hoje para calcular os pontos, diz de onde cada regra vem e lista as perguntas que precisam de resposta.

- **Data:** 22/10/2026. **Versão das regras da ferramenta:** 1.4.
- **Fontes:** o Compêndio do projeto (`docs/compendio.md`), o funcionamento da ferramenta e os dados reais das Etapas 1 e 2 (lidos do site) e da Etapa 3 (planilha enviada).
- **Como ler as marcações de confiança** (as mesmas do Compêndio):

| Marca | Significa |
|---|---|
| **[OFICIAL]** | Está no regulamento oficial do ranking. |
| **[CONFIRMADO]** | O usuário ou o responsável confirmou (com a data, quando há). |
| **[OBSERVADO]** | Visto nos dados do site; é um fato, não uma regra. |
| **[INFERIDO]** | Deduzido pelos números. É hipótese, **não é regra**. |
| **[PENDENTE]** | Ainda sem resposta. |

> Regra de ouro adotada: o que é [INFERIDO] ou [PENDENTE] não é tratado como regra confirmada. Quando a ferramenta precisa de um valor mesmo assim, isso está dito de forma explícita e vira pergunta na seção 2.

### Decisões recentes que a ferramenta já aplica (todas de 21/10/2026, salvo indicação)

| Decisão | Origem |
|---|---|
| **Satélites não pontuam** (esperado 0; pontos registrados são erro) | Usuário, 21/10/2026 (Compêndio 6.6) |
| **Flights** valem 10 × fator de participantes × fator de buy-in, com o campo = ações do flight. Substitui "flight não conta ponto" e "10 pontos fixos" | Usuário, vinda do responsável do ranking, 21/10/2026 (Compêndio 6.4) |
| **Flights da Etapa 1 aguardam** as ações (o site não informa) | Consequência da decisão acima |
| **Dia Final sem posição fica em "Aguardando regra"** (substitui "10 pontos fixos") | Usuário, 21/10/2026 (Compêndio 6.7) |
| **Acordo:** os K primeiros pontuam como o Kº colocado (substitui a divisão igual dos pontos) | Usuário, 21/10/2026 (Compêndio 6.9) |
| **Campo do torneio = ações** (o site contou só buy-ins na Etapa 2, que é um erro do site) | Usuário, vinda do superior, 21/10/2026 (Compêndio 6.2). A ferramenta ainda usa os inscritos como padrão |
| **Fora da premiação = 10 × fatores** (a Etapa 1 confirma) | Regulamento, **[OFICIAL]**, e Etapa 1 **[OBSERVADO]**; mantido como padrão |

---

## 1. A resposta à pergunta do Main Event

**Pergunta:** "A regra do Main Event usa o fator de buy-in da faixa de até R$ 1.000 (fator 1,0)?"

### Resposta: **SIM**, em todos os tipos de linha do Main Event.

Todos os torneios do Main Event (flights e Dia Final) têm buy-in de **R$ 1.000** na fonte, ou **zero** no caso do Dia Final das Etapas 2 e 3, que a ferramenta troca por R$ 1.000. As duas situações caem na faixa "R$ 500 a R$ 1.000", cujo fator é **1,0**. **Não há nenhum caso em que o fator do Main Event seja diferente de 1,0.** Além disso, o multiplicador do Main Event é sempre **1,0**: não existe outro valor possível.

**Trechos do Compêndio:**

- Faixas de buy-in (seção 3.4, **[OFICIAL]**): "R$ 500 a R$ 1.000 → 1.0; R$ 1.001 a R$ 1.999 → 1.2; R$ 2.000 a R$ 2.999 → 1.5; R$ 3.000 ou mais → 2.5".
- Multiplicador (seção 3.2, **[OFICIAL]**): "O torneio Main Event recebe fator de multiplicação 1.0, por ser o torneio especial da série." Na seção 5: "Multiplicador sempre 1,0; não existe outro valor — [OFICIAL] e [CONFIRMADO]".
- Buy-in do Dia Final (seção 7.6, registrada em 18/10): "a API traz `buyIn = 0`. Interpretação registrada em 18/10: usar R$ 1.000, o mesmo valor dos flights e do Final Main Event da etapa 1 (fator 1,0, também por ser Main Event). **[INFERIDO, confirmar]**". Na seção 9 esse ponto aparece como **[PENDENTE]**.

**Atenção a um detalhe:** a troca de R$ 0 por R$ 1.000 no Dia Final é uma **hipótese do Compêndio**, não uma regra confirmada. Ela **não muda o fator**: qualquer buy-in até R$ 1.000 (e até o valor abaixo de R$ 500, hoje tratado como 1,0) dá fator 1,0. O que ela muda é que, sem a troca, a ferramenta não conseguiria calcular essas linhas (buy-in zero é tratado como "buy-in não informado"). Só mudaria o resultado se o buy-in verdadeiro do Dia Final fosse **maior que R$ 1.000** (ver pergunta 8).

### Tabela: cada tipo de linha do Main Event

| Tipo de linha | Buy-in recebido da fonte | Buy-in usado no cálculo | Fator de buy-in | Multiplicador | Campo (número de participantes) e de onde vem | Onde o código decide | Exemplo real |
|---|---|---|---|---|---|---|---|
| **Flight da Etapa 1** (Dia 1A, 1C, 1D, 1E) | R$ 1.000 (site) | R$ 1.000 | **1,0** | 1,0 | O campo certo é **ações** (buy-ins + re-entries) do flight. O site **não informa** as ações; só informa inscritos (83, 47, 55, 17). Sem as ações, o resultado fica **aguardando regra** | `calculo.ts` linhas 28–34 (faixas); `auditoria.ts` linhas 33 (identifica flight), 87–93 (exige as ações) | Anderson Costa, Dia 1D, 1º, site pagou **12,1**. Se as ações fossem 71: 10 × (71 ÷ 100 + 0,5) × 1,0 = 10 × 1,21 × 1,0 = **12,1** (71 é um valor deduzido dos pontos, [INFERIDO]). Hoje o resultado aguarda |
| **Flight da Etapa 2** | R$ 1.000 (site) | R$ 1.000 | **1,0** | 1,0 | O site **não traz nenhuma linha de resultado** dos flights. Os inscritos (96 + 50 + 64 + 67 + 54 = **331**) servem só para formar o campo do Dia Final | `auditoria.ts` linhas 44, 52–54 | Não há jogador com resultado de flight na Etapa 2 |
| **Flight da Etapa 3** | R$ 1.000 (site) | R$ 1.000 | **1,0** | 1,0 | Também **sem linhas de resultado**. Inscritos 77 + 64 + 55 + 67 + 65 = **328**, usados no campo do Dia Final | `planilha-guardada.ts` linhas 45 e 73–76 | Não há jogador com resultado de flight na Etapa 3 |
| **Dia Final da Etapa 1** ("Final Main Event"; o site não o marca como Dia Final) | R$ 1.000 (site) | R$ 1.000 | **1,0** | 1,0 | O site informa **135** inscritos, e a ferramenta usa 135. Os pontos só fecham com **334** inscritos (**[INFERIDO]**), e a ferramenta mostra isso como "divergência de inscritos", sem tratar como erro | `calculo.ts` 28–34; `auditoria.ts` 50–59, 138–142 | Arnaldo Fernandes, 24º, site pagou **384**: 100 × (334 ÷ 100 + 0,5) × 1,0 = 100 × 3,84 × 1,0 = **384** (base 100: premiado depois do 18º) |
| **Dia Final da Etapa 2** | **R$ 0** (site) | **R$ 1.000** (troca da ferramenta, [INFERIDO] 18/10) | **1,0** | 1,0 | **Soma dos flights = 331** ([INFERIDO]), e não os 92 inscritos do Dia Final | `regras.ts` linha 27 (R$ 1.000); `auditoria.ts` linhas 53–54 (campo) e 60 (troca do buy-in) | Rafael Bryan, 7º, site pagou **1.524**: 400 × (331 ÷ 100 + 0,5) × 1,0 = 400 × 3,81 × 1,0 = **1.524**. Confere |
| **Dia Final da Etapa 3** (planilha) | **R$ 0** (planilha) | **R$ 1.000** (troca da ferramenta) | **1,0** | 1,0 | **Soma dos flights = 328**, lida do site. A planilha informa 79 inscritos e não traz os flights. Sem os flights do site, a ferramenta usaria o número informado no envio ou, na falta dele, 79 | `planilha-guardada.ts` linhas 73–82; `auditoria.ts` 53–54, 60 | Gustavo Akio, 1º, planilha: **3.780** = 1.000 × (328 ÷ 100 + 0,5) × 1,0 = 1.000 × 3,78 × 1,0 = **3.780**. Confere |

**Em que casos o fator é diferente de 1,0?** Em nenhum. **Em que casos o resultado depende de uma hipótese?** Nos Dias Finais das Etapas 2 e 3 (buy-in trocado e campo = soma dos flights, ambos [INFERIDO]) e nos flights da Etapa 1 (campo = ações, que o site não informa).

---

## 2. Perguntas para validação do superior

São 12 perguntas fechadas. Para cada uma: o que a ferramenta faz hoje, as alternativas e **quantos resultados mudam**. Os números vêm da ferramenta rodando sobre os dados reais (Etapa 1: 642 resultados; Etapa 2: 270; Etapa 3: 554).

**Pergunta 1. Quem fica fora da premiação recebe "10 × fatores" ou "10 pontos fixos"?**
- Hoje: **10 × fatores** (regulamento, **[OFICIAL]**; a Etapa 1 confirma: 29,25 = 10 × 2,925). Mantido como padrão.
- Alternativa: 10 pontos fixos (a calculadora do site, e o que as Etapas 2 e 3 pagaram).
- Impacto se fosse 10 fixos: **Etapa 1: 301 resultados mudam** (de corretos para erros); **Etapa 2: 5** (erros passam de 10 para 5); **Etapa 3: 273** (erros passam de 276 para 3).

**Pergunta 2. Premiados depois do 18º lugar: base 100 para todos, ou só para os "próximos 10% premiados" (e base 10 para os demais)? [PENDENTE, Compêndio 6.3]**
- Hoje: **base 100 para todos** os premiados depois do 18º (como a calculadora; combina com a Etapa 1: 384 = 100 × 3,84).
- Alternativa: base 10 para os premiados depois do 18º (aproxima a leitura do regulamento; o Compêndio não define como contar os "10%").
- Impacto: resultados premiados depois do 18º: **Etapa 1: 58** (230 mudam no total, porque o ajuste automático de inscritos deixa de fechar); **Etapa 2: 50**; **Etapa 3: 48**.

**Pergunta 3. Para buy-in abaixo de R$ 500, o fator é 1,0? [PENDENTE, Compêndio 6.8]**
- Hoje: **1,0** (como a calculadora e a Etapa 1: 12º = 375 = 250 × 1,5 × 1,0).
- Alternativa: outro valor, a definir pelo responsável.
- Impacto: torneios com buy-in abaixo de R$ 500: **Etapa 1: 95 resultados** (Second Chance 20K, R$ 250); **Etapa 2: 23** (EV #10 Second Chance 20K); **Etapa 3: 79** (Second Chance).

**Pergunta 4. O número de participantes de todo torneio é o de "ações" (buy-ins + re-entries) ou só o de buy-ins (inscritos)? [CONFIRMADO em 21/10/2026 como ações, vindo do superior; o site conta só buy-ins]**
- Hoje: o padrão usa os **inscritos do site** (só buy-ins); as ações só são usadas nos flights, quando conhecidas. Existe uma opção "ações" desligada.
- A pergunta: confirmar que **ações valem para todos os torneios** (não só para os flights) e como obter as ações das Etapas 1 e 2, que o site não informa.
- Impacto: só a Etapa 3 tem as ações (a planilha traz). Com a opção ligada: **corretos 143 → 64 e erros 276 → 355** (79 resultados passam de corretos para erro; os pontos da planilha foram calculados com buy-ins). Etapas 1 e 2: não dá para aplicar, o site não informa.
- Na Etapa 1, 5 torneios têm inscritos do site diferentes do número que reproduz os pontos (386 resultados "corretos com inscritos do site"). Qual número é o certo?

**Pergunta 5. Os flights da Etapa 1 tinham estas ações: Dia 1A = 126, Dia 1C = 61, Dia 1D = 71, Dia 1E = 100?**
- Hoje: **202 resultados aguardam regra** (faltam as ações). Esses números são os que reproduzem exatamente o valor que o site pagou (17,6; 11,1; 12,1; 15), mas não vêm do site ([INFERIDO]).
- Impacto se confirmados: os **202 resultados da Etapa 1 ficam corretos** (Etapa 1: 0 aguardando).

**Pergunta 6. O Dia Final sem posição (jogadores que aparecem só com 10 pontos) deve: (a) aguardar, (b) valer 10 pontos fixos, (c) valer 10 × fatores como fora da premiação, ou (d) 10 × fatores com o campo = ações do flight em que jogaram?**
- Hoje: **(a) aguarda regra** (decisão de 21/10/2026: não se sabe em qual flight o jogador jogou). A hipótese de que "jogaram só os flights" é **[INFERIDO]**.
- Impacto: **Etapa 2: 126 resultados; Etapa 3: 135.** Em (b), todos ficam corretos (o site pagou 10). Em (c), todos viram erro (esperado 38,1 na Etapa 2 e 37,8 na Etapa 3). Em (d), depende de saber o flight de cada jogador.

**Pergunta 7. O campo do Dia Final é a soma dos inscritos dos flights, ou os inscritos do próprio Dia Final? [INFERIDO, Compêndio 7.6]**
- Hoje: **soma dos flights** (331 na Etapa 2; 328 na Etapa 3), porque reproduz os pontos.
- Alternativa: inscritos do Dia Final (92 na Etapa 2; 79 na Etapa 3).
- Impacto: dos resultados do Dia Final com posição, os **60 corretos da Etapa 2** e os **64 corretos da Etapa 3** passam a ser erros (todos).

**Pergunta 8. O buy-in do Dia Final é R$ 1.000 (o site informa R$ 0)? [INFERIDO em 18/10, "confirmar"]**
- Hoje: usa **R$ 1.000** (fator 1,0). Qualquer valor até R$ 1.000 dá o mesmo resultado.
- Impacto: se o buy-in verdadeiro for **maior que R$ 1.000** (fator 1,2 ou mais): **Etapa 2: 64 resultados** do Dia Final com posição (60 corretos viram erros); **Etapa 3: 79** (64 corretos viram erros). Se for R$ 1.000 ou menos: nenhum resultado muda.

**Pergunta 9. Como o site arredonda os pontos? [PENDENTE, Compêndio 6.1]**
- Hoje: a ferramenta compara com o valor exato (com decimais) e só trata como "arredondamento" uma diferença de até **0,01 ponto**. O site mostra números inteiros e a regra do arredondamento não é conhecida.
- Pergunta: arredonda cada torneio ou só o total? Para cima, para baixo ou ao mais próximo?
- Impacto hoje: **0 resultados** em "arredondamento" nas três etapas; nenhuma diferença de até 1 ponto na Etapa 1 nem na Etapa 2. Na Etapa 3, 17 diferenças de até 1 ponto são "10 pagos contra 9 esperados" (é o 10 fixo, não arredondamento).

**Pergunta 10. Acordo: os K primeiros pontuam como o Kº colocado (confirmado em 21/10/2026). E o desempate: no critério "mais primeiros lugares", como o acordo conta? [PENDENTE]**
- Hoje: o acordo é marcado por torneio, vale para todos, e a ferramenta **não altera** o desempate.
- Impacto hoje: **nenhum acordo está marcado (0 resultados)**. Como exemplo de conta: K = 4 no Dia Final da Etapa 2 daria 2.286 para os quatro primeiros, exatamente o que o site pagou, e **3 erros (Emerson Rocha Sheik, Andrey Pérez do lago, Carlos Felipe Verlangieri Difini) passariam a corretos**. Isto só confirma a conta; não afirma que houve acordo.

**Pergunta 11. Etapa 3 (planilha): a planilha não traz o prêmio. Podemos considerar premiados quem tem pontos diferentes de 10? E os três campeões que receberam o valor do 2º lugar são erro da planilha?**
- Hoje: premiados **inferidos** pelos pontos (**[INFERIDO]**, não é o critério do Compêndio, que usa "prêmio maior que zero"). Premiados por torneio: 200K Omaha 10; Horse 4; Super K.O 6; 8 Game 4; 100K Omaha Mystery Bounty 8; Championship High Roller 200K 10; PLO/NLH Pijama 4; Dia Final 64; Second Chance 20; High Roller 50K 9; Omaha Dealer's Choice 7.
- Impacto: **toda a Etapa 3 (554 resultados)** depende dessa dedução. Os três campeões (SUPER K.O 672 contra 840; CHAMPIONSHIP HIGH ROLLER 200K 2.300 contra 2.875; HIGH ROLLER 50K 972 contra 1.215): **3 resultados**.

**Pergunta 12. Por que EV #7 LADIES ESPECIAL e EV #4 HORSE (Etapa 2) não têm nenhum resultado no site? Eles pontuam? [PENDENTE, Compêndio 6.6]**
- Hoje: a ferramenta só audita o que o site devolve; esses torneios aparecem sem resultados (29 e 12 inscritos).
- Impacto: **0 resultados hoje**, mas até **41 jogadores** podem estar sem os pontos desses dois torneios.

---

## 3. Tabela geral de regras

Cada linha é uma regra. "Precisa de validação?" diz se a regra depende de algo que ainda não foi confirmado.

| Nº | Regra | Valor ou fórmula | Fonte e confiabilidade | Como a ferramenta aplica hoje | Exemplo real | Validar? |
|---|---|---|---|---|---|---|
| 1 | Fórmula geral | Pontos = pontos-base da posição × fator de participantes × fator de buy-in | Regulamento (Compêndio 3.1) **[OFICIAL]** | Aplica a fórmula em centésimos inteiros | Rafael Bryan, 7º no Dia Final da Etapa 2: 400 × 3,81 × 1,0 = **1.524** | Não |
| 2 | Pontos-base do 1º ao 9º | 1º 1.000; 2º 800; 3º 700; 4º 600; 5º 500; 6º 450; 7º 400; 8º 350; 9º 300 | Compêndio 3.2 **[OFICIAL]** | Usa a tabela como está | Gustavo Akio, 1º no Dia Final da Etapa 3: 1.000 × 3,78 × 1,0 = **3.780** | Não |
| 3 | Pontos-base do 10º ao 18º | 10º a 12º: 250; 13º a 18º: 200 | Compêndio 3.2 **[OFICIAL]** | Usa a tabela como está | Rafael Bryan, 10º no EV #2 (Etapa 2): 250 × 0,84 × 1,5 = **315**. Renan Demetrio, 13º no Final Main Event (Etapa 1): 200 × 3,84 × 1,0 = **768** | Não |
| 4 | "Próximos 10% premiados" e "demais participantes" | Regulamento: próximos 10% premiados = 100; demais = 10. Não define como contar os 10% | Compêndio 3.2 **[OFICIAL]** e 6.3 **[PENDENTE]** | Dá **base 100 a todos os premiados depois do 18º** (como a calculadora). Existe opção para base 10 | Arnaldo Fernandes, 24º no Final Main Event: 100 × 3,84 × 1,0 = **384** | **Sim** (pergunta 2) |
| 5 | Fator de participantes | (número de participantes ÷ 100) + 0,5; sem mínimo nem máximo | Compêndio 3.3 **[OFICIAL]** | Aplica a conta | 100 participantes = 1,5; Dia Final da Etapa 2 com 331: 3,81 | Não |
| 6 | Qual número de participantes (campo): torneios comuns | Decisão: **ações** (buy-ins + re-entries). O site conta só buy-ins | Compêndio 6.2: **[CONFIRMADO 21/10/2026]**, revisto; o site conta só buy-ins [CONFIRMADO 18/10] | **Padrão: inscritos do site (só buy-ins).** Há opção "ações" (usa as ações quando a planilha informa; senão, os inscritos) | 200K Omaha 5 K.O (Etapa 1): 1.000 × 0,76 × 2,5 = **1.900** (campo 26) | **Sim** (pergunta 4) |
| 7 | Campo do Dia Final | Soma dos inscritos dos flights | Compêndio 7.6 **[INFERIDO]** | Usa a soma dos flights nas duas opções. Na Etapa 3, lê os flights do site; sem eles usa o valor informado ou o da planilha | Etapa 2: 96 + 50 + 64 + 67 + 54 = **331**. Etapa 3: **328** | **Sim** (pergunta 7) |
| 8 | Campo dos flights | Ações do flight (buy-ins + re-entries) | Compêndio 6.4 **[CONFIRMADO 21/10/2026]** | Usa as ações quando informadas. O site não informa: **aguarda regra** | Dia 1D, 1º: se 71 ações, 10 × 1,21 × 1,0 = **12,1** (71 é [INFERIDO]) | **Sim** (pergunta 5) |
| 9 | Fator de buy-in por faixa | R$ 500 a 1.000 = 1,0; R$ 1.001 a 1.999 = 1,2; R$ 2.000 a 2.999 = 1,5; R$ 3.000 ou mais = 2,5 | Compêndio 3.4 **[OFICIAL]** | Usa as faixas como estão | 1,0: Horse, buy-in R$ 800, 1º = 1.000 × 0,69 × 1,0 = **690**. 1,2: 8 Game, R$ 1.200, 1º = 1.000 × 0,64 × 1,2 = **768**. 1,5: 200K Omaha 5 K.O, R$ 2.000, 1º = 1.000 × 0,8 × 1,5 = **1.200**. 2,5: Championship High Roller 200K, R$ 3.000, 3º = 700 × 1,15 × 2,5 = **2.012,5** | Não |
| 10 | Fator de buy-in abaixo de R$ 500 | O regulamento não define. A calculadora usa 1,0 | Compêndio 6.8 **[OBSERVADO]**/**[INFERIDO]**; **[PENDENTE]** | Usa **1,0** | Second Chance 20K (Etapa 1, R$ 250), 12º: 250 × 1,5 × 1,0 = **375** | **Sim** (pergunta 3) |
| 11 | Multiplicador do Main Event | Sempre 1,0; não existe outro valor | Compêndio 3.2 e 5 **[OFICIAL]** e **[CONFIRMADO]** | Não há multiplicador na conta (equivale a 1,0) | Dia Final da Etapa 2, 7º: 400 × 3,81 × 1,0 = **1.524** | Não |
| 12 | Critério de premiado (ITM) | "Ambos": posição dentro do número de premiados **e** prêmio maior que zero | Compêndio 5 **[CONFIRMADO]** | Premiado = posição ≤ número de premiados e prêmio > 0. Quando os dois critérios divergem, marca a linha como "Revisar" | Dia Final da Etapa 2: 63 premiados; o 64º (sem prêmio) recebe 10 | Não |
| 13 | Quem fica fora da premiação | Base 10 multiplicada pelos fatores | Compêndio 5 **[OFICIAL]**; a Etapa 1 confirma **[OBSERVADO]** | **10 × fatores** (padrão). Há opção "10 pontos fixos" (a calculadora) | Carlos Vulpini, 200k High Roller (Etapa 1): 10 × 2,925 = **29,25** | **Sim** (pergunta 1) |
| 14 | Flights: quanto valem | 10 × fator de participantes × fator de buy-in, com campo = ações. Substitui "flight não conta ponto" e "10 pontos fixos" | Compêndio 6.4 **[CONFIRMADO 21/10/2026]** | Calcula quando as ações são conhecidas (igual = correto, diferente = erro, sem tolerância). Não conhecidas: aguarda | Dia 1A com 126 ações: 10 × 1,76 × 1,0 = **17,6** | **Sim** (pergunta 5) |
| 15 | Flights da Etapa 1 | Ações dos flights não vêm do site | Compêndio 6.4 **[OBSERVADO]**; ações implícitas **[INFERIDO]** | **202 resultados aguardam** ("faltam as ações deste flight") | Valores pagos: 17,6; 11,1; 12,1; 15 | **Sim** (pergunta 5) |
| 16 | Dia Final: buy-in zerado | O site informa R$ 0; usa-se R$ 1.000 | Compêndio 7.6 (18/10) **[INFERIDO, confirmar]** | Troca por **R$ 1.000** só no Dia Final. Qualquer valor até R$ 1.000 dá o mesmo fator | Etapas 2 e 3: fator 1,0 | **Sim** (pergunta 8) |
| 17 | Dia Final sem posição | Aguarda regra: não se sabe em qual flight o jogador jogou, então o multiplicador não pode ser calculado; o site pagou 10 | Compêndio 6.7 **[CONFIRMADO 21/10/2026]**; "jogou só os flights" **[INFERIDO]** | **Aguardando regra** (126 na Etapa 2; 135 na Etapa 3). Não são resultado do Dia Final | O site pagou 10 a cada um | **Sim** (pergunta 6) |
| 18 | O que é "Dia Final" | Na Etapa 1 só se reconhece pelo nome ("Final Main Event"); nas Etapas 2 e 3 o site marca como Dia Final | Compêndio 8 **[OBSERVADO]** | Etapas 2 e 3: marca do site. Etapa 1: tratado como torneio comum, com 135 inscritos | Etapa 1: "Final Main Event", 135 inscritos | Não |
| 19 | Satélites | Não pontuam | Compêndio 6.6 **[CONFIRMADO 21/10/2026]** | Reconhecido **pelo nome** ("satélite"): o esperado é 0; se houver pontos registrados, é erro | Etapa 2: "Satélite PLO 200K" e "SATELITE CHAMPIONSHIP" não têm resultados no site | Não |
| 20 | Torneio cancelado com resultados | Não definido | Compêndio: não define | **Aguarda regra** (motivo: torneio cancelado). Hoje há 0 resultados assim | Etapa 3 tem um satélite e o agregador cancelados, sem resultados | **Sim** (decisão não registrada) |
| 21 | Torneio não finalizado | Não definido | Compêndio: não define | **Aguarda regra** (os resultados podem mudar). Hoje há 0 | Nenhuma linha hoje | Não |
| 22 | Buy-in não informado | Sem o buy-in não há fator | Decisão da ferramenta | **Aguarda regra**. Hoje há 0 | Nenhuma linha hoje | Não |
| 23 | Bounty / KO | Não entra na pontuação; vale só a posição | Compêndio 5 **[CONFIRMADO]** | Ignora o bounty | 100K Omaha Mystery Bounty: conta só a posição | Não |
| 24 | Acordo | Os K primeiros pontuam como o Kº colocado: base da colocação K × fatores | Compêndio 6.9 **[CONFIRMADO 21/10/2026]** | Marcado por torneio, salvo para todos; vale para posições 1 a K (K de 2 até os premiados). Hoje: nenhum acordo marcado | Dia Final da Etapa 2, K = 4: 600 × 3,81 × 1,0 = **2.286** para os quatro | **Sim** (pergunta 10, desempate) |
| 25 | Arredondamento e decimais | O site mostra inteiros; a API guarda decimais. Regra de arredondamento desconhecida | Compêndio 6.1 **[CONFIRMADO 18/10]** (inteiros) e **[PENDENTE]** (regra) | Compara com o valor exato (com decimais) | 8 Game, 2º: 800 × 0,64 × 1,2 = **614,4** | **Sim** (pergunta 9) |
| 26 | Diferença aceita como arredondamento | Até 0,01 ponto | Decisão da ferramenta (Compêndio: "não tratar a diferença de arredondamento como erro") | Diferença de até 0,01 = "arredondamento"; acima disso, erro. Hoje: 0 resultados | Nenhuma linha hoje | **Sim** (pergunta 9) |
| 27 | Desempate | Mais primeiros lugares; mais mesas finais; mais participações; maior soma de buy-ins | Compêndio 3.5 **[OFICIAL]** | No Consolidado, só o 1º critério; quem continua empatado divide a posição. Os demais não existem nos dados | Empate em pontos: vale quem tem mais 1º lugares | **Sim** (pergunta 10) |
| 28 | Total do jogador | Soma simples de todos os torneios | Compêndio 3.1 e 5 **[OFICIAL]** e **[CONFIRMADO]** | Confere que o total do site é a soma dos resultados do jogador | Arnaldo Fernandes, Etapa 1: **5.137** | Não |
| 29 | Premiados da planilha | A planilha não traz prêmio | Decisão da ferramenta; não é o critério do Compêndio **[INFERIDO]** | Premiado = pontos diferentes de 10 | Dia Final da Etapa 3: 64 premiados | **Sim** (pergunta 11) |
| 30 | Cancelamento por falta de jogadores | Menos de 4 inscritos até o fim do 2º nível: cancelado | Compêndio 3.5 **[OFICIAL]** | Não aplicada (o status vem do site) | — | Não |

---

## 4. Divergências entre o Compêndio e a ferramenta

1. **Premiados depois do 18º lugar.** O regulamento dá base 100 só aos "próximos 10% premiados" (Compêndio 3.2). A ferramenta dá base 100 a **todos** os premiados depois do 18º, como a calculadora do site. Mantido porque reproduz a Etapa 1 e o Compêndio (6.3) deixa como pendente.
2. **Hipóteses usadas como regra.** Duas coisas marcadas [INFERIDO] no Compêndio são aplicadas pela ferramenta como se fossem regra: o **buy-in de R$ 1.000 no Dia Final** (7.6) e o **campo do Dia Final igual à soma dos flights** (7.6). A seção 9 do Compêndio ainda as lista como [PENDENTE].
3. **Campo do torneio.** O Compêndio registra (21/10/2026) que o campo correto é **ações**. A ferramenta, por padrão, ainda usa os **inscritos do site** (só buy-ins) e oferece "ações" como opção desligada. Isso é o que o próprio Compêndio descreve, mas na prática o padrão não segue a decisão.
4. **Critério de premiado na Etapa 3.** O Compêndio usa "prêmio maior que zero"; a planilha não traz prêmio, e a ferramenta infere pelos pontos diferentes de 10.
5. **Desempate.** O Compêndio (3.5) tem quatro critérios; a ferramenta só aplica o primeiro (primeiros lugares), porque os outros dados não existem.
6. **Satélite reconhecido pelo nome.** O Compêndio diz que satélites não pontuam; a ferramenta reconhece satélite pelo nome do torneio, não por um dado do site.
7. **Texto antigo no Compêndio.** A tabela da seção 5 e o glossário ainda trazem frases antigas ("flight não conta ponto"; "o site conta só buy-ins") junto das decisões novas. As decisões novas estão marcadas com data, mas o texto antigo convive com elas.
8. **Torneios cancelados e não finalizados.** O Compêndio não diz o que fazer; a ferramenta deixa aguardando regra.

Fora isso, todas as demais regras do Compêndio marcadas como [OFICIAL] ou [CONFIRMADO] (fórmula, bases do 1º ao 18º, fator de participantes, faixas de buy-in, multiplicador 1,0, premiado com posição e prêmio, fora da premiação como 10 × fatores, bounty fora da conta, soma simples, satélites sem pontos, acordo, flights com 10 × fatores e Dia Final sem posição aguardando) estão aplicadas como escritas.
