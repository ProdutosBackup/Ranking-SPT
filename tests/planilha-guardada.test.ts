import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, POST } from "../app/api/planilha/route";
import { MSG_SEM_RANKING } from "../lib/api-spt";
import { ArmazenamentoBlob, ArmazenamentoLocal, ETAPA_PLANILHA, sha256, trocarArmazenamento, type Armazenamento, type Registro } from "../lib/armazenamento-planilha";
import { exportacaoXlsx, relatorioXlsx } from "../lib/excel";
import { executar } from "../lib/executar";
import { montarResposta } from "../lib/painel";
import { MSG_GRANDE, MSG_NAO_XLSX } from "../lib/planilha-guardada";

// O Vercel Blob de mentira: um mapa em memória com as mesmas funções (put, get, del).
const blobs = vi.hoisted(() => new Map<string, Uint8Array>());
vi.mock("@vercel/blob", () => ({
  put: async (caminho: string, corpo: string | Buffer) => void blobs.set(caminho, typeof corpo === "string" ? new TextEncoder().encode(corpo) : new Uint8Array(corpo)),
  get: async (caminho: string) => (blobs.has(caminho) ? { statusCode: 200, stream: new Response(blobs.get(caminho)! as BodyInit).body } : null),
  del: async (caminho: string) => void blobs.delete(caminho),
}));

const ARQUIVO = readFileSync("tests/fixtures/ranking-spt-3a-etapa.xlsx");
const pasta = mkdtempSync(join(tmpdir(), "planilha-"));
afterAll(() => rmSync(pasta, { recursive: true, force: true }));

// ---------- site de mentira ----------
const FLIGHTS = [77, 64, 55, 67, 65].map((players, i) => ({ id: `f${i}`, name: `Dia 1 ${"ABCDE"[i]}`, buyIn: 1000, players, role: "FLIGHT", flightLabel: "ABCDE"[i], status: "FINISHED" }));
function site(opcoes: { flights?: boolean } = {}) {
  vi.stubGlobal("fetch", async (url: string) => {
    const u = new URL(url);
    const stage = u.searchParams.get("stage")!;
    if (stage === ETAPA_PLANILHA) {
      const corpo = u.pathname.endsWith("/ranking")
        ? { updatedAt: "2026-10-21T00:00:00Z", ranking: [] }
        : { updatedAt: "2026-10-21T00:00:00Z", tournaments: opcoes.flights === false ? [] : FLIGHTS };
      return { ok: true, status: 200, json: async () => corpo };
    }
    const fx = JSON.parse(readFileSync(`tests/fixtures/${stage}.json`, "utf8"));
    const corpo = u.pathname.endsWith("/ranking") ? fx.ranking : u.pathname.endsWith("/tournaments") ? fx.tournaments : fx.playerSummaries[u.searchParams.get("name")!];
    return { ok: true, status: 200, json: async () => corpo };
  });
}

// ---------- ajudantes ----------
async function variante(mudar: (wb: ExcelJS.Workbook) => void) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(ARQUIVO as unknown as ExcelJS.Buffer);
  mudar(wb);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
const enviar = (bytes: Uint8Array | null, extras: Record<string, string> = {}, nome = "ranking-spt-3a-etapa.xlsx") => {
  const f = new FormData();
  if (bytes) f.set("arquivo", new File([bytes as BlobPart], nome));
  for (const [k, v] of Object.entries(extras)) f.set(k, v);
  return POST(new Request("http://x/api/planilha", { method: "POST", body: f }));
};
const estado = async () => (await GET(new Request("http://x/api/planilha"))).json();
const auditoria = (stage = ETAPA_PLANILHA, id?: string) => executar(new Request(`http://x/api/auditoria?stage=${stage}${id ? `&id=${id}` : ""}`));
type OrigemDados = { tipo: string; arquivo: string; inscritosDiaFinal: { fonte: string; valor: number } };
const origemDe = (dados: unknown) => (dados as { origem: OrigemDados }).origem;

