import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PUT } from "../app/api/cancelados/route";
import { buscarDados, type DadosSpt } from "../lib/api-spt";
import { auditar } from "../lib/auditoria";
import {
  armazenamentoCancelados,
  assinaturaCancelados,
  CANCELADO,
  canceladosDaEtapa,
  CanceladosBlob,
  CanceladosLocal,
  chaveCancelamento,
  chaveRegistro,
  lerCancelados,
  MSG_CANCELADO_DADOS,
  MSG_CANCELADO_NAO_ACHADO,
  trocarArmazenamentoCancelados,
  validarCancelamento,
  type Cancelados,
} from "../lib/cancelados";
import { consolidar } from "../lib/consolidado";
import { exportacaoXlsx, relatorioXlsx } from "../lib/excel";
import { executar } from "../lib/executar";
import { conferir, identificador } from "../lib/integridade";
import { montarResposta } from "../lib/painel";
import { dadosDaPlanilha } from "../lib/planilha-guardada";
import { REGRAS_PADRAO } from "../lib/regras";
import { verificar } from "../lib/verificador";
import { BOUNTY_API } from "./bounty-mock";

// O Vercel Blob de mentira: um mapa em memória com as mesmas funções (put, get).
const blobs = vi.hoisted(() => new Map<string, Uint8Array>());
vi.mock("@vercel/blob", () => ({
  put: async (caminho: string, corpo: string | Buffer) => void blobs.set(caminho, typeof corpo === "string" ? new TextEncoder().encode(corpo) : new Uint8Array(corpo)),
  get: async (caminho: string) => (blobs.has(caminho) ? { statusCode: 200, stream: new Response(blobs.get(caminho)! as BodyInit).body } : null),
  del: async (caminho: string) => void blobs.delete(caminho),
}));

const E1 = "taua-2026";
const E2 = "vale-suico-2026";
const pasta = mkdtempSync(join(tmpdir(), "cancelados-"));
afterAll(() => rmSync(pasta, { recursive: true, force: true }));

function stubSite(stage = E2) {
  const fx = JSON.parse(readFileSync(`tests/fixtures/${stage}.json`, "utf8"));
  vi.stubGlobal("fetch", async (url: string) => {
    const u = new URL(url);
    const body = u.pathname.endsWith("/ranking") ? fx.ranking : u.pathname.endsWith("/tournaments") ? fx.tournaments : fx.playerSummaries[u.searchParams.get("name")!];
    return { ok: true, status: 200, json: async () => body };
  });
}
const fixture = (stage: string) => {
  stubSite(stage);
  return buscarDados(stage);
};
const conferido = (d: DadosSpt, cancelados: string[] = []) => {
  const aud = auditar(d, REGRAS_PADRAO, {}, cancelados);
  conferir(d, REGRAS_PADRAO, aud, {}, cancelados); // o verificador independente concorda com o motor
  expect(verificar(d, REGRAS_PADRAO, aud.linhas, aud.torneios, {}, cancelados)).toEqual([]);
  return aud;
};
const ev2 = (d: DadosSpt) => d.torneios.find((t) => t.name.startsWith("EV #2"))!;

beforeEach(() => trocarArmazenamentoCancelados(new CanceladosLocal(join(pasta, String(Math.random())))));
afterEach(() => {
  vi.unstubAllGlobals();
  trocarArmazenamentoCancelados(null);
  blobs.clear();
});

describe("regra e validação", () => {
  it("chave: o ID do site, ou o nome normalizado na planilha (sem maiúsculas, acentos, hífen, barra e ´)", () => {
    expect(chaveCancelamento({ id: "abc", name: "EV #2" }, false)).toBe("abc");
    expect(chaveCancelamento({ id: "planilha:x", name: "PLO-NLH DEALER´S CHOICE PIJAMA" }, true)).toBe("nome:plo nlh dealers choice pijama");
    expect(chaveCancelamento({ id: "y", name: "plo/nlh dealer's choice pijama" }, true)).toBe("nome:plo nlh dealers choice pijama");
  });
  it("validação do corpo: etapa e torneio são obrigatórios", () => {
    expect(validarCancelamento({ etapa: E2, chave: "abc" })).toBeNull();
    for (const b of [null, {}, { etapa: E2 }, { chave: "abc" }, { etapa: "", chave: "abc" }, { etapa: E2, chave: " " }, { etapa: 3, chave: "abc" }, { etapa: E2, chave: ["x"] }])
      expect(validarCancelamento(b as never)).toBe(MSG_CANCELADO_DADOS);
  });
  it("assinatura estável e vazia sem cancelamentos; canceladosDaEtapa filtra pela etapa", () => {
    expect(assinaturaCancelados([])).toBe("");
    expect(assinaturaCancelados(["b", "a"])).toBe("a|b");
    const todos: Cancelados = {
      [chaveRegistro(E2, "t1")]: { etapa: E2, chave: "t1", nome: "A", atualizadoEm: "x" },
      [chaveRegistro("outra", "t9")]: { etapa: "outra", chave: "t9", nome: "B", atualizadoEm: "x" },
    };
    expect(canceladosDaEtapa(todos, E2)).toEqual(["t1"]);
  });
});

