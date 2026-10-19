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
    expect(aud.resumo).toMatchObject({ total: 270, CORRETO: 134, ERRO: 10, ARREDONDAMENTO: 0, SUSPEITO: 0, PENDENTE_REGRA: 126 });
  });
  it("Rafael Bryan", () => {
    const rb = aud.linhas.filter((l) => l.jogador.startsWith("Rafael Bryan"));
    for (const [t, p, e] of [["EV #2", 10, 315], ["EV #8", 3, 2310], ["Dia Final", 7, 1524]] as const) {
      const l = rb.find((x) => x.torneio.includes(t) && x.posicao === p)!;
      expect(l, `${t} ${p}º`).toBeDefined();
      expect([l.esperado, l.registrado, l.situacao]).toEqual([e, e, "CORRETO"]);
    }
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
const torn = (aud: ReturnType<typeof auditar>) => aud.torneios as unknown as { torneio: string; players: number; achado: { fieldApi: number; fieldSite: number; diferenca: number; linhasExplicadas: number } | null; melhorCandidato: { field: number; linhas: number; de: number } | null }[];

describe("etapa 1 (taua-2026), a referência correta", () => {
  let dados: DadosSpt;
  let aud: ReturnType<typeof auditar>;
  beforeAll(async () => {
    dados = await fixture("taua-2026");
    aud = auditar(dados, REGRAS_PADRAO);
  });
  it("5 divergências de inscritos, uma por torneio", () => {
    const achados = torn(aud).filter((t) => t.achado).map((t) => [t.torneio, t.achado!.fieldApi, t.achado!.fieldSite, t.achado!.linhasExplicadas]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    expect(achados).toEqual([
      ["100K OMAHA Mystery Bounty", 25, 26, 25],
      ["200k High Roller", 85, 67, 85],
      ["Final Main Event", 135, 334, 135],
      ["High Roller 50K", 46, 52, 46],
      ["Second Chance 20K", 95, 100, 95],
    ].sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
  });
  it("0 erros; 440 corretos (54 + 386 com os inscritos do site); 202 aguardando regra", () => {
    expect(aud.resumo).toMatchObject({ total: 642, ERRO: 0, SUSPEITO: 0, ARREDONDAMENTO: 0, CORRETO: 54, CORRETO_SITE: 386, PENDENTE_REGRA: 202 });
    expect(sit(aud).CORRETO + sit(aud).CORRETO_SITE).toBe(440);
  });
  it("torneios sem divergência não têm achado", () => {
    for (const t of torn(aud).filter((x) => !x.achado && x.melhorCandidato)) expect(t.melhorCandidato!.field).toBe(t.players);
  });
  it("Gregory Faria, 200k High Roller, 16º sem prêmio: o inverso dá 67 inscritos", () => {
    const l = aud.linhas.find((x) => x.jogador.startsWith("Gregory Faria") && x.torneio === "200k High Roller")!;
    expect([l.posicao, l.registrado, l.situacao, l.field, l.fieldApi]).toEqual([16, 29.25, "CORRETO_SITE", 67, 85]);
    expect(l.inverso).toMatchObject({ fatorTotal: 2.925, fieldImplicito: 67 });
  });
  it("verificador e integridade fecham, nas duas opções de fora da premiação", () => {
    for (const foraDoItm of ["base10xFatores", "10fixos"] as const) {
      const regras = { ...REGRAS_PADRAO, foraDoItm };
      const a = auditar(dados, regras);
      expect(verificar(dados, regras, a.linhas, a.torneios)).toEqual([]);
      expect(() => conferir(dados, regras, a)).not.toThrow();
    }
  });
});

describe("etapa 2: sem divergência de inscritos", () => {
  it("0 achados; os mesmos 10 erros", async () => {
    const dados = await fixture("vale-suico-2026");
    const aud = auditar(dados, REGRAS_PADRAO);
    expect(torn(aud).filter((t) => t.achado)).toHaveLength(0);
    expect(aud.resumo).toMatchObject({ ERRO: 10, CORRETO: 134, CORRETO_SITE: 0, PENDENTE_REGRA: 126 });
    const erros = aud.linhas.filter((l) => l.situacao === "ERRO").map((l) => `${l.torneio.slice(0, 7)}|${l.posicao}|${l.registrado}|${l.esperado}`).sort();
    expect(erros).toEqual([
      "EV #11 |8|10|12.75", "EV #2 2|1|1008|1260", "EV #6 8|1|547.2|684", "EV #8 C|14|10|33", "EV #8 C|15|10|33", "EV #8 C|16|10|33",
      "Main Ev|1|2286|3810", "Main Ev|2|2286|3048", "Main Ev|3|2286|2667", "Main Ev|64|10|38.1",
    ]);
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
