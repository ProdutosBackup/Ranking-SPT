import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ABAS, ACOES, ACORDO, ATALHOS, BARRA_ITENS, CAMPO, PARTICIPACAO, CONSOLIDADO_ITENS, CONTA_BLOCOS_ORDEM, ENDERECO, ENDERECO_EXTRA, PAINEL_BLOCOS_ORDEM, PLANILHA_ITENS, SECOES_RESUMO, TEXTOS_PLANILHA,
} from "../app/components/estrutura";

// Estrutura aprovada pelo usuário em 19/10/2026 (docs/interface.md). Mudar qualquer item abaixo exige autorização explícita.
const TRAVADA = "Estrutura da tela travada: alteração exige autorização do usuário.";

describe("estrutura da tela travada", () => {
  it("abas: nomes e ordem", () => {
    expect(
      ABAS.map((a) => a.rotulo),
      TRAVADA,
    ).toEqual(["Resumo", "Erros", "Divergências de inscritos", "Jogadores", "Torneios", "Aguardando regra", "Regras"]);
    expect(ABAS.map((a) => a.id), TRAVADA).toEqual(["resumo", "erros", "divergencias", "jogadores", "torneios", "aguardando", "regras"]);
    expect(ABAS.filter((a) => a.comContador).map((a) => a.id), TRAVADA).toEqual(["erros", "divergencias", "jogadores", "torneios", "aguardando"]);
  });

  it("barra superior: itens e ordem", () => {
    expect(BARRA_ITENS, TRAVADA).toEqual(["Etapa", "Auditar etapa", "Enviar planilha", "Baixar relatório", "Exportar dados", "Consolidado", "Faixa de confiança"]);
  });

  // Itens acrescentados com autorização do usuário em 21/10/2026 (envio de planilha).
  it("envio de planilha: marca, confirmação, bloco de resumo e textos de origem", () => {
    expect(PLANILHA_ITENS, TRAVADA).toEqual([
      "Planilha carregada", "Remover planilha", "Remover a planilha para todos?", "Sim", "Não", "O que foi lido", "Premiados inferidos pelos pontos da planilha",
    ]);
    expect(TEXTOS_PLANILHA.faixa("a.xlsx", "21/10/2026 14:00"), TRAVADA).toBe("Dados da planilha a.xlsx, enviada em 21/10/2026 14:00 (Brasília)");
    expect(TEXTOS_PLANILHA.mudou, TRAVADA).toBe("A planilha foi trocada ou removida depois desta auditoria. Audite de novo.");
  });

  // Itens acrescentados com autorização do usuário em 21/10/2026 (Consolidado).
  it("consolidado: seletor de etapa, busca, saída, texto sem dados e colunas fixas da tabela", () => {
    expect(CONSOLIDADO_ITENS, TRAVADA).toEqual(["Etapa", "Buscar jogador", "Voltar à auditoria", "Sem dados nesta etapa", "Posição", "Jogador", "Pontos acumulados"]);
  });

  // Itens acrescentados com autorização do usuário em 21/10/2026 (participação de flight e ações por torneio).
  it("participação de flight: nome, explicação, bloco da aba Regras, motivos da aba Aguardando e texto vazio", () => {
    expect(
      [PARTICIPACAO.rotulo, PARTICIPACAO.explicacao, PARTICIPACAO.bloco, PARTICIPACAO.regra, PARTICIPACAO.fonte, PARTICIPACAO.comPosicao, PARTICIPACAO.vazioAguardando],
      TRAVADA,
    ).toEqual([
      "Participação de flight",
      "Vale 10 × fatores com o campo em ações (buy-ins + re-entries). Sem as ações do flight, ou sem posição no Dia Final, aguarda regra.",
      "Participação nos flights",
      "Os flights pagam 10 × fator de participantes × fator de buy-in, com o campo do flight igual às ações (buy-ins + re-entries). Exemplo: 126 ações e buy-in R$ 1.000 dão 10 × 1,76 × 1 = 17,6. Quando as ações do flight não são conhecidas, o resultado aguarda regra.",
      "Fonte: decisão do responsável do ranking, confirmada em 21/10/2026. O site contou só buy-ins na Etapa 2; segundo a decisão, o campo correto é ações.",
      "Com posição",
      "Nenhum resultado aguardando regra.",
    ]);
    expect([PARTICIPACAO.motivoFlight, PARTICIPACAO.motivoDiaFinal], TRAVADA).toEqual([
      "faltam as ações deste flight",
      "não se sabe em qual flight o jogador jogou, então o multiplicador não pode ser calculado; o site pagou 10",
    ]);
  });

  it("opção de regra: campo do torneio (inscritos por padrão, ou ações)", () => {
    expect([CAMPO.rotulo, CAMPO.inscritos, CAMPO.acoes], TRAVADA).toEqual(["Campo do torneio", "Inscritos (só buy-ins)", "Ações (buy-ins + re-entries)"]);
  });

  it("aba Torneios: colunas de buy-ins, re-entries e ações", () => {
    expect([ACOES.buyIns, ACOES.reentries, ACOES.acoes, ACOES.naoInformado], TRAVADA).toEqual(["Buy-ins", "Re-entries", "Ações", "não informado pelo site"]);
  });

  // Itens acrescentados com autorização do usuário em 21/10/2026 (acordo).
  it("acordo: caixa e campo do painel, aviso, conta, marcação nas telas e texto da faixa de confiança", () => {
    expect([ACORDO.rotulo, ACORDO.pergunta, ACORDO.aplicar, ACORDO.desfazer, ACORDO.sim, ACORDO.nao, ACORDO.contaTitulo, ACORDO.soma], TRAVADA).toEqual([
      "Acordo", "Acordo entre quantas pessoas?", "Aplicar", "Desfazer o acordo para todos?", "Sim", "Não", "Conta com acordo", "Soma",
    ]);
    expect([ACORDO.aviso(3), ACORDO.torneio(3), ACORDO.faixa(2), ACORDO.causa(2, "3.429")], TRAVADA).toEqual([
      "Este torneio tem acordo entre 3 pessoas", "Acordo: 3 pessoas", "Acordos aplicados: 2 torneio(s)", "Acordo entre 2 jogadores: cada um recebe 3.429",
    ]);
  });

  it("aba Resumo: seções e ordem", () => {
    expect(SECOES_RESUMO.map((s) => s.nome), TRAVADA).toEqual(["Veredito", "Indicadores", "Composição", "Principais causas", "Torneios com problema"]);
  });

  it("painel lateral: blocos e ordem", () => {
    expect(PAINEL_BLOCOS_ORDEM, TRAVADA).toEqual(["Resultado", "Conta correta", "Registrado no site", "Hipótese da causa"]);
  });

  it("conta: três blocos e o resultado", () => {
    expect(CONTA_BLOCOS_ORDEM, TRAVADA).toEqual(["Base da posição", "Fator de participantes", "Fator de buy-in", "Pontos corretos"]);
  });

  it("endereço: parâmetros", () => {
    expect({ ...ENDERECO }, TRAVADA).toEqual({ etapa: "etapa", aba: "aba", causa: "causa", torneio: "torneio", busca: "busca", ordem: "ordem", item: "ver" });
    expect({ ...ENDERECO_EXTRA }, TRAVADA).toEqual({ soErro: "soerro", visao: "visao" });
  });

  it("atalhos de teclado do painel", () => {
    expect(
      Object.values(ATALHOS).map((a) => [a.simbolo, a.tecla]),
      TRAVADA,
    ).toEqual([["←", "ArrowLeft"], ["→", "ArrowRight"], ["Esc", "Escape"]]);
  });

  it("os componentes continuam importando a estrutura (sem nomes duplicados à mão)", () => {
    for (const arq of ["page.tsx", "components/Barra.tsx", "components/Erros.tsx", "components/Outras.tsx", "components/Painel.tsx", "components/Planilha.tsx", "components/Consolidado.tsx", "components/Acordo.tsx", "components/Resumo.tsx", "components/Detalhe.tsx"])
      expect(readFileSync(`app/${arq}`, "utf8"), `${TRAVADA} (${arq} deve importar app/components/estrutura.ts)`).toMatch(/from "(\.\/|\.\/components\/)estrutura"/);
    const page = readFileSync("app/page.tsx", "utf8");
    for (const nome of ["Divergências de inscritos", "Aguardando regra"]) expect(page, `${TRAVADA} ("${nome}" deve vir de estrutura.ts)`).not.toContain(`"${nome}"`);
  });
});
