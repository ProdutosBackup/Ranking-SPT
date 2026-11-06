# Calculadora SPT: contexto do projeto

Documento de referência do projeto Calculadora Ranking (Suprema Poker Tour). Todo agente que trabalhar neste projeto usa este documento como fonte única de regras, dados e decisões. O que não está aqui não deve ser suposto: deve ser perguntado ao usuário.

Última atualização: 05/11/2026 (saídas da ferramenta, field, rankings duplicados, cenário 0,9 e pendências; no mesmo dia: premissas, Main Event e torneios que não pontuam; antes: 18/10/2026, 21h45, inspeção da API, respostas do usuário, stack definida).

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
- **[CONFIRMADO 05/11/2026]** A etapa 1 **não é mais referência absoluta**: ela contém erros (ex.: jogadores pontuados em 2 ou 3 flights). Em conflito entre a etapa 1 e o responsável do ranking, vale o responsável. Os números deduzidos da etapa 1 (campo 67 do 200k High Roller, ações 126/61/71/100 dos flights etc.) são hipótese **[INFERIDO]**, não regra. Antes (18/10/2026): "a etapa 1 está correta e serve de base de referência".
- **Foco atual: corrigir a etapa 2.** O ranking da etapa 3 ainda não foi publicado e vai subir em alguns dias; a etapa 2 precisa estar corrigida antes disso. **[CONFIRMADO]**

| Etapa | Nome | Código (stage) | Ranking publicado? |
|---|---|---|---|
| 1 | Tauá Resort Atibaia 2026 | `taua-2026` | Sim (com erros, ver seção 1) |
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
5. **[CONFIRMADO 05/11/2026]** Nenhum satélite pontua, e a ferramenta reconhece o satélite pelo nome. O esperado de uma linha de satélite é 0; registrado maior que 0 é Erro (causa: Satélite com pontos registrados, hipótese). Isso encerra a opção temporária de perguntar ao usuário se satélites pontuam (antes: 21/10/2026, com opção; desde 05/11/2026 não há pergunta nem opção). O Ladies também não pontua (seção 6.6).
6. **Relatório de revisão para download (requisito central) [CONFIRMADO].** Um relatório em Excel que o usuário baixa para revisar a etapa (prioridade: etapa 2). Ele precisa:
   - detalhar **cálculo por cálculo**: cada resultado de cada jogador em cada torneio, com a conta feita passo a passo;
   - **mostrar onde está errado**, com destaque visual nas linhas divergentes;
   - ser um relatório de fato, pronto para leitura e revisão, e não apenas uma exportação de dados brutos.
7. **Exportação de dados para download [CONFIRMADO].** Além do relatório, a ferramenta deve ter uma opção separada de exportar os dados (os dados extraídos e calculados, sem a formatação de relatório). As duas opções coexistem: **Relatório** e **Exportação de dados**.

   Conteúdo mínimo **sugerido** por linha do relatório (item 6) (o layout final é definido com o usuário) **[PENDENTE]**: jogador; torneio; posição; premiação; buy-in; inscritos; pontos base; fator de participantes; fator buy-in; a conta escrita (ex.: 250 × 0,84 × 1,5); pontos esperados; pontos registrados no site; diferença; situação (correto / erro / provável arredondamento / suspeito); causa provável do erro. Sugestão adicional: um resumo no início (total de linhas, quantas corretas, quantas com erro, por torneio) e uma conferência da soma por jogador.

8. **Participantes, rankings, cenário 0,9 e "dados insuficientes" [CONFIRMADO 05/11/2026]**, pedidos pelo responsável e pelo usuário:
   - **Duas versões do número de participantes:** (1) **só entradas** (somente inscritos); (2) **entradas + reentradas** ("ações totais"). A fórmula não muda: Fator_Participantes = (Número_de_Participantes / 100) + 0,5. Antes: "o site conta só buy-ins, não ações" como regra única; desde 05/11/2026 a ferramenta mostra as duas.
   - **Dois rankings no audit, no ranking geral:** SOMENTE COM ENTRADAS e ENTRADAS E REENTRADAS (ações totais). **[PENDENTE]** Se os dois valem também por etapa ou só no ranking geral: o usuário não respondeu.
   - **Cenário do fator 0,9:** o responsável pediu "também a conta com 0,9" para a faixa de R$ 0 a R$ 1.000, e o usuário quer os dois lado a lado. Vale para todos os torneios de até R$ 1.000, incluindo o Main Event. **O fator 1,0 continua sendo a regra confirmada; o 0,9 é um cenário pedido, não regra, e não substitui o 1,0 até decisão do usuário.**
   - **Quatro resultados lado a lado**, cada um com rótulo explícito: (1) só entradas, fator 1,0; (2) só entradas, fator 0,9; (3) entradas + reentradas, fator 1,0; (4) entradas + reentradas, fator 0,9.
   - **Marcação "dados insuficientes":** quando faltar dado, a ferramenta mostra essa marcação e, ao passar o mouse, aparece o motivo escrito. Casos conhecidos de dado ausente: entradas e reentradas por flight (ficam no Stack Plus; o responsável não tem), Dia 1E da etapa 1, resultado do HORSE da etapa 2, lista de acordos, torneios cancelados.
   - **[PENDENTE]** Qual campo da API corresponde a "entradas" e qual a "entradas + reentradas" (o campo `players` de torneios e flights): a verificar na medição.
   - **Interface travada:** a estrutura (docs/interface.md, app/components/estrutura.ts, tests/interface.test.ts) só muda com autorização explícita. Os 4 resultados rotulados e a marcação "dados insuficientes" foram solicitados pelo usuário em 05/11/2026; nenhum desses arquivos foi alterado agora.

Comportamentos discutidos e aceitos durante o planejamento:

