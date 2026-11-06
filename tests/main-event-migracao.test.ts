import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DadosSpt } from "../lib/api-spt";
import { auditar } from "../lib/auditoria";
import { consolidar } from "../lib/consolidado";
import { identificador } from "../lib/integridade";
import { montarResposta } from "../lib/painel";
import { dadosDaPlanilha } from "../lib/planilha-guardada";
import { REGRAS_PADRAO } from "../lib/regras";
import { verificar } from "../lib/verificador";
import { BOUNTY_API } from "./bounty-mock";

// Main Event avaliado por linha [usuário, 06/11/2026: "Dias classificatórios não tem premiação."], que substitui a regra de 05/11/2026 (a pontuação do
// Dia Final ia para o primeiro flight e o Dia Final valia 0). Cada linha vale por si: o primeiro flight é participação (10 × fatores), os outros flights
// valem 0 e o Dia Final vale pela própria posição. A base ANTES (tests/fixtures/base-antes-main-event.json) é anterior às duas regras; as Etapas 2 e 3
// (sem linhas de flight nos resultados) continuam iguais a ela.
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

const flightsDe = (aud: Awaited<ReturnType<typeof depois>>["aud"], jogador: string) =>
  aud.linhas.filter((l) => l.jogador === jogador && /Dia 1[A-E]$/i.test(l.torneio)).sort((a, b) => (a.torneio.slice(-1) < b.torneio.slice(-1) ? -1 : 1));

describe("Main Event avaliado por linha", () => {
  it("Etapas 2 e 3 não mudam: total por jogador nos 4 cenários, correto e erro iguais aos de antes", async () => {
    for (const s of [E2, E3]) {
      const { c, r } = await depois(s);
      const antes = ANTES[s].jogadores;
      expect(c.jogadores).toHaveLength(Object.keys(antes).length);
      for (const j of c.jogadores) {
        const a = antes[j.nome];
        expect({ esperado: j.totalCent, A: j.cenarios.A.totalCent, B: j.cenarios.B.totalCent, C: j.cenarios.C.totalCent, D: j.cenarios.D.totalCent }, `${s} ${j.nome}`).toEqual({ esperado: a.esperado, A: a.A, B: a.B, C: a.C, D: a.D });
      }
      expect([r.painel.indicadores.corretos, r.painel.indicadores.erros], s).toEqual([ANTES[s].corretos, ANTES[s].erros]);
    }
    expect([ANTES[E2].corretos, ANTES[E2].erros, ANTES[E3].corretos, ANTES[E3].erros]).toEqual([121, 149, 127, 427]);
    const { aud } = await depois(E2);
    const rb = aud.linhas.find((l) => l.jogador === "Rafael Bryan" && l.torneio.includes("Dia Final") && l.posicao === 7)!;
    expect([rb.esperado, rb.registrado, rb.situacao]).toEqual([1524, 1524, "CORRETO"]);
  });

  it("Etapa 1: as 135 linhas do Dia Final valem pela própria posição; o primeiro flight de cada finalista é participação", async () => {
    const { aud } = await depois(E1);
    const final = aud.linhas.filter((l) => l.torneio === "Final Main Event");
    const comFlight = new Set(aud.linhas.filter((l) => /Dia 1[A-E]$/i.test(l.torneio)).map((l) => l.jogador));
    expect(final).toHaveLength(135);
    expect(final.filter((l) => comFlight.has(l.jogador))).toHaveLength(51); // 51 finalistas jogaram flight: pontuam nas duas linhas
    expect(final.every((l) => l.esperado > 0 && l.situacao === "CORRETO" && l.field === 334)).toBe(true);
    for (const f of final.filter((l) => comFlight.has(l.jogador))) {
      const [primeiro, ...outros] = flightsDe(aud, f.jogador);
      expect([primeiro.esperado, primeiro.participacao], f.jogador).toEqual([38.4, true]);
      for (const o of outros) expect([o.esperado, o.causaCodigo]).toEqual([0, "FLIGHT_ZERO"]);
    }
    // as causas da regra antiga não existem mais
    expect(aud.linhas.filter((l) => /a pontuação do Main Event vale no flight|a pontuação do jogador vale no flight dele/.test(`${l.causaProvavel} ${l.conta}`))).toEqual([]);
  });

  it("Anderson De Carvalho Costa: Dia 1D = participação (38,4) e Dia Final 76º = 38,4; o total é a soma das duas linhas", async () => {
    const { aud, c } = await depois(E1);
    const f = aud.linhas.find((l) => l.jogador.startsWith("Anderson De Carvalho") && l.torneio.endsWith("Dia 1D"))!;
    const fin = aud.linhas.find((l) => l.jogador.startsWith("Anderson De Carvalho") && l.torneio === "Final Main Event")!;
    expect([f.esperado, f.field, f.registrado, f.situacao, f.causaCodigo]).toEqual([38.4, 334, 12.1, "ERRO", "PARTICIPACAO"]);
    expect([fin.esperado, fin.field, fin.registrado, fin.situacao, fin.conta]).toEqual([38.4, 334, 38.4, "CORRETO", "10 × 3,84 × 1"]);
    const j = c.jogadores.find((x) => x.nome.startsWith("Anderson De Carvalho"))!;
    expect(j.totalCent).toBe(aud.linhas.filter((l) => l.jogador === j.nome).reduce((s, l) => s + l.esperadoCent, 0));
    expect(j.totalCent - ANTES[E1].jogadores[j.nome].esperado).toBe(3840); // a participação do flight (38,4) soma ao total de antes
  });

  it("jogador só de flights, sem Dia Final: primeira linha 10 × fatores (38,4) e as outras 0", async () => {
    const { aud } = await depois(E1);
    const comFinal = new Set(aud.linhas.filter((l) => l.torneio === "Final Main Event").map((l) => l.jogador));
    const jogadores = new Set(aud.linhas.filter((l) => /Dia 1[A-E]$/i.test(l.torneio) && !comFinal.has(l.jogador)).map((l) => l.jogador));
    expect(jogadores.size).toBe(107);
    for (const j of jogadores) {
      const [primeiro, ...outros] = flightsDe(aud, j);
      expect([primeiro.esperado, primeiro.causaCodigo === "FLIGHT_ZERO"]).toEqual([38.4, false]);
      for (const o of outros) expect([o.esperado, o.causaCodigo]).toEqual([0, "FLIGHT_ZERO"]);
    }
  });

  it("acordo no Dia Final fica na linha do Dia Final; o flight continua participação", async () => {
    const d = site(E1);
    const t = d.torneios.find((x) => x.name === "Final Main Event")!;
    const aud = auditar(d, REGRAS_PADRAO, { [t.id]: 3 });
    expect(verificar(d, REGRAS_PADRAO, aud.linhas, aud.torneios, { [t.id]: 3 })).toEqual([]);
    const finais = aud.linhas.filter((l) => l.torneioId === t.id && l.posicao != null && l.posicao <= 3);
    expect(finais).toHaveLength(3);
    for (const l of finais) {
      expect([l.acordo, l.esperadoCent > 0]).toEqual([3, true]);
      const fl = flightsDe(aud, l.jogador);
      if (fl.length) expect([fl[0].acordo, fl[0].esperado]).toEqual([null, 38.4]);
    }
  });
});

