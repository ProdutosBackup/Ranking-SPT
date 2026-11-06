import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarDados, type DadosSpt } from "../lib/api-spt";
import { auditar } from "../lib/auditoria";
import { conferir, identificador } from "../lib/integridade";
import { montarResposta } from "../lib/painel";
import { lerPlanilha } from "../lib/planilha";
import { lerRegras, REGRAS_PADRAO, VERSAO_REGRAS, type Regras } from "../lib/regras";

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

const conferido = (d: DadosSpt, regras: Regras = REGRAS_PADRAO) => {
  const aud = auditar(d, regras);
  conferir(d, regras, aud); // o verificador independente concorda
  return aud;
};

describe("versão das regras", () => {
  it("a versão das regras é 2.7", () => expect(VERSAO_REGRAS).toBe("2.7"));
});

describe("campo do torneio: não é mais opção (inscritos em \"Pontos corretos\"; ações só nos cenários C e D)", () => {
  it("?campo=... na URL é ignorado, sem erro", () => {
    expect(lerRegras(new URLSearchParams("campo=acoes"))).toEqual(REGRAS_PADRAO);
    expect(lerRegras(new URLSearchParams("campo=outro"))).toEqual(REGRAS_PADRAO);
    expect(lerRegras(new URLSearchParams(""))).toEqual(REGRAS_PADRAO);
    expect("field" in REGRAS_PADRAO).toBe(false);
  });

  it("a aba Regras e os avisos não falam mais em campo do torneio", async () => {
    const d = await fixture("vale-suico-2026");
    const r = montarResposta("vale-suico-2026", d, REGRAS_PADRAO, auditar(d, REGRAS_PADRAO), identificador(d));
    expect(r.painel.regrasTexto.map((x) => x.titulo)).not.toContain("Campo do torneio");
    expect(r.painel.avisos.some((a) => a.includes("Campo do torneio"))).toBe(false);
  });

  it("o campo é só entradas; Dia Final continua com a soma dos flights; as ações aparecem só nos cenários C e D (planilha da Etapa 3)", async () => {
    const lida = await lerPlanilha(new Uint8Array(readFileSync("tests/fixtures/ranking-spt-3a-etapa.xlsx")), { stage: "bendito-cacao-2026" });
    if (!lida.ok) throw new Error(lida.erros.join(" | "));
    const flight = { id: "f", name: "Dia 1 A", buyIn: 1000, players: 328, role: "FLIGHT", flightLabel: "1A", status: "FINISHED" };
    const d = { ...lida.dados, torneios: [...lida.dados.torneios, flight] };
    const aud = conferido(d);
    const campo = Object.fromEntries(aud.torneios.filter((t) => t.total > 0).map((t) => [t.torneio, t.field]));
    expect(campo["HIGH ROLLER 50K"]).toBe(31); // só buy-ins
    expect(campo["Main Event SPT - Dia Final"]).toBe(328); // soma dos flights
    const acoes = (nome: string) => aud.linhas.find((l) => l.torneio === nome)!.acoesCampo;
    expect([acoes("HIGH ROLLER 50K"), acoes("HORSE"), acoes("SECOND CHANCE")]).toEqual([61, 23, 173]); // buy-ins + re-entries: o campo dos cenários C e D
  });
});
