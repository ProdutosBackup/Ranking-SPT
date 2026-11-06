import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Torneio } from "../lib/api-spt";
import { auditar } from "../lib/auditoria";
import { conferir, identificador } from "../lib/integridade";
import { montarResposta } from "../lib/painel";
import { dadosDaPlanilha } from "../lib/planilha-guardada";
import { REGRAS_PADRAO } from "../lib/regras";
import { verificar } from "../lib/verificador";
import { BOUNTY_API } from "./bounty-mock";

const XLSX = new Uint8Array(readFileSync("tests/fixtures/ranking-spt-3a-etapa.xlsx"));
const FLIGHTS = [77, 64, 55, 67, 65].map((players, i) => ({ id: `f${i}`, name: `Dia 1 ${"ABCDE"[i]}`, buyIn: 1000, players, role: "FLIGHT", flightLabel: `1${"ABCDE"[i]}`, status: "FINISHED" }));
const REGISTRO = { arquivo: "x.xlsx", enviadoEm: "2026-11-05T00:00:00Z", tamanho: 1, sha256: "x", inscritosDiaFinal: null, resumo: {}, avisos: [] };
const TRES = ["200K OMAHA 5 K.O", "SUPER K.O", "100K OMAHA MYSTERY BOUNTY"];

afterEach(() => vi.unstubAllGlobals());

/** A API de mentira: sem rede. `resposta` é o que /tournaments devolve; null = o site não responde. */
async function etapa3(resposta: Torneio[] | null) {
  const chamadas: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    chamadas.push(url);
    if (resposta == null) throw new Error("rede fora");
    return { ok: true, status: 200, json: async () => ({ tournaments: resposta }) };
  });
  const dados = await dadosDaPlanilha(XLSX, REGISTRO as never);
  const aud = auditar(dados, REGRAS_PADRAO);
  expect(() => conferir(dados, REGRAS_PADRAO, aud)).not.toThrow(); // o verificador independente concorda em todas as linhas
  expect(verificar(dados, REGRAS_PADRAO, aud.linhas as never, aud.torneios as never)).toEqual([]);
  return { dados, aud, chamadas };
}
const COM_API = [...FLIGHTS, ...BOUNTY_API] as Torneio[];
const linhasDe = (aud: ReturnType<typeof auditar>, nome: string) => aud.linhas.filter((l) => l.torneio === nome);

describe("bounty da Etapa 3 vem da API, por nome", () => {
  it("K.O 2.000 + 1.000 = 3.000 (fator 2,5); Mystery 1.500 + 1.000 = 2.500 (1,5); Super K.O 500 + 500 = 1.000 (1,0)", async () => {
    const { aud, chamadas } = await etapa3(COM_API);
    expect(chamadas).toHaveLength(1); // uma só leitura: flights e bounty
    for (const [nome, exibido, total, fator, tipo, bounty] of [
      ["200K OMAHA 5 K.O", 2000, 3000, 2.5, "KO", 1000],
      ["100K OMAHA MYSTERY BOUNTY", 1500, 2500, 1.5, "MYSTERY", 1000],
      ["SUPER K.O", 500, 1000, 1, "KO", 500],
    ] as const) {
      const ls = linhasDe(aud, nome);
      expect(ls.length, nome).toBeGreaterThan(0);
      expect(ls.every((l) => l.buyIn === exibido && l.buyInFator === total && l.fatorBuyIn === fator && l.tipoBounty === tipo && l.somaBounty === bounty && l.pendencia == null), nome).toBe(true);
    }
    expect(aud.linhas.some((l) => l.pendencia != null)).toBe(false);
    // os outros torneios não têm bounty
    expect(aud.linhas.filter((l) => !TRES.includes(l.torneio)).every((l) => l.somaBounty == null)).toBe(true);
  });

  it("o texto da linha explica o buy-in para o fator", async () => {
    const { dados, aud } = await etapa3(COM_API);
    const r = montarResposta("bendito-cacao-2026", dados, REGRAS_PADRAO, aud, identificador(dados));
    const ko = r.linhas.find((l) => l.torneio === "200K OMAHA 5 K.O")!;
    expect(ko.buyInParaFator).toBe("buy-in para o fator: R$ 3.000 (2.000 + 1.000 K.O)");
    expect(r.linhas.find((l) => l.torneio === "100K OMAHA MYSTERY BOUNTY")!.buyInParaFator).toBe("buy-in para o fator: R$ 2.500 (1.500 + 1.000 Mystery)");
  });

  it("o nome casa sem maiúsculas, acentos, hífen, barra e ´", async () => {
    const outros = BOUNTY_API.map((t) => ({ ...t, name: t.name.toLowerCase().replace("super k.o", "Súper-K.O").replace("5 k.o", "5  K.O") }));
    const { aud } = await etapa3([...FLIGHTS, ...outros] as Torneio[]);
    expect(aud.linhas.some((l) => l.pendencia != null)).toBe(false);
    expect(linhasDe(aud, "200K OMAHA 5 K.O")[0].buyInFator).toBe(3000);
  });

  it("bounty (tipo e valor) entra no identificador dos dados", async () => {
    const a = (await etapa3(COM_API)).dados;
    const b = (await etapa3([...FLIGHTS, ...BOUNTY_API.map((t) => (t.name === "SUPER K.O" ? { ...t, bountyAmount: 600 } : t))] as Torneio[])).dados;
    const c = (await etapa3([...FLIGHTS, ...BOUNTY_API.map((t) => (t.name === "SUPER K.O" ? { ...t, bountyType: "MYSTERY" } : t))] as Torneio[])).dados;
    const hashes = new Set([a, b, c].map((d) => identificador(d).sha256));
    expect(hashes.size).toBe(3);
  });
});

