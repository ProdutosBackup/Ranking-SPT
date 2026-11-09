import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, POST } from "../app/api/planilha/route";
import { ArmazenamentoLocal, trocarArmazenamento } from "../lib/armazenamento-planilha";
import { executar } from "../lib/executar";

// Etapas 1 e 2: a planilha só alimenta buy-ins e re-entries (cenários C e D); resultados, erros, A e B não mudam.
const pasta = mkdtempSync(join(tmpdir(), "acoes-"));
afterAll(() => rmSync(pasta, { recursive: true, force: true }));

beforeEach(() => {
  trocarArmazenamento(new ArmazenamentoLocal(pasta));
  vi.stubGlobal("fetch", async (url: string) => {
    const u = new URL(url);
    const fx = JSON.parse(readFileSync(`tests/fixtures/${u.searchParams.get("stage")}.json`, "utf8"));
    const corpo = u.pathname.endsWith("/ranking") ? fx.ranking : u.pathname.endsWith("/tournaments") ? fx.tournaments : fx.playerSummaries[u.searchParams.get("name")!];
    return { ok: true, status: 200, json: async () => corpo };
  });
});
afterEach(() => {
  trocarArmazenamento(null);
  vi.unstubAllGlobals();
});

const arquivo = (f: string) => new Uint8Array(readFileSync(`tests/fixtures/ranking-spt-${f}-etapa.xlsx`));
const enviar = (bytes: Uint8Array, nome: string) => {
  const f = new FormData();
  f.set("arquivo", new File([bytes as BlobPart], nome));
  return POST(new Request("http://x/api/planilha", { method: "POST", body: f }));
};
const auditoria = (stage: string) => executar(new Request(`http://x/api/auditoria?stage=${stage}`));
const url = (stage: string) => new Request(`http://x/api/planilha?etapa=${stage}`);

describe.each([
  ["taua-2026", "1a", 202, 6],
  ["vale-suico-2026", "2a", 153, 8],
])("%s com a planilha de ações", (stage, f, erros, torneiosComAcoes) => {
  it("só os cenários C e D mudam", { timeout: 60000 }, async () => {
    const antes = await auditoria(stage);
    expect(antes.aud.resumo).toMatchObject({ ERRO: erros });
    const semAcoes = antes.aud.linhas.filter((l) => l.cenarios.C != null).length; // satélites (0)

    const r = await enviar(arquivo(f), `ranking-spt-${f}-etapa.xlsx`);
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(corpo.etapa).toBe(stage);
    expect(corpo.acoes).toMatchObject({ casadas: torneiosComAcoes, ambiguos: [] });
    expect((await (await GET(url(stage))).json()).carregada).toBe(true);

    const depois = await auditoria(stage);
    expect(depois.aud.resumo).toEqual(antes.aud.resumo);
    expect(depois.id.sha256).not.toBe(antes.id.sha256);
    expect(depois.id.sha256Dados).toBe(antes.id.sha256Dados);
    expect(depois.aud.linhas.map((l) => [l.esperadoCent, l.cenarios.A, l.cenarios.B, l.situacao])).toEqual(antes.aud.linhas.map((l) => [l.esperadoCent, l.cenarios.A, l.cenarios.B, l.situacao]));
    const comC = depois.aud.linhas.filter((l) => l.cenarios.C != null && antes.aud.linhas.find((a) => a.jogador === l.jogador && a.torneioId === l.torneioId)!.cenarios.C == null);
    expect(depois.aud.linhas.filter((l) => l.cenarios.C != null).length).toBeGreaterThan(semAcoes);
    expect(new Set(comC.map((l) => l.torneioId)).size).toBe(torneiosComAcoes);
    expect(comC.every((l) => l.cenarios.D != null)).toBe(true);
    // as linhas sem C ficam com um motivo escrito
    expect(depois.aud.linhas.filter((l) => l.cenarios.C == null).every((l) => l.cenariosMotivo)).toBe(true);

    // o identificador pedido de volta é reconhecido (cache) e remover a planilha volta ao estado anterior
    const rem = await DELETE(new Request(`http://x/api/planilha?etapa=${stage}`, { method: "DELETE" }));
    expect((await rem.json()).removida).toBe(true);
    const volta = await auditoria(stage);
    expect(volta.id.sha256).toBe(antes.id.sha256);
    expect(volta.aud.linhas.filter((l) => l.cenarios.C != null).length).toBe(semAcoes);
  });
});

describe("planilha de ações: etapa errada e arquivo inválido", () => {
  it("não grava nada", async () => {
    expect((await enviar(new Uint8Array([1, 2, 3, 4, 5]), "x.xlsx")).status).toBe(400);
    for (const s of ["taua-2026", "vale-suico-2026", "bendito-cacao-2026"]) expect((await (await GET(url(s))).json()).carregada).toBe(false);
  });
});
