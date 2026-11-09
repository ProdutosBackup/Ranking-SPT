import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarDados, type DadosSpt } from "../lib/api-spt";
import { auditar } from "../lib/auditoria";
import { consolidar } from "../lib/consolidado";
import { conferir } from "../lib/integridade";
import { lerPlanilha } from "../lib/planilha";
import { REGRAS_PADRAO } from "../lib/regras";
import { verificar } from "../lib/verificador";
import { comBounty } from "./bounty-mock";

// Acordo só na mão (decisão do usuário, 08/11/2026, VERSAO_REGRAS 2.10): a ferramenta não detecta mais acordo sozinha. Pontuação igual em posições
// diferentes, sem acordo marcado, é Erro. Com o K marcado, as posições 1 a K pontuam como o Kº colocado (compêndio 6.9). Este arquivo substitui
// tests/acordo-automatico.test.ts: o caso "K informado" e o do desempate foram migrados; os da função de detecção saíram junto com a função.
const E1 = "taua-2026";
const E2 = "vale-suico-2026";
const ENVIO = { enviadoEm: new Date("2026-10-21T12:00:00Z"), arquivo: "ranking-spt-3a-etapa.xlsx", stage: "bendito-cacao-2026" };

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

/** Etapa 3 lida da planilha, com os 328 inscritos do Dia Final (soma dos flights) e o bounty do site. */
async function etapa3(): Promise<DadosSpt> {
  const r = await lerPlanilha(new Uint8Array(readFileSync("tests/fixtures/ranking-spt-3a-etapa.xlsx")), ENVIO);
  if (!r.ok) throw new Error(r.erros.join(" | "));
  const d = comBounty(r.dados);
  return { ...d, torneios: d.torneios.map((t) => (t.role === "FINAL" ? { ...t, players: 328 } : t)) };
}
const conferido = (d: DadosSpt, acordos: Record<string, number> = {}) => {
  const aud = auditar(d, REGRAS_PADRAO, acordos);
  conferir(d, REGRAS_PADRAO, aud, acordos); // o verificador independente concorda com o motor
  return aud;
};
const final = (d: DadosSpt) => d.torneios.find((t) => t.role === "FINAL")!;
const doTorneio = (aud: ReturnType<typeof auditar>, nome: string, pos: number) => aud.linhas.find((l) => l.torneio.startsWith(nome) && l.posicao === pos)!;

