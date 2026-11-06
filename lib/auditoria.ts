import type { DadosSpt, Torneio } from "./api-spt";
import { BASES_TABELA, baseDaPosicao, buyInParaFator, calcular, calcularCenario, centDe, fatorBuyIn, fatorParticipantes, fb100, fieldQueReproduz } from "./calculo";
import { ACORDO } from "./acordo";
import { CANCELADO, chaveCancelamento } from "./cancelados";
import { PARTICIPACAO } from "./participacao";
import { TORNEIOS_COM_BOUNTY_ETAPA3 } from "./bounty-etapa3";
import { chaveTorneio, premiadosDaLista } from "./premiados-etapa3";
import { CENARIOS, FATOR_FAIXA_CENARIO, MOTIVO_SEM_ACOES, type Cenario, type Regras } from "./regras";

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

export type Pendencia = "NAO_FINALIZADO" | "CANCELADO" | "SEM_BUYIN" | "SEM_PREMIADOS" | "SEM_BOUNTY";

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

/** Grupo de posições consecutivas e diferentes (de..ate) que pontuaram igual: acordo detectado. `cent`: a pontuação registrada de todas (centésimos). */
export type GrupoAcordo = { de: number; ate: number; cent: number };

/**
 * Detecta acordos num torneio. `linhas`: posição e pontos registrados (centésimos) de cada resultado que pontua e está dentro dos premiados.
 * Acordo = posições CONSECUTIVAS e DIFERENTES (de..ate, ate > de), todas com a mesma pontuação (tolerância de 0,01) e com bases da tabela NÃO todas iguais.
 * Não é acordo: a mesma posição repetida (eliminação simultânea) nem posições que compartilham a base (10º a 12º, 13º a 18º, depois do 18º).
 */
export function detectarAcordos(linhas: { posicao: number; cent: number }[], regras: Regras): GrupoAcordo[] {
  const porPosicao = new Map<number, number[]>();
  for (const l of linhas) (porPosicao.get(l.posicao) ?? porPosicao.set(l.posicao, []).get(l.posicao)!).push(l.cent);
  const posicoes = [...porPosicao.keys()].sort((a, b) => a - b);
  const grupos: GrupoAcordo[] = [];
  let atual: GrupoAcordo | null = null;
  const fecha = () => {
    if (atual && atual.ate > atual.de && new Set(Array.from({ length: atual.ate - atual.de + 1 }, (_, i) => baseDaPosicao(atual!.de + i, regras))).size > 1) grupos.push(atual);
    atual = null;
  };
  for (const p of posicoes) {
    const v = porPosicao.get(p)!;
    const uniforme = v.every((x) => Math.abs(x - v[0]) <= 1); // os resultados de uma mesma posição têm de pontuar igual
    if (atual && uniforme && p === atual.ate + 1 && Math.abs(v[0] - atual.cent) <= 1) atual.ate = p;
    else {
      fecha();
      if (uniforme) atual = { de: p, ate: p, cent: v[0] };
    }
  }
  fecha();
  return grupos;
}

/**
 * `acordos`: `torneioId → K`. Num torneio com acordo, os jogadores das posições 1 a K pontuam todos como o Kº colocado:
 * base da colocação K × fator de participantes × fator de buy-in (a fórmula normal, só a base muda).
 * `cancelados`: chaves dos torneios que o usuário marcou como cancelados (lib/cancelados.ts). Torneio cancelado não pontua: esperado 0 em todas as linhas.
 */
