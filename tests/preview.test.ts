import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buscarDados, extracao, urlApi } from "../lib/api-spt";
import { torneiosDoSite } from "../lib/planilha-guardada";

// Valor de exemplo: o código real do preview nunca aparece em teste.
const CODIGO = "codigo-de-teste";

const RANKING = { updatedAt: "2026-11-09T00:00:00Z", ranking: [{ rank: 1, name: "Ana Teste", points: 10 }] };
const TORNEIOS = { updatedAt: "2026-11-09T00:00:00Z", tournaments: [{ id: "t1", name: "Torneio", buyIn: 100, players: 10, role: "STANDALONE", flightLabel: null, status: "FINISHED" }] };
const RESUMO = { results: [{ tournamentId: "t1", tournamentName: "Torneio", position: 1, points: 10, prize: 0 }] };

let urls: string[];
const original = process.env.SPT_PREVIEW;
const antes = { ...extracao };

function simular(resposta: (u: URL) => { ok: boolean; status: number; json?: () => Promise<unknown> } | Error) {
  vi.stubGlobal("fetch", async (url: string | URL) => {
    urls.push(String(url));
    const r = resposta(new URL(String(url)));
    if (r instanceof Error) throw r;
    return r;
  });
}
const corpoOk = (u: URL) => ({ ok: true, status: 200, json: async () => (u.pathname.endsWith("/ranking") ? RANKING : u.pathname.endsWith("/tournaments") ? TORNEIOS : RESUMO) });

beforeEach(() => {
  urls = [];
  extracao.esperasMs = [0];
  extracao.tentativas = 2;
});
afterEach(() => {
  vi.unstubAllGlobals();
  if (original === undefined) delete process.env.SPT_PREVIEW;
  else process.env.SPT_PREVIEW = original;
  Object.assign(extracao, antes);
});

/** As 4 chamadas: /ranking, /tournaments e /player-summary (buscarDados) e /tournaments da planilha (torneiosDoSite). */
async function chamarTodas() {
  simular(corpoOk);
  await buscarDados("vale-suico-2026");
  await torneiosDoSite("bendito-cacao-2026");
}

describe("parâmetro preview (SPT_PREVIEW)", () => {
  it("(a) sem a variável, nenhuma das 4 chamadas leva preview", async () => {
    delete process.env.SPT_PREVIEW;
    await chamarTodas();
    for (const caminho of ["/ranking", "/tournaments", "/player-summary"]) expect(urls.some((u) => new URL(u).pathname.endsWith(caminho))).toBe(true);
    expect(urls.length).toBeGreaterThanOrEqual(4);
    for (const u of urls) expect(new URL(u).searchParams.has("preview")).toBe(false);
  });

  it("(a) variável vazia também não leva preview", async () => {
    process.env.SPT_PREVIEW = "";
    await chamarTodas();
    for (const u of urls) expect(u).not.toContain("preview");
  });

  it("(b) com a variável, as 4 chamadas levam preview=codigo-de-teste", async () => {
    process.env.SPT_PREVIEW = CODIGO;
    await chamarTodas();
    expect(new Set(urls.map((u) => new URL(u).pathname.split("/").pop()))).toEqual(new Set(["ranking", "tournaments", "player-summary"]));
    expect(urls.length).toBeGreaterThanOrEqual(4);
    for (const u of urls) expect(new URL(u).searchParams.get("preview")).toBe(CODIGO);
    // a chamada da planilha (torneiosDoSite) é a última e leva preview junto com a etapa
    expect(new URL(urls[urls.length - 1]).searchParams.get("stage")).toBe("bendito-cacao-2026");
  });

  it("(c) o erro de uma falha de rede ou de HTTP não contém o valor", async () => {
    process.env.SPT_PREVIEW = CODIGO;
    const casos: (() => ReturnType<Parameters<typeof simular>[0]>)[] = [
      () => ({ ok: false, status: 500 }),
      () => ({ ok: false, status: 404 }),
      () => ({ ok: true, status: 200, json: async () => { throw new Error("corpo inválido"); } }),
    ];
    for (const caso of casos) {
      urls = [];
      simular(caso);
      const e = await buscarDados("vale-suico-2026").then(() => null, (x: Error) => x);
      expect(e).toBeTruthy();
      expect(`${e!.name} ${e!.message} ${e!.stack}`).not.toContain(CODIGO);
    }
    // rede: o erro original traz a URL no texto; o que chega ao usuário não pode trazê-la
    simular((u) => new Error(`falha em ${u.href}`));
    const e = await buscarDados("vale-suico-2026").then(() => null, (x: Error) => x);
    expect(e).toBeTruthy();
    expect(`${e!.name} ${e!.message} ${e!.stack}`).not.toContain(CODIGO);
    expect(await torneiosDoSite("bendito-cacao-2026")).toEqual([]); // sem erro e sem repassar o texto da falha
  });

  it("(d) valor com caractere especial é codificado", () => {
    process.env.SPT_PREVIEW = "a b&c=d/é+";
    const u = urlApi("/ranking", { stage: "vale-suico-2026" });
    expect(u).toContain("preview=a%20b%26c%3Dd%2F%C3%A9%2B");
    expect(new URL(u).searchParams.get("preview")).toBe("a b&c=d/é+");
    expect(new URL(u).searchParams.get("stage")).toBe("vale-suico-2026");
  });
});
