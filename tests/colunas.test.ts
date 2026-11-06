import { describe, expect, it } from "vitest";
import { montarColuna, type Jogador } from "../app/components/colunas";

const tc = (totalCent: number | null, porEtapa: (number | null | undefined)[], posicao: number | null = null, empate = false) => ({
  totalCent, parcialCent: 0, insuficiente: totalCent == null, motivos: [], posicao, empate,
  porEtapa: porEtapa.map((c) => (c === undefined ? null : { cent: c, insuficiente: c == null })),
});
const J = (nome: string, pub: (number | null)[], A: ReturnType<typeof tc>, C: ReturnType<typeof tc>): Jogador =>
  ({
    nome, id: nome, porEtapa: [], totalCent: 0, primeiros: 0, posicao: 0, empate: false,
    publicadoCent: pub.reduce<number>((a, x) => a + (x ?? 0), 0), publicadoPorEtapa: pub,
    cenarios: { A, B: tc(A.totalCent == null ? null : A.totalCent - 1, []), C, D: tc(C.totalCent == null ? null : C.totalCent - 1, []) },
  }) as unknown as Jogador;

const js = [
  J("Zé", [100, 50], tc(150, [100, 50], 2), tc(null, [null, null])),
  J("Ana", [200, null], tc(200, [200, undefined], 1), tc(null, [null, undefined])),
  J("Bia", [100, 100], tc(200, [100, 100], 1, true), tc(300, [150, 150], 1)),
];

describe("colunas do Consolidado", () => {
  it("acumulado: coluna 2 = A (B com 0,9), posição do consolidado; insuficientes no fim sem posição", () => {
    expect(montarColuna(js, "entradas", "1,0", { tipo: "acumulado" }).map((i) => [i.nome, i.cent, i.pos])).toEqual([["Ana", 200, 1], ["Bia", 200, 1], ["Zé", 150, 2]]);
    expect(montarColuna(js, "entradas", "0,9", { tipo: "acumulado" }).map((i) => i.cent)).toEqual([199, 199, 149]);
    expect(montarColuna(js, "acoes", "1,0", { tipo: "acumulado" }).map((i) => [i.nome, i.cent, i.pos])).toEqual([["Bia", 300, 1], ["Ana", null, null], ["Zé", null, null]]);
    expect(montarColuna(js, "acoes", "0,9", { tipo: "acumulado" })[0].cent).toBe(299);
  });
  it("como estava: publicado, igual em qualquer fator, empate sem desempate", () => {
    const a = montarColuna(js, "estava", "1,0", { tipo: "acumulado" });
    expect(a).toEqual(montarColuna(js, "estava", "0,9", { tipo: "acumulado" }));
    expect(a.map((i) => [i.nome, i.cent, i.pos, i.empate])).toEqual([["Ana", 200, 1, true], ["Bia", 200, 1, true], ["Zé", 150, 3, false]]);
  });
  it("por etapa: só quem jogou, empate na mesma posição, insuficiente no fim", () => {
    expect(montarColuna(js, "entradas", "1,0", { tipo: "etapa", indice: 1, numero: 1 + 1 }).map((i) => [i.nome, i.cent, i.pos])).toEqual([["Bia", 100, 1], ["Zé", 50, 2]]);
    expect(montarColuna(js, "estava", "1,0", { tipo: "etapa", indice: 0, numero: 0 + 1 }).map((i) => [i.nome, i.pos, i.empate])).toEqual([["Ana", 1, false], ["Bia", 2, true], ["Zé", 2, true]]);
    expect(montarColuna(js, "acoes", "1,0", { tipo: "etapa", indice: 0, numero: 0 + 1 }).map((i) => [i.nome, i.cent, i.pos])).toEqual([["Bia", 150, 1], ["Ana", null, null], ["Zé", null, null]]);
  });
  it("insuficientes trazem os motivos do cenário exibido; no por etapa, só os da etapa", () => {
    const m = [{ etapa: 1, motivo: "sem reentradas", linhas: 3 }, { etapa: 2, motivo: "sem reentradas", linhas: 1 }];
    const x = { ...js[1], cenarios: { ...js[1].cenarios, C: { ...js[1].cenarios.C, motivos: m }, D: { ...js[1].cenarios.D, motivos: [m[0]] } } } as Jogador;
    expect(montarColuna([x], "acoes", "1,0", { tipo: "acumulado" })[0].motivos).toEqual(m);
    expect(montarColuna([x], "acoes", "0,9", { tipo: "acumulado" })[0].motivos).toEqual([m[0]]);
    expect(montarColuna([x], "acoes", "1,0", { tipo: "etapa", indice: 0, numero: 1 })[0].motivos).toEqual([m[0]]);
    expect(montarColuna([x], "entradas", "1,0", { tipo: "acumulado" })[0].motivos).toEqual([]);
  });
});