beforeEach(() => {
  trocarArmazenamento(new ArmazenamentoLocal(join(pasta, String(Math.random()))));
  site();
});
afterEach(() => {
  vi.unstubAllGlobals();
  trocarArmazenamento(null);
  blobs.clear();
});

describe("rotas /api/planilha", () => {
  it("envio, estado e remoção", async () => {
    expect(await estado()).toEqual({ carregada: false });
    const r = await enviar(new Uint8Array(ARQUIVO));
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(corpo).toMatchObject({ carregada: true, arquivo: "ranking-spt-3a-etapa.xlsx", tamanho: ARQUIVO.length, resumo: { torneios: 11, jogadores: 241, linhas: 554 } });
    expect(corpo.sha256).toMatch(/^[0-9a-f]{64}$/);
    const e = await estado();
    expect(e).toMatchObject({ carregada: true, arquivo: "ranking-spt-3a-etapa.xlsx", sha256: corpo.sha256, resumo: { linhas: 554, inscritosDiaFinal: { fonte: "flights", valor: 328 } } });
    expect(e.avisos).toHaveLength(2);
    expect(await (await DELETE()).json()).toEqual({ carregada: false, removida: true });
    expect(await estado()).toEqual({ carregada: false });
  });

  it("substituição: o novo envio troca a planilha", async () => {
    const a = await (await enviar(new Uint8Array(ARQUIVO))).json();
    const b = await (await enviar(await variante((wb) => (wb.getWorksheet("HORSE")!.getCell("C9").value = 553)), {}, "outra.xlsx")).json();
    expect(b.sha256).not.toBe(a.sha256);
    expect(await estado()).toMatchObject({ arquivo: "outra.xlsx", sha256: b.sha256 });
  });

  it("etapa diferente de 3 é bloqueada; sem número aceita com aviso", async () => {
    const dois = await enviar(await variante((wb) => (wb.getWorksheet("Consolidado")!.getCell("A1").value = "SPT - 2a Etapa — Ranking consolidado")));
    expect(dois.status).toBe(400);
    expect((await dois.json()).erro).toContain("é da 2ª Etapa");
    expect(await estado()).toEqual({ carregada: false });
    const sem = await enviar(
      await variante((wb) => {
        wb.getWorksheet("Consolidado")!.getCell("A1").value = "Ranking consolidado";
        wb.getWorksheet("Main Event SPT - Dia Final")!.getCell("A1").value = "Main Event · Dia Final";
      }),
    );
    expect(sem.status).toBe(200);
    expect((await sem.json()).avisos.join(" ")).toContain("Não encontrei o número da etapa");
  });

  it("arquivo inválido, grande demais ou ausente", async () => {
    const txt = await enviar(new TextEncoder().encode("não sou planilha"));
    expect([txt.status, (await txt.json()).erro]).toEqual([400, MSG_NAO_XLSX]);
    const grande = await enviar(new Uint8Array(4 * 1024 * 1024 + 1));
    expect([grande.status, (await grande.json()).erro]).toEqual([400, MSG_GRANDE]);
    expect((await enviar(null)).status).toBe(400);
    expect((await (await enviar(new Uint8Array(ARQUIVO), { inscritosDiaFinal: "abc" })).json()).erro).toContain("inscritos do Dia Final");
    expect(await estado()).toEqual({ carregada: false });
  });

  it("planilha com bloqueio de conteúdo não é guardada", async () => {
    const r = await enviar(await variante((wb) => (wb.getWorksheet("HORSE")!.getCell("C9").value = "x")));
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toContain('Aba "HORSE"');
    expect(await estado()).toEqual({ carregada: false });
  });
});

