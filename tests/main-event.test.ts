import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarDados, type DadosSpt } from "../lib/api-spt";
import { auditar } from "../lib/auditoria";
import { conferir } from "../lib/integridade";
import { dadosDaPlanilha } from "../lib/planilha-guardada";
import { BOUNTY_API } from "./bounty-mock";
import { REGRAS_PADRAO } from "../lib/regras";
import { verificar } from "../lib/verificador";

// Main Event como um torneio só [CONFIRMADO 05/11/2026]: cada jogador pontua uma vez; participantes = soma das entradas (players) dos flights.
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

const auditado = (d: DadosSpt) => {
  const aud = auditar(d, REGRAS_PADRAO);
  conferir(d, REGRAS_PADRAO, aud); // o verificador independente concorda em todas as linhas
  expect(verificar(d, REGRAS_PADRAO, aud.linhas, aud.torneios)).toEqual([]);
  return aud;
};

// Os cinco flights da Etapa 3 como o site os informa (flightsDoSite): 77 + 64 + 55 + 67 + 65 = 328.
const FLIGHTS_E3 = [77, 64, 55, 67, 65].map((players, i) => ({ id: `f${i}`, name: `Dia 1 ${"ABCDE"[i]}`, buyIn: 1000, players, role: "FLIGHT", flightLabel: `1${"ABCDE"[i]}`, status: "FINISHED" }));
async function etapa3() {
  vi.stubGlobal("fetch", async () => ({ ok: true, status: 200, json: async () => ({ tournaments: [...FLIGHTS_E3, ...BOUNTY_API] }) }));
  const registro = { arquivo: "x.xlsx", enviadoEm: "2026-11-05T00:00:00Z", tamanho: 1, sha256: "x", inscritosDiaFinal: null, resumo: {}, avisos: [] };
  return dadosDaPlanilha(new Uint8Array(readFileSync("tests/fixtures/ranking-spt-3a-etapa.xlsx")), registro as never);
}

describe("campo do Main Event: soma das entradas dos flights, por etapa", () => {
  it("Etapa 1: 202 = 83+47+55+17 (os 334 do site não fecham: aparece como divergência de inscritos)", async () => {
    const d = await fixture("taua-2026");
    const aud = auditado(d);
    const final = aud.torneios.find((t) => t.torneio === "Final Main Event")!;
    expect([final.field, final.fieldDeduzido]).toEqual([202, 334]);
    expect(final.achado).toMatchObject({ fieldApi: 202, fieldSite: 334, linhasExplicadas: 135 });
    const flights = aud.torneios.filter((t) => /Dia 1[A-E]$/i.test(t.torneio));
    expect(flights.every((t) => t.field === 202)).toBe(true);
    expect(flights.map((t) => t.players).sort((a, b) => a - b)).toEqual([17, 47, 55, 83]);
  });
  it("Etapa 2: 331 = 96+50+64+67+54", async () => {
    const d = await fixture("vale-suico-2026");
    const aud = auditado(d);
    expect(aud.torneios.find((t) => t.torneio.includes("Dia Final"))!.field).toBe(331);
    expect(aud.linhas.find((l) => l.causaProvavel.includes("campo: soma dos flights"))!.causaProvavel).toContain("campo: soma dos flights 331 = 96+50+64+67+54");
  });
  it("Etapa 3: 328 = 77+64+55+67+65 (flights lidos do site por nome)", async () => {
    const aud = auditado(await etapa3());
    expect(aud.torneios.find((t) => t.torneio.includes("Dia Final"))!.field).toBe(328);
  });
});

describe("Dia Final sem posição: 10 × fatores, uma vez", () => {
  it("Etapa 2: Rafael Bryan, 7º, segue correto; Auro Damazio De Assis (sem posição) esperado 38,1 contra 10", async () => {
    const aud = auditado(await fixture("vale-suico-2026"));
    const rb = aud.linhas.find((l) => l.jogador === "Rafael Bryan" && l.torneio.includes("Dia Final") && l.posicao === 7)!;
    expect([rb.base, rb.fatorParticipantes, rb.fatorBuyIn, rb.esperado, rb.registrado, rb.situacao]).toEqual([400, 3.81, 1, 1524, 1524, "CORRETO"]);
    const auro = aud.linhas.find((l) => l.jogador.startsWith("Auro Damazio") && l.torneio.includes("Dia Final"))!;
    expect([auro.posicao, auro.esperado, auro.registrado, auro.situacao, auro.pendencia, auro.fatorParticipantes]).toEqual([null, 38.1, 10, "ERRO", null, 3.81]);
    const sem = aud.linhas.filter((l) => l.torneio.includes("Dia Final") && l.posicao == null);
    expect(sem).toHaveLength(126);
    expect(sem.every((l) => l.esperado === 38.1 && l.participacao && l.pendencia == null)).toBe(true);
    expect(aud.linhas.filter((l) => l.situacao === "PENDENTE_REGRA")).toHaveLength(0);
  });
  it("Etapa 3: campo 328, fator 3,78; linha sem posição esperado 37,8 contra 10", async () => {
    const aud = auditado(await etapa3());
    const sem = aud.linhas.filter((l) => l.torneio.includes("Dia Final") && l.posicao == null);
    expect(sem).toHaveLength(135);
    expect(sem.every((l) => l.field === 328 && l.fatorParticipantes === 3.78 && l.esperado === 37.8 && l.registrado === 10 && l.situacao === "ERRO")).toBe(true);
    expect(aud.linhas.filter((l) => l.situacao === "PENDENTE_REGRA")).toHaveLength(0);
  });
});

