# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

Calculator that checks the Suprema Poker Tour (SPT) ranking scores. Stack: Next.js (App Router) + TypeScript for the page and server routes, ExcelJS to generate the Excel output. The project is a working auditor: it reads the SPT results (the public API, or an uploaded spreadsheet for stage 3), recomputes every result with two independent calculations (the engine and the verifier), lists the errors with a probable cause, generates the Relatório and Exportação Excel files, and shows an accumulated Consolidado with the four scenarios A to D.

## Commands

- `npm run dev` — dev server on :3000 (check with `curl localhost:3000/api/health` → `{"ok":true}`)
- `npm run build` — production build, includes the TypeScript check
- `npm start` — serves the production build
- `npm test` — `vitest run --testTimeout=20000` (20 s per test). `vitest.config.ts` loads `tests/isolar-armazenamento.ts`, so the tests use temporary folders and never touch `.acordos-local/` or `.planilha-local/`. The tests read fixtures from `tests/fixtures/` and do not call the real API. Node 22.x (`engines` in `package.json`).
- No lint script is configured.

## Next.js version

`next` is 16.x with breaking changes versus older versions. `AGENTS.md` requires reading the relevant guide in `node_modules/next/dist/docs/` before writing Next code.

## Why server routes

The public SPT API (`https://supremapokertour.com/api/spt/`) sends no `Access-Control-*` headers, so browsers cannot call it cross-origin. All calls to it must go through Next route handlers (`app/api/**/route.ts`), never from client code.

## SPT API facts (verified by inspection, not derivable from code)

Endpoints, all GET, `stage` is `taua-2026` (stage 1), `vale-suico-2026` (stage 2) or `bendito-cacao-2026` (stage 3):
- `/tournaments?stage=` — without `stage` it returns the current stage, which today is stage 2 (same tournament ids as `stage=vale-suico-2026`; `/ranking` and `/player-summary` also default to stage 2). Checked against the live API on 06/11/2026; if the API moves to a new current stage this changes, so always pass `stage`.
- `/ranking?stage=` → `{updatedAt, ranking:[{rank,name,avatarUrl,points,tournaments,breakdown:[{tournamentId,tournamentName,position,points,factor}]}]}`
- `/player-summary?stage=&name=` → `{name,totalPoints,tournaments,results:[{tournamentId,tournamentName,position,points,prize,stage}]}`; `tournaments[].id` equals `tournamentId`.

