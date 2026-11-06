import { describe, expect, it } from "vitest";
import { fb100 } from "../lib/calculo";
import { faixaDe } from "../lib/painel";
import { REGRAS_PADRAO } from "../lib/regras";
import { fatorBuyIn100 } from "../lib/verificador";

// Fator por buy-in [CONFIRMADO 05/11/2026]: até 1.000 = 1,0; até 1.999 = 1,2; até 2.999 = 1,5; acima = 2,5. Centavos acima do limite passam para a faixa seguinte.
const CASOS: [number, number, string][] = [
  [250, 1, "de R$ 0 a R$ 1.000"],
  [500, 1, "de R$ 0 a R$ 1.000"],
  [1000, 1, "de R$ 0 a R$ 1.000"],
  [1000.5, 1.2, "de R$ 1.001 a R$ 1.999"],
  [1001, 1.2, "de R$ 1.001 a R$ 1.999"],
  [1999, 1.2, "de R$ 1.001 a R$ 1.999"],
  [1999.5, 1.5, "de R$ 2.000 a R$ 2.999"],
  [2000, 1.5, "de R$ 2.000 a R$ 2.999"],
  [2999, 1.5, "de R$ 2.000 a R$ 2.999"],
  [2999.5, 2.5, "R$ 3.000 ou mais"],
  [3000, 2.5, "R$ 3.000 ou mais"],
];
// A faixa do painel é um rótulo; o fator dela vem da tabela do próprio painel/motor (uma amostra por faixa).
const FATOR_DA_FAIXA: Record<string, number> = {
  "de R$ 0 a R$ 1.000": 1,
  "de R$ 1.001 a R$ 1.999": 1.2,
  "de R$ 2.000 a R$ 2.999": 1.5,
  "R$ 3.000 ou mais": 2.5,
};

describe("fator de buy-in: motor, verificador e painel concordam", () => {
  it.each(CASOS)("buy-in %d → fator %d", (buyIn, fator, faixa) => {
    expect(fb100(buyIn, REGRAS_PADRAO) / 100, "motor (calculo.ts)").toBe(fator);
    expect(fatorBuyIn100(buyIn, REGRAS_PADRAO.fatorFaixaAte1000) / 100, "verificador (verificador.ts)").toBe(fator);
    expect(faixaDe(buyIn), "painel (painel.ts)").toBe(faixa);
    expect(FATOR_DA_FAIXA[faixaDe(buyIn)]).toBe(fator);
  });
  it("o fator da faixa até R$ 1.000 é parametrizável, igual no motor e no verificador (padrão 1,0)", () => {
    expect(REGRAS_PADRAO.fatorFaixaAte1000).toBe(1);
    for (const b of [0, 250, 500, 1000]) expect(fb100(b, { ...REGRAS_PADRAO, fatorFaixaAte1000: 0.9 })).toBe(fatorBuyIn100(b, 0.9));
  });
});