export function auditar(d: DadosSpt, regras: Regras, acordos: Record<string, number> = {}, cancelados: string[] = []) {
  const torneios = new Map(d.torneios.map((t) => [t.id, t]));
  const porLista = (d as { origem?: { tipo?: string } }).origem?.tipo === "planilha"; // origem planilha (Etapa 3)
  const canceladas = new Set(cancelados);
  const chaveDe = (t: Torneio) => chaveCancelamento(t, porLista);
  const canceladoPeloUsuario = (t: Torneio) => canceladas.has(chaveDe(t));
  // Participantes do Main Event: soma das entradas (players) dos flights da etapa [CONFIRMADO 05/11/2026].
  const flights = d.torneios.filter(ehFlight).sort((a, b) => (ordemFlight(a) < ordemFlight(b) ? -1 : ordemFlight(a) > ordemFlight(b) ? 1 : 0));
  const somaFlights = flights.reduce((a, t) => a + t.players, 0);
  const campoTexto = somaFlights > 0 ? PARTICIPACAO.campo(somaFlights, flights.map((t) => t.players)) : null;
  // Uma pontuação por jogador, no primeiro flight que jogou [CONFIRMADO 05/11/2026: "O player premia ao longo dos flights e não no dia final.
  // O dia final é somente uma continuação dos flights."]. Quem tem linha no Dia Final e linhas de flight: a pontuação da linha do Dia Final
  // passa para o primeiro flight e o Dia Final vale 0. Quem não tem linha de flight (Etapas 2 e 3) segue com o Dia Final.
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
  // Origem planilha (Etapa 3): a planilha não traz prêmio; o nº de premiados de cada torneio vem da lista fixa do responsável [CONFIRMADO 05/11/2026].
  // Torneio fora da lista: sem nº de premiados (null) e a linha aguarda regra. Nas demais origens, premiado = prize > 0.
  const premiados = new Map<string, number>();
  const pagosPelaPlanilha = new Map<string, number>(); // só para a divergência: linhas com pontos diferentes de 10 (o que a planilha pagou como premiado)
  if (porLista) {
    for (const t of d.torneios) {
      const n = premiadosDaLista(t.name);
      if (n != null) premiados.set(t.id, n);
    }
    for (const j of d.jogadores)
      for (const r of j.resultados) if (r.points !== 10) pagosPelaPlanilha.set(r.tournamentId, (pagosPelaPlanilha.get(r.tournamentId) ?? 0) + 1);
  } else
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

  // Origem planilha: os torneios com bounty (K.O e Mystery) precisam do bounty vindo da API; sem ele a linha aguarda, em vez de usar o buy-in base.
  const chavesBounty = new Set(TORNEIOS_COM_BOUNTY_ETAPA3.map(chaveTorneio));
  const semBounty = (t: Torneio) => porLista && chavesBounty.has(chaveTorneio(t.name)) && !(t.bountyType != null && t.bountyType !== "NONE" && typeof t.bountyAmount === "number");
  const pagos = (id: string) => pagosPelaPlanilha.get(id) ?? 0;

  // K do acordo de cada torneio, ou null.
  const acordoDe = (t: Torneio): number | null => (acordos[t.id] >= 2 ? acordos[t.id] : null);

  // Passo 1: cada linha calculada com os inscritos da API (ou a soma dos flights, no Dia Final).
  // `auto`: acordos detectados por torneio. A primeira rodada (sem eles) só serve para saber quais linhas pontuam; a segunda aplica os acordos.
  const calcPre = (auto: Map<string, GrupoAcordo[]>) => d.jogadores.flatMap((j) =>
    j.resultados.map((r) => {
      const t = torneios.get(r.tournamentId)!;
      const ctx = contexto(t);
      // Na planilha não há prêmio: quem tem posição dentro dos premiados da lista conta como premiado (prize 1 é só o marcador).
      const entrada = { posicao: r.position, prize: porLista ? 1 : r.prize, buyIn: ctx.buyIn, buyInFator: ctx.buyInFator, field: ctx.field, premiados: ctx.premiados };

      let motivoPendente: string | null = null;
      let pendencia: Pendencia | null = null;
      // Linha que vale 0: torneio que não pontua (pelo nome) ou flight de quem já pontua em outra linha do Main Event.
      let zero: { conta: string; causa: string; codigo: "SATELITE" | "FLIGHT_ZERO" | "CANCELADO_USUARIO" } | null = null;
      const motivoNP = motivoNaoPontua(t.name);
      let part = false; // participação do Main Event: primeiro flight de quem não tem Dia Final, ou Dia Final sem posição (10 × fatores)
      if (canceladoPeloUsuario(t)) {
        // Marcado como cancelado pelo usuário: não pontua, vale antes de qualquer pendência (o status da API não importa).
        zero = { conta: `0: ${CANCELADO.causa.charAt(0).toLowerCase()}${CANCELADO.causa.slice(1)}`, causa: CANCELADO.causa, codigo: "CANCELADO_USUARIO" };
      } else if (/^cancel/i.test(t.status ?? "")) {
        motivoPendente = "torneio cancelado com resultados";
        pendencia = "CANCELADO";
      } else if (t.status !== "FINISHED") {
        motivoPendente = `torneio não finalizado (situação: ${t.status ?? "desconhecida"})`;
        pendencia = "NAO_FINALIZADO";
      } else if (motivoNP) {
        zero = { conta: `0: ${motivoNP === "Satélite" ? "satélite" : motivoNP} não pontua`, causa: `${motivoNP} com pontos registrados`, codigo: "SATELITE" }; // satélite, Ladies e All in or Fold nunca pontuam
      } else if (ehFlight(t)) {
        // Flight de quem chegou ao Dia Final: o primeiro flight carrega a pontuação do Dia Final (passo 3, `fonteDe`); os demais valem 0.
        if (primeiroFlight.get(j) !== t.id) zero = { conta: PARTICIPACAO.contaZeroMaisDeUm, causa: PARTICIPACAO.zeroMaisDeUm, codigo: "FLIGHT_ZERO" };
        else if (temFinal.has(j)) zero = { conta: PARTICIPACAO.contaZeroFlight, causa: PARTICIPACAO.flightComFinal, codigo: "FLIGHT_ZERO" };
        else part = true;
      } else if (ehDiaFinal(t) && r.position == null) {
        part = true; // Dia Final sem posição: 10 × fatores, uma vez só
      } else if (porLista && !premiados.has(t.id)) {
        motivoPendente = "nº de premiados não informado";
        pendencia = "SEM_PREMIADOS";
      } else if (semBounty(t)) {
        motivoPendente = "bounty não obtido da API";
        pendencia = "SEM_BOUNTY";
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
      // Acordo (não vale para satélite, flight nem pendente). Informado (K salvo): as posições 1 a K pontuam como o Kº colocado, e vale no lugar do
      // automático. Sem K salvo: o grupo de posições que pontuaram igual (detectarAcordos) pontua como a última posição do grupo.
      const tAcordo = acordoDe(t);
      let grupo: { de: number; ate: number; origem: "informado" | "automatico" } | null = null;
      if (!sat && !part && !motivoPendente && r.position != null) {
        const pos = r.position;
        if (tAcordo != null) grupo = pos <= tAcordo ? { de: 1, ate: tAcordo, origem: "informado" } : null;
        else {
          const g = (auto.get(t.id) ?? []).find((x) => pos >= x.de && pos <= x.ate);
          if (g) grupo = { de: g.de, ate: g.ate, origem: "automatico" };
        }
      }
      const acordo = grupo?.ate ?? null;
      const c = sat
        ? { ...c0, itm: false, base: 0, conta: zero!.conta, esperado: 0, esperadoCent: 0 }
        : acordo != null
          ? calcular({ ...entrada, posicao: acordo, prize: 1, premiados: Math.max(acordo, ctx.premiados) }, regras)
          : c0;
      // 10 pontos fixos (opção da calculadora do site): não depende dos inscritos, então não entra na dedução.
      const fixo = sat || part || acordo != null || (!motivoPendente && !c.itm && regras.foraDoItm === "10fixos");
      // Sem prêmio na planilha, não há "posição e prêmio não concordam".
      const suspeito =
        !porLista && !sat && !part && (
        (r.position != null && r.position <= ctx.premiados && !(r.prize != null && r.prize > 0)) ||
        (r.position == null && r.prize != null && r.prize > 0) ||
        // prêmio em posição além do número de premiados: a posição ou o prêmio estão errados
        (r.position != null && r.position > ctx.premiados && r.prize != null && r.prize > 0));
      return { j, r, t, ctx, entrada, motivoPendente, pendencia, c, fixo, suspeito, sat, zero, motivoNP, part, acordo, grupo, tAcordo };
    }),
  );
  const pre0 = calcPre(new Map());
  // Acordos detectados: só entre as linhas que pontuam (sem pendência, satélite nem participação) e dentro dos premiados.
  const acordosAuto = new Map<string, GrupoAcordo[]>();
  for (const t of d.torneios) {
    const ls = pre0.filter((p) => p.t.id === t.id && !p.motivoPendente && !p.sat && !p.part && p.r.position != null && p.r.position <= p.ctx.premiados);
    const g = detectarAcordos(ls.map((p) => ({ posicao: p.r.position as number, cent: centDe(p.r.points) })), regras);
    if (g.length) acordosAuto.set(t.id, g);
  }
  const pre = acordosAuto.size ? calcPre(acordosAuto) : pre0;

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

  // Main Event: o primeiro flight de quem chegou ao Dia Final carrega a pontuação do Dia Final (`fonteDe`), e a linha do Dia Final vale 0 (`cedentes`).
  // Só vale se o flight não está pendente nem zerado por outro motivo (cancelado pelo usuário, satélite). A dedução de inscritos (passo 2) já usou as linhas como estavam.
  type Pre = (typeof pre)[number];
  const fonteDe = new Map<Pre, Pre>();
  const cedentes = new Set<Pre>();
  const porJogadorPre = new Map<unknown, Pre[]>();
  for (const p of pre) (porJogadorPre.get(p.j) ?? porJogadorPre.set(p.j, []).get(p.j)!).push(p);
  for (const [j, ls] of porJogadorPre) {
    const g = ls.find((p) => ehFlight(p.t) && p.t.id === primeiroFlight.get(j));
    const f = ls.find((p) => ehDiaFinal(p.t));
    if (!g || !f || g.motivoPendente || (g.zero && g.zero.codigo !== "FLIGHT_ZERO")) continue;
    fonteDe.set(g, f);
    cedentes.add(f);
  }

  // Passo 3: classificação final. Linhas explicadas por um achado são recalculadas com os inscritos do site.
  const linhas = pre.map((p0) => {
    const fonte = fonteDe.get(p0); // primeiro flight: a pontuação vem da linha do Dia Final (menos o registrado, a posição e o torneio, que são os do flight)
    const carrega = fonte != null;
    const p: Pre = fonte
      ? { ...fonte, j: p0.j, r: p0.r, t: p0.t, ctx: { ...fonte.ctx, buyIn: p0.ctx.buyIn, somaBounty: p0.ctx.somaBounty, tipoBounty: p0.ctx.tipoBounty } }
      : cedentes.has(p0)
        ? { ...p0, sat: true, zero: { conta: PARTICIPACAO.contaZeroFlight, causa: PARTICIPACAO.finalCedido, codigo: "FLIGHT_ZERO" }, part: false, acordo: null, grupo: null, fixo: true, suspeito: false, motivoPendente: null, pendencia: null,
            c: { ...p0.c, itm: false, base: 0, conta: PARTICIPACAO.contaZeroFlight, esperado: 0, esperadoCent: 0 } }
        : p0;
    const { j, r, t, ctx, motivoPendente, pendencia, fixo, suspeito, sat, zero, motivoNP, part, acordo, grupo, tAcordo } = p;
    const achado = deducao.get((fonte ? fonte.t : t).id)!.achado;
    const explicada = achado != null && !motivoPendente && !fixo;
    const field = explicada ? achado.fieldSite : ctx.field;
    const c = explicada ? calcular({ ...p.entrada, field }, regras) : p.c;

    // Os 4 cenários (A a D): só mudam o número de participantes (entradas ou ações) e o fator da faixa até R$ 1.000. Tudo o mais (bounty, fora da
    // premiação, acordo, cancelamento, premiados, o que não pontua, uma pontuação por jogador) é o da linha. Em centésimos; C e D são null onde
    // as reentradas não existem (só o Excel da Etapa 3 as traz, nos torneios comuns), exceto na linha que vale 0 sem depender do campo.
    const entradasLinha = explicada ? field : (ehFlight(t) || ehDiaFinal(t)) && somaFlights > 0 ? somaFlights : t.players;
    const acoesLinha = ehFlight(t) || ehDiaFinal(t) ? null : acoesDe(t);
    const regime = { zero: sat, semPosicao: !!(motivoPendente || part), acordo };
    const cenarios = Object.fromEntries(
      CENARIOS.map((k) => {
        const campo = k === "A" || k === "B" ? entradasLinha : acoesLinha;
        return [k, campo == null && !sat ? null : calcularCenario(p.entrada, regras, regime, campo ?? 0, FATOR_FAIXA_CENARIO[k])];
      }),
    ) as Record<Cenario, number | null>;
    const cenariosMotivo = cenarios.C == null ? MOTIVO_SEM_ACOES : null;

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
    let causaCodigo: "FIXOS10" | "CAMPO" | "BASE" | "SEM_CAUSA" | "SUSPEITO" | "INSCRITOS_SITE" | "SATELITE" | "FLIGHT_ZERO" | "PARTICIPACAO" | "ACORDO" | "PREMIADOS_LISTA" | "CANCELADO_USUARIO" | null = null;
    let baseUsada: number | null = null;
    if (situacao === "ERRO" || situacao === "SUSPEITO" || situacao === "CORRETO_SITE") {
      const fb = fb100(ctx.buyInFator, regras);
      const fixos10 = situacao === "ERRO" && r.points === 10 && c.esperado !== 10;
      // 10 pontos fixos não permitem deduzir inscritos nem comparar bases.
      inverso = sat || part || acordo != null || carrega
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
      } else if (carrega) {
        causaCodigo = "FLIGHT_ZERO";
        causa = PARTICIPACAO.flightComFinal;
      } else if (acordo != null) {
        causaCodigo = "ACORDO";
        causa = grupo!.origem === "automatico" ? ACORDO.causaAuto(grupo!.de, grupo!.ate) : ACORDO.causa(acordo, String(c.esperado).replace(".", ","));
      } else if (part) {
        causaCodigo = "PARTICIPACAO";
        causa = PARTICIPACAO.causa;
      } else if (sat) {
        causaCodigo = zero!.codigo;
        causa = zero!.causa;
      } else if (porLista && r.position != null && r.position > Math.min(ctx.premiados, pagos(t.id)) && r.position <= Math.max(ctx.premiados, pagos(t.id))) {
        // Divergência com a planilha: vale a lista (a planilha pagou como premiado quem a lista não premia, ou o contrário).
        causaCodigo = "PREMIADOS_LISTA";
        causa = `premiados informados: ${ctx.premiados}; a planilha pagou ${pagos(t.id)}`;
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
      /** Posição da linha que deu a pontuação: no primeiro flight de quem chegou ao Dia Final, a posição no Dia Final; nas demais, a própria. O Consolidado conta o 1º lugar por ela. */
      posicaoPontua: (fonte ?? p).r.position,
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
      /** Valor esperado nos 4 cenários, em centésimos de ponto (inteiros): A = só entradas, faixa 1,0 (igual a `esperadoCent` com as regras padrão); B = só entradas, faixa 0,9;
       * C = total de ações, faixa 1,0; D = total de ações, faixa 0,9. C e D são null quando as reentradas não existem. */
      cenarios,
      /** Por que C e D são null (o motivo escrito), ou null quando eles existem. */
      cenariosMotivo,
      /** Total de ações (entradas + reentradas) do torneio, o campo dos cenários C e D; null quando não há. */
      acoesCampo: acoesLinha,
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
      /** O usuário marcou o torneio como cancelado: esperado 0. */
      canceladoUsuario: sat && zero!.codigo === "CANCELADO_USUARIO",
      /** K do acordo, nas linhas das posições 1 a K de um torneio com acordo (pontuam como o Kº colocado). */
      acordo,
      /** Primeira posição do acordo (a linha pontua como a última, `acordo`): 1 no informado; no automático, o começo do grupo. */
      acordoDe: grupo?.de ?? null,
      /** Como o acordo foi achado: informado (K salvo) ou detectado automaticamente. */
      acordoOrigem: grupo?.origem ?? null,
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
      /** Origem planilha: quantas linhas a planilha pagou como premiadas (pontos diferentes de 10); só para mostrar a divergência com a lista. Null nas outras origens. */
      premiadosPagos: porLista ? pagos(t.id) : null,
      buyIns: t.buyIns ?? null,
      reentries: t.reentries ?? null,
      acordo: acordoDe(t),
      /** Chave do torneio nos cancelamentos (o ID do site, ou o nome normalizado na planilha) e se o usuário o marcou como cancelado. */
      chaveCancelamento: chaveDe(t),
      cancelado: canceladoPeloUsuario(t),
      /** Acordos detectados automaticamente neste torneio (mesmo quando há um informado, que vale no lugar). */
      acordosAuto: (acordosAuto.get(t.id) ?? []).map((g) => ({ de: g.de, ate: g.ate, pontos: g.cent / 100 })),
      /** Há K informado e o automático discorda (não achou o mesmo grupo 1 a K). */
      acordoDiscorda: acordoDe(t) != null && !((acordosAuto.get(t.id) ?? []).length === 1 && acordosAuto.get(t.id)![0].de === 1 && acordosAuto.get(t.id)![0].ate === acordoDe(t)),
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

  // Lista dos acordos detectados (e dos informados que o automático não confirma), para o relatório.
  const detectados = resumoTorneios.flatMap((t) => t.acordosAuto.map((g) => ({ torneioId: t.torneioId, torneio: t.torneio, de: g.de, ate: g.ate, pontos: g.pontos, informado: t.acordo, discorda: t.acordoDiscorda })));
  return { resumo, torneios: resumoTorneios, linhas, somas, acordosDetectados: detectados, acordos: Object.fromEntries(d.torneios.map((t) => [t.id, acordoDe(t)]).filter(([, k]) => k != null)) as Record<string, number> };
}
