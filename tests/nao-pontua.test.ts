import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarDados } from "../lib/api-spt";
import { auditar, motivoNaoPontua } from "../lib/auditoria";
import { REGRAS_PADRAO } from "../lib/regras";
import { naoPontuaVerificador, verificar } from "../lib/verificador";

// Torneios que não pontuam, reconhecidos pelo nome [CONFIRMADO 05/11/2026; ALL IN OR FOLD por decisão do usuário].
const NAO_PONTUAM: [string, string][] = [
  ["EV #7 LADIES ESPECIAL", "Ladies"],
  ["Ladies", "Ladies"],
  ["LADIES ESPECIAL", "Ladies"],
  ["SATELITE CHAMPIONSHIP", "Satélite"],
  ["Satélite PLO 200K", "Satélite"],
  ["SATÉLITE ALL IN OR FOLD", "Satélite"],
  ["ALL IN OR FOLD CHAMPIONSHIP", "All in or Fold"],
  ["ALL IN OR FOLD CHAMPIONSHIP 2", "All in or Fold"],
  ["All-in or fold".replace("-", " "), "All in or Fold"],
];
const PONTUAM = ["SECOND CHANCE", "HIGH ROLLER 50K", "Main Event SPT - Dia Final", "EV #9 DOUBLE BOARD TURBO PIJAMA", "EV #4 HORSE", "200K OMAHA 5 K.O", "EV #2 200K PLO 5 K.O", "OMAHA DEALER´S CHOICE", "SUPER K.O"];

afterEach(() => vi.unstubAllGlobals());

describe("reconhecimento pelo nome: motor e verificador concordam", () => {
  it.each(NAO_PONTUAM)("%s não pontua (%s)", (nome, motivo) => {
    expect(motivoNaoPontua(nome)).toBe(motivo);
    expect(motivoNaoPontua(nome.toUpperCase())).toBe(motivo);
    expect(naoPontuaVerificador(nome)).toBe(true);
    expect(naoPontuaVerificador(nome.toLowerCase())).toBe(true);
  });
  it.each(PONTUAM)("%s pontua", (nome) => {
    expect(motivoNaoPontua(nome)).toBeNull();
    expect(naoPontuaVerificador(nome)).toBe(false);
  });
});

describe("linhas de torneios que não pontuam", () => {
  async function dadosRenomeando(nome: string) {
    const fx = JSON.parse(readFileSync("tests/fixtures/vale-suico-2026.json", "utf8"));
    vi.stubGlobal("fetch", async (url: string) => {
      const u = new URL(url);
      const body = u.pathname.endsWith("/ranking") ? fx.ranking : u.pathname.endsWith("/tournaments") ? fx.tournaments : fx.playerSummaries[u.searchParams.get("name")!];
      return { ok: true, status: 200, json: async () => body };
    });
    const d = await buscarDados("vale-suico-2026");
    d.torneios.find((t) => t.name.startsWith("EV #3"))!.name = nome;
    return d;
  }
  it.each([
    ["EV #7 LADIES ESPECIAL", "Ladies"],
    ["ALL IN OR FOLD CHAMPIONSHIP 2", "All in or Fold"],
    ["SATELITE CHAMPIONSHIP", "Satélite"],
  ])("%s com pontos registrados é Erro com o motivo no texto; motor e verificador concordam", async (nome, motivo) => {
    const d = await dadosRenomeando(nome);
    const aud = auditar(d, REGRAS_PADRAO);
    const ls = aud.linhas.filter((l) => l.torneio === nome);
    expect(ls.length).toBeGreaterThan(0);
    expect(ls.every((l) => l.situacao === "ERRO" && l.esperado === 0 && l.naoPontua === motivo && l.causaProvavel === `${motivo} com pontos registrados` && l.conta === `0: ${motivo === "Satélite" ? "satélite" : motivo} não pontua`)).toBe(true);
    expect(verificar(d, REGRAS_PADRAO, aud.linhas, aud.torneios)).toEqual([]);
  });
  it("torneio que pontua não ganha motivo", async () => {
    const d = await dadosRenomeando("EV #3 30K SUPER K.O");
    const aud = auditar(d, REGRAS_PADRAO);
    expect(aud.linhas.every((l) => l.naoPontua == null)).toBe(true);
  });
});
