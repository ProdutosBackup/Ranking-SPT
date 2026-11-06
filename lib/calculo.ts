import type { Regras } from "./regras";

export type EntradaCalculo = {
  posicao: number | null;
  prize: number | null;
  buyIn: number;
  /** Buy-in que escolhe o fator, quando difere do exibido (torneio com bounty: buy-in + bounty). Sem ele, vale `buyIn`. */
  buyInFator?: number;
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

// Seção 3.2 do Compêndio [OFICIAL]. Da posição 19 em diante, todo premiado recebe base 100 [CONFIRMADO 05/11/2026].
const BASE_POSICAO = [1000, 800, 700, 600, 500, 450, 400, 350, 300, 250, 250, 250, 200, 200, 200, 200, 200, 200];
export const BASES_TABELA = [1000, 800, 700, 600, 500, 450, 400, 350, 300, 250, 200, 100, 10];

// Aritmética exata: fatores em inteiros. Participantes em 1/10000 (field/100 + 0,5 → field×100 + 5000);
// buy-in em 1/100 (1,2 → 120). Base × fp4 × fb100 = pontos × 1.000.000.
export const fp4 = (n: number) => Math.round(n * 100) + 5000;
// Faixas pelo limite superior (inclusivo): até 1.000 = fator da faixa (padrão 1,0), até 1.999 = 1,2, até 2.999 = 1,5, acima = 2,5.
// Buy-in com centavos acima do limite passa para a faixa seguinte (1.000,50 → 1,2) [CONFIRMADO 05/11/2026].
export const fb100 = (buyIn: number, r: Regras): number => {
  if (buyIn <= 1000) return Math.round(r.fatorFaixaAte1000 * 100);
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

/**
 * Buy-in que escolhe o fator: em todo torneio com bounty (K.O e Mystery) vale o total, buy-in + bounty [CONFIRMADO 05/11/2026].
 * Sem bounty (`bountyType` NONE, nulo ou ausente) não soma nada: na Etapa 1 o `buyIn` da API já é o total.
 * Com bounty mas sem `bountyAmount`: provisório, mantém só o buy-in.
 */
export const buyInParaFator = (t: { buyIn: number; bountyType?: string | null; bountyAmount?: number | null }): number =>
  t.bountyType != null && t.bountyType !== "NONE" && typeof t.bountyAmount === "number" ? t.buyIn + t.bountyAmount : t.buyIn;

export const fatorParticipantes = (n: number) => fp4(n) / 10000;
export const fatorBuyIn = (buyIn: number, r: Regras) => fb100(buyIn, r) / 100;

export const baseDaPosicao = (posicao: number) => (posicao <= 18 ? BASE_POSICAO[posicao - 1] : 100);

const fmt = (x: number) => String(x).replace(".", ",");

export function calcular(e: EntradaCalculo, r: Regras): ResultadoCalculo {
  const itm = e.posicao != null && e.posicao <= e.premiados && e.prize != null && e.prize > 0;
  const fp = fatorParticipantes(e.field);
  const fb = fatorBuyIn(e.buyInFator ?? e.buyIn, r);
  const base = itm ? baseDaPosicao(e.posicao as number) : 10; // fora da premiação: 10 × fatores [CONFIRMADO 05/11/2026]
  const cent = paraCent(base * fp4(e.field) * fb100(e.buyInFator ?? e.buyIn, r));
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

/**
 * Como a linha pontua, para recalcular o esperado em outro cenário (outro número de participantes e/ou outro fator da faixa até R$ 1.000).
 * `zero`: torneio que não pontua ou flight que vale 0; `semPosicao`: pendente ou participação (10 × fatores); `acordo`: posição pela qual o acordo pontua.
 */
export type RegimeLinha = { zero: boolean; semPosicao: boolean; acordo: number | null };

/**
 * Valor esperado (centésimos) da linha com `field` participantes e fator `faixa` na faixa de buy-in até R$ 1.000.
 * É a mesma regra de `calcular`, na mesma ordem em que a auditoria a aplica; só mudam o campo e o fator da faixa.
 */
export function calcularCenario(e: EntradaCalculo, r: Regras, linha: RegimeLinha, field: number, faixa: number): number {
  if (linha.zero) return 0;
  const reg: Regras = { ...r, fatorFaixaAte1000: faixa };
  if (linha.acordo != null) return calcular({ ...e, field, posicao: linha.acordo, prize: 1, premiados: Math.max(linha.acordo, e.premiados) }, reg).esperadoCent;
  if (linha.semPosicao) return calcular({ ...e, field, posicao: null, prize: null }, reg).esperadoCent;
  return calcular({ ...e, field }, reg).esperadoCent;
}
