import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/planilha/route";
import { BOUNTY_API } from "./bounty-mock";
import { buscarDados } from "../lib/api-spt";
import { auditar } from "../lib/auditoria";
import { ArmazenamentoLocal, ETAPA_PLANILHA, trocarArmazenamento } from "../lib/armazenamento-planilha";
import { consolidar } from "../lib/consolidado";
import { etapaParaConsolidar } from "../lib/consolidado-etapas";
import { executar } from "../lib/executar";
import { conferir, identificador } from "../lib/integridade";
import { removerParticipantes, salvarParticipantes } from "../lib/participantes-armazenamento";
import { montarResposta } from "../lib/painel";
import { REGRAS_PADRAO, VERSAO_REGRAS } from "../lib/regras";

// Totais inventados (os da planilha real não aparecem aqui): Etapa 2 = 576 e Etapa 3 = 557 entradas + reentradas.
const TOTAIS = { 1: { entradas: 900, jogadores: 100 }, 2: { entradas: 576, jogadores: 218 }, 3: { entradas: 557, jogadores: 214 } };
const E1 = "taua-2026";
const E2 = "vale-suico-2026";
const E3 = ETAPA_PLANILHA;

const pasta = mkdtempSync(join(tmpdir(), "participantes-calculo-"));
afterAll(() => rmSync(pasta, { recursive: true, force: true }));

const FLIGHTS = [77, 64, 55, 67, 65].map((players, i) => ({ id: `f${i}`, name: `Dia 1 ${"ABCDE"[i]}`, buyIn: 1000, players, role: "FLIGHT", flightLabel: "ABCDE"[i], status: "FINISHED" }));
function site() {
  vi.stubGlobal("fetch", async (url: string) => {
    const u = new URL(url);
    const stage = u.searchParams.get("stage")!;
    if (stage === E3) {
      const corpo = u.pathname.endsWith("/ranking") ? { updatedAt: "2026-10-21T00:00:00Z", ranking: [] } : { updatedAt: "2026-10-21T00:00:00Z", tournaments: [...FLIGHTS, ...BOUNTY_API] };
      return { ok: true, status: 200, json: async () => corpo };
    }
    const fx = JSON.parse(readFileSync(`tests/fixtures/${stage}.json`, "utf8"));
    const corpo = u.pathname.endsWith("/ranking") ? fx.ranking : u.pathname.endsWith("/tournaments") ? fx.tournaments : fx.playerSummaries[u.searchParams.get("name")!];
    return { ok: true, status: 200, json: async () => corpo };
  });
}
const enviarPlanilha = async (arquivo: string, nome: string) => {
  const f = new FormData();
  f.set("arquivo", new File([readFileSync(`tests/fixtures/${arquivo}`) as BlobPart], nome));
  expect((await POST(new Request("http://x/api/planilha", { method: "POST", body: f }))).status).toBe(200);
};

beforeEach(async () => {
  trocarArmazenamento(new ArmazenamentoLocal(join(pasta, String(Math.random()))));
  site();
  await enviarPlanilha("ranking-spt-3a-etapa.xlsx", "ranking-spt-3a-etapa.xlsx");
});
afterEach(() => {
  vi.unstubAllGlobals();
  trocarArmazenamento(null);
});

const auditoria = (stage: string) => executar(new Request(`http://x/api/auditoria?stage=${stage}`));
type Res = Awaited<ReturnType<typeof auditoria>>;
type L = Res["aud"]["linhas"][number];
const resumo = (r: Res) => r.aud.resumo as unknown as Record<string, number>;
/** Linha que vale 0 sem depender do campo (flight de quem já pontuou, satélite): C e D valem 0, como antes. */
const valeZero = (l: L) => l.cenarios.A === 0;
const ehFinal = (l: L) => l.role === "FINAL" || /^final main event/i.test(l.torneio);
const ehFlight = (l: L) => l.role === "FLIGHT" || (l.role === "STANDALONE" && /dia 1/i.test(l.torneio));
const doMain = (l: L) => ehFinal(l) || ehFlight(l);
const cent = (x: number | null | undefined) => (x == null ? null : x / 100);
/** A linha sem os campos que o total guardado pode mudar (C, D, ações e o motivo). */
const semCD = (l: L) => ({ ...l, cenarios: { A: l.cenarios.A, B: l.cenarios.B }, acoesCampo: null, cenariosMotivo: null });
const jogadoresComTotal = (r: Res, numero: number) => {
  const resp = montarResposta(r.stage, r.dados, r.regras, r.aud, r.id);
  const c = consolidar([etapaParaConsolidar(numero, resp as never)]);
  return { C: c.jogadores.filter((j) => !j.cenarios.C.insuficiente).length, D: c.jogadores.filter((j) => !j.cenarios.D.insuficiente).length, total: c.jogadores.length };
};

