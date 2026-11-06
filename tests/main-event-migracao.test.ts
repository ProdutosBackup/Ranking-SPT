import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DadosSpt } from "../lib/api-spt";
import { auditar } from "../lib/auditoria";
import { consolidar } from "../lib/consolidado";
import { identificador } from "../lib/integridade";
import { montarResposta } from "../lib/painel";
import { dadosDaPlanilha } from "../lib/planilha-guardada";
import { PARTICIPACAO } from "../lib/participacao";
import { REGRAS_PADRAO } from "../lib/regras";
import { verificar } from "../lib/verificador";
import { BOUNTY_API } from "./bounty-mock";

// Main Event [CONFIRMADO 05/11/2026]: "O player premia ao longo dos flights e não no dia final. O dia final é somente uma continuação dos flights."
// Quem jogou flight e chegou ao Dia Final leva a pontuação do Dia Final para o primeiro flight; a linha do Dia Final vale 0.
const E1 = "taua-2026";
const E2 = "vale-suico-2026";
const E3 = "bendito-cacao-2026";
const FLIGHTS = [77, 64, 55, 67, 65].map((players, i) => ({ id: `f${i}`, name: `Dia 1 ${"ABCDE"[i]}`, buyIn: 1000, players, role: "FLIGHT", flightLabel: `1${"ABCDE"[i]}`, status: "FINISHED" }));
afterEach(() => vi.unstubAllGlobals());

function site(stage: string): DadosSpt {
  const fx = JSON.parse(readFileSync(`tests/fixtures/${stage}.json`, "utf8"));
  return {
    stage,
    updatedAt: { ranking: fx.ranking.updatedAt, tournaments: fx.tournaments.updatedAt },
    torneios: fx.tournaments.tournaments,
    jogadores: fx.ranking.ranking.map((p: { name: string; rank: number; points: number }) => ({ name: p.name, rank: p.rank, rankingPoints: p.points, resultados: fx.playerSummaries[p.name].results })),
  };
}
async function planilha(): Promise<DadosSpt> {
  vi.stubGlobal("fetch", async () => ({ ok: true, status: 200, json: async () => ({ tournaments: [...FLIGHTS, ...BOUNTY_API] }) }));
  const registro = { arquivo: "x.xlsx", enviadoEm: "2026-11-05T00:00:00Z", tamanho: 1, sha256: "x", inscritosDiaFinal: null, resumo: {}, avisos: [] };
  return dadosDaPlanilha(new Uint8Array(readFileSync("tests/fixtures/ranking-spt-3a-etapa.xlsx")), registro as never);
}
const dadosDe = (s: string) => (s === E3 ? planilha() : Promise.resolve(site(s)));

// Linha de base gravada ANTES da mudança (tests/fixtures/base-antes-main-event.json): totais por jogador nos 4 cenários, posição e contagens.
const ANTES = JSON.parse(readFileSync("tests/fixtures/base-antes-main-event.json", "utf8")) as Record<string, { erros: number; corretos: number; jogadores: Record<string, { esperado: number; A: number; B: number; C: number | null; D: number | null; primeiros: number; posicao: number }> }>;

async function depois(stage: string) {
  const d = await dadosDe(stage);
  const aud = auditar(d, REGRAS_PADRAO);
  expect(verificar(d, REGRAS_PADRAO, aud.linhas, aud.torneios)).toEqual([]); // motor e verificador concordam em todas as linhas e nos 4 cenários
  const r = montarResposta(stage, d, REGRAS_PADRAO, aud, identificador(d));
  const c = consolidar([{ numero: 1, jogadores: r.painel.jogadores.map((j) => ({ nome: j.nome, id: j.id })), linhas: r.linhas.map((l) => ({ jogador: l.jogador, posicao: l.posicaoPontua, esperadoCent: Math.round(l.esperado * 100), aguarda: l.classe === "aguarda", participacao: l.participacao, acordo: l.acordo != null, registradoCent: l.registradoCent, cenarios: l.cenarios, cenariosMotivo: l.cenariosMotivo })) }]);
  return { d, aud, r, c };
}