- **Conferência da soma:** o total de pontos de cada jogador deve ser igual à soma dos torneios dele. **[CONFIRMADO]**: o ranking é a soma simples de todos os torneios.
- **Regras em aberto como configuração:** para os pontos da seção 6 que ainda não estão definidos, a ferramenta calcula as variantes possíveis e mostra qual delas reproduz os valores registrados. Desde 05/11/2026 a etapa 1 indica qual variante é plausível, mas não decide: em conflito vale o responsável do ranking (antes: "a etapa 1, por ser correta, indica qual variante vale").
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

**[CONFIRMADO 05/11/2026]**
- Depois do 18º lugar, **todo premiado recebe base 100** (antes: o regulamento só cita os "próximos 10% premiados").
- Quem fica **fora da premiação** recebe base 10 com a fórmula completa: **10 × Fator_Participantes × Fator_Buy-in**, nas 3 etapas. Todo jogador pontua pela participação, inclusive quem só ganhou bounty.
- O campo "prêmio" é só a premiação; o bounty é lançado à parte, não cria pontos e não define ITM.
- Ranking geral: soma de todas as etapas, sem descarte e sem zerar entre elas.

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

**[CONFIRMADO 05/11/2026]**
- O fator usa o buy-in **total**, incluindo o K.O/bounty, em todos os torneios. K.O: R$ 2.000 + R$ 1.000 = R$ 3.000, fator 2,5. Mystery: R$ 1.500 + R$ 1.000 = R$ 2.500 (faixa R$ 2.000 a R$ 2.999). Super K.O: R$ 1.000 total, fator 1,0. Antes: "bounty/K.O não entra no fator e o K.O vale só o buy-in"; desde 05/11/2026 entra.
- Buy-in de R$ 0 a R$ 1.000: fator 1,0 (a primeira faixa vale desde R$ 0, não só a partir de R$ 500). O fator 0,9 é só um cenário pedido, não regra (seção 2, item 8).
- Buy-in com centavos acima do limite da faixa passa para a faixa seguinte (R$ 1.000,50 vale a faixa de R$ 1.001 a R$ 1.999).
- Verificação: buy-in total de R$ 3.000 cai em "R$ 3.000 ou mais" (fator 2,5).

### 3.5 Outras regras do regulamento

- **Desempate**, nesta ordem: maior número de primeiros lugares; maior número de mesas finais; maior número de participações; maior soma de buy-ins investidos.
  - **[CONFIRMADO 05/11/2026]** Conta como participação um único torneio, mesmo que o jogador jogue mais de uma vez; no Main Event, com vários flights, a participação conta uma única vez. Quem pontua por acordo **não** conta como 1º lugar (seção 6.9).
  - **[CONFIRMADO 05/11/2026]** Mesa final: 9 jogadores normalmente; 8 no Omaha 5; 7 no 8-Game e no HORSE. O Omaha 5 é identificado pelo nome do torneio.
  - Para os critérios 2 a 4 (mesas finais, participações, soma de buy-ins) não há instrução nova: a ferramenta segue só com o critério 1, como hoje. **[PENDENTE]** A soma de buy-ins inclui re-entradas e bounty? Sem resposta.
