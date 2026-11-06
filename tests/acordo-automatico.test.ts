import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarDados, type DadosSpt } from "../lib/api-spt";
import { auditar, detectarAcordos } from "../lib/auditoria";
import { consolidar } from "../lib/consolidado";
import { conferir } from "../lib/integridade";
import { REGRAS_PADRAO } from "../lib/regras";
import { verificar } from "../lib/verificador";

const E1 = "taua-2026";
const E2 = "vale-suico-2026";
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
const conferido = (d: DadosSpt, acordos: Record<string, number> = {}) => {
  const aud = auditar(d, REGRAS_PADRAO, acordos);
  conferir(d, REGRAS_PADRAO, aud, acordos); // o verificador independente concorda com o motor em todas as linhas e nos acordos detectados
  return aud;
};
const pos = (...v: [number, number][]) => v.map(([posicao, cent]) => ({ posicao, cent }));

describe("detecção de acordo (função)", () => {
  it("posições consecutivas e diferentes, mesma pontuação, bases diferentes: é acordo", () => {
    expect(detectarAcordos(pos([1, 228600], [2, 228600], [3, 228600], [4, 228600], [5, 190500]), REGRAS_PADRAO)).toEqual([{ de: 1, ate: 4, cent: 228600 }]);
    expect(detectarAcordos(pos([1, 100800], [2, 100800]), REGRAS_PADRAO)).toEqual([{ de: 1, ate: 2, cent: 100800 }]);
    expect(detectarAcordos(pos([9, 5000], [10, 5000], [11, 5000]), REGRAS_PADRAO)).toEqual([{ de: 9, ate: 11, cent: 5000 }]); // 300, 250, 250: bases diferentes
  });
  it("tolerância de 0,01 ponto", () => {
    expect(detectarAcordos(pos([1, 10000], [2, 10001]), REGRAS_PADRAO)).toHaveLength(1);
    expect(detectarAcordos(pos([1, 10000], [2, 10002]), REGRAS_PADRAO)).toHaveLength(0);
  });
  it("mesma base na tabela não é acordo: 10º a 12º, 13º a 18º e depois do 18º", () => {
    expect(detectarAcordos(pos([10, 31500], [11, 31500], [12, 31500]), REGRAS_PADRAO)).toEqual([]);
    expect(detectarAcordos(pos([13, 9000], [14, 9000], [15, 9000], [16, 9000], [17, 9000], [18, 9000]), REGRAS_PADRAO)).toEqual([]);
    expect(detectarAcordos(pos([19, 5000], [20, 5000], [21, 5000]), REGRAS_PADRAO)).toEqual([]);
  });
  it("a mesma posição repetida (eliminação simultânea) não é acordo", () => {
    expect(detectarAcordos(pos([14, 9000], [14, 9000]), REGRAS_PADRAO)).toEqual([]);
    expect(detectarAcordos(pos([13, 9000], [14, 9000], [14, 9000], [15, 9000]), REGRAS_PADRAO)).toEqual([]);
    expect(detectarAcordos(pos([6, 9000], [6, 9000]), REGRAS_PADRAO)).toEqual([]);
  });
  it("posições não consecutivas ou com pontos diferentes não formam grupo", () => {
    expect(detectarAcordos(pos([1, 5000], [3, 5000]), REGRAS_PADRAO)).toEqual([]);
    expect(detectarAcordos(pos([1, 5000], [2, 4000]), REGRAS_PADRAO)).toEqual([]);
    expect(detectarAcordos(pos([1, 5000], [2, 5000], [2, 4000]), REGRAS_PADRAO)).toEqual([]); // a posição 2 não pontua igual para todos
  });
});

