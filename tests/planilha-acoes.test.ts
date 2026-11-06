import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { DadosSpt, Torneio } from "../lib/api-spt";
import { casar, lerAcoes, mesclarAcoes, MOTIVO_SEM_BLOCO, type AbaAcoes } from "../lib/planilha-acoes";
import { lerBloco } from "../lib/planilha";

const t = (id: string, name: string, extra: Partial<Torneio> = {}): Torneio => ({ id, name, buyIn: 100, players: 10, role: "STANDALONE", status: "FINISHED", ...extra }) as Torneio;
const aba = (nome: string, buyIns: number | null, reentries: number | null, titulo = nome): AbaAcoes => ({ nome, titulo, buyIns, reentries });
const ws = (monta: (w: ExcelJS.Worksheet) => void) => {
  const w = new ExcelJS.Workbook().addWorksheet("x");
  monta(w);
  return w;
};

describe("lerBloco: Buy In e Rebuy/Reentry/Reentrada em qualquer caixa", () => {
  it.each([
    ["Rebuy", "Buy In"],
    ["REBUY", "BUY IN"],
    ["  rebuy ", " buy  in"],
    ["REENTRY", "BUY IN"],
    ["Reentrada", "buy in"],
  ])("%s / %s", (re, bi) => {
    const w = ws((x) => {
      x.getCell("E3").value = bi;
      x.getCell("F3").value = re;
      x.getCell("E4").value = 26;
      x.getCell("F4").value = 23;
    });
    expect(lerBloco(w)).toEqual({ buyIns: 26, reentries: 23 });
  });
  it("zero explícito é 0; vazio e texto são ausentes; sem rótulo é ausente", () => {
    const w = ws((x) => {
      x.getCell("F2").value = "buy in";
      x.getCell("G2").value = "Rebuy";
      x.getCell("F3").value = 0;
    });
    expect(lerBloco(w)).toEqual({ buyIns: 0, reentries: null });
    expect(lerBloco(ws(() => {}))).toEqual({ buyIns: null, reentries: null });
  });
  it("não lê 'AÇÕES TOTAIS' nem 'AÇÕES:'", () => {
    const w = ws((x) => {
      x.getCell("E3").value = "AÇÕES TOTAIS";
      x.getCell("F3").value = "Buy In";
      x.getCell("G3").value = "Rebuy";
      x.getCell("E4").value = 999;
      x.getCell("F4").value = 5;
      x.getCell("G4").value = 7;
    });
    expect(lerBloco(w)).toEqual({ buyIns: 5, reentries: 7 });
  });
});

describe("lerAcoes: planilhas reais das Etapas 1 e 2", () => {
  it("Etapa 1: número da etapa e blocos", async () => {
    const r = await lerAcoes(new Uint8Array(readFileSync("tests/fixtures/ranking-spt-1a-etapa.xlsx")));
    if (!r.ok) throw new Error(r.erros.join());
    expect(r.etapa).toBe(1);
    const dia1a = r.abas.find((a) => a.nome === "Main Event 400K Dia 1A")!;
    expect([dia1a.buyIns, dia1a.reentries]).toEqual([126, 195]);
    const omaha = r.abas.find((a) => a.nome === "200K Omaha 5 K.O")!;
    expect([omaha.buyIns, omaha.reentries]).toEqual([27, 48]);
    expect(r.abas.find((a) => a.nome === "Main Event 400K Dia 1C")).toMatchObject({ buyIns: 61, reentries: 0 }); // zero explícito
    expect(r.abas.find((a) => a.nome === "Final Main Event")).toMatchObject({ buyIns: 334 });
  });
  it("Etapa 2: número da etapa e blocos", async () => {
    const r = await lerAcoes(new Uint8Array(readFileSync("tests/fixtures/ranking-spt-2a-etapa.xlsx")));
    if (!r.ok) throw new Error(r.erros.join());
    expect(r.etapa).toBe(2);
    const sc = r.abas.find((a) => a.nome === "EV #10 SECOND CHANCE 20K")!;
    expect([sc.buyIns, sc.reentries]).toEqual([94, 138]);
    expect(r.abas.find((a) => /Dia Final/.test(a.nome))).toMatchObject({ buyIns: 92, reentries: 0 });
  });
  it("arquivo que não é .xlsx", async () => {
    const r = await lerAcoes(new Uint8Array([1, 2, 3, 4, 5]));
    expect(r.ok).toBe(false);
  });
});

