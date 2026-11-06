import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarDados, type DadosSpt } from "../lib/api-spt";
import { auditar } from "../lib/auditoria";
import { conferir, identificador } from "../lib/integridade";
import { montarResposta } from "../lib/painel";
import { lerPlanilha } from "../lib/planilha";
import { CAMPO } from "../lib/participacao";
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
  it("a versão das regras é 2.5", () => expect(VERSAO_REGRAS).toBe("2.5"));
});

describe("opção de regra: campo do torneio", () => {
  it("o padrão é inscritos; o parâmetro campo=acoes liga a opção; valor inválido é erro", () => {
    expect(REGRAS_PADRAO.field).toBe("players");
    expect(lerRegras(new URLSearchParams("campo=inscritos")).field).toBe("players");
    expect(lerRegras(new URLSearchParams("campo=acoes")).field).toBe("acoes");
    expect(() => lerRegras(new URLSearchParams("campo=outro"))).toThrow('campo inválido: "outro"');
    expect(lerRegras(new URLSearchParams(""))).toEqual(REGRAS_PADRAO);
  });

  it("desligada, não muda nada: o resultado é idêntico ao padrão; o texto das regras mostra inscritos", async () => {
    const d = await fixture("vale-suico-2026");
    const padrao = auditar(d, REGRAS_PADRAO);
    const explicita = auditar(d, lerRegras(new URLSearchParams("campo=inscritos")));
    expect(JSON.stringify(explicita)).toBe(JSON.stringify(padrao));
    const r = montarResposta("vale-suico-2026", d, REGRAS_PADRAO, padrao, identificador(d));
    expect(r.painel.regrasTexto.find((x) => x.titulo === CAMPO.rotulo)!.valor).toBe(CAMPO.inscritos);
    expect(r.painel.avisos.some((a) => a.includes("Campo do torneio"))).toBe(false);
  });

  it("ligada, o campo vem de buy-ins + re-entries da planilha; Dia Final continua com a soma dos flights", async () => {
    const lida = await lerPlanilha(new Uint8Array(readFileSync("tests/fixtures/ranking-spt-3a-etapa.xlsx")), { stage: "bendito-cacao-2026" });
    if (!lida.ok) throw new Error(lida.erros.join(" | "));
    const flight = { id: "f", name: "Dia 1 A", buyIn: 1000, players: 328, role: "FLIGHT", flightLabel: "1A", status: "FINISHED" };
    const d = { ...lida.dados, torneios: [...lida.dados.torneios, flight] };
    const acoes = { ...REGRAS_PADRAO, field: "acoes" } as Regras;
    const campo = (aud: ReturnType<typeof auditar>) => Object.fromEntries(aud.torneios.filter((t) => t.total > 0).map((t) => [t.torneio, t.field]));
    const padrao = campo(conferido(d));
    const ligada = campo(conferido(d, acoes));
    expect(padrao["HIGH ROLLER 50K"]).toBe(31);
    expect(ligada["HIGH ROLLER 50K"]).toBe(61); // 31 buy-ins + 30 re-entries
    expect(ligada["HORSE"]).toBe(23);
    expect(ligada["SECOND CHANCE"]).toBe(173);
    expect(ligada["Main Event SPT - Dia Final"]).toBe(328); // soma dos flights, nas duas opções
    expect(padrao["Main Event SPT - Dia Final"]).toBe(328);
    const r = montarResposta("bendito-cacao-2026", d, acoes, auditar(d, acoes), identificador(d));
    expect(r.painel.regrasTexto.find((x) => x.titulo === CAMPO.rotulo)!.valor).toBe(`${CAMPO.acoes}; ${CAMPO.semAcoes}`);
  });

  it("onde não há ações informadas (site), usa os inscritos e lista os torneios no resultado", async () => {
    const d = await fixture("vale-suico-2026");
    const acoes = { ...REGRAS_PADRAO, field: "acoes" } as Regras;
    const aud = conferido(d, acoes);
    expect(JSON.stringify(aud.linhas.map((l) => [l.field, l.situacao]))).toBe(JSON.stringify(auditar(d, REGRAS_PADRAO).linhas.map((l) => [l.field, l.situacao])));
    const r = montarResposta("vale-suico-2026", d, acoes, aud, identificador(d));
    const aviso = r.painel.avisos.find((a) => a.startsWith("Campo do torneio = ações:"))!;
    expect(aviso).toContain("8 torneios não têm as ações informadas e usaram os inscritos");
    expect(aviso).toContain("EV #2 200K PLO 5 K.O");
  });
});
