import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarDados } from "../lib/api-spt";
import { auditar } from "../lib/auditoria";
import { avisoAguardando, chaveNome, consolidar, type EtapaConsolidado, type LinhaConsolidado } from "../lib/consolidado";
import { REGRAS_PADRAO } from "../lib/regras";

const L = (jogador: string, esperadoCent: number, posicao: number | null = null, aguarda = false): LinhaConsolidado => ({ jogador, posicao, esperadoCent, aguarda });
const E = (numero: number, jogadores: (string | [string, string])[], linhas: LinhaConsolidado[]): EtapaConsolidado => ({
  numero,
  jogadores: jogadores.map((j) => (typeof j === "string" ? { nome: j } : { nome: j[0], id: j[1] })),
  linhas,
});
const por = (c: ReturnType<typeof consolidar>, nome: string) => c.jogadores.find((j) => j.nome === nome)!;

describe("soma acumulada (casos pequenos, em centésimos)", () => {
  const c = consolidar([
    E(1, ["Ana", "Beto"], [L("Ana", 1005), L("Ana", 2010), L("Beto", 1000)]),
    E(2, ["Ana", "Beto"], [L("Ana", 33), L("Beto", 12345)]),
  ]);
  it("soma os centésimos inteiros por etapa e no total", () => {
    expect(por(c, "Ana")).toMatchObject({ porEtapa: [3015, 33], totalCent: 3048 });
    expect(por(c, "Beto")).toMatchObject({ porEtapa: [1000, 12345], totalCent: 13345 });
  });
  it("ordena do maior para o menor e numera as posições", () => {
    expect(c.jogadores.map((j) => [j.posicao, j.nome])).toEqual([[1, "Beto"], [2, "Ana"]]);
    expect(c.etapas).toEqual([1, 2]);
  });
  it("não perde centésimo com decimais que o ponto flutuante erra (0,1 + 0,2)", () => {
    const x = consolidar([E(1, ["Ana"], [L("Ana", 10), L("Ana", 20)])]);
    expect(x.jogadores[0].totalCent).toBe(30);
  });
});

describe("jogador presente só em algumas etapas", () => {
  const c = consolidar([E(1, ["Ana", "Beto"], [L("Ana", 500), L("Beto", 700)]), E(2, ["Ana", "Caio"], [L("Ana", 100), L("Caio", 900)]), E(3, ["Beto"], [L("Beto", 50)])]);
  it("marca com null a etapa em que não jogou, sem inventar zero", () => {
    expect(por(c, "Ana").porEtapa).toEqual([500, 100, null]);
    expect(por(c, "Beto").porEtapa).toEqual([700, null, 50]);
    expect(por(c, "Caio").porEtapa).toEqual([null, 900, null]);
  });
  it("totais", () => {
    expect(c.jogadores.map((j) => [j.nome, j.totalCent])).toEqual([["Caio", 900], ["Beto", 750], ["Ana", 600]]);
  });
});

describe("aguardando regra fica fora da soma", () => {
  const c = consolidar([
    E(1, ["Ana", "Beto"], [L("Ana", 500), L("Ana", 99999, null, true), L("Beto", 1000, null, true)]),
    E(2, ["Ana"], [L("Ana", 100), L("Ana", 777, null, true)]),
  ]);
  it("não soma as linhas pendentes nem inventa pontos para elas", () => {
    expect(por(c, "Ana").totalCent).toBe(600);
    expect(por(c, "Beto")).toMatchObject({ totalCent: 0, porEtapa: [0, null] }); // jogou, mas só tem resultado pendente
  });
  it("conta os pendentes por etapa e monta o aviso fixo", () => {
    expect(c.aguardando).toEqual([{ etapa: 1, n: 2 }, { etapa: 2, n: 1 }]);
    expect(avisoAguardando(3)).toBe("3 resultados aguardando regra não entram na soma");
    expect(avisoAguardando(1)).toBe("1 resultado aguardando regra não entra na soma");
    expect(avisoAguardando(1135)).toBe("1.135 resultados aguardando regra não entram na soma");
  });
});

