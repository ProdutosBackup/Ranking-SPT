import type { DadosSpt, Torneio } from "./api-spt";
import { BASES_TABELA, buyInParaFator, calcular, centDe, fatorBuyIn, fatorParticipantes, fb100, fieldQueReproduz } from "./calculo";
import { ACORDO } from "./acordo";
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

export type Pendencia = "NAO_FINALIZADO" | "CANCELADO" | "SEM_BUYIN";

// Flight: role=FLIGHT (etapas 2 e 3) ou, sem marcação, nome com "Dia 1" (etapa 1).
const ehFlight = (t: Torneio) => t.role === "FLIGHT" || (t.role === "STANDALONE" && /dia 1/i.test(t.name));
// Dia Final do Main Event: role=FINAL (etapas 2 e 3) ou, sem marcação, "Final Main Event" (etapa 1).
const ehDiaFinal = (t: Torneio) => t.role === "FINAL" || (t.role === "STANDALONE" && /^final main event/i.test(t.name));
/** Ordem dos flights (1A, 1B, 1C…): a letra do rótulo ou do nome. */
const ordemFlight = (t: Torneio) => (/(?:^|dia\s*)1\s*([a-z])/i.exec(t.flightLabel ?? t.name)?.[1] ?? t.name).toUpperCase();
/** Ações do torneio (buy-ins + re-entries), só quando a planilha informa as duas. */
export const acoesDe = (t: Torneio) => (t.buyIns != null && t.reentries != null ? t.buyIns + t.reentries : null);
/**
 * Torneios que não pontuam, reconhecidos pelo nome (sem diferenciar maiúsculas e acentos) [CONFIRMADO 05/11/2026]:
 * satélite, Ladies e ALL IN OR FOLD (decisão do usuário). Devolve o motivo, que aparece ao usuário, ou null se o torneio pontua.
 */
export const motivoNaoPontua = (nome: string): "Satélite" | "Ladies" | "All in or Fold" | null => {
  const n = nome.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ");
  return /satelite/.test(n) ? "Satélite" : /\bladies\b/.test(n) ? "Ladies" : /\ball in or fold\b/.test(n) ? "All in or Fold" : null;
};

/**
 * `acordos`: `torneioId → K`. Num torneio com acordo, os jogadores das posições 1 a K pontuam todos como o Kº colocado:
 * base da colocação K × fator de participantes × fator de buy-in (a fórmula normal, só a base muda).
 */