describe("Etapa 3 usa a planilha", () => {
  it("auditoria da planilha: 554 resultados, origem planilha, inscritos pela soma dos flights", async () => {
    await enviar(new Uint8Array(ARQUIVO));
    const { aud, dados } = await auditoria();
    expect(aud.resumo.total).toBe(554);
    expect(origemDe(dados)).toMatchObject({ tipo: "planilha", arquivo: "ranking-spt-3a-etapa.xlsx", inscritosDiaFinal: { fonte: "flights", valor: 328 } });
    const final = aud.linhas.filter((l) => l.torneio.includes("Dia Final") && l.situacao !== "PENDENTE_REGRA");
    expect(final.every((l) => l.field === 328)).toBe(true);
  });

  it("fonte dos inscritos do Dia Final: flights, depois o informado, depois a planilha", async () => {
    const campo = async () => {
      const { aud, dados } = await auditoria();
      const o = origemDe(dados).inscritosDiaFinal;
      return [o.fonte, o.valor, aud.linhas.find((l) => l.torneio.includes("Dia Final") && l.situacao !== "PENDENTE_REGRA")!.field];
    };
    await enviar(new Uint8Array(ARQUIVO), { inscritosDiaFinal: "300" });
    expect(await campo()).toEqual(["flights", 328, 328]); // o site lista os flights: a soma vence
    site({ flights: false });
    expect(await campo()).toEqual(["informado", 300, 300]);
    await enviar(new Uint8Array(ARQUIVO)); // sem valor informado
    expect(await campo()).toEqual(["planilha", 79, 79]);
  });

  it("cache invalidado por novo envio e por remoção", async () => {
    await enviar(new Uint8Array(ARQUIVO));
    const a = await auditoria();
    const igual = await auditoria(ETAPA_PLANILHA, a.id.sha256);
    expect(igual.mudou).toBe(false); // mesmo envio: o cache serve
    expect(igual.aud).toBe(a.aud);

    await enviar(await variante((wb) => (wb.getWorksheet("HORSE")!.getCell("C9").value = 553)), {}, "outra.xlsx");
    const b = await auditoria(ETAPA_PLANILHA, a.id.sha256);
    expect(b.aud).not.toBe(a.aud); // novo envio: não devolve a entrada antiga
    expect(b.mudou).toBe(true);
    expect(b.id.sha256).not.toBe(a.id.sha256);

    await DELETE();
    await expect(auditoria(ETAPA_PLANILHA, b.id.sha256)).rejects.toThrow(MSG_SEM_RANKING); // remoção: volta ao site
  });

  it("sem planilha, a Etapa 3 continua com o aviso de ranking não publicado", async () => {
    await expect(auditoria()).rejects.toThrow(MSG_SEM_RANKING);
  });

  it("relatório e exportação saem com a origem planilha", async () => {
    await enviar(new Uint8Array(ARQUIVO));
    const { stage, dados, aud, regras, id } = await auditoria();
    expect(montarResposta(stage, dados, regras, aud, id).origem).toMatchObject({ tipo: "planilha", arquivo: "ranking-spt-3a-etapa.xlsx" });
    const textosDe = async (buf: Buffer) => {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
      const textos: string[] = [];
      wb.eachSheet((ws) => ws.eachRow((row) => row.eachCell((c) => typeof c.value === "string" && textos.push(c.value))));
      return textos;
    };
    const relatorio = await textosDe(await relatorioXlsx(stage, dados, aud, regras, id));
    expect(relatorio.some((t) => t.startsWith("Dados da planilha ranking-spt-3a-etapa.xlsx enviada em"))).toBe(true);
    expect(relatorio.some((t) => t.includes("Dados do site"))).toBe(false);
    const exportacao = await textosDe(await exportacaoXlsx(dados, aud, id, regras));
    expect(exportacao).toContain("Origem dos dados");
    expect(exportacao.some((t) => t.startsWith("328 inscritos (soma dos 5 torneios"))).toBe(true);
    expect(exportacao.some((t) => t.includes("Data dos dados do site"))).toBe(false);

    // o prêmio "1" (marcador interno de premiado inferido) nunca aparece: nem na resposta, nem nos arquivos
    const r = montarResposta(stage, dados, regras, aud, id);
    expect(r.linhas.every((l) => l.prize === null && l.premioInferido)).toBe(true);
    expect(relatorio).toContain("Premiados inferidos pelos pontos da planilha");
    for (const buf of [await relatorioXlsx(stage, dados, aud, regras, id), await exportacaoXlsx(dados, aud, id, regras)]) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
      const ws = wb.getWorksheet("Todos os cálculos") ?? wb.getWorksheet("Dados")!;
      const col = (ws.getRow(1).values as unknown[]).indexOf("Prêmio (R$)");
      expect(col).toBeGreaterThan(0);
      const premios = new Set<unknown>();
      ws.eachRow((row, i) => i > 1 && premios.add(row.getCell(col).value));
      expect([...premios]).toEqual(["—"]);
    }
  });
});

