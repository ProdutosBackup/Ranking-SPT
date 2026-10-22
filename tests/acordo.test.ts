import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PUT } from "../app/api/acordos/route";
import { assinaturaAcordos, validarK } from "../lib/acordo";
import { AcordosBlob, AcordosLocal, acordosDaEtapa, armazenamentoAcordos, chaveAcordo, lerAcordos, trocarArmazenamentoAcordos, type Acordos } from "../lib/acordos";
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

describe("regra do acordo", () => {
  it("validação de K: inteiro, de 2 até os premiados", () => {
    expect(validarK(2, 63)).toBeNull();
    expect(validarK(63, 63)).toBeNull();
    expect(validarK(1.5, 63)).toBe("Informe a colocação como um número inteiro.");
    expect(validarK("3", 63)).toBe("Informe a colocação como um número inteiro.");
    expect(validarK(null, 63)).toBe("Informe a colocação como um número inteiro.");
    expect(validarK(1, 63)).toBe("A colocação do acordo vai de 2 para cima.");
    expect(validarK(0, 63)).toBe("A colocação do acordo vai de 2 para cima.");
    expect(validarK(64, 63)).toBe("A colocação não pode passar dos premiados: este torneio tem 63.");
    expect(validarK(2, 1)).toBe("Este torneio tem menos de 2 premiados, então não dá para fazer acordo.");
  });

  it("assinatura estável, marcada com K, e vazia sem acordos", () => {
    expect(assinaturaAcordos({})).toBe("");
    expect(assinaturaAcordos({ b: 3, a: 2 })).toBe("a:k2,b:k3");
  });
});

