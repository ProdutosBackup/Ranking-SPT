import type { Regras } from "./regras";

export type EntradaCalculo = {
  posicao: number | null;
  prize: number | null;
  buyIn: number;
  field: number;
  premiados: number;
};
export type ResultadoCalculo = {
  itm: boolean;
  base: number;
  fatorParticipantes: number;
  fatorBuyIn: number;
  conta: string;
  esperado: number;
  /** Esperado em centésimos de ponto (inteiro). Fonte da verdade para comparações. */
  esperadoCent: number;
};

// Seção 3.2 do Compêndio [OFICIAL]. Posição 19+ depende de `aposDecimoOitavo`.
const BASE_POSICAO = [1000, 800, 700, 600, 500, 450, 400, 350, 300, 250, 250, 250, 200, 200, 200, 200, 200, 200];
export const BASES_TABELA = [1000, 800, 700, 600, 500, 450, 400, 350, 300, 250, 200, 100, 10];

// Aritmética exata: fatores em inteiros. Participantes em 1/10000 (field/100 + 0,5 → field×100 + 5000);
// buy-in em 1/100 (1,2 → 120). Base × fp4 × fb100 = pontos × 1.000.000.
export const fp4 = (n: number) => Math.round(n * 100) + 5000;
export const fb100 = (buyIn: number, r: Regras): number => {
  if (buyIn < 500) return Math.round(r.fatorBuyInAbaixo500 * 100);
  if (buyIn <= 1000) return 100;
  if (buyIn <= 1999) return 120;
  if (buyIn <= 2999) return 150;
  return 250;
};
/** Pontos × 1.000.000 → centésimos de ponto, arredondando metade para cima. */
export const paraCent = (micro: number) => Math.floor((micro + 5000) / 10000);
/** Pontos registrados (decimal da API) → centésimos inteiros. */
export const centDe = (pontos: number) => Math.round(pontos * 100);

/**
 * Inversa exata da fórmula: o nº inteiro de inscritos (≥ 1) que, com esta base e este fator de buy-in (×100),
 * dá exatamente `cent` centésimos de ponto. Null se nenhum inteiro reproduz o valor.
 */
export function fieldQueReproduz(base: number, fb: number, cent: number): number | null {
  const k = base * fb;
  if (!(k > 0)) return null;
  const f0 = Math.round(((cent * 10000) / k - 5000) / 100);
  for (const f of [f0, f0 - 1, f0 + 1]) if (f >= 1 && paraCent(base * fp4(f) * fb) === cent) return f;
  return null;
}

export const fatorParticipantes = (n: number) => fp4(n) / 10000;
export const fatorBuyIn = (buyIn: number, r: Regras) => fb100(buyIn, r) / 100;

export const baseDaPosicao = (posicao: number, r: Regras) =>
  posicao <= 18 ? BASE_POSICAO[posicao - 1] : r.aposDecimoOitavo === "base100TodosItm" ? 100 : 10;

const fmt = (x: number) => String(x).replace(".", ",");

export function calcular(e: EntradaCalculo, r: Regras): ResultadoCalculo {
  const itm = e.posicao != null && e.posicao <= e.premiados && e.prize != null && e.prize > 0;
  const fp = fatorParticipantes(e.field);
  const fb = fatorBuyIn(e.buyIn, r);
  const base = itm ? baseDaPosicao(e.posicao as number, r) : 10;
  if (!itm && r.foraDoItm === "10fixos")
    return { itm, base, fatorParticipantes: fp, fatorBuyIn: fb, conta: "10 fixos (sem fatores)", esperado: 10, esperadoCent: 1000 };
  const cent = paraCent(base * fp4(e.field) * fb100(e.buyIn, r));
  return {
    itm,
    base,
    fatorParticipantes: fp,
    fatorBuyIn: fb,
    conta: `${base} × ${fmt(fp)} × ${fmt(fb)}`,
    esperado: cent / 100,
    esperadoCent: cent,
  };
}