describe("armazenamento", () => {
  const exemplo: Cancelados = { [chaveRegistro(E2, "t1")]: { etapa: E2, chave: "t1", nome: "EV #2", atualizadoEm: "2026-11-05T12:00:00.000Z" } };
  for (const [nome, criar] of [
    ["pasta local", () => new CanceladosLocal(join(pasta, "ciclo"))],
    ["Vercel Blob (simulado)", () => new CanceladosBlob()],
  ] as const)
    it(`${nome}: grava, lê, troca e esvazia`, async () => {
      const a = criar();
      expect(await a.ler()).toEqual({});
      await a.gravar(exemplo);
      expect(await a.ler()).toEqual(exemplo);
      await a.gravar({ ...exemplo, [chaveRegistro(E2, "t2")]: { etapa: E2, chave: "t2", nome: "EV #3", atualizadoEm: "x" } });
      expect(Object.keys(await a.ler())).toHaveLength(2);
      await a.gravar({});
      expect(await a.ler()).toEqual({});
    });
  it("em desenvolvimento a pasta local é .cancelados-local (e a dos testes é temporária)", () => {
    expect(process.env.CANCELADOS_LOCAL_DIR).toBeTruthy();
    trocarArmazenamentoCancelados(null);
    expect(armazenamentoCancelados()).toBeInstanceOf(CanceladosLocal);
  });
  it("registros malformados são descartados", async () => {
    await armazenamentoCancelados().gravar({ ...exemplo, ruim: { etapa: E2 } as never, vazio: { etapa: E2, chave: "", nome: "", atualizadoEm: "" } });
    expect(await lerCancelados()).toEqual(exemplo);
  });
});

describe("rota /api/cancelados", () => {
  const put = (corpo: unknown) => PUT(new Request("http://x/api/cancelados", { method: "PUT", body: JSON.stringify(corpo), headers: { "content-type": "application/json" } }));
  const apagar = (etapa: string, chave: string) => DELETE(new Request(`http://x/api/cancelados?etapa=${etapa}&chave=${encodeURIComponent(chave)}`, { method: "DELETE" }));
  const lista = async () => (await (await GET(new Request("http://x/api/cancelados"))).json()).cancelados;

  it("grava, lista, remove", async () => {
    stubSite();
    const { dados } = await executar(new Request(`http://x/api/auditoria?stage=${E2}`));
    const t = ev2(dados);
    expect(await lista()).toEqual([]);
    const r = await put({ etapa: E2, chave: t.id });
    expect(r.status).toBe(200);
    expect((await r.json()).cancelado).toMatchObject({ etapa: E2, chave: t.id, nome: t.name });
    expect(await lista()).toMatchObject([{ etapa: E2, chave: t.id, nome: t.name }]);
    expect(await (await GET(new Request(`http://x/api/cancelados?etapa=outra`))).json()).toEqual({ cancelados: [] });
    expect(await (await (await apagar(E2, t.id)).json())).toEqual({ removido: true });
    expect(await lista()).toEqual([]);
    expect(await (await (await apagar(E2, t.id)).json())).toEqual({ removido: false });
  });

  it("valor inválido devolve mensagem clara em português e nada é salvo", async () => {
    stubSite();
    for (const corpo of [{}, { etapa: E2 }, { chave: "x" }, { etapa: "", chave: "x" }, { etapa: E2, chave: 5 }, { etapa: E2, chave: [] }]) {
      const r = await put(corpo);
      expect([r.status, (await r.json()).erro]).toEqual([400, MSG_CANCELADO_DADOS]);
    }
    const nao = await put({ etapa: E2, chave: "nao-existe" });
    expect([nao.status, (await nao.json()).erro]).toEqual([400, MSG_CANCELADO_NAO_ACHADO]);
    expect((await PUT(new Request("http://x", { method: "PUT", body: "não é json" }))).status).toBe(400);
    const sem = await DELETE(new Request("http://x/api/cancelados?etapa=" + E2, { method: "DELETE" }));
    expect([sem.status, (await sem.json()).erro]).toEqual([400, MSG_CANCELADO_DADOS]);
    expect(await lista()).toEqual([]);
  });

  it("o cancelamento entra no identificador e invalida o cache da auditoria", async () => {
    stubSite();
    const auditoria = (id?: string) => executar(new Request(`http://x/api/auditoria?stage=${E2}${id ? `&id=${id}` : ""}`));
    const a = await auditoria();
    const t = ev2(a.dados);
    expect((await auditoria(a.id.sha256)).aud).toBe(a.aud); // sem mudança, o cache serve
    await put({ etapa: E2, chave: t.id });
    const b = await auditoria(a.id.sha256);
    expect(b.aud).not.toBe(a.aud);
    expect(b.mudou).toBe(true);
    expect(b.id.sha256).not.toBe(a.id.sha256);
    expect(b.aud.linhas.filter((l) => l.torneioId === t.id).every((l) => l.esperado === 0 && l.canceladoUsuario)).toBe(true);
    await apagar(E2, t.id);
    const c = await auditoria(b.id.sha256);
    expect(c.id.sha256).toBe(a.id.sha256);
    expect(JSON.stringify(c.aud)).toBe(JSON.stringify(a.aud)); // desmarcar volta ao anterior
  });
});