describe("Main Event: a pontuação vale no primeiro flight; o Dia Final é continuação", () => {
  it("o total por jogador no Consolidado não muda, nos 4 cenários, nas 3 etapas", async () => {
    for (const s of [E1, E2, E3]) {
      const { c } = await depois(s);
      const antes = ANTES[s].jogadores;
      expect(c.jogadores).toHaveLength(Object.keys(antes).length);
      for (const j of c.jogadores) {
        const a = antes[j.nome];
        expect({ esperado: j.totalCent, A: j.cenarios.A.totalCent, B: j.cenarios.B.totalCent, C: j.cenarios.C.totalCent, D: j.cenarios.D.totalCent }, `${s} ${j.nome}`).toEqual({ esperado: a.esperado, A: a.A, B: a.B, C: a.C, D: a.D });
      }
    }
  });

  it("Etapas 2 e 3 não mudam: correto e erro idênticos aos de antes", async () => {
    for (const s of [E2, E3]) {
      const { r } = await depois(s);
      expect([r.painel.indicadores.corretos, r.painel.indicadores.erros], s).toEqual([ANTES[s].corretos, ANTES[s].erros]);
    }
    expect([ANTES[E2].corretos, ANTES[E2].erros, ANTES[E3].corretos, ANTES[E3].erros]).toEqual([121, 149, 127, 427]);
    const { aud } = await depois(E2);
    const rb = aud.linhas.find((l) => l.jogador === "Rafael Bryan" && l.torneio.includes("Dia Final") && l.posicao === 7)!;
    expect([rb.esperado, rb.registrado, rb.situacao]).toEqual([1524, 1524, "CORRETO"]); // sem flights nos resultados: o Dia Final continua carregando
  });

  it("Etapa 1: as linhas que mudaram de lugar", async () => {
    const { aud } = await depois(E1);
    const final = aud.linhas.filter((l) => l.torneio === "Final Main Event");
    const comFlight = new Set(aud.linhas.filter((l) => /Dia 1[A-E]$/i.test(l.torneio)).map((l) => l.jogador));
    const cedentes = final.filter((l) => comFlight.has(l.jogador));
    expect(final).toHaveLength(135);
    expect(cedentes).toHaveLength(51); // 51 finalistas jogaram flight
    expect(cedentes.every((l) => l.esperado === 0 && l.situacao === "ERRO" && l.causaProvavel.startsWith(PARTICIPACAO.finalCedido))).toBe(true);
    expect(cedentes.every((l) => l.conta === PARTICIPACAO.contaZeroFlight)).toBe(true);
    // os 84 finalistas sem flight seguem iguais: a linha do Dia Final carrega
    expect(final.filter((l) => !comFlight.has(l.jogador)).every((l) => l.esperado > 0 && l.situacao === "CORRETO_SITE")).toBe(true);
    // o primeiro flight (1A, 1C, 1D, 1E) de cada um desses 51 carrega a pontuação do Dia Final
    for (const f of cedentes) {
      const flights = aud.linhas.filter((l) => l.jogador === f.jogador && /Dia 1[A-E]$/i.test(l.torneio)).sort((a, b) => (a.torneio.slice(-1) < b.torneio.slice(-1) ? -1 : 1));
      expect([flights[0].esperado, flights[0].esperadoCent, flights[0].cenarios]).toEqual([f.esperado === 0 ? flights[0].esperado : 0, flights[0].esperadoCent, flights[0].cenarios]);
      expect(flights[0].esperado).toBeGreaterThan(0);
      expect(flights[0].causaProvavel).toContain(PARTICIPACAO.flightComFinal);
      for (const outra of flights.slice(1)) expect([outra.esperado, outra.causaCodigo]).toEqual([0, "FLIGHT_ZERO"]);
    }
  });

  it("Anderson De Carvalho Costa: Dia 1D com a pontuação, Dia Final com 0, o mesmo total de antes", async () => {
    const { aud, c } = await depois(E1);
    const f = aud.linhas.find((l) => l.jogador.startsWith("Anderson De Carvalho") && l.torneio.endsWith("Dia 1D"))!;
    const fin = aud.linhas.find((l) => l.jogador.startsWith("Anderson De Carvalho") && l.torneio === "Final Main Event")!;
    // Com os 334 inscritos do site (que reproduzem as 135 linhas do Dia Final) a linha vale 38,4; com o campo da API (202) vale 10 × 2,52 = 25,2.
    expect([f.esperado, f.esperadoApi, f.field, f.fieldApi, f.registrado, f.situacao, f.causaCodigo]).toEqual([38.4, 25.2, 334, 202, 12.1, "ERRO", "FLIGHT_ZERO"]);
    expect(f.causaProvavel).toContain("Flight de jogador que chegou ao Dia Final: a pontuação do Main Event vale no flight");
    expect([fin.esperado, fin.esperadoApi, fin.registrado, fin.situacao]).toEqual([0, 0, 38.4, "ERRO"]);
    expect(fin.conta).toBe("0: a pontuação do Main Event vale no flight");
    expect(fin.causaProvavel).toContain("Dia Final de jogador que jogou flight: a pontuação do jogador vale no flight dele");
    expect(fin.conta).not.toContain("10 pontos fixos");
    const j = c.jogadores.find((x) => x.nome.startsWith("Anderson De Carvalho"))!;
    expect(j.totalCent).toBe(ANTES[E1].jogadores[j.nome].esperado); // 1.089,80, como antes
  });

  it("jogador só de flights, sem Dia Final, não muda: primeira linha 10 × fatores (25,2) e as outras 0", async () => {
    const { aud } = await depois(E1);
    const comFinal = new Set(aud.linhas.filter((l) => l.torneio === "Final Main Event").map((l) => l.jogador));
    const flights = aud.linhas.filter((l) => /Dia 1[A-E]$/i.test(l.torneio) && !comFinal.has(l.jogador));
    const porJ = new Map<string, typeof flights>();
    for (const l of flights) porJ.set(l.jogador, [...(porJ.get(l.jogador) ?? []), l]);
    expect(porJ.size).toBe(107);
    for (const ls of porJ.values()) {
      const ord = [...ls].sort((a, b) => (a.torneio.slice(-1) < b.torneio.slice(-1) ? -1 : 1));
      expect([ord[0].esperado, ord[0].causaCodigo === "FLIGHT_ZERO"]).toEqual([25.2, false]);
      for (const o of ord.slice(1)) expect([o.esperado, o.causaCodigo]).toEqual([0, "FLIGHT_ZERO"]);
    }
  });

  it("jogador de 2 ou 3 flights e Dia Final: a pontuação fica só na primeira linha de flight", async () => {
    const { aud } = await depois(E1);
    const final = new Set(aud.linhas.filter((l) => l.torneio === "Final Main Event").map((l) => l.jogador));
    const porJ = new Map<string, typeof aud.linhas>();
    for (const l of aud.linhas) if (/Dia 1[A-E]$/i.test(l.torneio) && final.has(l.jogador)) porJ.set(l.jogador, [...(porJ.get(l.jogador) ?? []), l]);
    const varios = [...porJ.values()].filter((ls) => ls.length >= 2);
    expect(varios.length).toBeGreaterThan(0);
    for (const ls of varios) {
      const ord = [...ls].sort((a, b) => (a.torneio.slice(-1) < b.torneio.slice(-1) ? -1 : 1));
      expect(ord[0].esperado).toBeGreaterThan(0);
      for (const o of ord.slice(1)) expect([o.esperado, o.cenarios.A, o.cenarios.B]).toEqual([0, 0, 0]);
    }
  });

  it("acordo no Dia Final: os pontos do acordo vão para o primeiro flight (mesmo valor), e o Dia Final vale 0", async () => {
    // Etapa 1 com acordo informado de 3 colocados no Final Main Event: quem tem flight leva o valor do acordo para o flight.
    const d = site(E1);
    const t = d.torneios.find((x) => x.name === "Final Main Event")!;
    const aud0 = auditar(d, REGRAS_PADRAO);
    const aud = auditar(d, REGRAS_PADRAO, { [t.id]: 3 });
    expect(verificar(d, REGRAS_PADRAO, aud.linhas, aud.torneios, { [t.id]: 3 })).toEqual([]);
    const tot = (a: typeof aud, j: string) => a.linhas.filter((l) => l.jogador === j).reduce((s, l) => s + l.esperadoCent, 0);
    const finais = aud.linhas.filter((l) => l.torneioId === t.id && l.posicao != null && l.posicao <= 3);
    const comFlight = finais.filter((l) => aud.linhas.some((x) => x.jogador === l.jogador && /Dia 1[A-E]$/i.test(x.torneio)));
    for (const l of comFlight) {
      expect(l.esperadoCent).toBe(0);
      const g = aud.linhas.filter((x) => x.jogador === l.jogador && /Dia 1[A-E]$/i.test(x.torneio)).sort((a, b) => (a.torneio.slice(-1) < b.torneio.slice(-1) ? -1 : 1))[0];
      expect([g.acordo, g.esperadoCent > 0]).toEqual([3, true]);
      expect(tot(aud, l.jogador)).toBeGreaterThan(tot(aud0, l.jogador) - 1); // o valor do acordo (base do 3º) aparece no total, só no flight
    }
  });
});