describe("sem acordo marcado: pontuação igual em posições diferentes é Erro", () => {
  it("Etapa 1: 202 erros e 189 corretos (mais 251 corretos com os inscritos do site), igual a antes; nenhuma linha em acordo", async () => {
    const aud = conferido(await fixture(E1));
    expect(aud.resumo).toMatchObject({ total: 642, ERRO: 202, CORRETO: 189, CORRETO_SITE: 251, PENDENTE_REGRA: 0 });
    expect(aud.linhas.filter((l) => l.acordo != null)).toEqual([]);
  });

  it("Etapa 2: 153 erros e 117 corretos (antes 149 e 121, com 4 linhas de acordo detectado); nenhuma linha em acordo", async () => {
    const aud = conferido(await fixture(E2));
    expect(aud.resumo).toMatchObject({ total: 270, ERRO: 153, CORRETO: 117, PENDENTE_REGRA: 0 });
    expect(aud.linhas.filter((l) => l.acordo != null)).toEqual([]);
  });

  it("Etapa 2, Dia Final: 2.286 registrados do 1º ao 4º; esperado 1000, 800, 700 e 600 × 3,81 = 3.810, 3.048, 2.667 e 2.286 (o 4º é Correto)", async () => {
    const aud = conferido(await fixture(E2));
    const ls = [1, 2, 3, 4].map((p) => doTorneio(aud, "Main Event SPT — Dia Final", p));
    expect(ls.map((l) => [l.registrado, l.esperado, l.base, l.situacao, l.acordo])).toEqual([
      [2286, 3810, 1000, "ERRO", null], [2286, 3048, 800, "ERRO", null], [2286, 2667, 700, "ERRO", null], [2286, 2286, 600, "CORRETO", null],
    ]);
    // a causa aponta a hipótese de base (valor igual ao de um 4º colocado), não um acordo
    expect(ls.slice(0, 3).every((l) => l.causaCodigo === "BASE" && l.causaProvavel!.startsWith("Valor igual ao de um 4º colocado"))).toBe(true);
  });

  it("Etapa 2, EV #6 8-GAME: 1º esperado 1000 × 0,684 = 684 contra 547,20 (Erro); o 2º, 800 × 0,684 = 547,20, é Correto", async () => {
    const aud = conferido(await fixture(E2));
    expect([1, 2].map((p) => { const l = doTorneio(aud, "EV #6", p); return [l.registrado, l.esperado, l.situacao]; })).toEqual([[547.2, 684, "ERRO"], [547.2, 547.2, "CORRETO"]]);
  });

  it("Etapa 2, EV #2 200K PLO 5 K.O: 1º esperado 1000 × 0,84 × 2,5 = 2.100 (antes 1.680) contra 1.008; já era Erro", async () => {
    const aud = conferido(await fixture(E2));
    const um = doTorneio(aud, "EV #2", 1);
    const dois = doTorneio(aud, "EV #2", 2);
    expect([um.registrado, um.esperado, um.situacao, um.causaCodigo]).toEqual([1008, 2100, "ERRO", "SEM_CAUSA"]);
    expect([dois.registrado, dois.esperado, dois.situacao]).toEqual([1008, 1680, "ERRO"]);
  });

  it("não é acordo: 10º, 11º e 12º com 315 no mesmo torneio (mesma base 250); continua assim, sem marca de acordo", async () => {
    const aud = conferido(await fixture(E2));
    const dez = [10, 11, 12].map((p) => doTorneio(aud, "EV #2", p));
    expect(dez.map((l) => l.registrado)).toEqual([315, 315, 315]);
    expect(dez.every((l) => l.acordo == null && l.base === 250)).toBe(true);
  });

  it("Etapa 3: 430 erros e 124 corretos (antes 427 e 127); o 1º lugar de SUPER K.O, HIGH ROLLER 50K e CHAMPIONSHIP HIGH ROLLER 200K é Erro, o 2º continua Correto", async () => {
    const aud = conferido(await etapa3());
    expect(aud.resumo).toMatchObject({ total: 554, ERRO: 430, CORRETO: 124, PENDENTE_REGRA: 0 });
    expect(aud.linhas.filter((l) => l.acordo != null)).toEqual([]);
    // 1º = 1000 × f e 2º = 800 × f (o site pagou a base do 2º aos dois): 840 e 672; 1.215 e 972; 2.875 e 2.300
    for (const [nome, um, dois] of [["SUPER K.O", 840, 672], ["HIGH ROLLER 50K", 1215, 972], ["CHAMPIONSHIP HIGH ROLLER 200K", 2875, 2300]] as const) {
      const a = doTorneio(aud, nome, 1);
      const b = doTorneio(aud, nome, 2);
      expect([a.registrado, a.esperado, a.situacao]).toEqual([dois, um, "ERRO"]);
      expect([b.registrado, b.esperado, b.situacao]).toEqual([dois, dois, "CORRETO"]);
    }
  });
});