describe("efeito: torneio cancelado não pontua", () => {
  it("EV #2 200K PLO 5 K.O da Etapa 2: esperado 0 em todas as linhas; desmarcar volta ao anterior; motor e verificador concordam", async () => {
    const d = await fixture(E2);
    const t = ev2(d);
    const antes = conferido(d);
    const com = conferido(d, [t.id]);
    const linhas = com.linhas.filter((l) => l.torneioId === t.id);
    expect(linhas).toHaveLength(12);
    expect(linhas.every((l) => l.esperado === 0 && l.esperadoCent === 0 && l.canceladoUsuario && l.conta === CANCELADO.causa)).toBe(true);
    // com pontos registrados > 0: Erro com a causa; o torneio sai do painel como cancelado
    expect(linhas.every((l) => l.registrado > 0 && l.situacao === "ERRO" && l.causaCodigo === "CANCELADO_USUARIO" && l.causaProvavel === CANCELADO.causa)).toBe(true);
    expect(com.torneios.find((x) => x.torneioId === t.id)).toMatchObject({ cancelado: true, chaveCancelamento: t.id });
    // as outras linhas não mudam
    const resto = (a: typeof antes) => a.linhas.filter((l) => l.torneioId !== t.id).map((l) => [l.jogador, l.torneioId, l.esperadoCent, l.situacao]);
    expect(resto(com)).toEqual(resto(antes));
    // desmarcar volta ao anterior
    expect(JSON.stringify(conferido(d, []))).toBe(JSON.stringify(antes));
    // cancelamento vale antes do acordo detectado: as posições 1 e 2 (1.008 cada) deixam de ser acordo
    expect(linhas.every((l) => l.acordo == null)).toBe(true);
  });

  it("o motivo do usuário vale mesmo quando a API já marca o torneio como cancelado; sem marca, o comportamento atual (pendente) permanece", async () => {
    const d = structuredClone(await fixture(E2));
    const t = ev2(d);
    t.status = "CANCELED";
    const sem = conferido(d);
    expect(sem.linhas.filter((l) => l.torneioId === t.id).every((l) => l.situacao === "PENDENTE_REGRA" && l.pendencia === "CANCELADO")).toBe(true);
    const com = conferido(d, [t.id]);
    expect(com.linhas.filter((l) => l.torneioId === t.id).every((l) => l.situacao === "ERRO" && l.causaCodigo === "CANCELADO_USUARIO" && l.pendencia == null)).toBe(true);
  });

  it("torneio cancelado com pontos registrados 0 fecha como Correto", async () => {
    const d = structuredClone(await fixture(E2));
    const t = ev2(d);
    for (const j of d.jogadores) for (const r of j.resultados) if (r.tournamentId === t.id) { j.rankingPoints = Math.round((j.rankingPoints - r.points) * 100) / 100; r.points = 0; }
    const l = conferido(d, [t.id]).linhas.filter((x) => x.torneioId === t.id);
    expect(l.every((x) => x.situacao === "CORRETO" && x.diferenca === 0)).toBe(true);
  });

  it("o Consolidado não soma o torneio cancelado nem conta o 1º lugar dele no desempate", async () => {
    const d = await fixture(E2);
    const t = ev2(d);
    const monta = (cancelados: string[]) => {
      const aud = auditar(d, REGRAS_PADRAO, {}, cancelados);
      return consolidar([
        { numero: 2, jogadores: d.jogadores.map((j) => ({ nome: j.name, id: j.id })), linhas: aud.linhas.map((l) => ({ jogador: l.jogador, posicao: l.posicao, esperadoCent: l.esperadoCent, aguarda: l.situacao === "PENDENTE_REGRA", participacao: l.participacao, acordo: l.acordo != null })) },
      ]);
    };
    const sem = monta([]);
    const com = monta([t.id]);
    const por = (c: ReturnType<typeof monta>) => Object.fromEntries(c.jogadores.map((j) => [j.nome, j]));
    const antes = por(sem);
    const depois = por(com);
    const aud = auditar(d, REGRAS_PADRAO);
    const doTorneio = aud.linhas.filter((l) => l.torneioId === t.id);
    const soma = doTorneio.reduce((a, l) => a + l.esperadoCent, 0);
    const somaTotal = (c: ReturnType<typeof monta>) => c.jogadores.reduce((a, j) => a + j.totalCent, 0);
    expect(somaTotal(sem) - somaTotal(com)).toBe(soma);
    for (const l of doTorneio) expect(antes[l.jogador].totalCent - depois[l.jogador].totalCent).toBeGreaterThanOrEqual(l.esperadoCent);
    // o campeão do torneio cancelado: o 1º lugar dele não conta mais (já não contava, por estar em acordo; o total só cai pelos pontos)
    const campeao = doTorneio.find((l) => l.posicao === 1)!.jogador;
    expect(depois[campeao].primeiros).toBeLessThanOrEqual(antes[campeao].primeiros);
  });

  it("Etapa 1 e Etapa 2 sem cancelamento marcado: resultados idênticos aos de hoje", async () => {
    for (const s of [E1, E2]) {
      const d = await fixture(s);
      expect(JSON.stringify(auditar(d, REGRAS_PADRAO, {}, []))).toBe(JSON.stringify(auditar(d, REGRAS_PADRAO)));
      expect(identificador(d, {}, []).sha256).toBe(identificador(d).sha256);
    }
    const d = await fixture(E2);
    expect(identificador(d, {}, [ev2(d).id]).sha256).not.toBe(identificador(d).sha256);
  });

  it("o verificador independente pega um motor que não zerasse o torneio cancelado", async () => {
    const d = await fixture(E2);
    const t = ev2(d);
    const aud = auditar(d, REGRAS_PADRAO);
    expect(verificar(d, REGRAS_PADRAO, aud.linhas, aud.torneios, {}, [t.id]).length).toBeGreaterThan(0);
  });
});

