// Formatação pt-BR. Inteiros saem sem casas decimais.
export const n = (x: number, casas = 2) => x.toLocaleString("pt-BR", { maximumFractionDigits: casas });
export const nSinal = (x: number) =>
  x.toLocaleString("pt-BR", { maximumFractionDigits: 2, signDisplay: "exceptZero" }).replace(/^-/, "−");
export const reais = (x: number | null) => (x == null ? "—" : `R$ ${n(x)}`);
export const dataBr = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
export const semAcento = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
export const nomePosicao = (p: number | null) => (p == null ? "sem posição" : p === 1 ? "campeão" : `${p}º colocado`);
export const classeDif = (d: number) => (d < 0 ? "neg" : d > 0 ? "pos" : "");
/** Chave estável de uma linha (usada no endereço e em "revisado"). */
export const chaveLinha = (l: { jogador: string; torneioId: string; posicao: number | null }) => `${l.jogador}|${l.torneioId}|${l.posicao ?? ""}`;