Gotchas:
- Wrong `stage`, unknown name, wrong case or missing accents all return HTTP 200 with empty data. `name` must match the ranking exactly, passed through `encodeURIComponent`.
- Stage 1 results list every player of each tournament (rows = `players`). Stage 2 lists only players who scored, so `players` is the only source of the field size. Stage 2 flights (Dia 1A–1E), satellites, Ladies and HORSE have no result rows.
- Stage 2 "Main Event SPT — Dia Final" (`role=FINAL`) has 190 rows for `players=92`: 64 with `position`, 126 with `position=null` and `points=10`. `prize` is `null` (not 0) for some rows with `points=10`.
- Flights are marked by `role=FLIGHT` + `flightLabel` (1A to 1E) in stages 2 and 3; stage 1 uses `STANDALONE` and the name ("Dia 1A/1C/1D/1E"; there is no 1B).
- Stage 3 has tournaments but no results in the API: `/ranking?stage=bendito-cacao-2026` returns `{"ranking":[]}` with HTTP 200 (the tool reports "Esta etapa ainda não tem ranking publicado." when there is no spreadsheet; `MSG_SEM_RANKING` in `lib/api-spt.ts`). The stage 3 results come from the .xlsx spreadsheet uploaded through the tool itself (`POST /api/planilha`): one file, shared by everyone, kept in `.planilha-local/` in development or in Vercel Blob in production (`lib/armazenamento-planilha.ts`, `ETAPA_PLANILHA`; `lib/executar.ts` uses it for stage 3 while it exists). The tool still reads `/tournaments?stage=bendito-cacao-2026` by name for the stage 3 flights (their `players` sum is the Main Event field: 77+64+55+67+65 = 328) and for each K.O or Mystery tournament's bounty (`flightsDe`, `bountyDoSite` in `lib/planilha-guardada.ts`). The Dia Final field is the flights' sum; if the site lists no flights, the value typed on upload, then the spreadsheet's.
- Stages 1 and 2 also accept an uploaded spreadsheet, but only for the actions (Buy In + Rebuy/Reentry per tournament, cenários C and D): results, points and errors still come from the site. The stage is read from the title (A1 of the Consolidado tab); one file per stage (`.planilha-local/planilha-<slug>.xlsx` + `registro-<slug>.json`, or `planilha/<slug>.*` in Blob; stage 3 keeps the old names), `POST /api/planilha`, `GET/DELETE /api/planilha?etapa=<slug>`. Tabs are matched to the API tournaments by normalized name (`lib/planilha-acoes.ts`); Main Event flights/Dia Final are not merged, ambiguous matches do not match. `identificador().sha256` covers the actions; `sha256Dados` (key of the "revisado" marks) does not.
- Stage 1 API `players` (Final Main Event 135, 200k High Roller 85) does not match the field values used in the reverse calculation (334 and 67).
- Main Event (`VERSAO_REGRAS` 2.9, user decision 06/11/2026, replaces the 05/11 rule that moved the Dia Final points to the first flight): every line is evaluated by itself. The player's first flight is participation (10 × factors), other flights are 0, and the Dia Final line scores by its own position. No points move between lines; a flight line whose site value differs from the expected one is an error. Field: stage 1 uses 334 on every Main Event line (user-provided, `CAMPO_MAIN_EVENT` in `lib/regras.ts`; the API flights sum to 202, the spreadsheets to 358), so a stage 1 participation line is 10 × 3.84 × 1 = 38.4; other stages use the sum of the flights' `players`.
- Scoring formula applied: `Points = Base_Position × Factor_Participants × Factor_BuyIn`, with `Factor_Participants = n/100 + 0.5`; outside the prizes the base is 10 (10 × factors) and after 18th place every paid position has base 100. The rules and their status are in `docs/compendio.md`.

## Interface travada

A estrutura está descrita em docs/interface.md e em app/components/estrutura.ts, e protegida por tests/interface.test.ts. Em 05/11/2026 o usuário liberou a interface (estrutura.ts, tests/interface.test.ts, docs/interface.md) para alterações, desde que o dinamismo dos cards seja preservado; os três mudam juntos. Painel lateral e aba Jogadores: só cores e fontes.

Alteração autorizada em 21/10/2026 (autorização do usuário: "Satélites não contam pontos, então pode tirar aquela opção."): removidos da estrutura o controle "Satélites contam pontos?" da barra superior e o parâmetro `sat` do endereço (um `?sat=` antigo é ignorado). Satélites são fixos como "não pontua" (`VERSAO_REGRAS` 1.2). A autorização vale só para esse item.

Alteração autorizada em 21/10/2026 (autorização do usuário para o envio de planilha): acrescentados à estrutura (a) o botão "Enviar planilha" na barra superior, ao lado de "Auditar etapa", em estilo secundário; (b) a marca "Planilha carregada" com o botão X ("Remover planilha") e a confirmação "Remover a planilha para todos? Sim / Não"; (c) o texto da faixa de confiança quando a origem for planilha; (d) o texto do aviso de "dados mudaram" quando a origem for planilha; (e) o bloco "O que foi lido" com o resumo da planilha. Estão em `PLANILHA`, `TEXTOS_PLANILHA` e `BARRA` (estrutura.ts) e no tests/interface.test.ts. A autorização vale só para esses itens.

Alteração autorizada em 21/10/2026 (autorização do usuário para o Consolidado): acrescentados à estrutura o botão "Consolidado" na barra superior (separado das abas), o seletor de etapa da visão (com "Sem dados nesta etapa" para a Etapa 3 sem dados), a busca e a tabela do ranking correto acumulado, e o parâmetro de endereço `visao`. Estão em `BARRA`, `ENDERECO_EXTRA` e `CONSOLIDADO` (estrutura.ts) e no tests/interface.test.ts. A autorização vale só para esses itens.

