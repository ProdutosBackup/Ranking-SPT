import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PUT } from "../app/api/acordos/route";
import { assinaturaAcordos, dividirAcordo, validarN } from "../lib/acordo";
import { AcordosBlob, AcordosLocal, acordosDaEtapa, chaveAcordo, trocarArmazenamentoAcordos, type Acordos } from "../lib/acordos";
import { buscarDados, type DadosSpt } from "../lib/api-spt";
import { auditar } from "../lib/auditoria";
import { consolidar } from "../lib/consolidado";
import { executar } from "../lib/executar";
import { conferir, identificador } from "../lib/integridade";
import { montarResposta } from "../lib/painel";
import { REGRAS_PADRAO } from "../lib/regras";
import { verificar } from "../lib/verificador";

// O Vercel Blob de mentira: um mapa em memória com as mesmas funções (put, get).
const blobs = vi.hoisted(() => new Map<string, Uint8Array>());
vi.mock("@vercel/blob", () => ({
  put: async (caminho: string, corpo: string | Buffer) => void blobs.set(caminho, typeof corpo === "string" ? new TextEncoder().encode(corpo) : new Uint8Array(corpo)),
  get: async (caminho: string) => (blobs.has(caminho) ? { statusCode: 200, stream: new Response(blobs.get(caminho)! as BodyInit).body } : null),
  del: async (caminho: string) => void blobs.delete(caminho),
}));

const E2 = "vale-suico-2026";
const pasta = mkdtempSync(join(tmpdir(), "acordos-"));
afterAll(() => rmSync(pasta, { recursive: true, force: true }));

function fixture(stage: string) {
  const fx = JSON.parse(readFileSync(`tests/fixtures/${stage}.json`, "utf8"));
  vi.stubGlobal("fetch", async (url: string) => {
    const u = new URL(url);
    const body = u.pathname.endsWith("/ranking") ? fx.ranking : u.pathname.endsWith("/tournaments") ? fx.tournaments : fx.playerSummaries[u.searchParams.get("name")!];
    return { ok: true, status: 200, json: async () => body };
  });
  return buscarDados(stage);
}
const diaFinal = (d: DadosSpt) => d.torneios.find((t) => t.role === "FINAL")!;
const conferido = (d: DadosSpt, acordos: Record<string, number> = {}) => {
  const aud = auditar(d, REGRAS_PADRAO, acordos);
  conferir(d, REGRAS_PADRAO, aud, acordos); // o verificador independente concorda com o motor
  return aud;
};

beforeEach(() => trocarArmazenamentoAcordos(new AcordosLocal(join(pasta, String(Math.random())))));
afterEach(() => {
  vi.unstubAllGlobals();
  trocarArmazenamentoAcordos(null);
  blobs.clear();
});

describe("divisão do acordo", () => {
  it("arredonda a 2 casas, metade para cima, igual para os N", () => {
    expect(dividirAcordo(685800, 2)).toBe(342900); // 6.858,00 ÷ 2
    expect(dividirAcordo(100, 3)).toBe(33); // 1,00 ÷ 3 = 0,3333
    expect(dividirAcordo(101, 3)).toBe(34); // 1,01 ÷ 3 = 0,3367
    expect(dividirAcordo(5, 2)).toBe(3); // 0,05 ÷ 2 = 0,025: metade sobe
    expect(dividirAcordo(1, 4)).toBe(0); // 0,01 ÷ 4 = 0,0025
    expect(dividirAcordo(2, 4)).toBe(1); // 0,02 ÷ 4 = 0,005: metade sobe
  });

  it("validação de N: inteiro, de 2 até os premiados", () => {
    expect(validarN(2, 63)).toBeNull();
    expect(validarN(63, 63)).toBeNull();
    expect(validarN(1.5, 63)).toBe("O número de pessoas do acordo deve ser um número inteiro.");
    expect(validarN("3", 63)).toBe("O número de pessoas do acordo deve ser um número inteiro.");
    expect(validarN(1, 63)).toBe("O acordo é entre 2 ou mais pessoas.");
    expect(validarN(0, 63)).toBe("O acordo é entre 2 ou mais pessoas.");
    expect(validarN(64, 63)).toBe("O acordo não pode ter mais pessoas do que premiados: este torneio tem 63.");
    expect(validarN(2, 1)).toBe("Este torneio tem menos de 2 premiados, então não dá para fazer acordo.");
  });

  it("assinatura estável e vazia sem acordos", () => {
    expect(assinaturaAcordos({})).toBe("");
    expect(assinaturaAcordos({ b: 3, a: 2 })).toBe("a:2,b:3");
  });
});

