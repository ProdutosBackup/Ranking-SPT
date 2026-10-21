import type { DadosSpt, Torneio } from "./api-spt";
import { BASES_TABELA, calcular, centDe, fatorBuyIn, fatorParticipantes, fb100, fieldQueReproduz } from "./calculo";
import { ACORDO, dividirAcordo, type ContaAcordo } from "./acordo";
import { PARTICIPACAO } from "./participacao";
import type { Regras } from "./regras";

export type Situacao = "CORRETO" | "CORRETO_SITE" | "ARREDONDAMENTO" | "ERRO" | "SUSPEITO" | "PENDENTE_REGRA";
const SITUACOES: Situacao[] = ["CORRETO", "CORRETO_SITE", "ARREDONDAMENTO", "ERRO", "SUSPEITO", "PENDENTE_REGRA"];

/** Inverso: o que o valor registrado indica. `fieldImplicito` é inteiro ≥ 1 ou null (nunca negativo, zero ou fracionário). */
type Inverso = {
  fatorTotal: number;
  fieldImplicito: number | null;
  /** Outras bases que reproduzem o registrado exatamente com os inscritos usados na linha. */
  candidatos: { base: number; field: number }[];
};
/** Melhor número de inscritos para o torneio: quantas das linhas não pendentes ele reproduz. */
type Candidato = { field: number; linhas: number; de: number };
type Achado = { fieldApi: number; fieldSite: number; diferenca: number; linhasExplicadas: number };

const arred = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

const DESCRICAO_BASE: Record<number, string> = {
  1000: "campeão", 800: "2º colocado", 700: "3º colocado", 600: "4º colocado", 500: "5º colocado",
  450: "6º colocado", 400: "7º colocado", 350: "8º colocado", 300: "9º colocado",
  250: "10º a 12º colocado", 200: "13º a 18º colocado", 100: "premiado depois do 18º", 10: "jogador fora da premiação",
};
export const descreverBase = (b: number) => DESCRICAO_BASE[b] ?? `base ${b}`;

export type Pendencia = "NAO_FINALIZADO" | "CANCELADO" | "FLIGHT" | "FINAL_SEM_POSICAO" | "SEM_BUYIN";

// Flight: role=FLIGHT (etapa 2) ou, sem marcação, nome com "Dia 1" (etapa 1).
const ehFlight = (t: Torneio) => t.role === "FLIGHT" || (t.role === "STANDALONE" && /dia 1/i.test(t.name));
/** Ações do torneio (buy-ins + re-entries), só quando a planilha informa as duas. */
export const acoesDe = (t: Torneio) => (t.buyIns != null && t.reentries != null ? t.buyIns + t.reentries : null);
const ehSatelite = (t: Torneio) => /sat[eé]lite/i.test(t.name);

/**
 * `acordos`: `torneioId → N`. Num torneio com acordo, os jogadores das posições 1 a N recebem o mesmo valor correto: a soma dos pontos
 * das posições 1 a N (cada uma pela fórmula normal, em centésimos) dividida por N, arredondada a 2 casas.
 */
