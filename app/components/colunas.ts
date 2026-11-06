// As 3 colunas do Consolidado. Só escolhe e ordena os valores que o consolidado já traz (lib/consolidado.ts); não recalcula pontos.
import type { Consolidado } from "../../lib/consolidado";

export type Jogador = Consolidado["jogadores"][number];
export type ColunaId = "estava" | "entradas" | "acoes";
export type Fator = "1,0" | "0,9";
/** Acumulado de todas as etapas lidas, ou uma etapa (índice em `Consolidado.etapas`). */
export type Visao = { tipo: "acumulado" } | { tipo: "etapa"; indice: number; numero: number };
export type Motivo = Jogador["cenarios"]["A"]["motivos"][number];
/** `motivos`: por que o total é null (do consolidado, no cenário e na etapa mostrados); vazio quando há valor. */
export type Item = { chave: string; nome: string; cent: number | null; pos: number | null; empate: boolean; motivos: Motivo[] };

const porNome = (a: Item, b: Item) => a.nome.localeCompare(b.nome, "pt-BR");

/** `undefined` = o jogador não entra na coluna (não jogou a etapa); `null` = dados insuficientes. */
function valor(j: Jogador, c: ColunaId, f: Fator, v: Visao): number | null | undefined {
  if (c === "estava") return v.tipo === "acumulado" ? j.publicadoCent : (j.publicadoPorEtapa[v.indice] ?? undefined);
  const t = j.cenarios[c === "entradas" ? (f === "1,0" ? "A" : "B") : f === "1,0" ? "C" : "D"];
  if (v.tipo === "acumulado") return t.totalCent;
  return t.porEtapa[v.indice] == null ? undefined : t.porEtapa[v.indice]!.cent;
}

export function montarColuna(jogadores: Jogador[], c: ColunaId, f: Fator, v: Visao): Item[] {
  const itens: (Item & { posMotor: number | null; empateMotor: boolean })[] = [];
  for (const j of jogadores) {
    const cent = valor(j, c, f, v);
    if (cent === undefined) continue;
    const t = c === "estava" ? null : j.cenarios[c === "entradas" ? (f === "1,0" ? "A" : "B") : f === "1,0" ? "C" : "D"];
    itens.push({ chave: `${j.id ?? j.nome}`, nome: j.nome, cent, pos: null, empate: false, motivos: cent == null && t ? t.motivos.filter((m) => v.tipo === "acumulado" || m.etapa === v.numero) : [], posMotor: t?.posicao ?? null, empateMotor: t?.empate ?? false });
  }
  const com = itens.filter((i) => i.cent != null);
  const sem = itens.filter((i) => i.cent == null).sort(porNome); // dados insuficientes: fim da coluna, sem posição
  if (c !== "estava" && v.tipo === "acumulado") {
    // Acumulado dos cenários: a posição e o empate já vêm do consolidado (desempate por primeiros lugares).
    com.sort((a, b) => a.posMotor! - b.posMotor! || porNome(a, b));
    for (const i of com) [i.pos, i.empate] = [i.posMotor, i.empateMotor];
  } else {
    // "Como estava" e Por etapa: mesma posição para o mesmo valor, sem desempate; dentro do empate, ordem alfabética só para exibição.
    com.sort((a, b) => b.cent! - a.cent! || porNome(a, b));
    com.forEach((i, k) => {
      const a = com[k - 1];
      i.pos = a && a.cent === i.cent ? a.pos : k + 1;
      if (a && a.cent === i.cent) i.empate = a.empate = true;
    });
  }
  return [...com, ...sem].map(({ posMotor: _p, empateMotor: _e, ...i }) => i);
}