describe("conta no Dia Final da Etapa 2 (fator 3,81, buy-in 1, multiplicador 1,0)", () => {
  it.each([
    [2, 3429, 6858],
    [3, 3175, 9525],
    [4, 2952.75, 11811],
  ])("N=%i: cada um recebe %f", async (n, valor, soma) => {
    const d = await fixture(E2);
    const final = diaFinal(d);
    const aud = conferido(d, { [final.id]: n });
    const linhas = aud.linhas.filter((l) => l.torneioId === final.id && l.acordo);
    expect(linhas).toHaveLength(n);
    expect(linhas.map((l) => l.posicao).sort()).toEqual(Array.from({ length: n }, (_, i) => i + 1));
    expect(linhas.every((l) => l.esperado === valor && l.acordo!.valorCent === valor * 100 && l.acordoN === n)).toBe(true);
    expect(linhas[0].acordo!.somaCent).toBe(soma * 100);
    expect(linhas[0].acordo!.passos.map((p) => p.cent)).toEqual([381000, 304800, 266700, 228600].slice(0, n));
    // situação: usa o valor do acordo; os registrados (2.286, 2.286, 2.286…) não batem, então Erro
    expect(linhas.every((l) => l.situacao === "ERRO" && l.causaCodigo === "ACORDO")).toBe(true);
    // posições acima de N não mudam, e a posição e o prêmio publicados continuam como estão
    const acima = aud.linhas.filter((l) => l.torneioId === final.id && l.posicao != null && l.posicao > n && !l.participacao);
    expect(acima.every((l) => l.acordo == null && l.acordoN === n)).toBe(true);
    const antes = auditar(d, REGRAS_PADRAO);
    expect(acima.map((l) => [l.esperadoCent, l.situacao])).toEqual(antes.linhas.filter((l) => l.torneioId === final.id && l.posicao != null && l.posicao > n && !l.participacao).map((l) => [l.esperadoCent, l.situacao]));
    expect(aud.linhas.filter((l) => l.torneioId === final.id && l.posicao === 1)[0].prize).toBe(antes.linhas.filter((l) => l.torneioId === final.id && l.posicao === 1)[0].prize);
  });

  it("registrado igual ao valor do acordo é Correto (sem tolerância de arredondamento)", async () => {
    const d = structuredClone(await fixture(E2));
    const final = diaFinal(d);
    for (const j of d.jogadores)
      for (const r of j.resultados) if (r.tournamentId === final.id && r.position != null && r.position <= 3) {
        j.rankingPoints = Math.round((j.rankingPoints - r.points + 3175) * 100) / 100;
        r.points = 3175;
      }
    const aud = conferido(d, { [final.id]: 3 });
    expect(aud.linhas.filter((l) => l.acordo).every((l) => l.situacao === "CORRETO")).toBe(true);
    // 3.175,01 já é Erro
    const j = d.jogadores.find((x) => x.resultados.some((r) => r.tournamentId === final.id && r.position === 2))!;
    const r = j.resultados.find((x) => x.tournamentId === final.id && x.position === 2)!;
    j.rankingPoints = Math.round((j.rankingPoints - r.points + 3175.01) * 100) / 100;
    r.points = 3175.01;
    expect(conferido(d, { [final.id]: 3 }).linhas.find((l) => l.jogador === j.name && l.torneioId === final.id)!.situacao).toBe("ERRO");
  });

  it("o verificador independente pega um motor que ignorasse o acordo", async () => {
    const d = await fixture(E2);
    const final = diaFinal(d);
    const aud = auditar(d, REGRAS_PADRAO, { [final.id]: 3 });
    expect(verificar(d, REGRAS_PADRAO, aud.linhas, aud.torneios, { [final.id]: 3 })).toEqual([]);
    const semAcordo = auditar(d, REGRAS_PADRAO);
    expect(verificar(d, REGRAS_PADRAO, semAcordo.linhas, semAcordo.torneios, { [final.id]: 3 }).length).toBeGreaterThan(0);
  });

  it("sem acordo, o identificador e os resultados são idênticos aos de antes", async () => {
    const d = await fixture(E2);
    expect(identificador(d, {}).sha256).toBe(identificador(d).sha256);
    expect(JSON.stringify(auditar(d, REGRAS_PADRAO, {}))).toBe(JSON.stringify(auditar(d, REGRAS_PADRAO)));
    const final = diaFinal(d);
    expect(identificador(d, { [final.id]: 3 }).sha256).not.toBe(identificador(d).sha256);
    expect(identificador(d, { [final.id]: 3 }).sha256).not.toBe(identificador(d, { [final.id]: 4 }).sha256);
  });

  it("totais e KPIs seguem o acordo; o painel traz o torneio marcado e a conta", async () => {
    const d = await fixture(E2);
    const final = diaFinal(d);
    const antes = montarResposta(E2, d, REGRAS_PADRAO, auditar(d, REGRAS_PADRAO), identificador(d)).painel;
    const aud = conferido(d, { [final.id]: 3 });
    const r = montarResposta(E2, d, REGRAS_PADRAO, aud, identificador(d, { [final.id]: 3 }));
    expect(r.acordos).toEqual({ aplicados: 1 });
    expect(r.painel.torneios.find((t) => t.id === final.id)!.acordo).toBe(3);
    expect(r.painel.torneios.filter((t) => t.acordo != null)).toHaveLength(1);
    // O acordo só redistribui: os 3 primeiros do Dia Final já eram erros e o registrado (2.286 cada) soma o mesmo que o valor dividido em 3 vezes 3.175 contra 3.810 + 3.048 + 2.667; os totais coincidem, a diferença por jogador não.
    expect(r.painel.indicadores.erros).toBe(antes.indicadores.erros);
    expect(r.painel.indicadores.pontosEmDiscordancia).toBe(antes.indicadores.pontosEmDiscordancia);
    const antesJ = Object.fromEntries(antes.jogadores.map((j) => [j.nome, j.diferenca]));
    expect(r.painel.jogadores.filter((j) => j.diferenca !== antesJ[j.nome])).toHaveLength(3);
    const l1 = r.linhas.find((l) => l.torneioId === final.id && l.posicao === 1)!;
    expect([l1.esperado, l1.registrado, l1.diferenca]).toEqual([3175, 2286, -889]);
    expect(l1.hipotese!.texto).toBe("Acordo entre 3 jogadores: cada um recebe 3.175");
  });

  it("o Consolidado soma o valor do acordo", async () => {
    const d = await fixture(E2);
    const final = diaFinal(d);
    const total = (acordos: Record<string, number>) => {
      const aud = auditar(d, REGRAS_PADRAO, acordos);
      const c = consolidar([
        { numero: 1, jogadores: d.jogadores.map((j) => ({ nome: j.name, id: j.id })), linhas: aud.linhas.map((l) => ({ jogador: l.jogador, posicao: l.posicao, esperadoCent: Math.round(l.esperado * 100), aguarda: l.situacao === "PENDENTE_REGRA", participacao: l.participacao })) },
      ]);
      return Object.fromEntries(c.jogadores.map((j) => [j.nome, j.totalCent]));
    };
    const sem = total({});
    const com = total({ [final.id]: 3 });
    const campeao = d.jogadores.find((j) => j.resultados.some((r) => r.tournamentId === final.id && r.position === 1))!.name;
    expect(com[campeao] - sem[campeao]).toBe(317500 - 381000);
    expect(Object.keys(com).filter((k) => com[k] !== sem[k])).toHaveLength(3);
  });
});

