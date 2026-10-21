import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ABAS, ATALHOS, BARRA_ITENS, CONTA_BLOCOS_ORDEM, ENDERECO, ENDERECO_EXTRA, PAINEL_BLOCOS_ORDEM, PLANILHA_ITENS, SECOES_RESUMO, TEXTOS_PLANILHA,
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
    expect(BARRA_ITENS, TRAVADA).toEqual(["Etapa", "Auditar etapa", "Enviar planilha", "Baixar relatório", "Exportar dados", "Faixa de confiança"]);
  });

  // Itens acrescentados com autorização do usuário em 21/10/2026 (envio de planilha).
  it("envio de planilha: marca, confirmação, bloco de resumo e textos de origem", () => {
    expect(PLANILHA_ITENS, TRAVADA).toEqual([
      "Planilha carregada", "Remover planilha", "Remover a planilha para todos?", "Sim", "Não", "O que foi lido", "Premiados inferidos pelos pontos da planilha",
    ]);
    expect(TEXTOS_PLANILHA.faixa("a.xlsx", "21/10/2026 14:00"), TRAVADA).toBe("Dados da planilha a.xlsx, enviada em 21/10/2026 14:00 (Brasília)");
    expect(TEXTOS_PLANILHA.mudou, TRAVADA).toBe("A planilha foi trocada ou removida depois desta auditoria. Audite de novo.");
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
    expect({ ...ENDERECO_EXTRA }, TRAVADA).toEqual({ soErro: "soerro" });
  });

  it("atalhos de teclado do painel", () => {
    expect(
      Object.values(ATALHOS).map((a) => [a.simbolo, a.tecla]),
      TRAVADA,
    ).toEqual([["←", "ArrowLeft"], ["→", "ArrowRight"], ["Esc", "Escape"]]);
  });

  it("os componentes continuam importando a estrutura (sem nomes duplicados à mão)", () => {
    for (const arq of ["page.tsx", "components/Barra.tsx", "components/Erros.tsx", "components/Outras.tsx", "components/Painel.tsx", "components/Planilha.tsx", "components/Resumo.tsx", "components/Detalhe.tsx"])
      expect(readFileSync(`app/${arq}`, "utf8"), `${TRAVADA} (${arq} deve importar app/components/estrutura.ts)`).toMatch(/from "(\.\/|\.\/components\/)estrutura"/);
    const page = readFileSync("app/page.tsx", "utf8");
    for (const nome of ["Divergências de inscritos", "Aguardando regra"]) expect(page, `${TRAVADA} ("${nome}" deve vir de estrutura.ts)`).not.toContain(`"${nome}"`);
  });
});