- **Elegibilidade:** todos os torneios da série oficial, de qualquer modalidade (Texas Hold'em, Omaha, Mixed Games) ou estrutura (Turbo, Regular).
- **Cancelamento:** torneios sem no mínimo 4 jogadores inscritos até o final do 2º nível de blinds são cancelados automaticamente. **[CONFIRMADO 05/11/2026]** Torneio cancelado não pontua. **[PENDENTE]** Dado ausente: o responsável não informou quais torneios foram cancelados nem como saber (a etapa 3 não informa o status); sem inventar.
- **Auditoria:** todos os cálculos são auditáveis; jogadores podem solicitar revisão.
- **Premiação do ranking geral:** 1º R$ 100.000,00 + Bracelete Dourado; 2º R$ 50.000,00; 3º R$ 30.000,00; 4º R$ 20.000,00.

## 4. Calculadora do site

O site tem uma calculadora com 4 campos: Buy-in (R$), Field (nº de inscritos), Posição final e Nº de premiados (ITM). Ela foi testada em 23 casos. **[OBSERVADO]**

### 4.1 Texto do site

> Apenas quem está no ITM (com premiação > 0) pontua pela tabela. Jogadores fora do ITM recebem 10 pontos fixos, mesmo que tenham bounties/KOs. Bounty ≠ ITM. Fórmula final: Pontos = Pontos_Base × Fator_Participantes × Fator_Buy-in × MultiplicadorMainEvent (1,0×). Fator de participantes = (n / 100) + 0,5.

> Só quem fica no ITM pontua pela tabela; fora do ITM são 10 pts fixos. Se não souber quantos foram premiados, a calculadora estima 20% do field e o resultado fica aproximado.

**[CONFIRMADO 05/11/2026]** A regra "10 pontos fixos" fora da premiação é erro do site: a calculadora **não** é referência para quem está fora da premiação; vale 10 × fatores (seção 3.2). Antes: a calculadora era tratada como possível regra aplicada.

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

- Fora do ITM, a calculadora dá **10 pontos fixos, sem nenhum multiplicador** (T1, T2, T17). **[CONFIRMADO 05/11/2026]** Isso é erro da calculadora; vale 10 × fatores.
- A calculadora **não arredonda**: exibe o valor exato, com até 2 casas decimais (T3, T4, T22, T23).
- Buy-in abaixo de R$ 500 usa fator 1,0 (T5, T6); **[CONFIRMADO 05/11/2026]** buy-in de R$ 0 a R$ 1.000 tem fator 1,0. Atenção: existem torneios com buy-in abaixo de R$ 500 nas duas etapas (seção 6.8).
- As faixas de buy-in e a tabela de posições funcionam como no regulamento (T7 a T15).
- Com ITM em branco, a calculadora estima o nº de premiados como **20% do field arredondado para cima** (T16, T17, T20, T21).
- O fator de participantes não tem limite mínimo nem máximo (T18, T19).
- Todos os premiados depois do 18º recebem base 100 na calculadora (T15, T16, T20, T21). **[CONFIRMADO 05/11/2026]** Vale também como regra (seção 3.2).

### 4.4 Divergências entre a calculadora e o regulamento

| Ponto | Regulamento | Calculadora |
|---|---|---|
| Quem fica fora do ITM | "Demais participantes" têm **base 10**, que passa pela fórmula com os fatores | **10 pontos fixos**, sem fatores |
| Premiados depois do 18º | Base 100 só para os "próximos 10% premiados" | Base 100 para **todos** os premiados depois do 18º |

O ranking da etapa 1 segue o regulamento no primeiro ponto: quem fica fora do ITM recebe 10 × fatores (ver seção 7). **[OBSERVADO]** **[CONFIRMADO 05/11/2026]** Vale 10 × fatores nas 3 etapas; a calculadora do site está simplificada e **não** é referência para quem está fora da premiação. No segundo ponto vale a base 100 para todos os premiados depois do 18º. Antes: a etapa 1 era tratada como "correta" e referência absoluta; hoje a coincidência com ela é só indício.

Na etapa 2, a API mostra **10 pontos fixos** para jogadores sem prêmio em vários torneios (seção 6.7). **[OBSERVADO]** Isso reforça a hipótese de que a etapa 2 foi calculada com a regra da calculadora. **[INFERIDO]** **[CONFIRMADO 05/11/2026]** Os 10 pontos fixos do site (etapa 2) e da planilha da etapa 3 são erro; o certo é 10 × fatores.

## 5. Decisões confirmadas

| Tema | Decisão | Fonte |
|---|---|---|
| Fórmula | Base × Fator_Participantes × Fator_Buy-in | [OFICIAL] |
| Main Event | Multiplicador sempre 1,0; não existe outro valor | [OFICIAL] e [CONFIRMADO] |
| Quem fica fora do ITM | Base 10, multiplicada pelos fatores | [OFICIAL] e [CONFIRMADO 05/11/2026] nas 3 etapas; os "10 pontos fixos" (site e planilha da etapa 3) são erro |
| Total do jogador | Soma simples de todos os torneios | [OFICIAL] e [CONFIRMADO] |
| Bounty / KO | Bounty não cria pontos e não define ITM: o campo prêmio é só a premiação e o bounty é lançado à parte. Todo jogador pontua pela participação (10 × fatores), inclusive quem só ganhou bounty. O bounty/K.O entra no buy-in total do fator de buy-in (seção 3.4). Antes: "não entra na pontuação; vale só a posição final" | [CONFIRMADO 05/11/2026] |
| Critério de ITM | "Ambos": posição dentro do nº de premiados **e** premiação maior que zero | [CONFIRMADO] |
| Flights do Main Event | Flights das etapas 2 e 3 pontuam só por participação: 10 × fatores, uma vez por jogador, com participantes = soma das entradas dos flights (seção 6.4). O Dia Final é continuação dos flights: na Etapa 1, quem jogou flight e chegou ao Dia Final pontua no primeiro flight e o Dia Final dele vale 0. Antes: "flight não conta ponto" (18/10) e "campo em ações de cada flight" (21/10), ambas substituídas | [CONFIRMADO 05/11/2026] |
| Field | Duas versões do número de participantes: só entradas (inscritos) e entradas + reentradas (ações totais); a fórmula não muda (seção 2, item 8). Antes: "o site conta só buy-ins" (18/10) e "o campo correto é ações" (21/10). Qual campo da API corresponde a cada uma está em aberto | [CONFIRMADO 05/11/2026]; campo da API [PENDENTE] |
| Referência de verdade | Vale o responsável do ranking. A etapa 1 contém erros e não é referência absoluta; números deduzidos dela são [INFERIDO]. Antes (18/10): valia a variante que reproduz a etapa 1 | [CONFIRMADO 05/11/2026] |
| Arredondamento na tela | O site exibe pontos como número inteiro; a API guarda com decimais | [CONFIRMADO em 18/10] e [OBSERVADO] |
| Stack | Next.js com TypeScript (página e rotas de servidor); ExcelJS para o Excel | [CONFIRMADO em 18/10] |
| Acesso à API | Por rota de servidor (a API não envia CORS) | [OBSERVADO] |
| Mudança de regra entre etapas | Não houve | [CONFIRMADO] |
| Fator de buy-in | Usa o buy-in total, incluindo K.O/bounty; R$ 0 a R$ 1.000 = 1,0; centavos acima do limite passam para a faixa seguinte (seção 3.4) | [CONFIRMADO 05/11/2026] |
| Base depois do 18º | Todo premiado recebe base 100 | [CONFIRMADO 05/11/2026] |
| Fator de participantes | (Número_de_Participantes / 100) + 0,5, sem alteração | [CONFIRMADO 05/11/2026] |
| Ranking geral | Soma de todas as etapas, sem descarte e sem zerar entre elas | [CONFIRMADO 05/11/2026] |
| Arredondamento | Segue como a ferramenta calcula hoje; regra definitiva (para cima ou mais próximo) | [PENDENTE] |

Observação sobre o critério de ITM: quando os dois critérios divergirem em um jogador (por exemplo, posição dentro do ITM mas premiação zero), a ferramenta deve marcar a linha como suspeita.

## 6. Pontos em aberto

Estes pontos não podem ser tratados como regra. A ferramenta deve testar as variantes e mostrar quais reproduzem os valores publicados (desde 05/11/2026 a etapa 1 é indício, não referência absoluta; antes: "qual reproduz os valores da etapa 1").

### 6.1 Arredondamento dos pontos

- O regulamento não diz nada sobre arredondamento.
- **A API guarda os pontos com decimais** **[OBSERVADO]**: 877,5; 29,25; 38,4; 11,4; 12,1. Os totais também têm decimais (Carlos Vulpini 1.757,25; Vinicius Biesek 3.565,5; Anderson Costa 1.101,9).
- **O site exibe número inteiro** **[CONFIRMADO em 18/10]**.
- A regra de arredondamento usada na tela continua **[PENDENTE]**: o responsável disse "arredonda pra cima", mas o Compêndio registrou 877,5 exibido como 877 (para baixo). Não se sabe se o site arredonda cada torneio ou só o total.
- Decisão para a ferramenta: comparar com o valor da API (com decimais) e mostrar o inteiro ao lado, sem tratar a diferença de arredondamento como erro.

### 6.2 O que conta como "número de participantes" (field) [PENDENTE]

- O regulamento diz "Número_de_Participantes", sem tratar re-entries. **[CONFIRMADO 05/11/2026]** O responsável disse que a conta pode ser feita com os dois números e quer os dois resultados: (1) só entradas (somente inscritos) e (2) entradas + reentradas ("ações totais"); ver seção 2, item 8. A fórmula do fator de participantes não muda; só o número de participantes muda entre as versões. Antes: em 18/10 o usuário disse que o site conta só buy-ins (regra única); em 21/10 o responsável disse que isso era erro do site e que o campo correto era ações (opção "campo do torneio = ações", desligada por padrão). Desde 05/11/2026 nenhuma das duas é regra única.
- Campo `players` da API comparado com o field deduzido dos pontos:

| Etapa | Torneio | `players` na API | Field deduzido dos pontos | Bate? |
|---|---|---|---|---|
| 1 | 200K Omaha 5 K.O (buy-in 3.000) | 26 | 26 (1900÷1000 = 1,90 ÷ 2,5 = 0,76) | Sim |
| 1 | 100K OMAHA Mystery Bounty (buy-in 2.500) | 25 | 26 (513÷450 = 1,14 ÷ 1,5 = 0,76) | Não, diferença de 1 |
| 1 | 200k High Roller (buy-in 3.000) | 85 | 67 (2340÷800 = 2,925 ÷ 2,5 = 1,17) | Não |
| 1 | Final Main Event (buy-in 1.000) | 135 | 334 (fator 3,84) | Não |
| 1 | Second Chance 20K (buy-in 250) | 95 | 100 (375÷250 = 1,50, com fator buy-in 1,0) | Não |
| 2 | EV #2 200K PLO 5 K.O (buy-in 2.000) | 34 | 34 (seção 7.4; o 315 publicado diverge do buy-in total, ver 7.4) | Sim |
| 2 | EV #8 SUPER HIGH ROLLER 200K (buy-in 3.000) | 82 | 82 (2640÷800 = 3,3 ÷ 2,5 = 1,32) | Sim |

Os campos deduzidos são **[INFERIDO]**. **[CONFIRMADO 05/11/2026]** Como a etapa 1 contém erros, os campos deduzidos dela (67 do 200k High Roller, 334 do Final Main Event etc.) são hipótese, não regra. O responsável havia informado 46 buy-ins (80 ações) para o 200k High Roller da etapa 1; nenhum desses números reproduz os pontos.

- Main Event: field do Dia Final = soma das entradas dos flights nas etapas 2 e 3 **[CONFIRMADO 05/11/2026]** (seções 6.4 e 7.6); na etapa 1 é hipótese **[INFERIDO]**.
- A ferramenta deve testar `players` como field e, quando não reproduzir a etapa 1, mostrar o field deduzido pelo cálculo inverso.

### 6.3 "Próximos 10% premiados" [PENDENTE]

O regulamento dá base 100 aos "próximos 10% premiados" e base 10 aos "demais participantes". Não está definido:

- se os 10% são calculados sobre o nº de premiados ou sobre o field;
- o que acontece com premiados que ficam depois desses 10% (base 100 ou base 10); **[CONFIRMADO 05/11/2026]** depois do 18º, todo premiado recebe base 100;
- como pontuam as posições 1 a 18 quando há menos premiados do que isso.

A calculadora do site dá base 100 a todos os premiados depois do 18º. No Dia Final da etapa 2, as posições 19 a 63 têm todas 381 pontos (100 × 3,81), coerente com a calculadora. **[OBSERVADO / INFERIDO]**

### 6.4 Flights do Main Event [CONFIRMADO 05/11/2026]

- **[CONFIRMADO 05/11/2026]** Os flights das etapas 2 e 3 **pontuam**, só por participação. O número de participantes do Main Event é a **soma de todas as entradas dos Dias 1 (flights)** e varia em cada etapa. Quem joga mais de um flight pontua **uma vez só**, qualquer que seja o flight jogado (o ponto de participação é computado uma única vez). Quem jogou flight e não chegou ao Dia Final recebe **10 × Fator_Participantes × Fator_Buy-in**, com esse número de participantes e buy-in R$ 1.000 dos flights (fator 1,0). Exemplos derivados: etapa 2, 331 participantes → 10 × 3,81 × 1,0 = 38,1; etapa 3, 328 → 10 × 3,78 × 1,0 = 37,8. Antes (21/10/2026): o campo era as ações de cada flight (ex.: Dia 1A com 126 ações = 17,6), com a linha "aguardando regra" quando faltavam as ações; antes disso, "10 pontos fixos" e "flight não conta ponto". Todas substituídas. Flights nunca entram no ITM de outros torneios.
- **[CONFIRMADO 05/11/2026]** O Dia Final é continuação dos flights (Etapa 1, a única com linhas de flight nos resultados). Palavras do usuário: "O player premia ao longo dos flights e não no dia final. O dia final é somente uma continuação dos flights." Aplicação: (a) jogador com linha no Dia Final e linhas de flight: a pontuação que estaria na linha do Dia Final (base da posição × fatores, ou 10 × fatores se não tem posição, com o acordo que houver) fica na **primeira linha de flight** dele (1A, 1C, 1D, 1E); os outros flights e a linha do Dia Final valem 0. (b) Só flights, sem Dia Final: 10 × fatores na primeira linha de flight, como antes. (c) Dia Final sem nenhuma linha de flight nos resultados (Etapas 2 e 3, e quem não tem flight na Etapa 1): o Dia Final carrega a pontuação, como antes. O total de cada jogador não muda; muda só a linha onde o ponto aparece. Na Etapa 1, 51 finalistas jogaram flight, então 51 linhas do Dia Final passam a 0 e 51 flights passam a carregar a pontuação (o número de erros vai de 202 para 253, porque o site registrou os pontos no Dia Final). Antes (05/11/2026, mais cedo): "quem tem linha no Dia Final vale só essa linha e os flights dele valem 0"; substituída.

- ~~Regra informada: flight não conta ponto.~~ **[SUBSTITUÍDO 05/11/2026]** pela regra acima: os flights das etapas 2 e 3 pontuam. (Antes, [CONFIRMADO em 18/10].)
- Etapa 1: os flights (Dia 1A, 1C, 1D, 1E) aparecem nos resultados de **todos** os participantes, com prize 0. Exemplo: Anderson De Carvalho Costa, Dia 1D, posição 1, **12,1 pontos**. **[OBSERVADO]** Pela regra antiga ("flight não conta ponto") seria 0; essa regra foi substituída em 05/11/2026. A etapa 1 tem erros conhecidos nos flights (jogadores pontuados em 2 ou 3 flights).
- 12,1 pontos equivalem a base 10 × fator 1,21; com buy-in 1.000, o field seria 71, mas a API traz 55 jogadores no Dia 1D. **[INFERIDO]**
- Etapa 1 não tem Dia 1B na API (só 1A, 1C, 1D, 1E). **[OBSERVADO]** **[CONFIRMADO 05/11/2026]** Não houve Dia 1B na etapa 1.
- Cada flight da etapa 1 tem um único valor registrado, e ele é exatamente 10 × (ações/100 + 0,5) com buy-in R$ 1.000: Dia 1A 17,6 (126 ações), Dia 1C 11,1 (61), Dia 1D 12,1 (71) e Dia 1E 15 (100). **[OBSERVADO]** Esses números de ações são os implícitos nos pontos, não informados pelo site. **[INFERIDO]** Hipótese apenas: desde 05/11/2026 o campo em ações de cada flight não é regra.
- Etapa 2: a API **não traz nenhum resultado** dos flights (Dia 1A a 1E). **[OBSERVADO]**
- O usuário pode fornecer a página do site com a grade completa dos torneios, para conferência. **[CONFIRMADO]**
- **[PENDENTE]** Entradas (buy-ins + re-entradas) de cada flight: ficam registradas no sistema Stack Plus, e o responsável **não tem** esses números por flight (confirmado em 05/11/2026 que o dado falta). Dado ausente; não estimar.
- **[CONFIRMADO 05/11/2026]** O número do Dia Final fecha com a soma das entradas dos flights nas etapas 2 e 3: **331 = 96 + 50 + 64 + 67 + 54** (etapa 2) e **328 = 77 + 64 + 55 + 67 + 65** (etapa 3). Na etapa 1 não fecha (334 deduzido; 358 pela soma das ações deduzidas 126 + 61 + 71 + 100; 202 inscritos listados 83 + 47 + 55 + 17) e continua como hipótese **[INFERIDO]**.

### 6.5 Nº de premiados (ITM)

- A API não tem campo de nº de premiados. **[OBSERVADO]**
- Etapa 1: todos os participantes aparecem nos resultados (linhas = `players` em todos os 11 torneios), então o ITM sai de `prize > 0`. **[OBSERVADO]**
- Etapa 2: só aparece quem pontuou, então não dá para contar participantes pelos resultados; o ITM sai de `prize > 0`. **[OBSERVADO]**
- A estimativa de 20% do field da calculadora não é necessária enquanto `prize` estiver disponível. Se foi usada no ranking real continua **[PENDENTE]**.
- **[CONFIRMADO 05/11/2026]** Premiados da etapa 3 (a planilha da etapa 3 não traz prêmio nem nº de premiados; vale esta lista): EV1 Main Event 64; EV2 Omaha 200K 11; EV3 HORSE 3; EV4 SUPER K.O 6; EV5 8 GAME 4; EV6 OMAHA MYSTERY 8; EV8 Championship 10; EV9 PLO DEALER´S CHOICE 4; EV10 SECOND CHANCE 20; EV11 HIGH ROLLER 9; EV12 OMAHA DEALER´S CHOICE 7. O EV 7 é o Ladies (não pontua). Com esses números, a inferência "premiado = pontos diferentes de 10" deixa de valer. Os nomes das abas foram mapeados em lib/premiados-etapa3.ts (VERSAO_REGRAS 2.1); onde a planilha diverge da lista vale a lista e a divergência aparece (HORSE: planilha pagou 4, lista 3; 200K OMAHA 5 K.O: planilha pagou 10, lista 11).
- **[CONFIRMADO 05/11/2026]** Posição repetida: os jogadores foram eliminados ao mesmo tempo e o sistema os coloca na mesma posição. Ex.: 14º duas vezes no OMAHA DEALER´S CHOICE da etapa 3, que tem 7 premiados; os dois ficam fora da premiação (10 × fatores). **[PENDENTE]** As posições repetidas da etapa 1 (50K Cucurucho, 100K Omaha Mystery Bounty, 200k High Roller) não foram explicadas pelo responsável.

### 6.6 Satélites e torneios que não pontuam [CONFIRMADO 05/11/2026]

- **[CONFIRMADO 05/11/2026]** Nenhum satélite pontua; a ferramenta o reconhece pelo nome (etapa 2: "Satélite PLO 200K" e "SATELITE CHAMPIONSHIP"). Isso encerra a opção temporária de perguntar se satélites pontuam; o requisito foi removido (seção 2, item 5).
- **[CONFIRMADO 05/11/2026]** O Ladies não pontua: "EV #7 LADIES ESPECIAL" da etapa 2 e o EV 7 da etapa 3. É o único torneio do calendário, fora os satélites, que não pontua. Antes: "por que o Ladies não tem resultado" era [PENDENTE]; agora é explicado, pois não pontua.
- **[CONFIRMADO 05/11/2026, usuário]** "ALL IN OR FOLD CHAMPIONSHIP" e "ALL IN OR FOLD CHAMPIONSHIP 2" (etapa 3, R$ 300, 10 jogadores) não pontuam; a ferramenta os reconhece pelo nome, como os satélites e o Ladies.
- **[CONFIRMADO 05/11/2026]** O HORSE da etapa 2 (EV #4) teve 12 inscritos e 3 premiados e **pontua**. **[PENDENTE]** Dado ausente: o resultado dele não existe no site (por isso a API não traz linhas); sem estimar.
- **[CONFIRMADO 05/11/2026]** Torneio cancelado não pontua; quais foram cancelados e como saber é **[PENDENTE]** (seção 3.5).


- A etapa 2 tem satélites com buy-in de R$ 300 ("Satélite PLO 200K", 15 inscritos; "SATELITE CHAMPIONSHIP", 15 inscritos). A etapa 1 não tem. **[OBSERVADO]**
- Na API, os satélites da etapa 2 **não têm nenhum resultado**, ou seja, hoje não pontuam no site. O mesmo acontece com "EV #7 LADIES ESPECIAL" (R$ 300, 29 inscritos) e "EV #4 HORSE" (R$ 500, 12 inscritos). **[OBSERVADO]**
- O regulamento não define fator buy-in abaixo de R$ 500.
- Satélites não contam para o ranking: regra confirmada em 21/10/2026 e 05/11/2026. O esperado de uma linha de satélite é 0; registrado maior que 0 é Erro (causa: Satélite com pontos registrados, hipótese).
- ~~**[PENDENTE]** Por que Ladies e HORSE não têm resultado na API.~~ **[RESPONDIDO 05/11/2026]** Ladies não pontua; HORSE pontua mas o resultado não existe no site (dado ausente, acima).

### 6.7 Pontos fixos de 10 na etapa 2 [OBSERVADO]

**[CONFIRMADO 05/11/2026]** Os 10 pontos fixos fora da premiação (site, etapa 2, e planilha da etapa 3) são erro; o certo é 10 × Fator_Participantes × Fator_Buy-in. Os casos de Main Event/flights abaixo seguem a regra da seção 6.4: 10 × fatores, uma única vez.

**[CONFIRMADO 05/11/2026]** As linhas do Dia Final (role FINAL) **sem posição** ("—": 126 na etapa 2; 135 na etapa 3, que tem 214 linhas para 79 inscritos) são **pontos de participação mais o multiplicador**, sempre pontuando uma única vez: 10 × Fator_Participantes × Fator_Buy-in com o número de participantes do Main Event (soma das entradas dos flights, seção 6.4). Antes (21/10/2026): "aguardando regra" por não se saber em qual flight o jogador jogou; antes disso, "10 pontos fixos". Ambas substituídas. A etiqueta "Participação de flight" permanece, e essas linhas não são resultado do Dia Final (não entram na contagem de posições). **[INFERIDO]** Quem aparece sem posição jogou só os flights. Evidência: na etapa 3 as posições do Dia Final vão de 1 a 79, contínuas, e os inscritos são 79; os "—" são 135 (79 + 135 = 214 linhas). Na etapa 2 há 64 posições e 126 linhas sem posição.

Na etapa 2, a API mostra 10 pontos sem multiplicador nestes casos:

| Torneio | Jogadores | position | prize | points |
|---|---|---|---|---|
| Main Event SPT — Dia Final | 126 jogadores (ex.: Auro Damazio De Assis) | null | null | 10 |
| Main Event SPT — Dia Final | Edson Santos Ribeiro | 64 | null | 10 |
| EV #8 SUPER HIGH ROLLER 200K | Ramon Victor fernandes ambrozio, Diones da Silva lopes, LEONARDO DURANTE DOMINGUES | 14, 15, 16 | null | 10 |
| EV #11 HIGH ROLLER 50K | Renan Esteves | 8 | null | 10 |

Pela regra da seção 5 (base 10 × fatores), esses jogadores deveriam ter 10 × fator do torneio (ex.: 33 no EV #8, com fator total 3,3). São candidatos fortes a erro. **[INFERIDO]**

~~[PENDENTE: responder em 19/10]~~ **[RESPONDIDO 21/10/2026]** Os 126 jogadores sem posição do Dia Final **ficam fora da conferência, aguardando regra**, conforme a decisão acima (a resposta anterior, "10 pontos fixos", foi substituída). **[SUBSTITUÍDO 05/11/2026]** Essas linhas pontuam 10 × fatores, uma única vez (seção 6.4); não ficam mais aguardando regra.

### 6.8 Buy-in abaixo de R$ 500 [OBSERVADO]

O Compêndio registrava que não havia buy-in abaixo de R$ 500 na etapa 1. A API mostra **"Second Chance 20K" com buy-in 250** na etapa 1 (correta), e "EV #10 SECOND CHANCE 20K" com buy-in 250 na etapa 2. Os pontos da etapa 1 (12º = 375) são compatíveis com fator buy-in 1,0. **[INFERIDO]** **[CONFIRMADO 05/11/2026]** Buy-in de R$ 0 a R$ 1.000 tem fator 1,0 (antes: qual fator vale abaixo de R$ 500 era [PENDENTE]).

### 6.9 Acordo [CONFIRMADO pelo usuário em 21/10/2026]

**[CONFIRMADO 05/11/2026]** Se jogadores têm a mesma pontuação, entende-se que houve acordo: todos pontuam como a última posição do acordo e **não** contam como 1º lugar no desempate. No Dia Final da etapa 2, as posições 1 a 4 com 2.286 pontos cada (600 × 3,81, base do 4º lugar) são um acordo entre 4 jogadores. **[PENDENTE]** O responsável não informou outros torneios com acordo; sem inventar.

- **Regra [CONFIRMADO pelo usuário em 21/10/2026]:** num torneio com **acordo**, a pergunta é uma só: "Pontuam como qual colocação?" (K). Os jogadores das posições 1 a K pontuam **todos com a pontuação da colocação K**. Valor de cada um = base da colocação K × fator de participantes × fator de buy-in × multiplicador do torneio (a fórmula normal; só a base muda).
- **Por que as posições 1 a K [CONFIRMADO pelo usuário em 21/10/2026]:** quem faz o acordo são os jogadores que restam na mesa, e eles pontuam como a colocação em que o acordo foi fechado. Por isso, nesta versão, o número de pessoas no acordo (N) é **sempre igual a K**.
- **Conta no Dia Final da etapa 2** (fator de participantes 3,81, fator de buy-in 1, multiplicador 1,0; o teste confere a conta, não conclui que houve acordo): K=2 → 800 × 3,81 = 3.048,00 cada; K=3 → 700 × 3,81 = 2.667,00 cada; K=4 → 600 × 3,81 = 2.286,00 cada (exemplo do usuário). Com K=4, os quatro primeiros, que têm 2.286 registrados, ficam Corretos. Desde 05/11/2026 o responsável confirma que houve acordo entre 4 jogadores nesse caso (antes: "só confirma a conta; não prova que houve acordo"; seção 7.6).
- **Quem entra:** K é inteiro, de 2 até o número de premiados (ITM) do torneio. Posições acima de K não mudam. A posição e o prêmio publicados continuam como estão.
- **Como a ferramenta guarda:** o acordo é marcado por torneio, salvo para todos, sem login, e qualquer pessoa pode remover. O registro guarda só K. Ele entra no identificador dos dados e na chave do cache. A linha mostra a etiqueta "Acordo", e o resultado (Correto ou Erro, sem tolerância de arredondamento) usa o valor da colocação K. Registros da regra anterior (com N, sem K) são descartados ao ler.
- ~~**Regra anterior, substituída em 21/10/2026:** os N jogadores dividiam igualmente a soma dos pontos das posições 1 a N (com a hipótese de arredondamento a 2 casas, metade para cima). A pergunta "Acordo entre quantas pessoas?" e essa hipótese de arredondamento foram removidas.~~ **[SUBSTITUÍDO pela regra acima]**
- **Desempate [CONFIRMADO 05/11/2026]:** quem pontua por acordo não conta como 1º lugar no critério "maior número de primeiros lugares" (antes: [PENDENTE]). A ferramenta **não altera** o desempate neste momento: segue só com o critério 1, como hoje, e as posições seguem como publicadas.

## 7. Dados de referência da etapa 1

Cinco jogadores da etapa 1. Valores conferidos na API em 18/10 (pontos com decimais). **[OBSERVADO]** Desde 05/11/2026 a etapa 1 não é referência absoluta (contém erros): estes dados são observação, e o que se deduz deles é [INFERIDO]. Antes: "etapa 1 (correta)".

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

Os valores da etapa 1 batem exatamente com base 10 × fator total, e não com 10 fixos. **[OBSERVADO]** **[CONFIRMADO 05/11/2026]** Caso de verificação: 76º do Final Main Event sem prêmio = 10 × 3,84 = 38,4.

### 7.4 Caso verificado na etapa 2

Rafael Bryan, 10º no "EV #2 200K PLO 5 K.O" (buy-in R$ 2.000, 34 inscritos), premiação R$ 3.500:

250 × (34/100 + 0,5) × 1,5 = 250 × 0,84 × 1,5 = **315**. O ranking mostra **315**. **[OBSERVADO]** Dado publicado, mantido.

**Divergência encontrada [INFERIDO, 05/11/2026]:** o site pagou 315 com fator de buy-in 1,5 (buy-in R$ 2.000). Pela regra do buy-in total (R$ 2.000 + R$ 1.000 = R$ 3.000, fator 2,5) o esperado seria 250 × 0,84 × 2,5 = **525**.

**Revisão 05/11/2026:** antes, este caso era tratado como verificado com buy-in R$ 2.000 (fator 1,5). Desde 05/11/2026 o fator usa o buy-in total com o K.O (R$ 2.000 + R$ 1.000 = R$ 3.000, fator 2,5; seção 3.4); esta conta com fator 1,5 não reproduz a regra vigente. Conflito deixado em aberto.

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

**[CONFIRMADO 05/11/2026]** Para o fator de buy-in vale o total com o bounty (seção 3.4), não só o `buyIn` da tabela: EV #2 K.O (API 2.000, K.O 1.000) = R$ 3.000; EV #5 Mystery (API 1.500) = R$ 2.500; EV #3 Super K.O (API 500) = R$ 1.000 total.

### 7.6 Main Event da etapa 2: achados [INFERIDO]

- **Buy-in do Dia Final [CONFIRMADO 05/11/2026]:** a API traz `buyIn = 0` e o Dia Final não tem valor de buy-in; vale a regra de R$ 0 a R$ 1.000: fator 1,0. Antes (18/10): "usar R$ 1.000", [INFERIDO, confirmar]; R$ 1.000 deixou de ser a premissa.
- **Field do Dia Final [CONFIRMADO 05/11/2026]:** é a soma das entradas dos flights, e não os 92 do campo `players`. Etapa 2: Rafael Bryan, 7º, 1.524 pontos; 1524 ÷ 400 = 3,81 → field 331 = 96 + 50 + 64 + 67 + 54. Etapa 3: 328 = 77 + 64 + 55 + 67 + 65. Antes: [INFERIDO].
- Na etapa 1 os números não fecham: field deduzido do Final Main Event 334; 358 pela soma das ações deduzidas dos flights (126 + 61 + 71 + 100); 202 inscritos listados na API (1A, 1C, 1D, 1E). Continua hipótese **[INFERIDO]**. A explicação "diferença de 132 = Dia 1B ausente" caiu: não houve Dia 1B na etapa 1 **[CONFIRMADO 05/11/2026]**.
- **Posições 1 a 4 do Dia Final com 2.286 pontos cada:** 2286 ÷ 3,81 = 600, que é a base do 4º lugar. Pelo regulamento, 1º = 3.810, 2º = 3.048, 3º = 2.667, 4º = 2.286. **[CONFIRMADO 05/11/2026]** É um acordo entre 4 jogadores (seção 6.9): 600 × 3,81 = 2.286 para os quatro, que ficam Corretos. Antes: "candidato forte a erro (ou acordo não registrado)".
- Posições 19 a 63 com 381 pontos cada (base 100 × 3,81). **[OBSERVADO]**
- Posição 64 e 126 jogadores sem posição com 10 pontos fixos (seção 6.7). **[OBSERVADO]** Os 10 fixos são erro; o certo é 10 × fatores com o field acima **[CONFIRMADO 05/11/2026]**.
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

## 9. Pendências (lista única, atualizada em 05/11/2026)

Tudo o que continua **[PENDENTE]** em 05/11/2026. Itens resolvidos não ficam aqui: estão registrados nas seções indicadas na própria regra.

- **[PENDENTE]** Formato do arquivo da fase 2 (upload) (seção 2, item 1).
- **[PENDENTE]** Layout final do relatório por linha (seção 2, item 6).
- **[PENDENTE]** Regra de arredondamento, no site e a definitiva (para cima ou mais próximo). A ferramenta segue como calcula hoje (seção 6.1).
- **[PENDENTE]** "Próximos 10% premiados": se os 10% são sobre premiados ou sobre o field, e como pontuam as posições 1 a 18 quando há menos premiados do que isso (seção 6.3).
- **[PENDENTE]** Se a estimativa de 20% do field da calculadora foi usada no ranking real (seção 6.5).
- **[PENDENTE]** Posições repetidas da etapa 1 (50K Cucurucho, 100K Omaha Mystery Bounty, 200k High Roller): não explicadas pelo responsável (seção 6.5).
- **[PENDENTE]** Dado ausente: entradas e reentradas de cada flight (ficam no Stack Plus; o responsável não tem) (seção 6.4).
- **[PENDENTE]** Dado ausente: Dia 1E da etapa 1 (seção 2, item 8).
- **[PENDENTE]** Dado ausente: resultado do HORSE da etapa 2 (EV #4), que pontua (seção 6.6).
- **[PENDENTE]** Dado ausente: lista de acordos; o responsável não informou outros torneios com acordo (seção 6.9).
- **[PENDENTE]** Dado ausente: quais torneios foram cancelados e como saber; a etapa 3 não informa o status (seção 3.5).
- **[PENDENTE]** Desempate: a soma de buy-ins inclui re-entradas e bounty? E os critérios 2 a 4 (mesas finais, participações, soma de buy-ins) não têm instrução nova; a ferramenta segue só com o critério 1 (seção 3.5).
- **[PENDENTE]** Qual campo da API corresponde a "entradas" e qual a "entradas + reentradas" (o campo `players` de torneios e flights); a verificar na medição (seção 6.2).
- **[PENDENTE]** Os dois rankings (só entradas; entradas e reentradas) valem também por etapa, ou só no ranking geral? O usuário não respondeu (seção 2, item 8).
- **[PENDENTE]** Decisão do usuário sobre o cenário do fator 0,9: ele não substitui o 1,0 até lá (seção 2, item 8).

## 10. Glossário

- **Buy-in:** valor de entrada do torneio, em R$.
- **Field:** número de participantes do torneio, em duas versões: só entradas (inscritos) e entradas + reentradas (ações totais) (seção 2, item 8). O campo da API de cada uma está pendente (seção 6.2). Antes: "número de inscritos; o site conta só buy-ins".
- **Cenário 0,9:** conta pedida com fator 0,9 na faixa de R$ 0 a R$ 1.000, lado a lado com o 1,0. Não é regra (seção 2, item 8).
- **ITM (In The Money):** jogadores premiados no torneio.
- **Flight:** dia classificatório de um torneio com vários dias (ex.: "Main Event 400k Dia 1D"). Pontua só por participação (seção 6.4).
- **Re-entry:** nova entrada do mesmo jogador no mesmo torneio.
- **Bounty / KO:** prêmio por eliminar outro jogador. Não cria pontos nem define ITM, mas entra no buy-in total usado no fator de buy-in (seção 3.4). **[CONFIRMADO 05/11/2026]** Antes: "não entra na pontuação do ranking".
- **Main Event:** torneio principal da série, marcado com estrela no ranking. Multiplicador 1,0.
- **Etapa:** cada fase do ranking. A etapa 1 não é referência absoluta (contém erros; antes: referência correta).
- **Auditor:** função principal da ferramenta nesta fase: encontrar erros no ranking publicado.
- **Cálculo normal:** dos dados do torneio para os pontos esperados.
- **Cálculo inverso:** dos pontos registrados para os fatores, a posição e o field que os gerariam.
