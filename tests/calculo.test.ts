import { describe, expect, it } from "vitest";
import { calcular } from "../lib/calculo";
import { REGRAS_PADRAO, type Regras } from "../lib/regras";

const fixos: Regras = { ...REGRAS_PADRAO, foraDoItm: "10fixos" };
// premiados alto = todo mundo no ITM; premiados 0 / prize 0 = fora do ITM.
const itm = (buyIn: number, field: number, posicao: number, r = REGRAS_PADRAO, premiados = 9999) =>
  calcular({ posicao, prize: 1, buyIn, field, premiados }, r).esperado;
const fora = (buyIn: number, field: number, posicao: number, r = REGRAS_PADRAO) =>
  calcular({ posicao, prize: 0, buyIn, field, premiados: 0 }, r).esperado;

describe("foraDoItm=10fixos (calculadora do site)", () => {
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
  ])("buy-in %i field %i pos %i → %d", (b, f, p, esp) => expect(itm(b, f, p, fixos)).toBe(esp));
  it("fora do ITM → 10", () => {
    const c = calcular({ posicao: 50, prize: 0, buyIn: 1000, field: 100, premiados: 20 }, fixos);
    expect(c.esperado).toBe(10);
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

describe("aritmética exata", () => {
  it("devolve centésimos inteiros", () => {
    const c = calcular({ posicao: 1, prize: 1, buyIn: 1001, field: 137, premiados: 99 }, REGRAS_PADRAO);
    expect(Number.isInteger(c.esperadoCent)).toBe(true);
    expect(c.esperadoCent).toBe(224400) // 2244,00 pontos;
  });
});
