import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { DadosSpt } from "../lib/api-spt";
import { centDe } from "../lib/calculo";
import { identificador } from "../lib/integridade";
import { VERSAO_REGRAS } from "../lib/regras";

// Os dois hashes: `sha256` (mostrado na tela e nos Excel) cobre buy-ins e re-entries; `sha256Dados` (chave das marcas "revisado") não cobre.
function dados(stage = "vale-suico-2026"): DadosSpt {
  const fx = JSON.parse(readFileSync(`tests/fixtures/${stage}.json`, "utf8"));
  return {
    stage,
    updatedAt: { ranking: fx.ranking.updatedAt, tournaments: fx.tournaments.updatedAt },
    torneios: fx.tournaments.tournaments,
    jogadores: fx.ranking.ranking.map((p: { name: string; rank: number; points: number }) => ({ name: p.name, rank: p.rank, rankingPoints: p.points, resultados: fx.playerSummaries[p.name].results })),
  };
}
const copia = (d: DadosSpt): DadosSpt => structuredClone(d);

describe("identificador: o hash mostrado cobre as reentradas; o hash das marcas, não", () => {
  it("mudar só buyIns/reentries muda o identificador mostrado e NÃO muda o das marcas", () => {
    const base = dados();
    const a = identificador(base);
    const com = copia(base);
    com.torneios[2].buyIns = 34;
    com.torneios[2].reentries = 48;
    const b = identificador(com);
    expect(b.sha256).not.toBe(a.sha256);
    expect(b.sha256Dados).toBe(a.sha256Dados);
    const outra = copia(com);
    outra.torneios[2].reentries = 49;
    expect(identificador(outra).sha256).not.toBe(b.sha256);
    expect(identificador(outra).sha256Dados).toBe(a.sha256Dados);
    // o motivo escrito de "sem bloco" também só mexe no hash mostrado
    const motivo = copia(base);
    motivo.torneios[3].acoesMotivo = "planilha da etapa sem Buy In/Reentry para este torneio";
    expect(identificador(motivo).sha256).not.toBe(a.sha256);
    expect(identificador(motivo).sha256Dados).toBe(a.sha256Dados);
  });

  it("mudar resultados ou inscritos muda os dois", () => {
    const base = dados();
    const a = identificador(base);
    const pontos = copia(base);
    pontos.jogadores[0].resultados[0].points += 1;
    expect(identificador(pontos).sha256).not.toBe(a.sha256);
    expect(identificador(pontos).sha256Dados).not.toBe(a.sha256Dados);
    const inscritos = copia(base);
    inscritos.torneios[0].players += 1;
    expect(identificador(inscritos).sha256).not.toBe(a.sha256);
    expect(identificador(inscritos).sha256Dados).not.toBe(a.sha256Dados);
  });

  it("mudar a VERSAO_REGRAS muda os dois", async () => {
    const base = dados();
    const a = identificador(base);
    vi.resetModules();
    vi.doMock("../lib/regras", async (original) => ({ ...(await original<typeof import("../lib/regras")>()), VERSAO_REGRAS: `${VERSAO_REGRAS}-teste` }));
    const { identificador: outro } = await import("../lib/integridade");
    const b = outro(base);
    expect(b.sha256).not.toBe(a.sha256);
    expect(b.sha256Dados).not.toBe(a.sha256Dados);
    vi.doUnmock("../lib/regras");
    vi.resetModules();
  });

  it("sem planilha de ações, o identificador mostrado é o mesmo de antes (fórmula antiga recalculada)", () => {
    const d = dados();
    const porTexto = (x: unknown, y: unknown) => (JSON.stringify(x) < JSON.stringify(y) ? -1 : JSON.stringify(x) > JSON.stringify(y) ? 1 : 0);
    const torneios = d.torneios.map((t) => [t.id, t.name, t.buyIn, t.players, t.role, t.flightLabel ?? null, t.status, t.bountyType ?? null, t.bountyAmount ?? null, t.buyIns ?? null, t.reentries ?? null]).sort(porTexto);
    const jogadores = d.jogadores.map((j) => [j.name, centDe(j.rankingPoints), j.resultados.map((r) => [r.tournamentId, r.position, centDe(r.points), r.prize == null ? null : centDe(r.prize)]).sort(porTexto)]).sort(porTexto);
    const antigo = createHash("sha256").update(JSON.stringify({ stage: d.stage, versaoRegras: VERSAO_REGRAS, torneios, jogadores })).digest("hex");
    expect(identificador(d).sha256).toBe(antigo);
  });
});