export function auditar(d: DadosSpt, regras: Regras, acordos: Record<string, number> = {}) {
  const torneios = new Map(d.torneios.map((t) => [t.id, t]));
  // Participantes do Main Event: soma das entradas (players) dos flights da etapa [CONFIRMADO 05/11/2026].
  const flights = d.torneios.filter(ehFlight).sort((a, b) => (ordemFlight(a) < ordemFlight(b) ? -1 : ordemFlight(a) > ordemFlight(b) ? 1 : 0));
  const somaFlights = flights.reduce((a, t) => a + t.players, 0);
  const campoTexto = somaFlights > 0 ? PARTICIPACAO.campo(somaFlights, flights.map((t) => t.players)) : null;
  // Uma pontuação por jogador: quem tem linha no Dia Final vale só ela; senão, só o primeiro flight que jogou.
  const temFinal = new Set<unknown>();
  const primeiroFlight = new Map<unknown, string>();
  for (const j of d.jogadores) {
    let primeiro: Torneio | null = null;
    for (const r of j.resultados) {
      const t = torneios.get(r.tournamentId)!;
      if (ehDiaFinal(t)) temFinal.add(j);
      else if (ehFlight(t) && (primeiro == null || ordemFlight(t) < ordemFlight(primeiro))) primeiro = t;
    }
    if (primeiro) primeiroFlight.set(j, primeiro.id);
  }
  const premiados = new Map<string, number>();
  for (const j of d.jogadores)
    for (const r of j.resultados)
      if (r.prize != null && r.prize > 0) premiados.set(r.tournamentId, (premiados.get(r.tournamentId) ?? 0) + 1);

  // `buyIn` é o exibido. `buyInFator` escolhe o fator (em torneio com bounty, K.O ou Mystery, buy-in + bounty).
  // `somaBounty`: o bounty somado, só quando a soma foi aplicada; `tipoBounty`: o tipo (KO ou MYSTERY) nesse caso.
  const buyInDe = (t: Torneio) => {
    const buyIn = t.buyIn; // Dia Final: buyIn 0 é o valor real (sem buy-in; fator 1,0 pela faixa de R$ 0 a R$ 1.000)
    const buyInFator = buyInParaFator({ ...t, buyIn });
    const somou = buyInFator !== buyIn;
    return { buyIn, buyInFator, somaBounty: somou ? (t.bountyAmount as number) : null, tipoBounty: somou ? (t.bountyType as string) : null };
  };
  const contexto = (t: Torneio) => ({
    // Main Event (flights e Dia Final): a soma dos flights, em qualquer opção. Demais: inscritos ou, na opção "ações", as ações quando conhecidas.
    field:
      (ehFlight(t) || ehDiaFinal(t)) && somaFlights > 0
        ? somaFlights
        : regras.field === "acoes" && !ehFlight(t) && !ehDiaFinal(t) && acoesDe(t) != null
          ? acoesDe(t)!
          : t.players,
    ...buyInDe(t),
    premiados: premiados.get(t.id) ?? 0,
  });

  // K do acordo de cada torneio, ou null.
  const acordoDe = (t: Torneio): number | null => (acordos[t.id] >= 2 ? acordos[t.id] : null);

  // Passo 1: cada linha calculada com os inscritos da API (ou a soma dos flights, no Dia Final).
  const pre = d.jogadores.flatMap((j) =>
    j.resultados.map((r) => {
      const t = torneios.get(r.tournamentId)!;
      const ctx = contexto(t);
      const entrada = { posicao: r.position, prize: r.prize, buyIn: ctx.buyIn, buyInFator: ctx.buyInFator, field: ctx.field, premiados: ctx.premiados };

      let motivoPendente: string | null = null;
      let pendencia: Pendencia | null = null;
      // Linha que vale 0: torneio que não pontua (pelo nome) ou flight de quem já pontua em outra linha do Main Event.
      let zero: { conta: string; causa: string; codigo: "SATELITE" | "FLIGHT_ZERO" } | null = null;
      const motivoNP = motivoNaoPontua(t.name);
      let part = false; // participação do Main Event: primeiro flight de quem não tem Dia Final, ou Dia Final sem posição (10 × fatores)
      if (/^cancel/i.test(t.status ?? "")) {
        motivoPendente = "torneio cancelado com resultados";
        pendencia = "CANCELADO";
      } else if (t.status !== "FINISHED") {
        motivoPendente = `torneio não finalizado (situação: ${t.status ?? "desconhecida"})`;
        pendencia = "NAO_FINALIZADO";
      } else if (motivoNP) {
        zero = { conta: `${motivoNP} não pontua`, causa: `${motivoNP} com pontos registrados`, codigo: "SATELITE" }; // satélite, Ladies e All in or Fold nunca pontuam
      } else if (ehFlight(t)) {
        if (temFinal.has(j)) zero = { conta: PARTICIPACAO.contaZeroComFinal, causa: PARTICIPACAO.zeroComFinal, codigo: "FLIGHT_ZERO" };
        else if (primeiroFlight.get(j) !== t.id) zero = { conta: PARTICIPACAO.contaZeroMaisDeUm, causa: PARTICIPACAO.zeroMaisDeUm, codigo: "FLIGHT_ZERO" };
        else part = true;
      } else if (ehDiaFinal(t) && r.position == null) {
        part = true; // Dia Final sem posição: 10 × fatores, uma vez só
      } else if (ehDiaFinal(t) ? !(ctx.buyIn >= 0) : !(ctx.buyIn > 0)) {
        // Só o Dia Final aceita buy-in 0 [CONFIRMADO 05/11/2026]; nos demais torneios, 0 ou ausente aguarda.
        motivoPendente = "buy-in não informado: sem o buy-in não há como calcular o fator";
        pendencia = "SEM_BUYIN";
      }
      const sat = zero != null;
      // Participação do Main Event: sempre 10 × fatores (não depende da opção de fora da premiação).
      const c0 = motivoPendente || part
        ? calcular({ ...entrada, posicao: null, prize: null }, { ...regras, foraDoItm: "base10xFatores" })
        : calcular(entrada, regras);
      // Acordo: posições 1 a K de um torneio com acordo pontuam como o Kº colocado (não vale para satélite, flight nem pendente).
      const tAcordo = acordoDe(t);
      const acordo = tAcordo != null && !sat && !part && !motivoPendente && r.position != null && r.position <= tAcordo ? tAcordo : null;
      const c = sat
        ? { ...c0, itm: false, base: 0, conta: zero!.conta, esperado: 0, esperadoCent: 0 }
        : acordo != null
          ? calcular({ ...entrada, posicao: acordo, prize: 1, premiados: Math.max(acordo, ctx.premiados) }, regras)
          : c0;
      // 10 pontos fixos (opção da calculadora do site): não depende dos inscritos, então não entra na dedução.
      const fixo = sat || part || acordo != null || (!motivoPendente && !c.itm && regras.foraDoItm === "10fixos");
      const suspeito =
        !sat && !part && (
        (r.position != null && r.position <= ctx.premiados && !(r.prize != null && r.prize > 0)) ||
        (r.position == null && r.prize != null && r.prize > 0) ||
        // prêmio em posição além do número de premiados: a posição ou o prêmio estão errados
        (r.position != null && r.position > ctx.premiados && r.prize != null && r.prize > 0));
      return { j, r, t, ctx, entrada, motivoPendente, pendencia, c, fixo, suspeito, sat, zero, motivoNP, part, acordo, tAcordo };
    }),
  );

  // Passo 2: por torneio, o inteiro de inscritos que reproduz mais linhas não pendentes (em centésimos exatos).
  const deducao = new Map<string, { melhor: Candidato | null; achado: Achado | null }>();
  for (const t of d.torneios) {
    const ls = pre.filter((p) => p.t.id === t.id && !p.motivoPendente && !p.fixo);
    const conta = new Map<number, number>();
    for (const p of ls) {
      const f = fieldQueReproduz(p.c.base, fb100(p.ctx.buyInFator, regras), centDe(p.r.points));
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
    const { j, r, t, ctx, motivoPendente, pendencia, fixo, suspeito, sat, zero, motivoNP, part, acordo, tAcordo } = p;
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
    else if (!sat && !part && acordo == null && abs <= centDe(regras.toleranciaArredondamento)) situacao = "ARREDONDAMENTO";
    else situacao = "ERRO";

    let inverso: Inverso | null = null;
    let causa = motivoPendente ?? "";
    // Código estruturado da causa (hipótese), usado pelo painel para agrupar; `causa` é só texto para leitura.
    let causaCodigo: "FIXOS10" | "CAMPO" | "BASE" | "SEM_CAUSA" | "SUSPEITO" | "INSCRITOS_SITE" | "SATELITE" | "FLIGHT_ZERO" | "PARTICIPACAO" | "ACORDO" | null = null;
    let baseUsada: number | null = null;
    if (situacao === "ERRO" || situacao === "SUSPEITO" || situacao === "CORRETO_SITE") {
      const fb = fb100(ctx.buyInFator, regras);
      const fixos10 = situacao === "ERRO" && r.points === 10 && c.esperado !== 10;
      // 10 pontos fixos não permitem deduzir inscritos nem comparar bases.
      inverso = sat || part || acordo != null
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
      } else if (acordo != null) {
        causaCodigo = "ACORDO";
        causa = ACORDO.causa(acordo, String(c.esperado).replace(".", ","));
      } else if (part) {
        causaCodigo = "PARTICIPACAO";
        causa = PARTICIPACAO.causa;
      } else if (sat) {
        causaCodigo = zero!.codigo;
        causa = zero!.causa;
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

    // Main Event: de onde vem o campo (soma dos flights), junto da causa ou, se não houver causa, sozinho.
    const campoMain = campoTexto && (ehFlight(t) || ehDiaFinal(t)) ? campoTexto : null;
    if (campoMain) causa = causa ? `${causa} (${campoMain})` : campoMain;
    return {
      jogador: j.name,
      torneioId: t.id,
      torneio: t.name,
      role: t.role,
      posicao: r.position,
      prize: r.prize,
      buyIn: ctx.buyIn,
      buyInFator: ctx.buyInFator,
      /** Bounty (K.O ou Mystery) somado ao buy-in para escolher o fator; null quando não houve soma. */
      somaBounty: ctx.somaBounty,
      /** Tipo do bounty somado (KO ou MYSTERY); null quando não houve soma. */
      tipoBounty: ctx.tipoBounty,
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
      /** Motivo de o torneio não pontuar (Satélite, Ladies ou All in or Fold), reconhecido pelo nome; null se pontua. */
      naoPontua: sat && zero!.codigo === "SATELITE" ? motivoNP : null,
      /** K do acordo, nas linhas das posições 1 a K de um torneio com acordo (pontuam como o Kº colocado). */
      acordo,
      /** K do acordo do torneio (em todas as linhas dele, também fora das posições 1 a K). */
      acordoK: tAcordo,
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
      acordo: acordoDe(t),
      fatorTotalEsperado: arred(fatorParticipantes(ctx.field) * fatorBuyIn(ctx.buyInFator, regras)),
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

  return { resumo, torneios: resumoTorneios, linhas, somas, acordos: Object.fromEntries(d.torneios.map((t) => [t.id, acordoDe(t)]).filter(([, k]) => k != null)) as Record<string, number> };
}
