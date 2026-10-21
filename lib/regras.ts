// Única fonte das opções de regra. Os itens abaixo são [PENDENTE]/[INFERIDO] no docs/compendio.md
// (ou dependem de pendência) e por isso são configuráveis; nada aqui é regra fixa.
export type Regras = {
  /** Fora do ITM: base 10 multiplicada pelos fatores (seção 5) ou 10 pontos fixos (calculadora do site, seção 4.4). */
  foraDoItm: "base10xFatores" | "10fixos";
  /**
   * Campo do torneio: `players` (inscritos, só buy-ins; padrão) ou `acoes` (buy-ins + re-entries, onde a planilha informa; senão usa os inscritos).
   * Exceção nas duas: role=FINAL usa a soma de `players` dos FLIGHT da etapa (seção 7.6).
   */
  field: "players" | "acoes";
  /** Buy-in usado quando um torneio role=FINAL vem com buyIn 0 (seção 7.6). */
  buyInDiaFinalZero: number;
  /** Fator buy-in para buy-in abaixo de R$ 500 (seção 6.8). */
  fatorBuyInAbaixo500: number;
  /** Premiados depois do 18º: base 100 para todos (seção 6.3, como a calculadora) ou base 10. */
  aposDecimoOitavo: "base100TodosItm" | "base10";
  /** Diferença (em pontos) até a qual o desvio é tratado como arredondamento (seção 2). */
  toleranciaArredondamento: number;
};

/** Incrementar a cada mudança de regra ou de tabela de pontos. Vai no JSON e nos arquivos. */
export const VERSAO_REGRAS = "1.4";

export const REGRAS_PADRAO: Regras = {
  foraDoItm: "base10xFatores",
  field: "players",
  buyInDiaFinalZero: 1000,
  fatorBuyInAbaixo500: 1.0,
  aposDecimoOitavo: "base100TodosItm",
  toleranciaArredondamento: 0.01,
};

/**
 * Sobrescreve os padrões com parâmetros de URL. Só aceita valores válidos; valor inválido é erro explícito.
 * Parâmetros: foraDoItm, aposDecimoOitavo, tolerancia (aceita vírgula decimal), campo (inscritos | acoes).
 */
export function lerRegras(q: URLSearchParams): Regras {
  const r: Regras = { ...REGRAS_PADRAO };
  const fora = q.get("foraDoItm");
  if (fora != null) {
    if (fora !== "base10xFatores" && fora !== "10fixos") throw new Error(`foraDoItm inválido: "${fora}"`);
    r.foraDoItm = fora;
  }
  const apos = q.get("aposDecimoOitavo");
  if (apos != null) {
    if (apos !== "base100TodosItm" && apos !== "base10") throw new Error(`aposDecimoOitavo inválido: "${apos}"`);
    r.aposDecimoOitavo = apos;
  }
  const campo = q.get("campo");
  if (campo != null) {
    if (campo !== "inscritos" && campo !== "acoes") throw new Error(`campo inválido: "${campo}"`);
    r.field = campo === "acoes" ? "acoes" : "players";
  }
  const tol = q.get("tolerancia");
  if (tol != null) {
    const n = Number(tol.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) throw new Error(`tolerancia inválida: "${tol}"`);
    r.toleranciaArredondamento = n;
  }
  return r;
}