describe("Etapa 2: acordos detectados", () => {
  it("Dia Final, posições 1 a 4 com 2.286: acordo de 4, esperado 600 × 3,81 = 2.286, Correto", async () => {
    const d = await fixture(E2);
    const aud = conferido(d);
    const final = d.torneios.find((t) => t.role === "FINAL")!;
    const ls = aud.linhas.filter((l) => l.torneioId === final.id && l.posicao != null && l.posicao <= 4);
    expect(ls).toHaveLength(4);
    expect(ls.every((l) => l.registrado === 2286 && l.esperado === 2286 && l.base === 600 && l.situacao === "CORRETO" && l.acordo === 4 && l.acordoDe === 1 && l.acordoOrigem === "automatico")).toBe(true);
    expect(ls[0].conta).toBe("600 × 3,81 × 1");
    // o 5º em diante não é acordo
    expect(aud.linhas.filter((l) => l.torneioId === final.id && l.posicao != null && l.posicao > 4).every((l) => l.acordo == null)).toBe(true);
  });

  it("EV #2 200K PLO 5 K.O, 1º e 2º com 1.008: acordo de 2 posições, esperado 800 × 0,84 × 2,5 = 1.680, Erro com a causa do acordo", async () => {
    const d = await fixture(E2);
    const aud = conferido(d);
    const t = d.torneios.find((x) => x.name.startsWith("EV #2"))!;
    const ls = aud.linhas.filter((l) => l.torneioId === t.id && l.posicao != null && l.posicao <= 2);
    expect(ls).toHaveLength(2);
    expect(ls.every((l) => l.registrado === 1008 && l.esperado === 1680 && l.base === 800 && l.fatorParticipantes === 0.84 && l.fatorBuyIn === 2.5 && l.situacao === "ERRO" && l.acordo === 2 && l.acordoDe === 1)).toBe(true);
    expect(ls.every((l) => l.causaCodigo === "ACORDO" && l.causaProvavel === "acordo entre as posições 1 a 2; deveria pontuar como a posição 2")).toBe(true);
  });

  it("não é acordo: 10º, 11º e 12º com 315 no mesmo torneio (mesma base)", async () => {
    const d = await fixture(E2);
    const aud = conferido(d);
    const t = d.torneios.find((x) => x.name.startsWith("EV #2"))!;
    const dez = aud.linhas.filter((l) => l.torneioId === t.id && l.posicao != null && l.posicao >= 10 && l.posicao <= 12);
    expect(dez.map((l) => l.registrado)).toEqual([315, 315, 315]);
    expect(dez.every((l) => l.acordo == null && l.base === 250)).toBe(true);
  });

  it("a lista dos acordos detectados na Etapa 2 (3 torneios) e nenhum na Etapa 1", async () => {
    const aud2 = conferido(await fixture(E2));
    expect(aud2.acordosDetectados.map((a) => [a.torneio, a.de, a.ate, a.pontos, a.informado, a.discorda])).toEqual([
      ["EV #2 200K PLO 5 K.O", 1, 2, 1008, null, false],
      ["EV #6 8-GAME", 1, 2, 547.2, null, false],
      ["Main Event SPT — Dia Final", 1, 4, 2286, null, false],
    ]);
    expect(conferido(await fixture(E1)).acordosDetectados).toEqual([]);
  });

  it("o verificador independente pega um motor que não aplicasse o acordo detectado", async () => {
    const d = await fixture(E2);
    const aud = auditar(d, REGRAS_PADRAO);
    expect(verificar(d, REGRAS_PADRAO, aud.linhas, aud.torneios)).toEqual([]);
    const sem = aud.linhas.map((l) => (l.acordo != null ? { ...l, acordo: null, acordoDe: null, acordoOrigem: null } : l));
    expect(verificar(d, REGRAS_PADRAO, sem, aud.torneios).length).toBeGreaterThan(0);
  });
});