describe("Etapa 3 (planilha): a chave é o nome normalizado", () => {
  const FLIGHTS = [77, 64, 55, 67, 65].map((players, i) => ({ id: `f${i}`, name: `Dia 1 ${"ABCDE"[i]}`, buyIn: 1000, players, role: "FLIGHT", flightLabel: `1${"ABCDE"[i]}`, status: "FINISHED" }));
  async function etapa3() {
    vi.stubGlobal("fetch", async () => ({ ok: true, status: 200, json: async () => ({ tournaments: [...FLIGHTS, ...BOUNTY_API] }) }));
    const registro = { arquivo: "x.xlsx", enviadoEm: "2026-11-05T00:00:00Z", tamanho: 1, sha256: "x", inscritosDiaFinal: null, resumo: {}, avisos: [] };
    return dadosDaPlanilha(new Uint8Array(readFileSync("tests/fixtures/ranking-spt-3a-etapa.xlsx")), registro as never);
  }
  it("marcar o HORSE (chave nome:horse) zera o torneio; a lista de premiados e o bounty não são exigidos", async () => {
    const d = await etapa3();
    const antes = conferido(d);
    const com = conferido(d, ["nome:horse"]);
    const ls = com.linhas.filter((l) => l.torneio === "HORSE");
    expect(ls).toHaveLength(19);
    expect(ls.every((l) => l.esperado === 0 && l.canceladoUsuario)).toBe(true);
    expect(com.torneios.find((t) => t.torneio === "HORSE")).toMatchObject({ cancelado: true, chaveCancelamento: "nome:horse" });
    expect(com.linhas.filter((l) => l.torneio !== "HORSE").map((l) => l.esperadoCent)).toEqual(antes.linhas.filter((l) => l.torneio !== "HORSE").map((l) => l.esperadoCent));
    // torneio com bounty não obtido da API também vale 0 quando cancelado (sem pendência)
    const semBounty = { ...d, torneios: d.torneios.map((t) => (t.name === "SUPER K.O" ? { ...t, bountyType: null, bountyAmount: null } : t)) };
    expect(conferido(semBounty).linhas.some((l) => l.pendencia === "SEM_BOUNTY")).toBe(true);
    expect(conferido(semBounty, ["nome:super k.o"]).linhas.filter((l) => l.torneio === "SUPER K.O").every((l) => l.pendencia == null && l.esperado === 0)).toBe(true);
  });
  it("a chave nome: casa com o nome do torneio em outra grafia (hífen, barra, maiúsculas)", async () => {
    const d = await etapa3();
    const com = conferido(d, ["nome:plo nlh dealers choice pijama"]);
    expect(com.linhas.filter((l) => l.torneio.startsWith("PLO-NLH")).every((l) => l.canceladoUsuario)).toBe(true);
  });
});