describe("com o acordo marcado na mão", () => {
  it("Etapa 2, K=4 no Dia Final: 150 erros e 120 corretos; as 4 linhas pontuam como 4º colocado (600 × 3,81 = 2.286) e são Corretas", async () => {
    const d = await fixture(E2);
    const aud = conferido(d, { [final(d).id]: 4 });
    expect(aud.resumo).toMatchObject({ total: 270, ERRO: 150, CORRETO: 120 });
    const ls = aud.linhas.filter((l) => l.torneioId === final(d).id && l.acordo != null);
    expect(ls).toHaveLength(4);
    expect(ls.every((l) => l.esperado === 2286 && l.base === 600 && l.situacao === "CORRETO" && l.acordo === 4)).toBe(true);
    // só o Dia Final tem acordo: o EV #6 e o EV #2 continuam como sem acordo
    expect(aud.linhas.filter((l) => l.acordo != null && l.torneioId !== final(d).id)).toEqual([]);
    expect(doTorneio(aud, "EV #6", 1).situacao).toBe("ERRO");
    // a conta: 153 − 3 (o 1º, o 2º e o 3º do Dia Final deixam de errar) = 150; 117 + 3 = 120
  });

  it("Etapa 2, K=3: o 1º ao 3º valem 700 × 3,81 = 2.667 (Erro, o site pagou 2.286); o 4º fica fora do acordo e continua Correto", async () => {
    const d = await fixture(E2);
    const k3 = conferido(d, { [final(d).id]: 3 });
    const lin = k3.linhas.filter((l) => l.torneioId === final(d).id && l.acordo != null);
    expect(lin).toHaveLength(3);
    expect(lin.every((l) => l.acordo === 3 && l.esperado === 2667 && l.registrado === 2286 && l.situacao === "ERRO")).toBe(true);
    const quarto = k3.linhas.find((l) => l.torneioId === final(d).id && l.posicao === 4)!;
    expect([quarto.acordo, quarto.acordoK, quarto.esperado, quarto.situacao]).toEqual([null, 3, 2286, "CORRETO"]);
    expect(k3.torneios.find((t) => t.torneioId === final(d).id)).toMatchObject({ acordo: 3 });
  });

  it("Etapa 3, K=2 no SUPER K.O: o 1º passa a valer 800 × 0,84 = 672, igual ao registrado; 429 erros e 125 corretos", async () => {
    const d = await etapa3();
    const t = d.torneios.find((x) => x.name === "SUPER K.O")!;
    const aud = conferido(d, { [t.id]: 2 });
    expect(aud.resumo).toMatchObject({ ERRO: 429, CORRETO: 125 }); // 430 − 1 e 124 + 1
    const um = doTorneio(aud, "SUPER K.O", 1);
    expect([um.registrado, um.esperado, um.situacao, um.acordo]).toEqual([672, 672, "CORRETO", 2]);
  });

  it("o verificador independente pega um motor que não aplicasse o acordo marcado", async () => {
    const d = await fixture(E2);
    const ac = { [final(d).id]: 4 };
    const aud = auditar(d, REGRAS_PADRAO, ac);
    expect(verificar(d, REGRAS_PADRAO, aud.linhas, aud.torneios, ac)).toEqual([]);
    const sem = aud.linhas.map((l) => (l.acordo != null ? { ...l, acordo: null } : l));
    expect(verificar(d, REGRAS_PADRAO, sem, aud.torneios, ac).length).toBeGreaterThan(0);
  });
});

describe("desempate: quem pontua por acordo marcado não conta como 1º lugar", () => {
  it("Etapa 2, K=4: o campeão do Dia Final deixa de contar o 1º lugar; só ele muda", async () => {
    const d = await fixture(E2);
    const aud = conferido(d, { [final(d).id]: 4 });
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
    const campeao = aud.linhas.find((l) => l.torneioId === final(d).id && l.posicao === 1)!.jogador;
    expect(sem[campeao] - com[campeao]).toBe(1); // o 1º do Dia Final (acordo de 4) deixa de contar
    const total = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);
    expect(total(sem) - total(com)).toBe(1); // só há um torneio com acordo: o EV #2 e o EV #6 não são mais acordo detectado
    // quem tem 1º lugar fora de acordo continua contando: contagem direta
    const esperado = aud.linhas.filter((l) => l.posicao === 1 && l.esperadoCent > 0 && !l.participacao && l.acordo == null).length;
    expect(total(com)).toBe(esperado);
  });

  it("sem acordo marcado, o 1º lugar do EV #2, do EV #6 e do Dia Final conta como primeiro lugar (antes, o acordo detectado tirava os 3)", async () => {
    const d = await fixture(E2);
    const aud = conferido(d);
    const c = consolidar([
      { numero: 2, jogadores: d.jogadores.map((j) => ({ nome: j.name, id: j.id })), linhas: aud.linhas.map((l) => ({ jogador: l.jogador, posicao: l.posicao, esperadoCent: l.esperadoCent, aguarda: l.situacao === "PENDENTE_REGRA", participacao: l.participacao, acordo: l.acordo != null })) },
    ]);
    const primeiros = Object.fromEntries(c.jogadores.map((j) => [j.nome, j.primeiros]));
    for (const nome of ["EV #2", "EV #6", "Main Event SPT — Dia Final"]) expect(primeiros[doTorneio(aud, nome, 1).jogador], nome).toBeGreaterThanOrEqual(1);
    expect(Object.values(primeiros).reduce((a, b) => a + b, 0)).toBe(aud.linhas.filter((l) => l.posicao === 1 && l.esperadoCent > 0 && !l.participacao).length);
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
