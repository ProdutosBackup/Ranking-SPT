# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Responsável do ranking e equipe da organização do Suprema Poker Tour (SPT). Usam a ferramenta depois que os resultados de cada etapa saem, para conferir a pontuação do ranking e decidir as regras que ainda estão pendentes. Uso interno, em português do Brasil, em desktop e também em celular (375 px).

## Product Purpose
Confere a pontuação do ranking do SPT contra a regra oficial, mostra onde o site diverge (com a conta passo a passo e a causa provável, sempre como hipótese) e produz o ranking correto acumulado. Sucesso, nesta ordem confirmada: achar todo erro de pontuação; entregar relatório em Excel; ter o ranking correto acumulado (Consolidado) como referência.

## Positioning
Não publica nem substitui o ranking do site: recalcula cada resultado com um segundo cálculo independente (`Pontos = Base da posição × Fator de participantes × Fator de buy-in`) e mostra a diferença para o valor registrado, sem afirmar que o site esteja errado quando a causa é só uma hipótese.

## Operating Context
- Fonte dos dados: API pública do SPT (`supremapokertour.com/api/spt/`), chamada só por rotas do servidor (sem CORS no navegador). Etapa 1 (Tauá) é a referência; Etapa 2 (Vale Suíço); a Etapa 3 entra por planilha .xlsx enviada pela equipe.
- Acesso: link compartilhado, sem login. Planilha enviada e acordos por torneio ficam salvos no servidor e valem para todos.
- Saídas: tela de auditoria, Relatório e Exportação em Excel, Consolidado.
- Regras ainda em decisão ficam em "Aguardando regra" (flights, Dia Final sem posição, campo do torneio) até o responsável do ranking decidir.

## Capabilities and Constraints
- Estrutura da tela travada em `docs/interface.md`, `app/components/estrutura.ts` e `tests/interface.test.ts`: nomes, ordem, abas, seções, blocos, parâmetros do endereço e atalhos só mudam com autorização explícita do usuário na conversa. Mudanças de cor, espaçamento e acabamento são permitidas.
- Painel lateral do resultado e aba Jogadores: por decisão do usuário, só cores e fontes podem mudar (nenhum layout, texto ou comportamento).
- Nomes de jogador e de torneio, números e causas aparecem exatamente como vêm da fonte; a comparação com o site depende disso.
- Dados nunca são inventados; resultados aguardando regra ficam fora da soma do Consolidado.
- Stack: Next.js 16 (App Router) + TypeScript, ExcelJS para o Excel. O Next 16 tem mudanças incompatíveis; ler o guia em `node_modules/next/dist/docs/` antes de escrever código Next (`AGENTS.md`).
- Em aberto: arquivo oficial do logo (hoje PNG de fundo opaco); a equipe do SPT pode fornecer vetor.

## Brand Commitments
- Nome: Suprema Poker Tour; título do app "Auditoria do Ranking — Suprema Poker Tour".
- A paleta em `docs/marca/` (dourado `#DAA763`, creme `#F3F0EB`, grafite `#1A1C1E` e derivadas) foi aprovada pelo usuário. O usuário quer a identidade e a qualidade do site oficial do evento, com tom de ferramenta de auditoria, não de divulgação. O contrato visual proposto está em `docs/DESIGN.md` (rascunho, ainda não aprovado).

## Evidence on Hand
- Dados reais da API pública do SPT, Etapas 1 e 2; planilha da Etapa 3 enviada pela equipe.
- Regulamento de pontuação (tabelas de base e fatores) e decisões do responsável do ranking registradas em `docs/compendio.md` e `docs/interface.md`.
- Sem depoimentos, métricas de uso ou benchmarks; não inventar.

## Product Principles
1. Mostrar a conta, não só o veredito: toda diferença traz o passo a passo que a explica.
2. Causa é hipótese até alguém decidir; a ferramenta nunca declara o site errado sem prova.
3. Dado exato, sem reescrever: o que o site publica aparece como veio.
4. Uma decisão registrada vale para todos e aparece nas telas e nos Excel.
5. Estrutura estável: quem usa a ferramenta não deve reaprender onde as coisas estão.

## Accessibility & Inclusion
Precisa funcionar em celular (375 px). Estado nunca só por cor. Sem requisito de padrão formal registrado; tratar WCAG AA como piso até o usuário dizer outro.