describe("armazenamento", () => {
  const exemplo: Acordos = { [chaveAcordo(E2, "t1")]: { etapa: E2, torneioId: "t1", n: 3, atualizadoEm: "2026-10-21T12:00:00.000Z" } };
  for (const [nome, criar] of [
    ["pasta local", () => new AcordosLocal(join(pasta, "ciclo"))],
    ["Vercel Blob (simulado)", () => new AcordosBlob()],
  ] as const)
    it(`${nome}: grava, lê, troca e esvazia`, async () => {
      const a = criar();
      expect(await a.ler()).toEqual({});
      await a.gravar(exemplo);
      expect(await a.ler()).toEqual(exemplo);
      await a.gravar({ ...exemplo, [chaveAcordo(E2, "t2")]: { etapa: E2, torneioId: "t2", n: 2, atualizadoEm: "x" } });
      expect(Object.keys(await a.ler())).toHaveLength(2);
      await a.gravar({});
      expect(await a.ler()).toEqual({});
    });
  it("acordosDaEtapa filtra pela etapa e devolve torneioId → N", () => {
    const todos = { ...exemplo, [chaveAcordo("outra", "t9")]: { etapa: "outra", torneioId: "t9", n: 4, atualizadoEm: "x" } };
    expect(acordosDaEtapa(todos, E2)).toEqual({ t1: 3 });
  });
});