describe("desempate do Consolidado (primeiros lugares e posição)", () => {
  it("posição e nº de primeiros lugares por jogador iguais aos de antes", async () => {
    for (const s of [E1, E2, E3]) {
      const { c } = await depois(s);
      const dif = c.jogadores.filter((j) => j.primeiros !== ANTES[s].jogadores[j.nome].primeiros || j.posicao !== ANTES[s].jogadores[j.nome].posicao).map((j) => `${j.nome}: primeiros ${ANTES[s].jogadores[j.nome].primeiros}→${j.primeiros}, posição ${ANTES[s].jogadores[j.nome].posicao}→${j.posicao}`);
      expect(dif, s).toEqual([]);
    }
  });
});

describe("Excel: Conta correta das linhas que valem 0 por esta regra", () => {
  it("Etapa 1: a conta não diz mais '10 pontos fixos = 0' no Dia Final de quem jogou flight, e os termos proibidos não aparecem", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const { exportacaoXlsx } = await import("../lib/excel");
    const { d, aud } = await depois(E1);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await exportacaoXlsx(d, aud, identificador(d))) as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Dados")!;
    const cedidas: string[] = [];
    ws.eachRow((row, i) => {
      if (i > 1 && String(row.getCell(2).value) === "Final Main Event" && String(row.getCell(12).value) === "0") cedidas.push(String(row.getCell(11).value));
    });
    expect(cedidas).toHaveLength(51);
    expect(cedidas.every((c) => c === "0: a pontuação do Main Event vale no flight")).toBe(true);
    let texto = "";
    ws.eachRow((row) => row.eachCell((c) => (texto += `${String(c.value)}\n`)));
    expect(texto).not.toContain("não pontua; vale o Dia Final");
  });
});