describe("etapa sem dados", () => {
  it("lista vazia: nenhum jogador e nenhum pendente", () => {
    expect(consolidar([E(1, [], [])])).toMatchObject({ jogadores: [], aguardando: [{ etapa: 1, n: 0 }], avisos: [] });
  });
});

describe("desempate do regulamento (seção 3.5): primeiros lugares; o resto não existe nos dados", () => {
  it("empate em pontos: quem tem mais primeiros lugares fica na frente", () => {
    const c = consolidar([E(1, ["Ana", "Beto", "Caio"], [L("Ana", 1000, 3), L("Beto", 500, 1), L("Beto", 500, 5), L("Caio", 1000, 2)])]);
    expect(c.jogadores.map((j) => [j.nome, j.posicao, j.primeiros, j.empate])).toEqual([
      ["Beto", 1, 1, false],
      ["Ana", 2, 0, true],
      ["Caio", 2, 0, true],
    ]); // Ana e Caio continuam empatados: dividem a posição
  });
  it("primeiro lugar de satélite (0 ponto) ou de linha pendente não conta", () => {
    const c = consolidar([E(1, ["Ana", "Beto"], [L("Ana", 0, 1), L("Ana", 700, 1, true), L("Beto", 100, 4)])]);
    expect(por(c, "Ana").primeiros).toBe(0);
  });
  it("a posição seguinte a um empate pula (1, 2, 2, 4)", () => {
    const c = consolidar([E(1, ["A", "B", "C", "D"], [L("A", 900), L("B", 500), L("C", 500), L("D", 100)])]);
    expect(c.jogadores.map((j) => j.posicao)).toEqual([1, 2, 2, 4]);
  });
});

describe("identificação do jogador entre etapas", () => {
  it("mesmo ID com nomes diferentes: usa o nome da etapa mais recente e avisa", () => {
    const c = consolidar([E(1, [["guilherme kalil", "id-1"]], [L("guilherme kalil", 100)]), E(2, [["Guilherme Kalil", "id-1"]], [L("Guilherme Kalil", 50)])]);
    expect(c.jogadores).toHaveLength(1);
    expect(c.jogadores[0]).toMatchObject({ nome: "Guilherme Kalil", totalCent: 150 });
    expect(c.avisos.join(" ")).toContain('O ID id-1 aparece como "guilherme kalil" e como "Guilherme Kalil" (Etapa 2); usei "Guilherme Kalil".');
  });
  it("sem ID numa etapa: une pelo nome (sem acento nem maiúsculas) e conta no aviso", () => {
    const c = consolidar([E(1, ["José Silva"], [L("José Silva", 100)]), E(2, [["jose silva", "id-9"]], [L("jose silva", 40)])]);
    expect(c.jogadores).toHaveLength(1);
    expect(c.jogadores[0]).toMatchObject({ id: "id-9", totalCent: 140, nome: "jose silva" });
    expect(c.avisos.join(" ")).toContain("1 jogador sem ID no site foi unido entre etapas pelo nome");
  });
  it("mesmo nome com IDs diferentes são duas pessoas", () => {
    const c = consolidar([E(1, [["João", "a"]], [L("João", 100)]), E(2, [["João", "b"]], [L("João", 100)])]);
    expect(c.jogadores).toHaveLength(2);
  });
  it("nome sem ID que casa com duas pessoas não é unido a nenhuma e gera aviso", () => {
    const c = consolidar([E(1, [["João", "a"], ["JOÃO", "b"]], [L("João", 100), L("JOÃO", 100)]), E(2, ["João"], [L("João", 50)])]);
    expect(c.jogadores).toHaveLength(3);
    expect(c.avisos.join(" ")).toContain("Não uni nomes que pertencem a mais de uma pessoa: João");
  });
  it("chaveNome ignora acento, maiúsculas e espaços repetidos", () => {
    expect(chaveNome("  José   da  Silva ")).toBe("jose da silva");
  });
});