describe("acordo informado vale no lugar do detectado; o relatório mostra a discordância", () => {
  it("K=4 informado concorda com o detectado; K=3 informado discorda", async () => {
    const d = await fixture(E2);
    const final = d.torneios.find((t) => t.role === "FINAL")!;
    const k4 = conferido(d, { [final.id]: 4 });
    expect(k4.linhas.filter((l) => l.torneioId === final.id && l.acordo != null).every((l) => l.acordoOrigem === "informado")).toBe(true);
    expect(k4.torneios.find((t) => t.torneioId === final.id)).toMatchObject({ acordo: 4, acordoDiscorda: false });
    const k3 = conferido(d, { [final.id]: 3 });
    const lin = k3.linhas.filter((l) => l.torneioId === final.id && l.acordo != null);
    expect(lin).toHaveLength(3);
    expect(lin.every((l) => l.acordoOrigem === "informado" && l.acordo === 3)).toBe(true);
    // o 4º tem 2.286, que o informado (K=3) não cobre: com informado, o automático não vale
    expect(k3.linhas.find((l) => l.torneioId === final.id && l.posicao === 4)!.acordo).toBeNull();
    expect(k3.torneios.find((t) => t.torneioId === final.id)).toMatchObject({ acordo: 3, acordoDiscorda: true, acordosAuto: [{ de: 1, ate: 4, pontos: 2286 }] });
    expect(k3.acordosDetectados.find((a) => a.torneio.includes("Dia Final"))).toMatchObject({ informado: 3, discorda: true });
  });
});

describe("desempate: quem está em acordo não conta como 1º lugar", () => {
  it("Etapa 2: nenhum jogador de acordo conta o 1º lugar daquele torneio", async () => {
    const d = await fixture(E2);
    const aud = conferido(d);
    const monta = (comAcordo: boolean) =>
      consolidar([
        {
          numero: 2,
          jogadores: d.jogadores.map((j) => ({ nome: j.name, id: j.id })),
          linhas: aud.linhas.map((l) => ({ jogador: l.jogador, posicao: l.posicao, esperadoCent: l.esperadoCent, aguarda: l.situacao === "PENDENTE_REGRA", participacao: l.participacao, acordo: comAcordo ? l.acordo != null : false })),
        },
      ]);
    const primeiros = (c: ReturnType<typeof consolidar>) => Object.fromEntries(c.jogadores.map((j) => [j.nome, j.primeiros]));
    const com = primeiros(monta(true));
    const sem = primeiros(monta(false));
    const final = d.torneios.find((t) => t.role === "FINAL")!;
    const campeao = aud.linhas.find((l) => l.torneioId === final.id && l.posicao === 1)!.jogador;
    expect(sem[campeao] - com[campeao]).toBe(1); // o 1º do Dia Final (acordo de 4) deixa de contar
    // a soma dos primeiros lugares cai em um por torneio com acordo que começa em 1 (EV #2, EV #6 e Dia Final)
    const total = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);
    expect(total(sem) - total(com)).toBe(3);
    // quem tem 1º lugar fora de acordo continua contando: contagem direta
    const esperado = aud.linhas.filter((l) => l.posicao === 1 && l.esperadoCent > 0 && !l.participacao && l.acordo == null).length;
    expect(total(com)).toBe(esperado);
  });

  it("o desempate decide por primeiros lugares sem contar o acordo", () => {
    const linhas = (acordo: boolean) => [
      { jogador: "A", posicao: 1, esperadoCent: 10000, aguarda: false, acordo },
      { jogador: "B", posicao: 2, esperadoCent: 10000, aguarda: false },
      { jogador: "B", posicao: 1, esperadoCent: 0, aguarda: false },
    ];
    const jog = [{ nome: "A" }, { nome: "B" }];
    // sem acordo: A tem 1 primeiro lugar e B tem 0 (o 1º de B vale 0 pontos): A fica na frente
    expect(consolidar([{ numero: 1, jogadores: jog, linhas: linhas(false) }]).jogadores.map((j) => [j.nome, j.primeiros, j.posicao])).toEqual([["A", 1, 1], ["B", 0, 2]]);
    // com acordo, A não conta o 1º lugar: empatam em pontos e em primeiros lugares
    const c = consolidar([{ numero: 1, jogadores: jog, linhas: linhas(true) }]);
    expect(c.jogadores.map((j) => [j.nome, j.primeiros, j.posicao, j.empate])).toEqual([["A", 0, 1, true], ["B", 0, 1, true]]);
  });
});