describe("campo de C e D do Main Event = total de entradas da planilha de participantes", () => {
  it("versão das regras 2.11", () => expect(VERSAO_REGRAS).toBe("2.11"));

  it("Etapa 2: A e B iguais (153 erros, 117 corretos), C e D com 576; 190 linhas mudam, todas do Dia Final", async () => {
    await removerParticipantes();
    const sem = await auditoria(E2);
    await salvarParticipantes(TOTAIS);
    const com = await auditoria(E2);
    expect(com.id.sha256).not.toBe(sem.id.sha256); // o identificador dos dados muda com os totais
    expect(com.id.sha256Dados).toBe(sem.id.sha256Dados);
    expect([resumo(sem).ERRO, resumo(sem).CORRETO]).toEqual([153, 117]);
    expect([resumo(com).ERRO, resumo(com).CORRETO]).toEqual([153, 117]);
    // Fora de C e D nada muda; C e D só mudam nas linhas do Dia Final.
    expect(com.aud.linhas.map(semCD)).toEqual(sem.aud.linhas.map(semCD));
    const mudou = com.aud.linhas.filter((l, i) => JSON.stringify(l.cenarios) !== JSON.stringify(sem.aud.linhas[i].cenarios));
    expect(mudou.every(ehFinal)).toBe(true);
    // 190 = 64 com posição + 126 sem posição (compêndio 6.7); contadas pelas linhas do Dia Final.
    expect(mudou.length).toBe(com.aud.linhas.filter(ehFinal).length);
    expect(mudou.length).toBe(190);
  });

  it("Etapa 2, Dia Final sem posição: A = 38,1, C = 62,6, D = 56,34 (conta à mão)", async () => {
    await salvarParticipantes(TOTAIS);
    const { aud } = await auditoria(E2);
    const l = aud.linhas.find((x) => ehFinal(x) && x.posicao == null)!;
    // A: 10 × (331/100 + 0,5) × 1,0 = 10 × 3,81 = 38,1; C: 10 × (576/100 + 0,5) × 1,0 = 10 × 6,26 = 62,6; D: 62,6 × 0,9 = 56,34
    expect([cent(l.cenarios.A), cent(l.cenarios.B), cent(l.cenarios.C), cent(l.cenarios.D)]).toEqual([38.1, 34.29, 62.6, 56.34]);
    expect(l.acoesCampo).toBe(576);
    expect(l.cenariosMotivo).toBeNull();
  });

  it("Etapa 2, Dia Final com posição (7º, base 400): A = 1.524, C = 2.504, D = 2.253,6", async () => {
    await salvarParticipantes(TOTAIS);
    const { aud } = await auditoria(E2);
    const l = aud.linhas.find((x) => ehFinal(x) && x.posicao === 7)!;
    // A: 400 × 3,81 = 1.524; C: 400 × 6,26 = 2.504; D: 2.504 × 0,9 = 2.253,6
    expect(l.base).toBe(400);
    expect([cent(l.cenarios.A), cent(l.cenarios.C), cent(l.cenarios.D)]).toEqual([1524, 2504, 2253.6]);
  });

  it("Etapa 3: A e B iguais (430 erros, 124 corretos); Dia Final sem posição A = 37,8, C = 60,7, D = 54,63; 214 linhas mudam", async () => {
    const sem = await auditoria(E3);
    await salvarParticipantes(TOTAIS);
    const com = await auditoria(E3);
    expect([resumo(sem).ERRO, resumo(sem).CORRETO]).toEqual([430, 124]);
    expect([resumo(com).ERRO, resumo(com).CORRETO]).toEqual([430, 124]);
    expect(com.aud.linhas.map(semCD)).toEqual(sem.aud.linhas.map(semCD));
    const mudou = com.aud.linhas.filter((l, i) => JSON.stringify(l.cenarios) !== JSON.stringify(sem.aud.linhas[i].cenarios));
    expect(mudou.every(ehFinal)).toBe(true);
    expect(mudou.length).toBe(com.aud.linhas.filter(ehFinal).length);
    expect(mudou.length).toBe(214); // 79 com posição + 135 sem posição (compêndio 6.7)
    const l = com.aud.linhas.find((x) => ehFinal(x) && x.posicao == null)!;
    // A: 10 × (328/100 + 0,5) = 37,8; C: 10 × (557/100 + 0,5) = 10 × 6,07 = 60,7; D: 60,7 × 0,9 = 54,63
    expect([cent(l.cenarios.A), cent(l.cenarios.C), cent(l.cenarios.D)]).toEqual([37.8, 60.7, 54.63]);
  });

  it("Etapa 1: 202 erros e 189 corretos; C e D continuam nulos no Main Event, mesmo com total guardado para a Etapa 1", async () => {
    await salvarParticipantes(TOTAIS);
    const r = await auditoria(E1);
    expect([resumo(r).ERRO, resumo(r).CORRETO]).toEqual([202, 189]);
    expect(r.dados.acoesMainEvent).toBeUndefined();
    const main = r.aud.linhas.filter(doMain);
    expect(main.length).toBeGreaterThan(0);
    for (const l of main.filter((x) => !valeZero(x))) expect([l.cenarios.C, l.cenarios.D, l.acoesCampo]).toEqual([null, null, null]);
    expect(main.filter((x) => !valeZero(x)).length).toBeGreaterThan(0);
    for (const l of main.filter(valeZero)) expect([l.cenarios.C, l.cenarios.D]).toEqual([0, 0]); // o 0 que já existia: flight que vale 0 não depende do campo
  });

  it("os dois motores concordam, também direto: Etapa 1 ignora o total mesmo recebido; Etapas 2 e 3 usam", async () => {
    for (const [stage, total, usa] of [[E1, 999, false], [E2, 576, true]] as const) {
      const d = { ...(await buscarDados(stage)), acoesMainEvent: total };
      const aud = auditar(d, REGRAS_PADRAO, {});
      expect(() => conferir(d, REGRAS_PADRAO, aud, {})).not.toThrow(); // o verificador independente concorda com o motor
      const l = aud.linhas.find((x) => doMain(x) && !valeZero(x))!;
      expect(l.cenarios.C != null).toBe(usa);
    }
  });

  it("sem totais guardados: C e D do Main Event nulos com o motivo de hoje", async () => {
    const r2 = await auditoria(E2);
    for (const l of r2.aud.linhas.filter(ehFinal)) expect([l.cenarios.C, l.cenarios.D, l.cenariosMotivo]).toEqual([null, null, "reentradas não disponíveis: falta a planilha de participantes do Main Event"]);
    const r3 = await auditoria(E3);
    for (const l of r3.aud.linhas.filter(ehFinal)) expect([l.cenarios.C, l.cenarios.D]).toEqual([null, null]);
  });

  it("total guardado zerado ou removido não vira campo (0 não é usado)", async () => {
    await salvarParticipantes({ ...TOTAIS, 2: { entradas: 0, jogadores: 0 } });
    const r = await auditoria(E2);
    expect(r.aud.linhas.filter(ehFinal).every((l) => l.cenarios.C == null)).toBe(true);
  });

  it("identificador: os totais entram no hash completo, não no das marcas 'revisado'", async () => {
    const d = await buscarDados(E2);
    const a = identificador(d);
    const b = identificador({ ...d, acoesMainEvent: 576 });
    const c = identificador({ ...d, acoesMainEvent: 577 });
    expect(b.sha256).not.toBe(a.sha256);
    expect(c.sha256).not.toBe(b.sha256);
    expect(b.sha256Dados).toBe(a.sha256Dados);
  });

  it("Consolidado: jogadores com total em C e D, antes e depois (contagem medida, comparada à conta de que só o Main Event mudou)", async () => {
    // Etapa 2 sem planilha de ações: toda linha fora do Main Event tem C e D nulos; só ganha total quem tem apenas linhas do Main Event (ou que valem 0).
    const antes2 = jogadoresComTotal(await auditoria(E2), 2);
    await salvarParticipantes(TOTAIS);
    const depois2 = jogadoresComTotal(await auditoria(E2), 2);
    expect([antes2.C, antes2.D]).toEqual([0, 0]);
    expect(depois2.C).toBe(depois2.D);
    expect(depois2.C).toBeGreaterThan(0);
    console.log("consolidado E2 sem planilha de ações: antes", antes2, "depois", depois2);
    // Etapa 3 (planilha traz as ações dos torneios comuns): quem tem Main Event e todo o resto com ação passa a ter total.
    await removerParticipantes();
    const antes3 = jogadoresComTotal(await auditoria(E3), 3);
    await salvarParticipantes(TOTAIS);
    const depois3 = jogadoresComTotal(await auditoria(E3), 3);
    expect(antes3.C).toBe(antes3.D);
    expect(depois3.C).toBe(depois3.D);
    expect(depois3.C).toBeGreaterThan(antes3.C);
    console.log("consolidado E3 (jogadores com total C/D): antes", antes3, "depois", depois3);
    // Etapa 2 com a planilha de ações enviada: aí os totais passam a fechar o jogador.
    await enviarPlanilha("ranking-spt-2a-etapa.xlsx", "ranking-spt-2a-etapa.xlsx");
    await removerParticipantes();
    const antes2a = jogadoresComTotal(await auditoria(E2), 2);
    await salvarParticipantes(TOTAIS);
    const depois2a = jogadoresComTotal(await auditoria(E2), 2);
    expect(depois2a.C).toBeGreaterThan(antes2a.C);
    console.log("consolidado E2 com planilha de ações: antes", antes2a, "depois", depois2a);
  });
});

