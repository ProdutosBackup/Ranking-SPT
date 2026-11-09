import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as DELETE_PLANILHA, GET as GET_PLANILHA } from "../app/api/planilha/route";
import { DELETE, GET, POST } from "../app/api/participantes-main-event/route";
import { ArmazenamentoBlob, ArmazenamentoLocal, MSG_SEM_ARMAZENAMENTO, trocarArmazenamento, type Armazenamento } from "../lib/armazenamento-planilha";
import { ESPACO_PARTICIPANTES, lerParticipantes, removerParticipantes, salvarParticipantes } from "../lib/participantes-armazenamento";
import { MSG_GRANDE, MSG_NAO_XLSX } from "../lib/planilha-guardada";

// O Vercel Blob de mentira: um mapa em memória com as mesmas funções (put, get, del).
const blobs = vi.hoisted(() => new Map<string, Uint8Array>());
vi.mock("@vercel/blob", () => ({
  put: async (caminho: string, corpo: string | Buffer) => void blobs.set(caminho, typeof corpo === "string" ? new TextEncoder().encode(corpo) : new Uint8Array(corpo)),
  get: async (caminho: string) => (blobs.has(caminho) ? { statusCode: 200, stream: new Response(blobs.get(caminho)! as BodyInit).body } : null),
  del: async (caminho: string) => void blobs.delete(caminho),
}));

const pasta = mkdtempSync(join(tmpdir(), "participantes-"));
afterAll(() => rmSync(pasta, { recursive: true, force: true }));

// Planilha inventada: nomes falsos e números fictícios.
const NOMES = ["Ana Inventada", "Bia Inventada", "Caio Inventado", "Dora Inventada", "Edu Inventado"];
const CAB = ["Jogador", "Dias jogados", "Entradas", "Foi ao Dia Final", "Posição no Dia Final"];
async function planilha(opcoes: { semAba?: string } = {}): Promise<Uint8Array> {
  const abas: Record<string, (string | number | null)[][]> = {
    Resumo: [["x"]],
    "1a Etapa": [[NOMES[0], "1A", 2, "Não", null], [NOMES[1], "1A, 1C", 3, "Sim", 7], [NOMES[2], "", null, "Sim", 2]],
    "2a Etapa": [[NOMES[0], "1B", 4, "Não", null], [NOMES[3], "1A", 5, "Sim", 1]],
    "3a Etapa": [[NOMES[4], "1E", 6, "Não", null]],
  };
  const wb = new ExcelJS.Workbook();
  for (const [n, ls] of Object.entries(abas)) {
    if (n === opcoes.semAba) continue;
    const ws = wb.addWorksheet(n);
    ws.addRow(n === "Resumo" ? ["Etapa"] : CAB);
    for (const l of ls) ws.addRow(l);
  }
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}
const enviar = (bytes: Uint8Array | null) => {
  const f = new FormData();
  if (bytes) f.set("arquivo", new File([bytes as BlobPart], "participantes.xlsx"));
  return POST(new Request("http://x/api/participantes-main-event", { method: "POST", body: f }));
};
const TOTAIS = { 1: { entradas: 5, jogadores: 3 }, 2: { entradas: 9, jogadores: 2 }, 3: { entradas: 6, jogadores: 1 } };

let dir = "";
beforeEach(() => {
  dir = join(pasta, String(Math.random()));
  trocarArmazenamento(new ArmazenamentoLocal(dir));
});
afterEach(() => {
  trocarArmazenamento(null);
  blobs.clear();
});

const conteudoLocal = () => {
  try {
    return readdirSync(dir).map((f) => readFileSync(join(dir, f), "latin1")).join("\n");
  } catch {
    return "";
  }
};