describe("conta no Dia Final da Etapa 2 (fator 3,81, buy-in 1, multiplicador 1,0)", () => {
  it.each([
    [2, 800, 3048],
    [3, 700, 2667],
    [4, 600, 2286],
  ])("K=%i: os K primeiros pontuam como Kº colocado (base %i × 3,81 = %f)", async (k, base, valor) => {
    const d = await fixture(E2);
    const final = diaFinal(d);
    const aud = conferido(d, { [final.id]: k });
    const linhas = aud.linhas.filter((l) => l.torneioId === final.id && l.acordo != null);
    expect(linhas).toHaveLength(k);
    expect(linhas.map((l) => l.posicao).sort()).toEqual(Array.from({ length: k }, (_, i) => i + 1));
    expect(linhas.every((l) => l.esperado === valor && l.esperadoCent === valor * 100 && l.base === base && l.acordo === k && l.acordoK === k)).toBe(true);
    expect(linhas[0].fatorParticipantes).toBe(3.81);
    expect(linhas[0].conta).toBe(`${base} × 3,81 × 1`);
    // posições acima de K não mudam, e a posição e o prêmio publicados continuam como estão
    const acima = aud.linhas.filter((l) => l.torneioId === final.id && l.posicao != null && l.posicao > k && !l.participacao);
    expect(acima.every((l) => l.acordo == null && l.acordoK === k)).toBe(true);
    const antes = auditar(d, REGRAS_PADRAO);
    expect(acima.map((l) => [l.esperadoCent, l.situacao])).toEqual(antes.linhas.filter((l) => l.torneioId === final.id && l.posicao != null && l.posicao > k && !l.participacao).map((l) => [l.esperadoCent, l.situacao]));
    expect(aud.linhas.filter((l) => l.torneioId === final.id && l.posicao === 1)[0].prize).toBe(antes.linhas.filter((l) => l.torneioId === final.id && l.posicao === 1)[0].prize);
  });

  it("K=4: os 2.286 registrados passam a Correto (só confirma a conta, não conclui que houve acordo)", async () => {
    const d = await fixture(E2);
    const final = diaFinal(d);
    const antes = auditar(d, REGRAS_PADRAO).linhas.filter((l) => l.torneioId === final.id && l.posicao != null && l.posicao <= 4);
    expect(antes.map((l) => l.registrado)).toEqual([2286, 2286, 2286, 2286]);
    expect(antes.filter((l) => l.situacao === "ERRO")).toHaveLength(3);
    const depois = conferido(d, { [final.id]: 4 }).linhas.filter((l) => l.torneioId === final.id && l.posicao != null && l.posicao <= 4);
    expect(depois.every((l) => l.situacao === "CORRETO" && l.diferenca === 0)).toBe(true);
  });

  it("registrado diferente do valor do acordo é Erro, sem tolerância de arredondamento", async () => {
    const d = structuredClone(await fixture(E2));
    const final = diaFinal(d);
    const j = d.jogadores.find((x) => x.resultados.some((r) => r.tournamentId === final.id && r.position === 2))!;
    const r = j.resultados.find((x) => x.tournamentId === final.id && x.position === 2)!;
    j.rankingPoints = Math.round((j.rankingPoints - r.points + 2286.01) * 100) / 100;
    r.points = 2286.01;
    const l = conferido(d, { [final.id]: 4 }).linhas.find((x) => x.jogador === j.name && x.torneioId === final.id)!;
    expect([l.situacao, l.causaCodigo]).toEqual(["ERRO", "ACORDO"]);
  });

  it("o verificador independente concorda com o motor e pega um motor que errasse o acordo", async () => {
    const d = await fixture(E2);
    const final = diaFinal(d);
    for (const k of [2, 3, 4]) {
      const aud = auditar(d, REGRAS_PADRAO, { [final.id]: k });
      expect(verificar(d, REGRAS_PADRAO, aud.linhas, aud.torneios, { [final.id]: k })).toEqual([]);
    }
    const semAcordo = auditar(d, REGRAS_PADRAO);
    expect(verificar(d, REGRAS_PADRAO, semAcordo.linhas, semAcordo.torneios, { [final.id]: 3 }).length).toBeGreaterThan(0);
    const outroK = auditar(d, REGRAS_PADRAO, { [final.id]: 4 });
    expect(verificar(d, REGRAS_PADRAO, outroK.linhas, outroK.torneios, { [final.id]: 3 }).length).toBeGreaterThan(0);
  });

  it("sem acordo, o identificador e os resultados são idênticos aos de antes", async () => {
    const d = await fixture(E2);
    expect(identificador(d, {}).sha256).toBe(identificador(d).sha256);
    expect(JSON.stringify(auditar(d, REGRAS_PADRAO, {}))).toBe(JSON.stringify(auditar(d, REGRAS_PADRAO)));
    const final = diaFinal(d);
    expect(identificador(d, { [final.id]: 3 }).sha256).not.toBe(identificador(d).sha256);
    expect(identificador(d, { [final.id]: 3 }).sha256).not.toBe(identificador(d, { [final.id]: 4 }).sha256);
  });

  it("K=4: totais e KPIs; o painel traz o torneio marcado e a hipótese", async () => {
    const d = await fixture(E2);
    const final = diaFinal(d);
    const antes = montarResposta(E2, d, REGRAS_PADRAO, auditar(d, REGRAS_PADRAO), identificador(d)).painel;
    const aud = conferido(d, { [final.id]: 4 });
    const r = montarResposta(E2, d, REGRAS_PADRAO, aud, identificador(d, { [final.id]: 4 }));
    expect(r.acordos).toEqual({ aplicados: 1 });
    expect(r.painel.torneios.find((t) => t.id === final.id)!.acordo).toBe(4);
    // Os 3 primeiros deixam de ser erro: 3.810 + 3.048 + 2.667 − 3 × 2.286 = 2.667 pontos a menos em discordância.
    expect(r.painel.indicadores.erros).toBe(antes.indicadores.erros - 3);
    expect(Math.round((antes.indicadores.pontosEmDiscordancia - r.painel.indicadores.pontosEmDiscordancia) * 100)).toBe(266700);
    const antesJ = Object.fromEntries(antes.jogadores.map((j) => [j.nome, j.diferenca]));
    expect(r.painel.jogadores.filter((j) => j.diferenca !== antesJ[j.nome])).toHaveLength(3);
    // Com K=3, o 1º pontua 2.667 contra 2.286 registrados; a hipótese diz a regra
    const r3 = montarResposta(E2, d, REGRAS_PADRAO, conferido(d, { [final.id]: 3 }), identificador(d, { [final.id]: 3 }));
    const l1 = r3.linhas.find((l) => l.torneioId === final.id && l.posicao === 1)!;
    expect([l1.esperado, l1.registrado, l1.diferenca]).toEqual([2667, 2286, -381]);
    expect(l1.hipotese!.texto).toBe("Acordo: os 3 primeiros pontuam como 3º colocado, 2.667 cada");
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
    const com = total({ [final.id]: 4 });
    const campeao = d.jogadores.find((j) => j.resultados.some((r) => r.tournamentId === final.id && r.position === 1))!.name;
    expect(com[campeao] - sem[campeao]).toBe(228600 - 381000);
    expect(Object.keys(com).filter((k) => com[k] !== sem[k])).toHaveLength(3);
  });
});