describe("rota /api/acordos e cache", () => {
  const put = (corpo: unknown) => PUT(new Request("http://x/api/acordos", { method: "PUT", body: JSON.stringify(corpo), headers: { "content-type": "application/json" } }));
  const apagar = (etapa: string, torneioId: string) => DELETE(new Request(`http://x/api/acordos?etapa=${etapa}&torneioId=${torneioId}`, { method: "DELETE" }));
  const lista = async () => (await (await GET(new Request("http://x/api/acordos"))).json()).acordos;
  const auditoria = (id?: string) => executar(new Request(`http://x/api/auditoria?stage=${E2}${id ? `&id=${id}` : ""}`));

  it("grava, lista, troca e remove; a conta muda e volta", async () => {
    fixtureStub();
    const antes = await auditoria();
    const final = antes.dados.torneios.find((t) => t.role === "FINAL")!;
    expect(await lista()).toEqual([]);
    const r = await put({ etapa: E2, torneioId: final.id, n: 3 });
    expect(r.status).toBe(200);
    expect(await lista()).toMatchObject([{ etapa: E2, torneioId: final.id, n: 3 }]);
    const com = await auditoria();
    expect(com.aud.linhas.filter((l) => l.acordo)).toHaveLength(3);
    expect(com.id.sha256).not.toBe(antes.id.sha256);
    await put({ etapa: E2, torneioId: final.id, n: 2 }); // trocar
    expect((await auditoria()).aud.linhas.filter((l) => l.acordo)).toHaveLength(2);
    expect((await (await apagar(E2, final.id)).json())).toEqual({ removido: true });
    const depois = await auditoria();
    expect(depois.id.sha256).toBe(antes.id.sha256);
    expect(JSON.stringify(depois.aud)).toBe(JSON.stringify(antes.aud));
    expect(await lista()).toEqual([]);
    expect((await (await apagar(E2, final.id)).json())).toEqual({ removido: false });
  });

  it("N inválido: mensagem clara em português e nada é salvo", async () => {
    fixtureStub();
    const { dados } = await auditoria();
    const final = dados.torneios.find((t) => t.role === "FINAL")!;
    for (const [n, msg] of [
      [1, "O acordo é entre 2 ou mais pessoas."],
      [0, "O acordo é entre 2 ou mais pessoas."],
      [-3, "O acordo é entre 2 ou mais pessoas."],
      [2.5, "O número de pessoas do acordo deve ser um número inteiro."],
      ["três", "O número de pessoas do acordo deve ser um número inteiro."],
      [null, "O número de pessoas do acordo deve ser um número inteiro."],
      [64, "O acordo não pode ter mais pessoas do que premiados: este torneio tem 63."],
    ] as const) {
      const r = await put({ etapa: E2, torneioId: final.id, n });
      expect([r.status, (await r.json()).erro]).toEqual([400, msg]);
    }
    expect((await put({ etapa: E2, torneioId: "nao-existe", n: 2 })).status).toBe(400);
    expect((await put({ etapa: E2 })).status).toBe(400);
    expect((await PUT(new Request("http://x", { method: "PUT", body: "não é json" }))).status).toBe(400);
    expect(await lista()).toEqual([]);
    expect((await put({ etapa: E2, torneioId: final.id, n: 63 })).status).toBe(200); // o limite (premiados) vale
  });

  it("o cache é invalidado quando o acordo muda: o id antigo não devolve os números antigos", async () => {
    fixtureStub();
    const a = await auditoria();
    const final = a.dados.torneios.find((t) => t.role === "FINAL")!;
    expect((await auditoria(a.id.sha256)).mudou).toBe(false);
    expect((await auditoria(a.id.sha256)).aud).toBe(a.aud); // sem acordo novo, o cache serve
    await put({ etapa: E2, torneioId: final.id, n: 3 });
    const b = await auditoria(a.id.sha256);
    expect(b.aud).not.toBe(a.aud);
    expect(b.mudou).toBe(true);
    expect(b.aud.linhas.filter((l) => l.acordo)).toHaveLength(3);
    await apagar(E2, final.id);
    const c = await auditoria(b.id.sha256);
    expect(c.aud.linhas.filter((l) => l.acordo)).toHaveLength(0);
    expect(c.id.sha256).toBe(a.id.sha256);
  });
});

