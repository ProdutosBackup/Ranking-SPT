import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ABAS, ATALHOS, BARRA_ITENS, CONTA_BLOCOS_ORDEM, ENDERECO, ENDERECO_EXTRA, PAINEL_BLOCOS_ORDEM, SECOES_RESUMO,
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
    expect(BARRA_ITENS, TRAVADA).toEqual(["Etapa", "Satélites contam pontos?", "Auditar etapa", "Baixar relatório", "Exportar dados", "Faixa de confiança"]);
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
    expect({ ...ENDERECO_EXTRA }, TRAVADA).toEqual({ satelites: "sat", soErro: "soerro" });
  });

  it("atalhos de teclado do painel", () => {
    expect(
      Object.values(ATALHOS).map((a) => [a.simbolo, a.tecla]),
      TRAVADA,
    ).toEqual([["←", "ArrowLeft"], ["→", "ArrowRight"], ["Esc", "Escape"]]);
  });

  it("os componentes continuam importando a estrutura (sem nomes duplicados à mão)", () => {
    for (const arq of ["page.tsx", "components/Barra.tsx", "components/Erros.tsx", "components/Outras.tsx", "components/Painel.tsx", "components/Resumo.tsx", "components/Detalhe.tsx"])
      expect(readFileSync(`app/${arq}`, "utf8"), `${TRAVADA} (${arq} deve importar app/components/estrutura.ts)`).toMatch(/from "(\.\/|\.\/components\/)estrutura"/);
    const page = readFileSync("app/page.tsx", "utf8");
    for (const nome of ["Divergências de inscritos", "Aguardando regra"]) expect(page, `${TRAVADA} ("${nome}" deve vir de estrutura.ts)`).not.toContain(`"${nome}"`);
  });
});