describe("Etapas 1 e 2 não mudam", () => {
  const proibido = async () => {
    throw new Error("não devia usar o armazenamento");
  };
  const semArmazenamento: Armazenamento = { salvar: proibido, ler: proibido, estado: proibido, remover: proibido };

  it("Etapa 2: 10 erros e 3.155,65 pontos, sem tocar na planilha", async () => {
    trocarArmazenamento(semArmazenamento);
    const { stage, dados, aud, regras, id } = await auditoria("vale-suico-2026");
    const r = montarResposta(stage, dados, regras, aud, id);
    const ind = r.painel.indicadores;
    expect([ind.erros, ind.pontosEmDiscordancia, ind.jogadoresAfetados, (aud.resumo as unknown as Record<string, number>).PENDENTE_REGRA]).toEqual([10, 3155.65, 10, 0]);
    expect(r.origem).toEqual({ tipo: "site" });
  });

  it("Etapa 1: 0 erros, sem tocar na planilha", async () => {
    trocarArmazenamento(semArmazenamento);
    const { aud } = await auditoria("taua-2026");
    expect(aud.resumo).toMatchObject({ ERRO: 202, SUSPEITO: 0, PENDENTE_REGRA: 0 }); // os 202 flights têm outro valor que não 10
  });
});

describe("armazenamentos", () => {
  const registro = (sha: string): Registro => ({ arquivo: "a.xlsx", enviadoEm: "2026-10-21T12:00:00.000Z", tamanho: 3, sha256: sha, inscritosDiaFinal: null, resumo: {} as Registro["resumo"], avisos: [] });
  const criadores: [string, () => Armazenamento][] = [
    ["pasta local", () => new ArmazenamentoLocal(join(pasta, "ciclo"))],
    ["Vercel Blob (simulado)", () => new ArmazenamentoBlob()],
  ];
  for (const [nome, criar] of criadores)
    it(`${nome}: salvar, ler, substituir e remover`, async () => {
      const a = criar();
      expect(await a.estado()).toBeNull();
      expect(await a.ler()).toBeNull();
      const um = new Uint8Array([1, 2, 3]);
      await a.salvar(um, registro(sha256(um)));
      expect(Array.from((await a.ler())!.bytes)).toEqual([1, 2, 3]);
      const dois = new Uint8Array([9, 9]);
      await a.salvar(dois, registro(sha256(dois)));
      expect(Array.from((await a.ler())!.bytes)).toEqual([9, 9]);
      await a.remover();
      expect(await a.estado()).toBeNull();
      expect(await a.ler()).toBeNull();
    });

  it("Vercel Blob: bytes que não batem com o registro viram erro claro", async () => {
    const a = new ArmazenamentoBlob();
    await a.salvar(new Uint8Array([1]), registro("0".repeat(64)));
    await expect(a.ler()).rejects.toThrow("sendo atualizada");
  });
});
