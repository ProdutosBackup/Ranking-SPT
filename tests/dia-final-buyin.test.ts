import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarDados, type DadosSpt } from "../lib/api-spt";
import { auditar } from "../lib/auditoria";
import { identificador } from "../lib/integridade";
import { montarResposta } from "../lib/painel";
import { REGRAS_PADRAO } from "../lib/regras";
import { verificar } from "../lib/verificador";

// Dia Final: a API traz buyIn 0 e isso é válido (sem valor de buy-in; fator 1,0 pela faixa de R$ 0 a R$ 1.000) [CONFIRMADO 05/11/2026].
async function etapa2(): Promise<DadosSpt> {
  const fx = JSON.parse(readFileSync("tests/fixtures/vale-suico-2026.json", "utf8"));
  vi.stubGlobal("fetch", async (url: string) => {
    const u = new URL(url);
    const body = u.pathname.endsWith("/ranking") ? fx.ranking : u.pathname.endsWith("/tournaments") ? fx.tournaments : fx.playerSummaries[u.searchParams.get("name")!];
    return { ok: true, status: 200, json: async () => body };
  });
  return buscarDados("vale-suico-2026");
}
afterEach(() => vi.unstubAllGlobals());

describe("buy-in R$ 0 no Dia Final", () => {
  it("não gera SEM_BUYIN, exibe R$ 0, faixa de R$ 0 a R$ 1.000, fator 1,0; motor e verificador concordam", async () => {
    const d = await etapa2();
    const final = d.torneios.find((t) => t.role === "FINAL")!;
    expect(final.buyIn).toBe(0);
    const aud = auditar(d, REGRAS_PADRAO);
    const ls = aud.linhas.filter((l) => l.torneioId === final.id && l.posicao != null);
    expect(ls.length).toBe(64);
    expect(ls.every((l) => l.pendencia == null && l.buyIn === 0 && l.buyInFator === 0 && l.fatorBuyIn === 1)).toBe(true);
    expect(aud.linhas.some((l) => l.pendencia === "SEM_BUYIN")).toBe(false);
    expect(verificar(d, REGRAS_PADRAO, aud.linhas, aud.torneios)).toEqual([]);
    const r = montarResposta("vale-suico-2026", d, REGRAS_PADRAO, aud, identificador(d));
    expect(r.linhas.filter((l) => l.torneioId === final.id && l.posicao != null).every((l) => l.buyIn === 0 && l.faixaBuyIn === "de R$ 0 a R$ 1.000")).toBe(true);
    expect(r.painel.regrasTexto.some((x) => x.titulo.includes("Dia Final"))).toBe(false);
  });
  it("Rafael Bryan, 7º do Dia Final: 400 × 3,81 × 1,0 = 1.524, correto", async () => {
    const d = await etapa2();
    const l = auditar(d, REGRAS_PADRAO).linhas.find((x) => x.jogador.startsWith("Rafael Bryan") && x.torneio.includes("Dia Final") && x.posicao === 7)!;
    expect([l.base, l.fatorParticipantes, l.fatorBuyIn, l.esperado, l.registrado, l.situacao]).toEqual([400, 3.81, 1, 1524, 1524, "CORRETO"]);
  });
  it("torneio comum com buyIn 0 ou ausente continua aguardando por SEM_BUYIN, e o verificador concorda", async () => {
    for (const valor of [0, undefined as unknown as number]) {
      const d = await etapa2();
      d.torneios.find((t) => t.name.startsWith("EV #3"))!.buyIn = valor;
      const aud = auditar(d, REGRAS_PADRAO);
      const ls = aud.linhas.filter((l) => l.torneio.startsWith("EV #3"));
      expect(ls.length).toBeGreaterThan(0);
      expect(ls.every((l) => l.situacao === "PENDENTE_REGRA" && l.pendencia === "SEM_BUYIN")).toBe(true);
      expect(verificar(d, REGRAS_PADRAO, aud.linhas, aud.torneios)).toEqual([]);
    }
  });
  it("Dia Final com buyIn ausente também aguarda (só o 0 é válido)", async () => {
    const d = await etapa2();
    d.torneios.find((t) => t.role === "FINAL")!.buyIn = undefined as unknown as number;
    const aud = auditar(d, REGRAS_PADRAO);
    expect(aud.linhas.filter((l) => l.role === "FINAL" && l.posicao != null).every((l) => l.pendencia === "SEM_BUYIN")).toBe(true);
    expect(verificar(d, REGRAS_PADRAO, aud.linhas, aud.torneios)).toEqual([]);
  });
});
