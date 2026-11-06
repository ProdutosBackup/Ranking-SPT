// Única fonte dos parâmetros de regra. Só ficam aqui os parâmetros que não são regra fixa: a tolerância de arredondamento (regra definitiva pendente) e o fator
// da faixa até R$ 1.000 (os cenários B e D usam 0,9). Confirmadas em 05/11/2026 e portanto fixas no código: fora da premiação vale 10 × fatores
// e, depois do 18º, todo premiado recebe base 100.
export type Regras = {
  /** Fator da faixa de buy-in de R$ 0 a R$ 1.000 (seções 3.4 e 6.8). Padrão 1,0 [CONFIRMADO 05/11/2026]. */
  fatorFaixaAte1000: number;
  /** Diferença (em pontos) até a qual o desvio é tratado como arredondamento (seção 2). */
  toleranciaArredondamento: number;
};

/** Incrementar a cada mudança de regra ou de tabela de pontos. Vai no JSON e nos arquivos. */
export const VERSAO_REGRAS = "2.9";

/**
 * Participantes do Main Event informados pelo usuário, por etapa; valem para todas as linhas do Main Event (flights e Dia Final).
 * Etapa 1 [usuário, 06/11/2026]: "A soma de todos os flights para o main event dá o número de entrada no FINAL MAIN EVENT. São 334 buy ins.
 * [...] O Fator de Participantes era 334 / 100 + 0,5 que daria 3,84." (A API soma 202 nos flights; as planilhas, 358.)
 * Nas etapas sem valor aqui, o campo é a soma das entradas (players) dos flights.
 */
export const CAMPO_MAIN_EVENT: Record<string, number> = { "taua-2026": 334 };

export const REGRAS_PADRAO: Regras = {
  fatorFaixaAte1000: 1.0,
  toleranciaArredondamento: 0.01,
};

/**
 * Sobrescreve os padrões com parâmetros de URL. Só aceita valores válidos; valor inválido é erro explícito.
 * Parâmetro: tolerancia (aceita vírgula decimal). Parâmetros antigos (foraDoItm, aposDecimoOitavo, campo, sat, satelitesPontuam) são ignorados em silêncio.
 * O campo do torneio não é mais opção: "Pontos corretos" usa só entradas (cenário A) e os números em ações são os cenários C e D.
 */
export function lerRegras(q: URLSearchParams): Regras {
  const r: Regras = { ...REGRAS_PADRAO };
  const tol = q.get("tolerancia");
  if (tol != null) {
    const n = Number(tol.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) throw new Error(`tolerancia inválida: "${tol}"`);
    r.toleranciaArredondamento = n;
  }
  return r;
}

/**
 * Cenários de cálculo pedidos pelo usuário (05/11/2026). Só mudam o número de participantes e o fator da faixa de buy-in até R$ 1.000:
 * A = só entradas, faixa 1,0 (a regra padrão); B = só entradas, faixa 0,9; C = total de ações (entradas + reentradas), faixa 1,0; D = ações, faixa 0,9.
 * O fator 0,9 é um cenário, não um padrão: `REGRAS_PADRAO.fatorFaixaAte1000` continua 1,0.
 */
export const CENARIOS = ["A", "B", "C", "D"] as const;
export type Cenario = (typeof CENARIOS)[number];
export const FATOR_FAIXA_CENARIO: Record<Cenario, number> = { A: 1, B: 0.9, C: 1, D: 0.9 };
export const CAMPO_CENARIO: Record<Cenario, "entradas" | "acoes"> = { A: "entradas", B: "entradas", C: "acoes", D: "acoes" };
/** Motivo escrito quando o cenário C ou D não pode ser calculado (as reentradas só vêm do Excel da Etapa 3). Nunca se estima. */
export const MOTIVO_SEM_ACOES = "reentradas não disponíveis: falta o Excel da etapa";
