import { readFileSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buscarDados, type DadosSpt } from "../lib/api-spt";
import { auditar } from "../lib/auditoria";
import { conferir, ErroAuditoria, identificador } from "../lib/integridade";
import { REGRAS_PADRAO } from "../lib/regras";
import { verificar } from "../lib/verificador";

// Congela o fetch: serve as respostas gravadas em tests/fixtures, sem internet.
function fixture(stage: string) {
  const fx = JSON.parse(readFileSync(`tests/fixtures/${stage}.json`, "utf8"));
  vi.stubGlobal("fetch", async (url: string) => {
    const u = new URL(url);
    const body = u.pathname.endsWith("/ranking")
      ? fx.ranking
      : u.pathname.endsWith("/tournaments")
        ? fx.tournaments
        : fx.playerSummaries[u.searchParams.get("name")!];
    return { ok: true, status: 200, json: async () => body };
  });
  return buscarDados(stage);
}
afterEach(() => vi.unstubAllGlobals());

describe("etapa 2 (vale-suico-2026), regras padrão", () => {
  let dados: DadosSpt;
  let aud: ReturnType<typeof auditar>;
  beforeAll(async () => {
    dados = await fixture("vale-suico-2026");
    aud = auditar(dados, REGRAS_PADRAO);
  });
  const linha = (jogador: string, torneio: string, pos: number) =>
    aud.linhas.find((l) => l.jogador === jogador && l.torneio.includes(torneio) && l.posicao === pos)!;

  it("contagens", () => {
    // Sem acordo marcado (VERSAO_REGRAS 2.10): 117 corretos e 153 erros = 27 listados + 126 do Dia Final sem posição (antes: 121 e 149, com 4 linhas de acordo detectado)
    expect(aud.resumo).toMatchObject({ total: 270, CORRETO: 117, ERRO: 27 + 126, ARREDONDAMENTO: 0, SUSPEITO: 0, PENDENTE_REGRA: 0 });
  });
  it("Rafael Bryan", () => {
    const rb = aud.linhas.filter((l) => l.jogador.startsWith("Rafael Bryan"));
    for (const [t, p, e] of [["EV #8", 3, 2310], ["Dia Final", 7, 1524]] as const) {
      const l = rb.find((x) => x.torneio.includes(t) && x.posicao === p)!;
      expect(l, `${t} ${p}º`).toBeDefined();
      expect([l.esperado, l.registrado, l.situacao]).toEqual([e, e, "CORRETO"]);
    }
    // K.O: buy-in total 2000 + 1000 = 3000, fator 2,5 [CONFIRMADO 05/11/2026]: 250 × 0,84 × 2,5 = 525; o site pagou 315 (fator 1,5).
    const ko = rb.find((x) => x.torneio.includes("EV #2") && x.posicao === 10)!;
    expect([ko.esperado, ko.registrado, ko.situacao, ko.buyIn, ko.buyInFator, ko.fatorBuyIn]).toEqual([525, 315, "ERRO", 2000, 3000, 2.5]);
  });
  it("erros conhecidos", () => {
    for (const p of [14, 15, 16]) {
      const l = aud.linhas.find((x) => x.torneio.startsWith("EV #8") && x.posicao === p)!;
      expect([l.esperado, l.situacao]).toEqual([33, "ERRO"]);
    }
    const l = aud.linhas.find((x) => x.torneio.includes("Dia Final") && x.posicao === 64)!;
    expect([l.esperado, l.situacao]).toEqual([38.1, "ERRO"]);
  });
  it("verificador e integridade fecham", () => {
    expect(verificar(dados, REGRAS_PADRAO, aud.linhas, aud.torneios)).toEqual([]);
    expect(() => conferir(dados, REGRAS_PADRAO, aud)).not.toThrow();
  });
  it("identificador", () => {
    const id = identificador(dados);
    expect(id.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(id.versaoRegras).toBeTruthy();
  });
  it("verificador pega linha adulterada", () => {
    const ruim = aud.linhas.map((l, i) => (i === 0 ? { ...l, esperadoCent: l.esperadoCent + 1 } : l));
    expect(verificar(dados, REGRAS_PADRAO, ruim, aud.torneios)).toHaveLength(1);
  });
  it("integridade trava com role desconhecido", () => {
    const d2 = structuredClone(dados);
    d2.torneios[0].role = "XYZ";
    expect(() => conferir(d2, REGRAS_PADRAO, auditar(d2, REGRAS_PADRAO))).toThrow(ErroAuditoria);
  });
  it("integridade trava com soma do ranking errada", () => {
    const d2 = structuredClone(dados);
    d2.jogadores[0].rankingPoints += 1;
    try {
      conferir(d2, REGRAS_PADRAO, auditar(d2, REGRAS_PADRAO));
      expect.unreachable();
    } catch (e) {
      expect((e as ErroAuditoria).detalhes.join()).toMatch(/soma/);
    }
  });
});

const sit = (aud: ReturnType<typeof auditar>) => aud.resumo as unknown as Record<string, number>;
const torn = (aud: ReturnType<typeof auditar>) => aud.torneios as unknown as { torneio: string; players: number; field: number; achado: { fieldApi: number; fieldSite: number; diferenca: number; linhasExplicadas: number } | null; melhorCandidato: { field: number; linhas: number; de: number } | null }[];

describe("etapa 1 (taua-2026), a referência correta", () => {
  let dados: DadosSpt;
  let aud: ReturnType<typeof auditar>;
  beforeAll(async () => {
    dados = await fixture("taua-2026");
    aud = auditar(dados, REGRAS_PADRAO);
  });
  it("4 divergências de inscritos, uma por torneio (o Main Event usa os 334 informados pelo usuário)", () => {
    const achados = torn(aud).filter((t) => t.achado).map((t) => [t.torneio, t.achado!.fieldApi, t.achado!.fieldSite, t.achado!.linhasExplicadas]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    expect(achados).toEqual([
      ["100K OMAHA Mystery Bounty", 25, 26, 25],
      ["200k High Roller", 85, 67, 85],
      ["High Roller 50K", 46, 52, 46],
      ["Second Chance 20K", 95, 100, 95],
    ].sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
  });
  it("440 corretos (189 + 251 com os inscritos do site); os 202 flights viram Erro, nenhum aguarda regra", () => {
    // Main Event avaliado por linha [usuário, 06/11/2026], com o campo de 334 buy-ins informado pelo usuário: o primeiro flight é participação
    // (10 × 3,84 × 1,0 = 38,4) e o Dia Final vale pela própria posição; as 135 linhas do Dia Final batem com o site.
    expect(aud.resumo).toMatchObject({ total: 642, ERRO: 202, SUSPEITO: 0, ARREDONDAMENTO: 0, CORRETO: 189, CORRETO_SITE: 251, PENDENTE_REGRA: 0 });
    expect(sit(aud).CORRETO + sit(aud).CORRETO_SITE).toBe(440);
    const flights = aud.linhas.filter((l) => /Dia 1[A-E]$/i.test(l.torneio));
    expect(flights).toHaveLength(202);
    expect(flights.every((l) => l.situacao === "ERRO" && l.pendencia == null && l.field === 334)).toBe(true);
    expect(flights.filter((l) => l.esperado === 0)).toHaveLength(44); // já pontuaram em outro flight
    expect(flights.filter((l) => l.esperado === 38.4)).toHaveLength(158); // primeiro flight: 10 × 3,84 × 1,0, chegando ou não ao Dia Final
    expect(aud.linhas.filter((l) => l.torneio === "Final Main Event").every((l) => l.situacao === "CORRETO" && l.field === 334)).toBe(true);
  });
  it("torneios sem divergência não têm achado", () => {
    for (const t of torn(aud).filter((x) => !x.achado && x.melhorCandidato)) expect(t.melhorCandidato!.field).toBe(t.field); // o campo usado (inscritos; no Main Event, 334)
  });
  it("Gregory Faria, 200k High Roller, 16º sem prêmio: o inverso dá 67 inscritos", () => {
    const l = aud.linhas.find((x) => x.jogador.startsWith("Gregory Faria") && x.torneio === "200k High Roller")!;
    expect([l.posicao, l.registrado, l.situacao, l.field, l.fieldApi]).toEqual([16, 29.25, "CORRETO_SITE", 67, 85]);
    expect(l.inverso).toMatchObject({ fatorTotal: 2.925, fieldImplicito: 67 });
  });
  it("verificador e integridade fecham, com as regras padrão", () => {
    const a = auditar(dados, REGRAS_PADRAO);
    expect(verificar(dados, REGRAS_PADRAO, a.linhas, a.torneios)).toEqual([]);
    expect(() => conferir(dados, REGRAS_PADRAO, a)).not.toThrow();
  });
});

describe("etapa 2: sem divergência de inscritos", () => {
  it("0 achados; os 10 erros de antes, as 6 linhas do Omaha Mystery (fator 1,5) e as 12 do K.O EV #2 (fator 2,5)", async () => {
    const dados = await fixture("vale-suico-2026");
    const aud = auditar(dados, REGRAS_PADRAO);
    expect(torn(aud).filter((t) => t.achado)).toHaveLength(0);
    expect(aud.resumo).toMatchObject({ ERRO: 27 + 126, CORRETO: 117, CORRETO_SITE: 0, PENDENTE_REGRA: 0 });
    const erros = aud.linhas.filter((l) => l.situacao === "ERRO" && !(l.torneio.includes("Dia Final") && l.posicao == null)).map((l) => `${l.torneio.slice(0, 7)}|${l.posicao}|${l.registrado}|${l.esperado}`).sort();
    expect(erros).toEqual([
      "EV #11 |8|10|12.75",
      "EV #2 2|1|1008|2100", "EV #2 2|2|1008|1680", "EV #2 2|3|882|1470", "EV #2 2|4|756|1260", "EV #2 2|5|630|1050", "EV #2 2|6|567|945",
      "EV #2 2|7|504|840", "EV #2 2|8|441|735", "EV #2 2|9|378|630", "EV #2 2|10|315|525", "EV #2 2|11|315|525", "EV #2 2|12|315|525",
      "EV #6 8|1|547.2|684", // 1º do 8-GAME: 1.000 × 0,684 = 684 (o site pagou 547,20 = base do 2º)
      "EV #5 1|1|744|930", "EV #5 1|2|595.2|744", "EV #5 1|3|520.8|651", "EV #5 1|4|446.4|558", "EV #5 1|5|372|465", "EV #5 1|6|334.8|418.5",
      "EV #8 C|14|10|33", "EV #8 C|15|10|33", "EV #8 C|16|10|33",
      "Main Ev|1|2286|3810", "Main Ev|2|2286|3048", "Main Ev|3|2286|2667", // Dia Final sem acordo marcado: 1.000, 800 e 700 × 3,81 (o 4º, 600 × 3,81 = 2.286, é Correto)
      "Main Ev|64|10|38.1",
    ].sort());
  });
  it("Omaha Mystery (1500 + 1000) e K.O (2000 + 1000, 500 + 500): bounty somado ao buy-in, buy-in exibido não muda, verificador concorda", async () => {
    const dados = await fixture("vale-suico-2026");
    const aud = auditar(dados, REGRAS_PADRAO);
    const mystery = aud.linhas.filter((l) => l.torneio.includes("OMAHA MYSTERY")).sort((a, b) => a.posicao! - b.posicao!);
    expect(mystery.map((l) => [l.posicao, l.buyIn, l.buyInFator, l.fatorBuyIn, l.fatorParticipantes, l.esperado, l.situacao])).toEqual([
      [1, 1500, 2500, 1.5, 0.62, 930, "ERRO"], [2, 1500, 2500, 1.5, 0.62, 744, "ERRO"], [3, 1500, 2500, 1.5, 0.62, 651, "ERRO"],
      [4, 1500, 2500, 1.5, 0.62, 558, "ERRO"], [5, 1500, 2500, 1.5, 0.62, 465, "ERRO"], [6, 1500, 2500, 1.5, 0.62, 418.5, "ERRO"],
    ]);
    expect(mystery.every((l) => l.somaBounty === 1000 && l.tipoBounty === "MYSTERY")).toBe(true);
    // K.O soma o bounty: EV #2 2000 + 1000 = 3000 → 2,5; Super K.O 500 + 500 = 1000 → 1,0 (a mesma faixa do buy-in sozinho).
    for (const [nome, bounty, total, fb] of [["EV #2", 1000, 3000, 2.5], ["SUPER K.O", 500, 1000, 1]] as const) {
      const ls = aud.linhas.filter((l) => l.torneio.includes(nome));
      expect(ls.length).toBeGreaterThan(0);
      expect(ls.every((l) => l.fatorBuyIn === fb && l.somaBounty === bounty && l.tipoBounty === "KO" && l.buyInFator === total)).toBe(true);
    }
    // Sem bounty: nada soma.
    for (const l of aud.linhas.filter((x) => !/OMAHA MYSTERY|EV #2|SUPER K\.O/.test(x.torneio))) expect([l.somaBounty, l.tipoBounty, l.buyInFator === l.buyIn]).toEqual([null, null, true]);
    expect(verificar(dados, REGRAS_PADRAO, aud.linhas, aud.torneios)).toEqual([]);
  });
});

describe("cálculo inverso nunca dá valor impossível", () => {
  it.each(["taua-2026", "vale-suico-2026"])("%s", async (stage) => {
    const aud = auditar(await fixture(stage), REGRAS_PADRAO);
    const com = aud.linhas.filter((l) => l.inverso);
    expect(com.length).toBeGreaterThan(0);
    for (const l of com) {
      const f = l.inverso!.fieldImplicito;
      expect(f === null || (Number.isInteger(f) && f >= 1), `${l.jogador} ${l.torneio}`).toBe(true);
      expect(l.inverso!.fatorTotal).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("identificador dos dados", () => {
  it("não depende do updatedAt nem da ordem; muda com 1 centésimo", async () => {
    const dados = await fixture("vale-suico-2026");
    const a = identificador(dados).sha256;
    const outro = structuredClone(dados);
    outro.updatedAt = { ranking: "2030-01-01T00:00:00.000Z", tournaments: "2030-01-01T00:00:00.000Z" };
    outro.jogadores.reverse();
    outro.torneios.reverse();
    expect(identificador(outro).sha256).toBe(a);
    const alterado = structuredClone(dados);
    alterado.jogadores[0].resultados[0].points += 0.01;
    expect(identificador(alterado).sha256).not.toBe(a);
  });
});

describe("verificador pega divergência de inscritos adulterada", () => {
  it("achado com inscritos do site trocado", async () => {
    const dados = await fixture("taua-2026");
    const aud = auditar(dados, REGRAS_PADRAO);
    const ruim = structuredClone(torn(aud));
    const t = ruim.find((x) => x.achado)!;
    t.achado!.fieldSite += 1;
    expect(verificar(dados, REGRAS_PADRAO, aud.linhas, ruim as never).length).toBeGreaterThan(0);
  });
});