describe("Relatório e Exportação trazem o cancelamento", () => {
  it("marca na aba Torneios, no Resumo e na Identificação; sem cancelamento, nada aparece", async () => {
    const d = await fixture(E2);
    const t = ev2(d);
    const abrir = async (buf: Buffer) => {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
      return wb;
    };
    const texto = (v: unknown) => (typeof v === "object" && v && "result" in v ? String((v as { result: unknown }).result) : typeof v === "object" && v && "richText" in v ? (v as { richText: { text: string }[] }).richText.map((x) => x.text).join("") : String(v ?? ""));
    const gerar = async (cancelados: string[]) => {
      const aud = auditar(d, REGRAS_PADRAO, {}, cancelados);
      const id = identificador(d, {}, cancelados);
      return { rel: await abrir(await relatorioXlsx(E2, d, aud, REGRAS_PADRAO, id)), exp: await abrir(await exportacaoXlsx(d, aud, id, REGRAS_PADRAO)) };
    };
    const { rel, exp } = await gerar([t.id]);
    const torneios = rel.getWorksheet("Torneios")!;
    const col = (torneios.getRow(1).values as unknown[]).map(texto).indexOf(CANCELADO.rotulo);
    expect(col).toBeGreaterThan(0);
    const marcados: string[] = [];
    torneios.eachRow((row, i) => i > 1 && texto(row.getCell(col).value) && marcados.push(`${texto(row.getCell(1).value)}:${texto(row.getCell(col).value)}`));
    expect(marcados).toEqual([`${t.name}:${CANCELADO.causa}`]);
    expect(texto(rel.getWorksheet("Resumo")!.getCell(4, 8).value)).toContain(CANCELADO.faixa(1));
    const ident: string[] = [];
    exp.getWorksheet("Identificação")!.eachRow((row) => ident.push(`${texto(row.getCell(1).value)}=${texto(row.getCell(2).value)}`));
    expect(ident.some((x) => x.startsWith(`Torneios cancelados=1: ${t.name} (torneio cancelado (marcado pelo usuário))`))).toBe(true);
    const { rel: limpo, exp: expLimpo } = await gerar([]);
    expect(texto(limpo.getWorksheet("Resumo")!.getCell(4, 8).value)).not.toContain("Torneios cancelados");
    const identLimpo: string[] = [];
    expLimpo.getWorksheet("Identificação")!.eachRow((row) => identLimpo.push(texto(row.getCell(1).value)));
    expect(identLimpo).not.toContain("Torneios cancelados");
    // a resposta do painel traz a contagem e a marca por torneio
    const r = montarResposta(E2, d, REGRAS_PADRAO, auditar(d, REGRAS_PADRAO, {}, [t.id]), identificador(d, {}, [t.id]));
    expect(r.cancelados).toEqual({ aplicados: 1 });
    expect(r.painel.torneios.filter((x) => x.cancelado).map((x) => x.nome)).toEqual([t.name]);
    expect(r.painel.grupos.some((g) => g.titulo === CANCELADO.titulo)).toBe(true);
  });
});