describe("casar: aba × torneio", () => {
  it("normaliza maiúsculas, acentos, '-' e '/'", () => {
    const c = casar([aba("PLO-NLH DEALER´S CHOICE PIJAMA", 1, 2, "PLO/NLH DEALER´S CHOICE PIJAMA")], [t("a", "plo/nlh dealer's choice pijama")]);
    expect(c.casados.get("a")?.buyIns).toBe(1);
    expect(c.abasSemTorneio).toEqual([]);
  });
  it("nome de aba cortado em 31 caracteres casa por prefixo; A1 completo também", () => {
    const longo = "EV #8 CHAMPIONSHIP SUPER HIGH ROLLER 200K";
    const cortado = longo.slice(0, 31);
    expect(casar([aba(cortado, 82, 33, "")], [t("a", longo)]).casados.has("a")).toBe(true);
    expect(casar([aba(cortado, 82, 33, longo)], [t("a", longo)]).casados.has("a")).toBe(true);
    expect(casar([aba("EV #8 CURTO", 1, 1, "")], [t("a", "EV #8 CURTO E MAIS")]).casados.size).toBe(0); // só vale prefixo quando a aba tem 31 caracteres
  });
  it("ambiguidade não casa e é reportada", () => {
    const duas = casar([aba("SUPER K.O", 1, 1)], [t("a", "Super K.O"), t("b", "SUPER K.O")]);
    expect(duas.casados.size).toBe(0);
    expect(duas.ambiguos).toEqual(["SUPER K.O"]);
    const abas2 = casar([aba("Super KO", 1, 1), aba("SUPER KO", 2, 2)], [t("a", "super ko")]);
    expect(abas2.casados.size).toBe(0);
    expect(abas2.ambiguos).toEqual(["super ko"]);
  });
  it("lista abas sem torneio e torneios sem aba; Main Event fica fora", () => {
    const c = casar([aba("Solta", 1, 1), aba("Main Event 400K Dia 1A", 1, 1)], [t("a", "Sem Aba"), t("f", "Main Event 400K Dia 1A")]);
    expect(c.abasSemTorneio).toEqual(["Solta"]);
    expect(c.torneiosSemAba).toEqual(["Sem Aba"]);
  });
});

describe("mesclarAcoes", () => {
  const base = { stage: "x", updatedAt: { ranking: "", tournaments: "" }, jogadores: [], torneios: [t("a", "Com Bloco"), t("b", "Sem Aba"), t("c", "Aba Sem Bloco"), t("f", "Main Event Dia 1A", { role: "FLIGHT" })] } as unknown as DadosSpt;
  it("preenche os casados, marca o motivo nos demais, não mexe no Main Event nem no objeto de entrada", () => {
    const antes = JSON.stringify(base);
    const { dados } = mesclarAcoes(base, { ok: true, etapa: 2, abas: [aba("Com Bloco", 10, 0), aba("Aba Sem Bloco", null, null), aba("Main Event Dia 1A", 5, 5)] });
    expect(JSON.stringify(base)).toBe(antes);
    const por = (id: string) => dados.torneios.find((x) => x.id === id)!;
    expect([por("a").buyIns, por("a").reentries, por("a").acoesMotivo]).toEqual([10, 0, undefined]);
    expect(por("b").acoesMotivo).toBe(MOTIVO_SEM_BLOCO);
    expect(por("c").acoesMotivo).toBe(MOTIVO_SEM_BLOCO);
    expect(por("f").buyIns).toBeUndefined();
    expect(por("f").acoesMotivo).toBeUndefined();
  });
});