describe("/api/participantes-main-event", () => {
  it("ciclo completo: enviar, ler os totais das 3 etapas, remover e ler 'sem planilha'", async () => {
    expect(await (await GET()).json()).toEqual({ carregada: false });
    const r = await enviar(await planilha());
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(corpo).toMatchObject({ carregada: true, etapas: TOTAIS });
    const g = await (await GET()).json();
    expect(g).toMatchObject({ carregada: true, etapas: TOTAIS, chave: corpo.chave });
    expect(g.chave).toMatch(/^[0-9a-f]{64}$/);
    expect(await (await DELETE()).json()).toEqual({ carregada: false, removida: true });
    expect(await (await GET()).json()).toEqual({ carregada: false });
    expect(await (await DELETE()).json()).toEqual({ carregada: false, removida: false });
    expect(await lerParticipantes()).toBeNull();
  });

  it("planilha inválida: 400 com as mensagens e nada guardado", async () => {
    const naoXlsx = await enviar(new TextEncoder().encode("não sou planilha"));
    expect(naoXlsx.status).toBe(400);
    expect((await naoXlsx.json()).erro).toBe(MSG_NAO_XLSX);
    const semAba = await enviar(await planilha({ semAba: "2a Etapa" }));
    expect(semAba.status).toBe(400);
    expect((await semAba.json()).erros).toEqual(['A planilha não tem a aba "2a Etapa".']);
    expect((await enviar(null)).status).toBe(400);
    expect(await lerParticipantes()).toBeNull();
    expect(conteudoLocal()).toBe("");
  });

  it("arquivo acima de 4 MB: 400 com MSG_GRANDE, nada guardado", async () => {
    const r = await enviar(new Uint8Array(4 * 1024 * 1024 + 1));
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toBe(MSG_GRANDE);
    expect(await lerParticipantes()).toBeNull();
  });

  it("um novo envio substitui o anterior", async () => {
    await enviar(await planilha());
    const antes = (await lerParticipantes())!.chave;
    await salvarParticipantes({ 1: { entradas: 1, jogadores: 1 }, 2: { entradas: 2, jogadores: 2 }, 3: { entradas: 3, jogadores: 3 } });
    const depois = (await lerParticipantes())!;
    expect(depois.totais[2]).toEqual({ entradas: 2, jogadores: 2 });
    expect(depois.chave).not.toBe(antes);
  });
});

describe("conteúdo guardado", () => {
  it("pasta local: só totais, sem nenhum nome e sem o arquivo", async () => {
    await enviar(await planilha());
    const tudo = conteudoLocal();
    expect(tudo.length).toBeGreaterThan(0);
    for (const n of NOMES) expect(tudo).not.toContain(n.split(" ")[0]);
    expect(tudo).not.toContain("PK"); // o .xlsx é um zip; ele não é guardado
    expect(tudo).toContain('"entradas":5');
  });

  it("Blob: só totais, sem nenhum nome e sem o arquivo", async () => {
    trocarArmazenamento(new ArmazenamentoBlob());
    expect((await enviar(await planilha())).status).toBe(200);
    expect(blobs.size).toBeGreaterThan(0);
    const tudo = [...blobs.values()].map((b) => new TextDecoder("latin1").decode(b)).join("\n");
    for (const n of NOMES) expect(tudo).not.toContain(n.split(" ")[0]);
    expect(tudo).not.toContain("PK");
    expect((await lerParticipantes())!.totais).toEqual(TOTAIS);
    await removerParticipantes();
    expect(blobs.size).toBe(0);
  });

  it("o JSON guardado tem só versão, data e os totais das três etapas", async () => {
    const g = await salvarParticipantes(TOTAIS, new Date("2026-11-09T12:00:00Z"));
    expect(g.enviadoEm).toBe("2026-11-09T12:00:00.000Z");
    const arq = readdirSync(dir).find((f) => f.includes(ESPACO_PARTICIPANTES) && !f.startsWith("registro"))!;
    expect(JSON.parse(readFileSync(join(dir, arq), "utf8"))).toEqual({ versao: 1, enviadoEm: "2026-11-09T12:00:00.000Z", etapas: TOTAIS });
  });
});

describe("sem armazenamento", () => {
  const falta = async () => {
    throw new Error(MSG_SEM_ARMAZENAMENTO);
  };
  const semArmazenamento: Armazenamento = { salvar: falta, ler: falta, estado: falta, remover: falta };

  it("a leitura devolve null e não dá erro; a rota GET diz 'sem planilha'", async () => {
    trocarArmazenamento(semArmazenamento);
    expect(await lerParticipantes()).toBeNull();
    expect(await (await GET()).json()).toEqual({ carregada: false });
  });

  it("enviar e remover respondem 500 com a mensagem de armazenamento, como a rota de planilha", async () => {
    trocarArmazenamento(semArmazenamento);
    const r = await enviar(await planilha());
    expect(r.status).toBe(500);
    expect((await r.json()).erro).toBe(MSG_SEM_ARMAZENAMENTO);
    expect((await DELETE()).status).toBe(500);
  });
});

describe("isolamento da rota /api/planilha", () => {
  it("guardar os totais não aparece na rota de planilha, e a rota de planilha não aceita o espaço novo", async () => {
    await enviar(await planilha());
    expect((await GET_PLANILHA(new Request("http://x/api/planilha"))).status).toBe(200);
    expect(await (await GET_PLANILHA(new Request("http://x/api/planilha"))).json()).toEqual({ carregada: false });
    expect((await GET_PLANILHA(new Request(`http://x/api/planilha?etapa=${ESPACO_PARTICIPANTES}`))).status).toBe(400);
    expect((await DELETE_PLANILHA(new Request(`http://x/api/planilha?etapa=${ESPACO_PARTICIPANTES}`, { method: "DELETE" }))).status).toBe(400);
    expect((await lerParticipantes())!.totais).toEqual(TOTAIS); // continua guardado
  });
});
