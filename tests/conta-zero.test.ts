import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DadosSpt } from "../lib/api-spt";
import { auditar } from "../lib/auditoria";
import { exportacaoXlsx, relatorioXlsx } from "../lib/excel";
import { identificador } from "../lib/integridade";
import { dadosDaPlanilha } from "../lib/planilha-guardada";
import { REGRAS_PADRAO } from "../lib/regras";
import { BOUNTY_API } from "./bounty-mock";

// "Conta correta" de linha que vale 0: "0: <motivo>", nunca "10 pontos fixos = 0" (a regra dos 10 fixos foi descartada em 05/11/2026).
const E = ["taua-2026", "vale-suico-2026", "bendito-cacao-2026"];
const FLIGHTS = [77, 64, 55, 67, 65].map((players, i) => ({ id: `f${i}`, name: `Dia 1 ${"ABCDE"[i]}`, buyIn: 1000, players, role: "FLIGHT", flightLabel: `1${"ABCDE"[i]}`, status: "FINISHED" }));
afterEach(() => vi.unstubAllGlobals());
const txt = (v: ExcelJS.CellValue) => (v == null ? "" : String(v));

async function dadosDe(stage: string): Promise<DadosSpt> {
  if (stage === E[2]) {
    vi.stubGlobal("fetch", async () => ({ ok: true, status: 200, json: async () => ({ tournaments: [...FLIGHTS, ...BOUNTY_API] }) }));
    const registro = { arquivo: "x.xlsx", enviadoEm: "2026-11-05T00:00:00Z", tamanho: 1, sha256: "x", inscritosDiaFinal: null, resumo: {}, avisos: [] };
    return dadosDaPlanilha(new Uint8Array(readFileSync("tests/fixtures/ranking-spt-3a-etapa.xlsx")), registro as never);
  }
  const fx = JSON.parse(readFileSync(`tests/fixtures/${stage}.json`, "utf8"));
  return {
    stage,
    updatedAt: { ranking: fx.ranking.updatedAt, tournaments: fx.tournaments.updatedAt },
    torneios: fx.tournaments.tournaments,
    jogadores: fx.ranking.ranking.map((p: { name: string; rank: number; points: number }) => ({ name: p.name, rank: p.rank, rankingPoints: p.points, resultados: fx.playerSummaries[p.name].results })),
  };
}

describe("Conta correta das linhas que valem 0", () => {
  it("nas 3 etapas, nenhuma linha com esperado 0 diz '10 pontos fixos' (motor, Exportação e Relatório)", async () => {
    for (const s of E) {
      const d = await dadosDe(s);
      const aud = auditar(d, REGRAS_PADRAO);
      const zeros = aud.linhas.filter((l) => l.situacao !== "PENDENTE_REGRA" && l.esperadoCent === 0);
      if (s === E[0]) expect(zeros).toHaveLength(44); // "jogou mais de um flight" (2.7: o Dia Final não vale mais 0)
      for (const l of zeros) {
        expect(l.conta, `${s} ${l.jogador} ${l.torneio}`).toMatch(/^0: .+/);
        expect(l.conta).not.toContain("10 pontos fixos");
      }
      // linhas que não valem 0 não ganham o formato novo
      expect(aud.linhas.filter((l) => l.esperadoCent > 0 && l.conta.startsWith("0: "))).toEqual([]);
      const id = identificador(d);
      const abas = [
        (await new ExcelJS.Workbook().xlsx.load((await exportacaoXlsx(d, aud, id)) as unknown as ArrayBuffer)).getWorksheet("Dados")!,
        (await new ExcelJS.Workbook().xlsx.load((await relatorioXlsx(s, d, aud, REGRAS_PADRAO, id)) as unknown as ArrayBuffer)).getWorksheet("Todos os cálculos")!,
      ];
      for (const ws of abas) {
        aud.linhas.forEach((l, i) => {
          const conta = txt(ws.getCell(i + 2, 11).value);
          if (l.situacao !== "PENDENTE_REGRA" && l.esperadoCent === 0) expect(conta).toBe(l.conta);
          expect(conta).not.toMatch(/10 pontos fixos = 0/);
        });
      }
    }
  }, 60000);

  it("cada categoria tem o seu motivo", async () => {
    const e1 = auditar(await dadosDe(E[0]), REGRAS_PADRAO);
    const contas = (f: (l: (typeof e1.linhas)[number]) => boolean) => [...new Set(e1.linhas.filter(f).map((l) => l.conta))];
    expect(contas((l) => l.causaProvavel.startsWith("Dia Final de jogador") || l.causaProvavel.startsWith("Flight de jogador que chegou"))).toEqual([]); // regra antiga (2.6)
    expect(contas((l) => l.causaProvavel.startsWith("Jogou mais de um flight"))).toEqual(["0: já pontuou em outro flight (pontua uma vez só)"]);
    // satélite, Ladies e All in or Fold: não existem nas fixtures; renomeio três torneios da Etapa 2 para cobrir o texto
    const d2 = await dadosDe(E[1]);
    const nomes = ["Satélite para o Main Event", "SPT Ladies", "ALL IN OR FOLD"];
    const ids = [...new Set(d2.jogadores.flatMap((j) => j.resultados.map((r) => r.tournamentId)))].filter((id) => d2.torneios.find((t) => t.id === id)!.role === "STANDALONE").slice(0, 3);
    ids.forEach((id, i) => (d2.torneios.find((t) => t.id === id)!.name = nomes[i]));
    const aud2 = auditar(d2, REGRAS_PADRAO);
    ids.forEach((id, i) => expect([...new Set(aud2.linhas.filter((l) => l.torneioId === id).map((l) => l.conta))], nomes[i]).toEqual([["0: satélite não pontua", "0: Ladies não pontua", "0: All in or Fold não pontua"][i]]));
    // torneio cancelado pelo usuário
    const d = await dadosDe(E[1]);
    const t = d.torneios.find((x) => x.name.startsWith("EV #2"))!;
    const canc = auditar(d, REGRAS_PADRAO, {}, [t.id]);
    expect([...new Set(canc.linhas.filter((l) => l.torneioId === t.id).map((l) => l.conta))]).toEqual(["0: torneio cancelado (marcado pelo usuário)"]);
  });
});