describe("Etapa 1: uma pontuação por jogador no Main Event", () => {
  it("finalista com flight: a pontuação vale no flight e o Dia Final vale 0 (Anderson De Carvalho Costa)", async () => {
    const aud = auditado(await fixture("taua-2026"));
    const f = aud.linhas.find((l) => l.jogador.startsWith("Anderson De Carvalho") && l.torneio.endsWith("Dia 1D"))!;
    // O flight carrega a pontuação do Dia Final (76º, campo 202: 10 × 2,52 × 1,0 = 25,2 com os inscritos da API; 38,4 com os 334 do site, que reproduzem as 135 linhas do Dia Final).
    expect([f.esperado, f.esperadoApi, f.field, f.fieldApi, f.registrado, f.situacao, f.causaCodigo]).toEqual([38.4, 25.2, 334, 202, 12.1, "ERRO", "FLIGHT_ZERO"]);
    expect(f.causaProvavel).toContain("Flight de jogador que chegou ao Dia Final: a pontuação do Main Event vale no flight");
    const fin = aud.linhas.find((l) => l.jogador.startsWith("Anderson De Carvalho") && l.torneio === "Final Main Event")!;
    expect([fin.posicao, fin.esperado, fin.registrado, fin.situacao, fin.conta]).toEqual([76, 0, 38.4, "ERRO", "0: a pontuação do Main Event vale no flight"]);
  });
  it("jogador com 2 ou 3 flights e sem Final: a primeira linha vale 10 × fatores e as outras 0", async () => {
    const aud = auditado(await fixture("taua-2026"));
    const comFinal = new Set(aud.linhas.filter((l) => l.torneio === "Final Main Event").map((l) => l.jogador));
    const porJogador = new Map<string, typeof aud.linhas>();
    for (const l of aud.linhas) if (/Dia 1[A-E]$/i.test(l.torneio) && !comFinal.has(l.jogador)) porJogador.set(l.jogador, [...(porJogador.get(l.jogador) ?? []), l]);
    const varios = [...porJogador.values()].filter((ls) => ls.length >= 2);
    expect(varios.length).toBe(22);
    expect(varios.some((ls) => ls.length === 3)).toBe(true);
    for (const ls of varios) {
      const ordem = [...ls].sort((a, b) => (a.torneio.slice(-1) < b.torneio.slice(-1) ? -1 : 1));
      expect(ordem[0].esperado).toBe(25.2); // 10 × (202/100 + 0,5) × 1,0
      expect(ordem[0].causaCodigo).toBe("PARTICIPACAO");
      for (const outra of ordem.slice(1)) expect([outra.esperado, outra.causaCodigo]).toEqual([0, "FLIGHT_ZERO"]);
      expect(ordem[1].causaProvavel).toContain("Jogou mais de um flight: vale só o primeiro");
    }
  });
  it("jogador com um flight só e sem Final: 10 × fatores com o campo 202", async () => {
    const aud = auditado(await fixture("taua-2026"));
    const comFinal = new Set(aud.linhas.filter((l) => l.torneio === "Final Main Event").map((l) => l.jogador));
    const flights = aud.linhas.filter((l) => /Dia 1[A-E]$/i.test(l.torneio));
    const contagem = new Map<string, number>();
    for (const l of flights) contagem.set(l.jogador, (contagem.get(l.jogador) ?? 0) + 1);
    const unicos = flights.filter((l) => !comFinal.has(l.jogador) && contagem.get(l.jogador) === 1);
    expect(unicos.length).toBe(85);
    expect(unicos.every((l) => l.esperado === 25.2 && l.field === 202 && l.fatorParticipantes === 2.52 && l.fatorBuyIn === 1)).toBe(true);
  });
  it("nenhuma linha aguarda regra por FLIGHT ou FINAL_SEM_POSICAO nas três etapas", async () => {
    for (const a of [auditado(await fixture("taua-2026")), auditado(await fixture("vale-suico-2026")), auditado(await etapa3())]) {
      expect(a.linhas.filter((l) => l.pendencia != null)).toEqual([]);
      expect(a.linhas.filter((l) => l.situacao === "PENDENTE_REGRA")).toHaveLength(0);
    }
  });
});