describe("bounty não obtido: as linhas aguardam, sem usar o buy-in base", () => {
  const confere = (aud: ReturnType<typeof auditar>, pendentes: string[]) => {
    for (const nome of TRES) {
      const ls = linhasDe(aud, nome);
      if (pendentes.includes(nome)) expect(ls.every((l) => l.situacao === "PENDENTE_REGRA" && l.pendencia === "SEM_BOUNTY" && l.causaProvavel === "bounty não obtido da API"), nome).toBe(true);
      else expect(ls.every((l) => l.pendencia == null), nome).toBe(true);
    }
    expect(aud.linhas.filter((l) => !pendentes.includes(l.torneio)).every((l) => l.pendencia == null)).toBe(true);
  };

  it("API indisponível: os 3 torneios aguardam e nada mais muda", async () => {
    const { aud, chamadas } = await etapa3(null);
    expect(chamadas).toHaveLength(2); // duas tentativas
    confere(aud, TRES);
    const boa = (await etapa3(COM_API)).aud;
    // nenhum outro torneio é afetado (flights vêm da planilha sem a API, então só o campo do Main Event pode mudar: aqui o Dia Final usa o valor da planilha)
    const outros = (a: typeof aud) => a.linhas.filter((l) => !TRES.includes(l.torneio) && !/Dia Final|Dia 1/.test(l.torneio)).map((l) => [l.jogador, l.torneio, l.esperadoCent, l.situacao]);
    expect(outros(aud)).toEqual(outros(boa));
  });

  it("nome sem correspondência na API: só esse torneio aguarda", async () => {
    const { aud } = await etapa3([...FLIGHTS, ...BOUNTY_API.map((t) => (t.name === "SUPER K.O" ? { ...t, name: "SUPER KNOCKOUT" } : t))] as Torneio[]);
    confere(aud, ["SUPER K.O"]);
  });

  it("API sem bounty válido (tipo NONE ou sem valor): o torneio aguarda", async () => {
    const { aud } = await etapa3([
      ...FLIGHTS,
      ...BOUNTY_API.map((t) => (t.name === "200K OMAHA 5 K.O" ? { ...t, bountyType: "NONE" } : t.name === "SUPER K.O" ? { ...t, bountyAmount: null } : t)),
    ] as Torneio[]);
    confere(aud, ["200K OMAHA 5 K.O", "SUPER K.O"]);
  });

  it("a tela mostra a pendência com o motivo", async () => {
    const { dados, aud } = await etapa3(null);
    const r = montarResposta("bendito-cacao-2026", dados, REGRAS_PADRAO, aud, identificador(dados));
    expect(r.painel.aguardando.map((a) => a.texto)).toContain("30 resultados de 200K OMAHA 5 K.O: bounty não obtido da API");
    expect(r.painel.avisos).toContain("Há torneios K.O ou Mystery sem o bounty da API.");
  });
});