describe("armazenamento", () => {
  const exemplo: Acordos = { [chaveAcordo(E2, "t1")]: { etapa: E2, torneioId: "t1", k: 3, atualizadoEm: "2026-10-21T12:00:00.000Z" } };
  for (const [nome, criar] of [
    ["pasta local", () => new AcordosLocal(join(pasta, "ciclo"))],
    ["Vercel Blob (simulado)", () => new AcordosBlob()],
  ] as const)
    it(`${nome}: grava, lê, troca e esvazia`, async () => {
      const a = criar();
      expect(await a.ler()).toEqual({});
      await a.gravar(exemplo);
      expect(await a.ler()).toEqual(exemplo);
      await a.gravar({ ...exemplo, [chaveAcordo(E2, "t2")]: { etapa: E2, torneioId: "t2", k: 2, atualizadoEm: "x" } });
      expect(Object.keys(await a.ler())).toHaveLength(2);
      await a.gravar({});
      expect(await a.ler()).toEqual({});
    });
  it("acordosDaEtapa filtra pela etapa e devolve torneioId → K", () => {
    const todos = { ...exemplo, [chaveAcordo("outra", "t9")]: { etapa: "outra", torneioId: "t9", k: 4, atualizadoEm: "x" } };
    expect(acordosDaEtapa(todos, E2)).toEqual({ t1: 3 });
  });
  it("registros da regra antiga (com N, sem K) são descartados em silêncio", async () => {
    const antigo = { etapa: E2, torneioId: "t2", n: 3, atualizadoEm: "x" } as unknown as Acordos[string];
    await armazenamentoAcordos().gravar({ ...exemplo, [chaveAcordo(E2, "t2")]: antigo });
    expect(await lerAcordos()).toEqual(exemplo);
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
    const r = await put({ etapa: E2, torneioId: final.id, k: 3 });
    expect(r.status).toBe(200);
    expect(await lista()).toMatchObject([{ etapa: E2, torneioId: final.id, k: 3 }]);
    const com = await auditoria();
    expect(com.aud.linhas.filter((l) => l.acordo)).toHaveLength(3);
    expect(com.id.sha256).not.toBe(antes.id.sha256);
    await put({ etapa: E2, torneioId: final.id, k: 2 }); // trocar
    expect((await auditoria()).aud.linhas.filter((l) => l.acordo)).toHaveLength(2);
    expect((await (await apagar(E2, final.id)).json())).toEqual({ removido: true });
    const depois = await auditoria();
    expect(depois.id.sha256).toBe(antes.id.sha256);
    expect(JSON.stringify(depois.aud)).toBe(JSON.stringify(antes.aud));
    expect(await lista()).toEqual([]);
    expect((await (await apagar(E2, final.id)).json())).toEqual({ removido: false });
  });

  it("K inválido: mensagem clara em português e nada é salvo", async () => {
    fixtureStub();
    const { dados } = await auditoria();
    const final = dados.torneios.find((t) => t.role === "FINAL")!;
    for (const [k, msg] of [
      [1, "A colocação do acordo vai de 2 para cima."],
      [0, "A colocação do acordo vai de 2 para cima."],
      [-3, "A colocação do acordo vai de 2 para cima."],
      [2.5, "Informe a colocação como um número inteiro."],
      ["três", "Informe a colocação como um número inteiro."],
      [null, "Informe a colocação como um número inteiro."],
      [64, "A colocação não pode passar dos premiados: este torneio tem 63."],
    ] as const) {
      const r = await put({ etapa: E2, torneioId: final.id, k });
      expect([r.status, (await r.json()).erro]).toEqual([400, msg]);
    }
    expect((await put({ etapa: E2, torneioId: "nao-existe", k: 2 })).status).toBe(400);
    expect((await put({ etapa: E2, torneioId: final.id, n: 3 })).status).toBe(400); // o formato antigo (N) não é aceito
    expect((await put({ etapa: E2 })).status).toBe(400);
    expect((await PUT(new Request("http://x", { method: "PUT", body: "não é json" }))).status).toBe(400);
    expect(await lista()).toEqual([]);
    expect((await put({ etapa: E2, torneioId: final.id, k: 63 })).status).toBe(200); // o limite (premiados) vale
  });

  it("o cache é invalidado quando o acordo muda: o id antigo não devolve os números antigos", async () => {
    fixtureStub();
    const a = await auditoria();
    const final = a.dados.torneios.find((t) => t.role === "FINAL")!;
    expect((await auditoria(a.id.sha256)).mudou).toBe(false);
    expect((await auditoria(a.id.sha256)).aud).toBe(a.aud); // sem acordo novo, o cache serve
    await put({ etapa: E2, torneioId: final.id, k: 3 });
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
  it("marca nas linhas, conta com a base de K, coluna no Torneios, faixa do Resumo e Identificação", async () => {
    const { exportacaoXlsx, relatorioXlsx } = await import("../lib/excel");
    const d = await fixture(E2);
    const final = diaFinal(d);
    const ac = { [final.id]: 4 };
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
        if (m === "Os 4 primeiros, como 4º colocado") {
          marcas.push(m);
          contas.push(texto(row.getCell(colConta).value));
        }
      });
      expect(marcas).toHaveLength(4);
      expect(contas[0]).toBe("Acordo: pontua como 4º colocado: 600 × 3,81 × 1 = 2.286");
    }
    const rel = await abrir(await relatorioXlsx(E2, d, aud, REGRAS_PADRAO, id));
    const torneios = rel.getWorksheet("Torneios")!;
    const colT = (torneios.getRow(1).values as unknown[]).map(texto).indexOf("Acordo");
    const linhasT: string[] = [];
    torneios.eachRow((row, i) => i > 1 && texto(row.getCell(colT).value) && linhasT.push(texto(row.getCell(1).value) + ":" + texto(row.getCell(colT).value)));
    expect(linhasT).toEqual(["Main Event SPT — Dia Final:Os 4 primeiros, como 4º colocado"]);
    expect(texto(rel.getWorksheet("Resumo")!.getCell(4, 8).value)).toContain("Acordos aplicados: 1 torneio(s)");
    const exp = await abrir(await exportacaoXlsx(d, aud, id, REGRAS_PADRAO));
    const ident: string[] = [];
    exp.getWorksheet("Identificação")!.eachRow((row) => ident.push(texto(row.getCell(1).value) + "=" + texto(row.getCell(2).value)));
    expect(ident.some((x) => x.startsWith("Acordos aplicados=1 torneio(s): Main Event SPT — Dia Final (os 4 primeiros, como 4º colocado)"))).toBe(true);
    // sem acordo, nada disso aparece
    const limpo = await abrir(await relatorioXlsx(E2, d, auditar(d, REGRAS_PADRAO), REGRAS_PADRAO, identificador(d)));
    expect(texto(limpo.getWorksheet("Resumo")!.getCell(4, 8).value)).not.toContain("Acordos aplicados");
  });
});