Alteração autorizada em 21/10/2026 (autorização do usuário para participação de flight e ações por torneio): acrescentados à estrutura (a) a categoria "Participação de flight" (nome, explicação, causa e presença nas linhas e filtros), no lugar do "Aguardando regra" para flights e Dia Final sem posição; (b) os campos separados "Com posição" e "Participação de flight" do Dia Final na aba Torneios; (c) as colunas Buy-ins, Re-entries e Ações da aba Torneios (e do Excel); (d) o bloco "Participação nos flights" da aba Regras; (e) o texto "Nenhum resultado aguardando regra." da aba Aguardando regra vazia. Estão em `PARTICIPACAO` e `ACOES` (estrutura.ts, vindos de lib/participacao.ts) e no tests/interface.test.ts. A autorização vale só para esses itens. `VERSAO_REGRAS` 1.3.

Alteração autorizada em 21/10/2026 (autorização do usuário, decisão do responsável do ranking, que substitui a anterior de "10 pontos fixos"): flights e Dia Final sem posição voltam a "Aguardando regra" com dois motivos ("faltam as ações deste flight" e "não se sabe em qual flight o jogador jogou…"), mantendo a etiqueta "Participação de flight"; flight com ações conhecidas vale 10 × fatores com o campo = ações. Acrescentada a opção de regra "Campo do torneio" (inscritos por padrão, ou ações; parâmetro `campo` da API), os textos dos motivos e o bloco "Participação nos flights" da aba Regras. Estão em `PARTICIPACAO` e `CAMPO` (estrutura.ts, vindos de lib/participacao.ts) e no tests/interface.test.ts. A autorização vale só para esses itens. `VERSAO_REGRAS` 1.4.

Alteração de 06/11/2026 (interface liberada pelo usuário): a opção de regra "Campo do torneio" (inscritos ou ações; parâmetro `campo`, constante `CAMPO`) foi removida, porque os cenários A a D a substituem: "Pontos corretos" usa só as entradas (cenário A) e os números em ações são os cenários C e D. Um `?campo=` antigo é ignorado. Substitui o trecho do item de 21/10/2026 sobre essa opção. `VERSAO_REGRAS` não mudou (nenhum resultado muda).

Alteração autorizada em 21/10/2026 (autorização do usuário para o acordo por torneio): acrescentados à estrutura (a) a caixa "Acordo" e o campo "Acordo entre quantas pessoas?" com o botão "Aplicar" no rodapé do painel; (b) o bloco "Conta correta" com a conta do acordo passo a passo e o aviso "Este torneio tem acordo entre N pessoas"; (c) a marcação "Acordo" nas linhas, na aba Torneios e nos Excel; (d) o texto "Acordos aplicados: N torneio(s)" na faixa de confiança. Estão em `ACORDO` (estrutura.ts, vindo de lib/acordo.ts) e no tests/interface.test.ts. A autorização vale só para esses itens. O desempate não muda.

Alteração autorizada em 21/10/2026 (autorização do usuário para refazer o acordo; substitui a pergunta, o lugar e os textos do item anterior): o acordo passa a ter só a pergunta "Pontuam como qual colocação?" (K; as posições 1 a K pontuam como o Kº colocado, e o registro guarda só K). Na estrutura: (a) a caixa saiu do rodapé, que voltou a ter só Anterior, Próximo e Marcar como revisado; (b) o cartão "Acordo" no corpo do painel, logo abaixo de "Conta correta", com a caixa "Houve acordo neste torneio", o campo "Pontuam como qual colocação?" com a dica e o botão "Aplicar", o resumo "Acordo: os K primeiros pontuam como Kº colocado", o link "Remover acordo" com a confirmação "Remover o acordo deste torneio para todos? Remover / Cancelar" e o aviso "Este torneio tem acordo: os K primeiros pontuam como Kº colocado" para quem está fora das posições 1 a K; (c) "Acordo: pontua como Kº colocado" na Conta correta; (d) as marcações "Os K primeiros, como Kº colocado" nas telas e nos Excel. Estão em `ACORDO` (estrutura.ts, vindo de lib/acordo.ts) e no tests/interface.test.ts. A autorização vale só para esses itens. O desempate não muda.