// ---------- com os dados reais gravados (fixtures) ----------
function fixture(stage: string) {
  const fx = JSON.parse(readFileSync(`tests/fixtures/${stage}.json`, "utf8"));
  vi.stubGlobal("fetch", async (url: string) => {
    const u = new URL(url);
    const body = u.pathname.endsWith("/ranking") ? fx.ranking : u.pathname.endsWith("/tournaments") ? fx.tournaments : fx.playerSummaries[u.searchParams.get("name")!];
    return { ok: true, status: 200, json: async () => body };
  });
  return buscarDados(stage);
}
afterEach(() => vi.unstubAllGlobals());

async function etapaReal(numero: number, stage: string): Promise<EtapaConsolidado & { brutas: { nome: string; id?: string; pontos: number; aguarda: boolean }[] }> {
  const d = await fixture(stage);
  const aud = auditar(d, REGRAS_PADRAO);
  return {
    numero,
    jogadores: d.jogadores.map((j) => ({ nome: j.name, id: j.id })),
    linhas: aud.linhas.map((l) => ({ jogador: l.jogador, posicao: l.posicao, esperadoCent: Math.round(l.esperado * 100), aguarda: l.situacao === "PENDENTE_REGRA" })),
    brutas: aud.linhas.map((l) => ({ nome: l.jogador, id: d.jogadores.find((j) => j.name === l.jogador)?.id, pontos: l.esperado, aguarda: l.situacao === "PENDENTE_REGRA" })),
  };
}

describe("etapas reais", () => {
  it("Etapa 1: igual, jogador a jogador, à soma dos pontos corretos da auditoria (sem os pendentes)", async () => {
    const e1 = await etapaReal(1, "taua-2026");
    const c = consolidar([e1]);
    const esperado = new Map<string, number>();
    for (const b of e1.brutas) if (!b.aguarda) esperado.set(chaveNome(b.nome), Math.round(((esperado.get(chaveNome(b.nome)) ?? 0) + b.pontos) * 100) / 100);
    expect(c.jogadores).toHaveLength(278);
    for (const j of c.jogadores) expect(j.totalCent / 100).toBeCloseTo(esperado.get(chaveNome(j.nome)) ?? 0, 2);
    expect(c.jogadores.reduce((a, j) => a + j.totalCent, 0)).toBe(Math.round([...esperado.values()].reduce((a, x) => a + x, 0) * 100));
    expect(c.aguardando).toEqual([{ etapa: 1, n: 202 }]);
  });

  it("Etapa 2 acumulada = pontos corretos da Etapa 1 + da Etapa 2, conferido por soma independente por nome", async () => {
    const e1 = await etapaReal(1, "taua-2026");
    const e2 = await etapaReal(2, "vale-suico-2026");
    const c = consolidar([e1, e2]);
    // soma independente: um mapa simples por nome normalizado, direto das linhas da auditoria
    const soma = new Map<string, number>();
    for (const b of [...e1.brutas, ...e2.brutas]) if (!b.aguarda) soma.set(chaveNome(b.nome), (soma.get(chaveNome(b.nome)) ?? 0) + Math.round(b.pontos * 100));
    const nomes = new Set([...e1.brutas, ...e2.brutas].map((b) => chaveNome(b.nome)));
    expect(c.jogadores).toHaveLength(nomes.size); // quem só tem resultado pendente aparece com 0
    for (const j of c.jogadores) expect(j.totalCent).toBe(soma.get(chaveNome(j.nome)) ?? 0);
    expect(c.aguardando).toEqual([{ etapa: 1, n: 202 }, { etapa: 2, n: 126 }]);
    expect(c.jogadores[0].posicao).toBe(1);
  });
});