function fixtureStub() {
  const fx = JSON.parse(readFileSync(`tests/fixtures/${E2}.json`, "utf8"));
  vi.stubGlobal("fetch", async (url: string) => {
    const u = new URL(url);
    const body = u.pathname.endsWith("/ranking") ? fx.ranking : u.pathname.endsWith("/tournaments") ? fx.tournaments : fx.playerSummaries[u.searchParams.get("name")!];
    return { ok: true, status: 200, json: async () => body };
  });
}

describe("Excel: Relatório e Exportação trazem o acordo", () => {
  it("marca nas linhas, conta passo a passo, coluna no Torneios, faixa do Resumo e Identificação", async () => {
    const { exportacaoXlsx, relatorioXlsx } = await import("../lib/excel");
    const d = await fixture(E2);
    const final = diaFinal(d);
    const ac = { [final.id]: 3 };
    const aud = conferido(d, ac);
    const id = identificador(d, ac);
    const abrir = async (buf: Buffer) => {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
      return wb;
    };
    const texto = (v: unknown) => (typeof v === "object" && v && "result" in v ? String((v as { result: unknown }).result) : typeof v === "object" && v && "richText" in v ? (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("") : String(v ?? ""));
    for (const wb of [await abrir(await relatorioXlsx(E2, d, aud, REGRAS_PADRAO, id)), await abrir(await exportacaoXlsx(d, aud, id, REGRAS_PADRAO))]) {
      const ws = wb.getWorksheet("Todos os cálculos") ?? wb.getWorksheet("Dados")!;
      const cab = (ws.getRow(1).values as unknown[]).map(texto);
      const colAcordo = cab.indexOf("Acordo");
      const colConta = cab.indexOf("Conta correta");
      expect(colAcordo).toBeGreaterThan(0);
      const marcas: string[] = [];
      const contas: string[] = [];
      ws.eachRow((row, i) => {
        if (i === 1) return;
        const m = texto(row.getCell(colAcordo).value);
        if (m === "Acordo entre 3") {
          marcas.push(m);
          contas.push(texto(row.getCell(colConta).value));
        }
      });
      expect(marcas).toHaveLength(3);
      expect(contas[0]).toBe("Acordo entre 3: (3.810 + 3.048 + 2.667) ÷ 3 = 3.175");
    }
    const rel = await abrir(await relatorioXlsx(E2, d, aud, REGRAS_PADRAO, id));
    const torneios = rel.getWorksheet("Torneios")!;
    const colT = (torneios.getRow(1).values as unknown[]).map(texto).indexOf("Acordo");
    const linhasT: string[] = [];
    torneios.eachRow((row, i) => i > 1 && texto(row.getCell(colT).value) && linhasT.push(texto(row.getCell(1).value) + ":" + texto(row.getCell(colT).value)));
    expect(linhasT).toEqual(["Main Event SPT — Dia Final:3 pessoas"]);
    expect(texto(rel.getWorksheet("Resumo")!.getCell(4, 8).value)).toContain("Acordos aplicados: 1 torneio(s)");
    const exp = await abrir(await exportacaoXlsx(d, aud, id, REGRAS_PADRAO));
    const ident: string[] = [];
    exp.getWorksheet("Identificação")!.eachRow((row) => ident.push(texto(row.getCell(1).value) + "=" + texto(row.getCell(2).value)));
    expect(ident.some((x) => x.startsWith("Acordos aplicados=1 torneio(s): Main Event SPT — Dia Final (3 pessoas)"))).toBe(true);
    // sem acordo, nada disso aparece
    const limpo = await abrir(await relatorioXlsx(E2, d, auditar(d, REGRAS_PADRAO), REGRAS_PADRAO, identificador(d)));
    expect(texto(limpo.getWorksheet("Resumo")!.getCell(4, 8).value)).not.toContain("Acordos aplicados");
  });
});
