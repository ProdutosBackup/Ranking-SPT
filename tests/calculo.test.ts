import { describe, expect, it } from "vitest";
import { buyInParaFator, calcular, fatorBuyIn } from "../lib/calculo";
import { buyInTotalVerificador } from "../lib/verificador";
import { REGRAS_PADRAO, type Regras } from "../lib/regras";

// premiados alto = todo mundo no ITM; premiados 0 / prize 0 = fora do ITM.
const itm = (buyIn: number, field: number, posicao: number, r = REGRAS_PADRAO, premiados = 9999) =>
  calcular({ posicao, prize: 1, buyIn, field, premiados }, r).esperado;
const fora = (buyIn: number, field: number, posicao: number, r = REGRAS_PADRAO) =>
  calcular({ posicao, prize: 0, buyIn, field, premiados: 0 }, r).esperado;

describe("posições premiadas: base da tabela × fatores", () => {
  it.each([
    [1500, 137, 20, 224.4],
    [3000, 67, 9, 877.5],
    [3000, 67, 8, 1023.75],
    [1000, 10, 1, 600],
    [1000, 1000, 1, 10500],
    [1001, 100, 1, 1800],
    [1999, 100, 1, 1800],
    [2999, 100, 1, 2250],
    [3000, 100, 1, 3750],
    [1000, 100, 12, 375],
    [1000, 100, 13, 300],
    [1000, 100, 18, 300],
    [1000, 100, 19, 150],
  ])("buy-in %i field %i pos %i → %d", (b, f, p, esp) => expect(itm(b, f, p)).toBe(esp));
  it("fora do ITM → 10 × fatores (nunca 10 fixos)", () => {
    const c = calcular({ posicao: 50, prize: 0, buyIn: 1000, field: 100, premiados: 20 }, REGRAS_PADRAO);
    expect(c.esperado).toBe(15); // 10 × (100/100 + 0,5) × 1,0
  });
});

describe("padrão base10xFatores (etapa 1)", () => {
  it.each([
    [3000, 67, 2, 2340],
    [3000, 67, 9, 877.5],
    [1000, 334, 3, 2688],
    [1000, 334, 6, 1728],
    [1000, 334, 8, 1344],
    [1000, 334, 24, 384],
    [3000, 26, 1, 1900],
    [3000, 26, 8, 665],
    [2500, 26, 6, 513],
    [250, 100, 12, 375],
  ])("buy-in %i field %i pos %i (ITM) → %d", (b, f, p, esp) => expect(itm(b, f, p)).toBe(esp));
  it.each([
    [3000, 67, 22, 29.25],
    [1000, 334, 76, 38.4],
    [2500, 26, 12, 11.4],
  ])("buy-in %i field %i pos %i sem prêmio → %d", (b, f, p, esp) => expect(fora(b, f, p)).toBe(esp));
});

describe("fator de buy-in dos torneios com bounty, K.O e Mystery (buy-in + bounty)", () => {
  const fatorDe = (t: { buyIn: number; bountyType?: string | null; bountyAmount?: number | null }) => fatorBuyIn(buyInParaFator(t), REGRAS_PADRAO);
  it("MYSTERY 1500 + 1000 → total 2500, fator 1,5", () => {
    expect(buyInParaFator({ buyIn: 1500, bountyType: "MYSTERY", bountyAmount: 1000 })).toBe(2500);
    expect(fatorDe({ buyIn: 1500, bountyType: "MYSTERY", bountyAmount: 1000 })).toBe(1.5);
  });
  it("KO 2000 + 1000 → total 3000, fator 2,5; Super K.O 500 + 500 → total 1000, fator 1,0", () => {
    expect(buyInParaFator({ buyIn: 2000, bountyType: "KO", bountyAmount: 1000 })).toBe(3000);
    expect(fatorDe({ buyIn: 2000, bountyType: "KO", bountyAmount: 1000 })).toBe(2.5);
    expect(buyInParaFator({ buyIn: 500, bountyType: "KO", bountyAmount: 500 })).toBe(1000);
    expect(fatorDe({ buyIn: 500, bountyType: "KO", bountyAmount: 500 })).toBe(1);
  });
  it("NONE com bountyAmount não soma (sem soma em dobro); Etapa 1: buyIn já é o total", () => {
    expect(buyInParaFator({ buyIn: 3000, bountyType: "NONE", bountyAmount: null })).toBe(3000);
    expect(buyInParaFator({ buyIn: 3000, bountyType: "NONE", bountyAmount: 1000 })).toBe(3000);
    expect(buyInParaFator({ buyIn: 3000 })).toBe(3000);
    expect(buyInParaFator({ buyIn: 3000, bountyType: null, bountyAmount: 1000 })).toBe(3000);
  });
  it("KO ou MYSTERY sem bountyAmount → só o buy-in (provisório)", () => {
    expect(buyInParaFator({ buyIn: 2000, bountyType: "KO", bountyAmount: null })).toBe(2000);
    expect(buyInParaFator({ buyIn: 2000, bountyType: "KO" })).toBe(2000);
    expect(fatorDe({ buyIn: 2000, bountyType: "KO" })).toBe(1.5);
  });
  it("o verificador (cópia independente) concorda com o motor em todos os casos", () => {
    const casos = [
      { buyIn: 2000, bountyType: "KO", bountyAmount: 1000 },
      { buyIn: 500, bountyType: "KO", bountyAmount: 500 },
      { buyIn: 1500, bountyType: "MYSTERY", bountyAmount: 1000 },
      { buyIn: 3000, bountyType: "NONE", bountyAmount: null },
      { buyIn: 3000, bountyType: "NONE", bountyAmount: 1000 },
      { buyIn: 3000 },
      { buyIn: 3000, bountyType: null, bountyAmount: 1000 },
      { buyIn: 2000, bountyType: "KO", bountyAmount: null },
      { buyIn: 1500, bountyType: "MYSTERY" },
    ];
    for (const c of casos) expect(buyInTotalVerificador(c), JSON.stringify(c)).toBe(buyInParaFator(c));
  });
  it("NONE 2500 → fator 1,5", () => expect(fatorDe({ buyIn: 2500, bountyType: "NONE", bountyAmount: null })).toBe(1.5));
  // Provisório: bounty sem bountyAmount mantém só o buy-in (1.500 → 1,2).
  it("MYSTERY sem bountyAmount → só o buy-in (provisório)", () => {
    expect(fatorDe({ buyIn: 1500, bountyType: "MYSTERY", bountyAmount: null })).toBe(1.2);
    expect(fatorDe({ buyIn: 1500, bountyType: "MYSTERY" })).toBe(1.2);
  });
  it("calcular usa buyInFator e mantém o buy-in exibido", () => {
    const c = calcular({ posicao: 1, prize: 1, buyIn: 1500, buyInFator: 2500, field: 12, premiados: 6 }, REGRAS_PADRAO);
    expect(c.fatorBuyIn).toBe(1.5);
    expect(c.esperado).toBe(930);
  });
});

describe("aritmética exata", () => {
  it("devolve centésimos inteiros", () => {
    const c = calcular({ posicao: 1, prize: 1, buyIn: 1001, field: 137, premiados: 99 }, REGRAS_PADRAO);
    expect(Number.isInteger(c.esperadoCent)).toBe(true);
    expect(c.esperadoCent).toBe(224400) // 2244,00 pontos;
  });
});