export function auditar(d: DadosSpt, regras: Regras, acordos: Record<string, number> = {}) {
  const torneios = new Map(d.torneios.map((t) => [t.id, t]));
  const somaFlights = d.torneios.filter((t) => t.role === "FLIGHT").reduce((a, t) => a + t.players, 0);
  const premiados = new Map<string, number>();
  for (const j of d.jogadores)
    for (const r of j.resultados)
      if (r.prize != null && r.prize > 0) premiados.set(r.tournamentId, (premiados.get(r.tournamentId) ?? 0) + 1);

  const contexto = (t: Torneio) => ({
    // Dia Final: soma dos flights, em qualquer opção. Flight com ações conhecidas: as ações (a regra dos flights). Demais: inscritos ou, na opção "ações", as ações quando conhecidas.
    field:
      t.role === "FINAL" && somaFlights > 0
        ? somaFlights
        : ehFlight(t) && acoesDe(t) != null
          ? acoesDe(t)!
          : regras.field === "acoes" && t.role !== "FINAL" && acoesDe(t) != null
            ? acoesDe(t)!
            : t.players,
    buyIn: t.role === "FINAL" && t.buyIn === 0 ? regras.buyInDiaFinalZero : t.buyIn,
    premiados: premiados.get(t.id) ?? 0,
  });

  // Conta do acordo de cada torneio (a soma das posições 1 a N, pela fórmula normal, dividida por N).
  const contaAcordo = new Map<string, ContaAcordo | null>();
  const acordoDe = (t: Torneio): ContaAcordo | null => {
    const n = acordos[t.id];
    if (!(n >= 2)) return null;
    if (!contaAcordo.has(t.id)) {
      const ctx = contexto(t);
      const passos = Array.from({ length: n }, (_, i) => {
        const c = calcular({ posicao: i + 1, prize: 1, buyIn: ctx.buyIn, field: ctx.field, premiados: n }, regras);
        return { posicao: i + 1, conta: c.conta, cent: c.esperadoCent };
      });
      const somaCent = passos.reduce((a, p) => a + p.cent, 0);
      contaAcordo.set(t.id, { n, passos, somaCent, valorCent: dividirAcordo(somaCent, n) });
    }
    return contaAcordo.get(t.id)!;
  };

  // Passo 1: cada linha calculada com os inscritos da API (ou a soma dos flights, no Dia Final).
  const pre = d.jogadores.flatMap((j) =>
    j.resultados.map((r) => {
      const t = torneios.get(r.tournamentId)!;
      const ctx = contexto(t);
      const entrada = { posicao: r.position, prize: r.prize, buyIn: ctx.buyIn, field: ctx.field, premiados: ctx.premiados };

      let motivoPendente: string | null = null;
      let pendencia: Pendencia | null = null;
      let sat = false;
      let part = false; // participação de flight (flight ou Dia Final sem posição)
      let flightComAcoes = false; // flight com ações conhecidas: 10 × fatores com campo = ações
      if (/^cancel/i.test(t.status ?? "")) {
        motivoPendente = "torneio cancelado com resultados";
        pendencia = "CANCELADO";
      } else if (t.status !== "FINISHED") {
        motivoPendente = `torneio não finalizado (situação: ${t.status ?? "desconhecida"})`;
        pendencia = "NAO_FINALIZADO";
      } else if (ehSatelite(t)) {
        sat = true; // satélite nunca pontua: o esperado é 0
      } else if (ehFlight(t)) {
        part = true;
        if (acoesDe(t) != null) flightComAcoes = true;
        else {
          motivoPendente = PARTICIPACAO.motivoFlight; // seção 6.4
          pendencia = "FLIGHT";
        }
      } else if (t.role === "FINAL" && r.position == null) {
        part = true;
        motivoPendente = PARTICIPACAO.motivoDiaFinal; // seção 6.7
        pendencia = "FINAL_SEM_POSICAO";
      } else if (!(ctx.buyIn > 0)) {
        motivoPendente = "buy-in não informado: sem o buy-in não há como calcular o fator";
        pendencia = "SEM_BUYIN";
      }
      // Flight com ações: sempre 10 × fatores (a regra dos flights não depende da opção de fora da premiação).
      const c0 = motivoPendente || flightComAcoes
        ? calcular({ ...entrada, posicao: null, prize: null }, { ...regras, foraDoItm: "base10xFatores" })
        : calcular(entrada, regras);
      // Acordo: posições 1 a N de um torneio com acordo recebem o valor dividido (não vale para satélite, flight nem pendente).
      const tAcordo = acordoDe(t);
      const acordo = tAcordo && !sat && !part && !motivoPendente && r.position != null && r.position <= tAcordo.n ? tAcordo : null;
      const c = sat
        ? { ...c0, itm: false, base: 0, conta: "Satélite não pontua", esperado: 0, esperadoCent: 0 }
        : acordo
          ? { ...c0, itm: true, conta: `${ACORDO.rotulo} entre ${acordo.n}`, esperado: acordo.valorCent / 100, esperadoCent: acordo.valorCent }
          : c0;
      // 10 pontos fixos (opção da calculadora do site): não depende dos inscritos, então não entra na dedução.
      const fixo = sat || flightComAcoes || acordo != null || (!motivoPendente && !c.itm && regras.foraDoItm === "10fixos");
      const suspeito =
        !sat && !part && (
        (r.position != null && r.position <= ctx.premiados && !(r.prize != null && r.prize > 0)) ||
        (r.position == null && r.prize != null && r.prize > 0) ||
        // prêmio em posição além do número de premiados: a posição ou o prêmio estão errados
        (r.position != null && r.position > ctx.premiados && r.prize != null && r.prize > 0));
      return { j, r, t, ctx, entrada, motivoPendente, pendencia, c, fixo, suspeito, sat, part, acordo, tAcordo };
    }),
  );

  // Passo 2: por torneio, o inteiro de inscritos que reproduz mais linhas não pendentes (em centésimos exatos).
  const deducao = new Map<string, { melhor: Candidato | null; achado: Achado | null }>();
  for (const t of d.torneios) {
    const ls = pre.filter((p) => p.t.id === t.id && !p.motivoPendente && !p.fixo);
    const conta = new Map<number, number>();
    for (const p of ls) {
      const f = fieldQueReproduz(p.c.base, fb100(p.ctx.buyIn, regras), centDe(p.r.points));
      if (f != null) conta.set(f, (conta.get(f) ?? 0) + 1);
    }
    const usado = contexto(t).field;
    const [melhorPar] = [...conta.entries()].sort((a, b) => b[1] - a[1] || +(b[0] === usado) - +(a[0] === usado) || a[0] - b[0]);
    const melhor = melhorPar ? { field: melhorPar[0], linhas: melhorPar[1], de: ls.length } : null;
    // Achado: outro número de inscritos reproduz 100% das linhas (mínimo de 3).
    const achado =
      melhor && ls.length >= 3 && melhor.field !== usado && melhor.linhas === ls.length
        ? { fieldApi: usado, fieldSite: melhor.field, diferenca: melhor.field - usado, linhasExplicadas: ls.length }
        : null;
    deducao.set(t.id, { melhor, achado });
  }

  // Passo 3: classificação final. Linhas explicadas por um achado são recalculadas com os inscritos do site.
  const linhas = pre.map((p) => {
    const { j, r, t, ctx, motivoPendente, pendencia, fixo, suspeito, sat, part, acordo, tAcordo } = p;
    const achado = deducao.get(t.id)!.achado;
    const explicada = achado != null && !motivoPendente && !fixo;
    const field = explicada ? achado.fieldSite : ctx.field;
    const c = explicada ? calcular({ ...p.entrada, field }, regras) : p.c;

    const registradoCent = centDe(r.points);
    const difCent = registradoCent - c.esperadoCent;
    const abs = Math.abs(difCent);
    let situacao: Situacao;
    if (motivoPendente) situacao = "PENDENTE_REGRA";
    else if (suspeito) situacao = "SUSPEITO";
    else if (abs === 0) situacao = explicada ? "CORRETO_SITE" : "CORRETO";
    else if (!sat && !part && !acordo && abs <= centDe(regras.toleranciaArredondamento)) situacao = "ARREDONDAMENTO";
    else situacao = "ERRO";

    let inverso: Inverso | null = null;
    let causa = motivoPendente ?? "";
    // Código estruturado da causa (hipótese), usado pelo painel para agrupar; `causa` é só texto para leitura.
    let causaCodigo: "FIXOS10" | "CAMPO" | "BASE" | "SEM_CAUSA" | "SUSPEITO" | "INSCRITOS_SITE" | "SATELITE" | "PARTICIPACAO" | "ACORDO" | null = null;
    let baseUsada: number | null = null;
    if (situacao === "ERRO" || situacao === "SUSPEITO" || situacao === "CORRETO_SITE") {
      const fb = fb100(ctx.buyIn, regras);
      const fixos10 = situacao === "ERRO" && r.points === 10 && c.esperado !== 10;
      // 10 pontos fixos não permitem deduzir inscritos nem comparar bases.
      inverso = sat || part || acordo
        ? null
        : fixos10
        ? { fatorTotal: arred(r.points / c.base), fieldImplicito: null, candidatos: [] }
        : {
            fatorTotal: arred(r.points / c.base),
            fieldImplicito: fieldQueReproduz(c.base, fb, registradoCent),
            candidatos: BASES_TABELA.filter((b) => b !== c.base && fieldQueReproduz(b, fb, registradoCent) === field).map((b) => ({ base: b, field })),
          };
      if (situacao === "CORRETO_SITE") {
        causaCodigo = "INSCRITOS_SITE";
        causa = `Bate com ${field} inscritos, e não com os ${ctx.field} informados pela API`;
      } else if (situacao === "SUSPEITO") {
        causaCodigo = "SUSPEITO";
        causa = "Posição e prêmio não concordam";
      } else if (acordo) {
        causaCodigo = "ACORDO";
        causa = ACORDO.causa(acordo.n, String(acordo.valorCent / 100).replace(".", ","));
      } else if (part) {
        causaCodigo = "PARTICIPACAO";
        causa = PARTICIPACAO.causa;
      } else if (sat) {
        causaCodigo = "SATELITE";
        causa = "Satélite com pontos registrados";
      } else if (fixos10) {
        causaCodigo = "FIXOS10";
        causa = "10 pontos fixos, sem multiplicar pelos fatores (como na calculadora do site)";
      } else if (inverso!.fieldImplicito != null && inverso!.fieldImplicito !== field) {
        causaCodigo = "CAMPO";
        causa = `Valor compatível com ${inverso!.fieldImplicito} inscritos (a conta usou ${field})`;
      } else if (inverso!.candidatos.length) {
        causaCodigo = "BASE";
        baseUsada = inverso!.candidatos[0].base;
        causa = `Valor igual ao de um ${descreverBase(baseUsada)} (base ${baseUsada})`;
      } else {
        causaCodigo = "SEM_CAUSA";
        causa = "Sem causa identificada";
      }
    } else if (situacao === "ARREDONDAMENTO") causa = "Diferença dentro da tolerância";

    return {
      jogador: j.name,
      torneioId: t.id,
      torneio: t.name,
      role: t.role,
      posicao: r.position,
      prize: r.prize,
      buyIn: ctx.buyIn,
      field,
      fieldApi: ctx.field,
      premiados: ctx.premiados,
      itm: c.itm,
      base: c.base,
      fatorParticipantes: arred(c.fatorParticipantes),
      fatorBuyIn: c.fatorBuyIn,
      conta: c.conta,
      esperado: c.esperado,
      esperadoCent: c.esperadoCent,
      /** Esperado com os inscritos da API (difere de `esperado` só nas linhas explicadas por um achado). */
      esperadoApi: p.c.esperado,
      registrado: r.points,
      registradoCent,
      diferenca: difCent / 100,
      situacao,
      causaProvavel: causa,
      causaCodigo,
      baseUsada,
      pendencia,
      participacao: part,
      /** Conta do acordo, nas linhas das posições 1 a N de um torneio com acordo. */
      acordo,
      /** N do acordo do torneio (em todas as linhas dele, também fora das posições 1 a N). */
      acordoN: tAcordo?.n ?? null,
      inverso,
    };
  });

  const resumoTorneios = d.torneios.map((t) => {
    const ctx = contexto(t);
    const { melhor, achado } = deducao.get(t.id)!;
    const ls = linhas.filter((l) => l.torneioId === t.id);
    const contagem = Object.fromEntries(SITUACOES.map((s) => [s, ls.filter((l) => l.situacao === s).length]));
    return {
      torneioId: t.id,
      torneio: t.name,
      role: t.role,
      players: t.players,
      field: ctx.field,
      buyIn: ctx.buyIn,
      premiados: ctx.premiados,
      buyIns: t.buyIns ?? null,
      reentries: t.reentries ?? null,
      acordo: acordoDe(t)?.n ?? null,
      fatorTotalEsperado: arred(fatorParticipantes(ctx.field) * fatorBuyIn(ctx.buyIn, regras)),
      fieldDeduzido: melhor?.field ?? null,
      fieldBateu: melhor ? melhor.field === ctx.field : null,
      melhorCandidato: melhor,
      achado,
      total: ls.length,
      comPosicao: ls.filter((l) => l.posicao != null && !l.participacao).length,
      participacao: ls.filter((l) => l.participacao).length,
      ...contagem,
    };
  });

  const resumo = {
    total: linhas.length,
    ...Object.fromEntries(SITUACOES.map((s) => [s, linhas.filter((l) => l.situacao === s).length])),
  };

  const somas = d.jogadores.map((j) => {
    const somaResultados = j.resultados.reduce((a, r) => a + centDe(r.points), 0) / 100;
    const somaLinhas = linhas.filter((l) => l.jogador === j.name).reduce((a, l) => a + l.registradoCent, 0) / 100;
    return {
      jogador: j.name,
      rankingPoints: j.rankingPoints,
      somaResultados,
      somaLinhas,
      ok: centDe(somaResultados) === centDe(j.rankingPoints) && centDe(somaLinhas) === centDe(j.rankingPoints),
    };
  });

  return { resumo, torneios: resumoTorneios, linhas, somas, acordos: Object.fromEntries(d.torneios.map((t) => [t.id, acordoDe(t)?.n]).filter(([, n]) => n != null)) as Record<string, number> };
}