describe("desempate do Consolidado (primeiros lugares e posição)", () => {
  it("nº de primeiros lugares igual ao de antes nas 3 etapas (o 1º lugar de um flight não conta); posição igual nas Etapas 2 e 3", async () => {
    for (const s of [E1, E2, E3]) {
      const { c } = await depois(s);
      const dif = c.jogadores.filter((j) => j.primeiros !== ANTES[s].jogadores[j.nome].primeiros || (s !== E1 && j.posicao !== ANTES[s].jogadores[j.nome].posicao)).map((j) => j.nome);
      expect(dif, s).toEqual([]);
    }
  });
});

describe("Excel: Conta correta do Main Event", () => {
  it("Etapa 1: nenhuma linha do Dia Final vale 0 e os textos da regra antiga não aparecem", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const { exportacaoXlsx } = await import("../lib/excel");
    const { d, aud } = await depois(E1);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await exportacaoXlsx(d, aud, identificador(d))) as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Dados")!;
    const zerados: string[] = [];
    ws.eachRow((row, i) => {
      if (i > 1 && String(row.getCell(2).value) === "Final Main Event" && String(row.getCell(12).value) === "0") zerados.push(String(row.getCell(11).value));
    });
    expect(zerados).toEqual([]);
    let texto = "";
    ws.eachRow((row) => row.eachCell((c) => (texto += `${String(c.value)}\n`)));
    expect(texto).not.toContain("a pontuação do Main Event vale no flight");
    expect(texto).not.toContain("não pontua; vale o Dia Final");
  });
});