describe("motivos de 'dados insuficientes' nas linhas do Main Event", () => {
  const OLD = "reentradas não disponíveis: falta o Excel da etapa";
  const ETAPA1 = "dado ausente: a Etapa 1 foi operada fora do Stack Plus e não traz as reentradas do Main Event";
  const SEM_PLANILHA = "reentradas não disponíveis: falta a planilha de participantes do Main Event";

  it("caso 1, Etapa 1: toda linha do Main Event com C e D nulos mostra o texto da Etapa 1, com ou sem totais guardados; as outras, o texto antigo", async () => {
    for (const guardar of [false, true]) {
      if (guardar) await salvarParticipantes(TOTAIS);
      const ls = (await auditoria(E1)).aud.linhas;
      const main = ls.filter((l) => doMain(l) && l.cenarios.C == null);
      expect(main.length).toBeGreaterThan(0);
      expect(main.every((l) => l.cenariosMotivo === ETAPA1)).toBe(true);
      const outras = ls.filter((l) => !doMain(l) && l.cenarios.C == null);
      expect(outras.length).toBeGreaterThan(0);
      expect(outras.every((l) => l.cenariosMotivo === OLD)).toBe(true);
    }
  });

  it("caso 2, Etapas 2 e 3 sem totais: o texto da planilha de participantes; as linhas comuns, o texto antigo", async () => {
    for (const stage of [E2, E3]) {
      const ls = (await auditoria(stage)).aud.linhas;
      const main = ls.filter(ehFinal);
      expect(main.length).toBeGreaterThan(0);
      expect(main.every((l) => l.cenarios.C == null && l.cenariosMotivo === SEM_PLANILHA)).toBe(true);
      expect(ls.filter((l) => !doMain(l) && l.cenarios.C == null).every((l) => l.cenariosMotivo === OLD)).toBe(true);
    }
  });

  it("com totais guardados, as linhas do Main Event das Etapas 2 e 3 têm C e D e não têm motivo", async () => {
    await salvarParticipantes(TOTAIS);
    for (const stage of [E2, E3]) {
      const main = (await auditoria(stage)).aud.linhas.filter(ehFinal);
      expect(main.every((l) => l.cenarios.C != null && l.cenarios.D != null && l.cenariosMotivo === null)).toBe(true);
    }
  });

  it("caso 3, outros torneios: o motivo da planilha de ações (MOTIVO_SEM_BLOCO) continua o mesmo, com planilha de ações da Etapa 2 enviada", async () => {
    await enviarPlanilha("ranking-spt-2a-etapa.xlsx", "ranking-spt-2a-etapa.xlsx");
    const ls = (await auditoria(E2)).aud.linhas;
    const comuns = ls.filter((l) => !doMain(l) && l.cenarios.C == null);
    // torneio sem aba/bloco: o motivo é o da planilha de ações; nunca o do Main Event
    expect(comuns.every((l) => l.cenariosMotivo !== ETAPA1 && l.cenariosMotivo !== SEM_PLANILHA)).toBe(true);
    expect(comuns.every((l) => l.cenariosMotivo === "planilha da etapa sem Buy In/Reentry para este torneio" || l.cenariosMotivo === OLD)).toBe(true);
    expect(ls.filter(ehFinal).every((l) => l.cenariosMotivo === SEM_PLANILHA)).toBe(true);
  });

  it("os resultados numéricos não mudam: o motivo não entra em nenhum identificador", async () => {
    const d = await buscarDados(E2);
    expect(identificador(d).sha256).toBe(identificador(structuredClone(d)).sha256);
    await salvarParticipantes(TOTAIS);
    const r = await auditoria(E2);
    expect([resumo(r).ERRO, resumo(r).CORRETO]).toEqual([153, 117]);
  });

});
