# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

Calculator that checks the Suprema Poker Tour (SPT) ranking scores. Stack: Next.js (App Router) + TypeScript for the page and server routes, ExcelJS to generate the Excel output. The project is currently a bare scaffold: only `app/api/health/route.ts` is custom, and there is no business logic yet.

## Commands

- `npm run dev` — dev server on :3000 (check with `curl localhost:3000/api/health` → `{"ok":true}`)
- `npm run build` — production build, includes the TypeScript check
- No lint or test scripts are configured.

## Next.js version

`next` is 16.x with breaking changes versus older versions. `AGENTS.md` requires reading the relevant guide in `node_modules/next/dist/docs/` before writing Next code.

## Why server routes

The public SPT API (`https://supremapokertour.com/api/spt/`) sends no `Access-Control-*` headers, so browsers cannot call it cross-origin. All calls to it must go through Next route handlers (`app/api/**/route.ts`), never from client code.

## SPT API facts (verified by inspection, not derivable from code)

Endpoints, all GET, `stage` is `taua-2026` (stage 1) or `vale-suico-2026` (stage 2):
- `/tournaments?stage=` — without `stage` it returns the current stage (2).
- `/ranking?stage=` → `{updatedAt, ranking:[{rank,name,avatarUrl,points,tournaments,breakdown:[{tournamentId,tournamentName,position,points,factor}]}]}`
- `/player-summary?stage=&name=` → `{name,totalPoints,tournaments,results:[{tournamentId,tournamentName,position,points,prize,stage}]}`; `tournaments[].id` equals `tournamentId`.

Gotchas:
- Wrong `stage`, unknown name, wrong case or missing accents all return HTTP 200 with empty data. `name` must match the ranking exactly, passed through `encodeURIComponent`.
- Stage 1 results list every player of each tournament (rows = `players`). Stage 2 lists only players who scored, so `players` is the only source of the field size. Stage 2 flights (Dia 1A–1E), satellites, Ladies and HORSE have no result rows.
- Stage 2 "Main Event SPT — Dia Final" (`role=FINAL`) has 190 rows for `players=92`: 64 with `position`, 126 with `position=null` and `points=10`. `prize` is `null` (not 0) for some rows with `points=10`.
- Flights are marked by `role=FLIGHT` + `flightLabel` only in stage 2; stage 1 uses `STANDALONE` and the name ("Dia 1A/1C/1D/1E"; there is no 1B).
- Stage 1 API `players` (Final Main Event 135, 200k High Roller 85) does not match the field values used in the reverse calculation (334 and 67).
- Scoring formula under validation: `Points = Base_Position × Factor_Participants × Factor_BuyIn`, with `Factor_Participants = n/100 + 0.5`. Stage 1 is known correct; stage 2 has errors on unknown points.

## Interface travada

A estrutura descrita em docs/interface.md e em app/components/estrutura.ts não pode ser alterada (nomes, ordem, abas, seções, blocos, parâmetros do endereço, atalhos) sem autorização explícita do usuário na conversa. Ajustes de cores, espaçamento e acabamento visual são permitidos desde que a estrutura e o teste tests/interface.test.ts continuem iguais. Se uma tarefa exigir mudar a estrutura, pare e pergunte antes.

Alteração autorizada em 21/10/2026 (autorização do usuário: "Satélites não contam pontos, então pode tirar aquela opção."): removidos da estrutura o controle "Satélites contam pontos?" da barra superior e o parâmetro `sat` do endereço (um `?sat=` antigo é ignorado). Satélites são fixos como "não pontua" (`VERSAO_REGRAS` 1.2). A autorização vale só para esse item.

Alteração autorizada em 21/10/2026 (autorização do usuário para o envio de planilha): acrescentados à estrutura (a) o botão "Enviar planilha" na barra superior, ao lado de "Auditar etapa", em estilo secundário; (b) a marca "Planilha carregada" com o botão X ("Remover planilha") e a confirmação "Remover a planilha para todos? Sim / Não"; (c) o texto da faixa de confiança quando a origem for planilha; (d) o texto do aviso de "dados mudaram" quando a origem for planilha; (e) o bloco "O que foi lido" com o resumo da planilha. Estão em `PLANILHA`, `TEXTOS_PLANILHA` e `BARRA` (estrutura.ts) e no tests/interface.test.ts. A autorização vale só para esses itens.
