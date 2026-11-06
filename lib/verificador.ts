// Verificador independente: reimplementa a regra do zero, sem importar calculo.ts nem auditoria.ts.
// Só usa inteiros. Recalcula 100% das linhas e a dedução de inscritos por torneio (por tentativa, sem fórmula inversa)
// a partir dos dados brutos e aponta qualquer divergência.
import type { DadosSpt } from "./api-spt";
import { TORNEIOS_COM_BOUNTY_ETAPA3 } from "./bounty-etapa3";
import { PREMIADOS_ETAPA3 } from "./premiados-etapa3";
import type { Regras } from "./regras";

// Pontos por posição 1..18; 19+ tratado à parte.
const TABELA: Record<number, number> = {
  1: 1000, 2: 800, 3: 700, 4: 600, 5: 500, 6: 450, 7: 400, 8: 350, 9: 300,
  10: 250, 11: 250, 12: 250, 13: 200, 14: 200, 15: 200, 16: 200, 17: 200, 18: 200,
};
// Faixas de buy-in acima de R$ 1.000, pelo limite superior inclusivo → fator ×100. Até R$ 1.000 vale o fator da faixa (regras).
// Acima de um limite, mesmo por centavos, vale a faixa seguinte; acima do último limite, 2,5. Escrito aqui, sem importar o motor.
const LIMITES: [number, number][] = [[1999, 120], [2999, 150]];
const FATOR_ACIMA = 250;
/** Fator de buy-in ×100 do verificador (exportado só para o teste de concordância das cópias). */
export function fatorBuyIn100(buyIn: number, faixaAte1000: number): number {
  if (buyIn <= 1000) return Math.round(faixaAte1000 * 100);
  for (const [max, f] of LIMITES) if (buyIn <= max) return f;
  return FATOR_ACIMA;
}
const MAX_INSCRITOS = 20000;
const MIN_LINHAS_ACHADO = 3;

/** Centésimos de ponto para base, inscritos e fator de buy-in ×100. Metade arredonda para cima. */
const centavos = (base: number, inscritos: number, f100: number) => Math.floor((base * (inscritos * 100 + 5000) * f100 + 5000) / 10000);

type Linha = {
  jogador: string;
  torneioId: string;
  posicao: number | null;
  field: number;
  buyIn: number;
  premiados: number;
  base: number;
  fatorParticipantes: number;
  fatorBuyIn: number;
  esperadoCent: number;
  registradoCent: number;
  diferenca: number;
  situacao: string;
  pendencia: string | null;
  participacao: boolean;
  acordo: unknown | null;
  acordoDe?: unknown | null;
  acordoOrigem?: unknown | null;
  canceladoUsuario?: unknown;
  cenarios?: Record<string, number | null>;
  cenariosMotivo?: string | null;
  acoesCampo?: number | null;
};
type TorneioMotor = {
  torneioId: string;
  fieldDeduzido: number | null;
  melhorCandidato: { field: number; linhas: number; de: number } | null;
  achado: { fieldApi: number; fieldSite: number; diferenca: number; linhasExplicadas: number } | null;
  acordosAuto?: { de: number; ate: number; pontos: number }[];
};
/** Buy-in que escolhe o fator: o total (buy-in + bounty) em todo torneio com bounty; sem bounty, só o buy-in. Escrito aqui, sem importar o motor; exportado só para o teste. */
export const buyInTotalVerificador = (t: { buyIn: number; bountyType?: string | null; bountyAmount?: number | null }): number =>
  t.bountyType != null && t.bountyType !== "NONE" && typeof t.bountyAmount === "number" ? t.buyIn + t.bountyAmount : t.buyIn;
/** Torneio que não pontua, pelo nome (sem maiúsculas e acentos): satélite, Ladies ou All in or Fold. Escrito aqui, sem importar o motor; exportado só para o teste. */
export const naoPontuaVerificador = (nome: string): boolean => {
  const n = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return n.includes("satelite") || /(^|[^a-z])ladies([^a-z]|$)/.test(n) || /all\s+in\s+or\s+fold/.test(n);
};
/**
 * Premiados da Etapa 3 por torneio (lista do responsável, tabela em premiados-etapa3.ts, que é só dado). A leitura do nome é escrita aqui,
 * sem importar o motor: sem maiúsculas, acentos, apóstrofos, hífen nem barra. Exportada só para o teste de concordância.
 */
export const chaveNomeV = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[´`'’]/g, "").replace(/[-–—/]/g, " ").replace(/\s+/g, " ").trim();
export const premiadosListaV = (nome: string): number | null => {
  const k = chaveNomeV(nome);
  for (const x of PREMIADOS_ETAPA3) if (chaveNomeV(x.aba) === k) return x.premiados;
  return null;
};
/** Main Event, escrito aqui sem importar o motor: flight, Dia Final e a ordem dos flights (1A, 1B, 1C…). Exportado só para o teste. */
export const ehFlightV = (t: { role: string; name: string }) => t.role === "FLIGHT" || (t.role === "STANDALONE" && /dia 1/i.test(t.name));
export const ehFinalV = (t: { role: string; name: string }) => t.role === "FINAL" || (t.role === "STANDALONE" && /^final main event/i.test(t.name));
const ordemV = (t: { name: string; flightLabel: string | null }) => (/(?:^|dia\s*)1\s*([a-z])/i.exec(t.flightLabel ?? t.name)?.[1] ?? t.name).toUpperCase();
export type Divergencia = { jogador: string; torneio: string; posicao: number | null; campo: string; motor: unknown; verificador: unknown };

type Bruta = {
  ji: number; flight: boolean; final: boolean; npNome: boolean; jogador: string; torneioId: string; pos: number | null; np: number; field: number; buyIn: number; f100: number;
  base: number; bif: number; entradas: number; acoes: number | null; canc: boolean; satelite: boolean; particip: boolean; acordo: boolean; acDe: number | null; acAte: number | null; acOrigem: string | null; acCent: number; pendente: boolean; motivo: string | null; fixo: boolean; itm: boolean; suspeito: boolean; reg: number; prize: number | null;
};

export function verificar(d: DadosSpt, regras: Regras, linhas: Linha[], torneiosMotor: TorneioMotor[], acordos: Record<string, number> = {}, cancelados: string[] = []): Divergencia[] {
  // Participantes do Main Event: soma das entradas (players) dos flights. Cada linha do Main Event vale por si: o primeiro flight do jogador é participação
  // (10 × fatores), os outros flights valem 0, e o Dia Final é avaliado pela própria posição [usuário, 06/11/2026].
  const somaFlights = d.torneios.filter(ehFlightV).reduce((a, t) => a + t.players, 0);
  const primeiro = new Map<unknown, string>();
  for (const j of d.jogadores) {
    let melhor: (typeof d.torneios)[number] | null = null;
    for (const r of j.resultados) {
      const t = d.torneios.find((x) => x.id === r.tournamentId);
      if (!t) continue;
      if (ehFlightV(t) && (melhor == null || ordemV(t) < ordemV(melhor))) melhor = t;
    }
    if (melhor) primeiro.set(j, melhor.id);
  }
  // Origem planilha: sem prêmio na planilha, o nº de premiados vem da lista; torneio fora dela fica sem nº (aguarda). Senão, premiado = prize > 0.
  const daPlanilha = (d as { origem?: { tipo?: string } }).origem?.tipo === "planilha";
  const premiados: Record<string, number> = {};
  if (daPlanilha) {
    for (const t of d.torneios) {
      const n = premiadosListaV(t.name);
      if (n != null) premiados[t.id] = n;
    }
  } else
    for (const j of d.jogadores)
      for (const r of j.resultados) if (r.prize != null && r.prize > 0) premiados[r.tournamentId] = (premiados[r.tournamentId] ?? 0) + 1;

  const brutas: Bruta[] = [];
  const indiceJ = new Map(d.jogadores.map((j, i) => [j, i]));
  for (const j of d.jogadores)
    for (const r of j.resultados) {
      const t = d.torneios.find((x) => x.id === r.tournamentId);
      if (!t) throw new Error(`verificador: torneio ${r.tournamentId} inexistente`);
      const final = ehFinalV(t);
      const flight = ehFlightV(t);
      const acoes = t.buyIns != null && t.reentries != null ? t.buyIns + t.reentries : null; // buy-ins + re-entries, se a planilha informa
      // Campo: Main Event (flights e Dia Final) = soma dos flights; senão os inscritos.
      const field = (final || flight) && somaFlights > 0 ? somaFlights : t.players;
      const buyIn = t.buyIn;
      // Fator de buy-in: em torneio com bounty (K.O ou Mystery) informado vale buy-in + bounty; sem bounty ou com bounty sem valor (provisório), só o buy-in.
      const buyInFator = buyInTotalVerificador({ buyIn, bountyType: t.bountyType, bountyAmount: t.bountyAmount });
      const np = premiados[t.id] ?? 0;
      const pos = r.position;
      // Motivo da pendência, na mesma ordem de precedência da regra (reescrita aqui, de forma independente).
      let motivo: string | null = null;
      let satelite = false;
      let particip = false; // participação do Main Event: 10 × fatores
      // Torneio que o usuário marcou como cancelado: não pontua (vale 0), antes de qualquer pendência. Chave: ID do site, ou o nome normalizado na planilha.
      const canc = cancelados.includes(daPlanilha ? `nome:${chaveNomeV(t.name)}` : t.id);
      if (canc) satelite = true;
      else if (/^cancel/i.test(t.status ?? "")) motivo = "CANCELADO";
      else if (t.status !== "FINISHED") motivo = "NAO_FINALIZADO";
      else if (naoPontuaVerificador(t.name)) satelite = true;
      else if (flight) {
        if (primeiro.get(j) !== t.id) satelite = true; // já pontuou em outro flight: vale 0
        else particip = true;
      } else if (final && pos == null) particip = true; // Dia Final sem posição: 10 × fatores
      if (motivo == null && !particip && !satelite && daPlanilha && premiados[t.id] == null) motivo = "SEM_PREMIADOS"; // fora da lista de premiados
      // Torneio com bounty na lista da Etapa 3 sem o bounty vindo da API: aguarda, em vez de usar o buy-in base.
      if (motivo == null && !particip && !satelite && daPlanilha && TORNEIOS_COM_BOUNTY_ETAPA3.some((n) => chaveNomeV(n) === chaveNomeV(t.name)) && !(t.bountyType != null && t.bountyType !== "NONE" && typeof t.bountyAmount === "number")) motivo = "SEM_BOUNTY";
      if (motivo == null && !particip && !satelite && !/^cancel/i.test(t.status ?? "") && t.status === "FINISHED" && !(final ? buyIn >= 0 : buyIn > 0)) motivo = "SEM_BUYIN"; // só o Dia Final aceita buy-in 0
      const pendente = motivo != null;
      const itm = !pendente && pos != null && pos <= np && (daPlanilha || (r.prize != null && r.prize > 0));
      const baseDe = (p: number) => (p <= 18 ? TABELA[p] : 100);
      // Acordo: as posições 1 a K pontuam como o Kº colocado (a base da colocação K com os fatores normais), reescrito aqui.
      const acK = acordos[t.id] ?? 0;
      const acordo = acK >= 2 && !satelite && !particip && !pendente && pos != null && pos <= acK; // o automático entra depois do laço
      const base = satelite ? 0 : acordo ? baseDe(acK) : itm ? baseDe(pos!) : 10;
      const f100 = fatorBuyIn100(buyInFator, regras.fatorFaixaAte1000);
      const acCent = acordo ? centavos(base, field, f100) : 0;
      const comPremio = r.prize != null && r.prize > 0;
      const suspeito = !daPlanilha && !satelite && !particip && ((pos != null && pos <= np && !comPremio) || (pos == null && comPremio) || (pos != null && pos > np && comPremio));
      brutas.push({
        ji: indiceJ.get(j)!, flight, final, npNome: naoPontuaVerificador(t.name), jogador: j.name, torneioId: t.id, pos, np, field, buyIn, f100, base, bif: buyInFator, entradas: (final || flight) && somaFlights > 0 ? somaFlights : t.players, acoes: final || flight ? null : acoes, canc, satelite, particip, acordo, acDe: acordo ? 1 : null, acAte: acordo ? acK : null, acOrigem: acordo ? "informado" : null, acCent, pendente, motivo, itm, suspeito,
        fixo: satelite || acordo || (particip && !pendente), reg: Math.round(r.points * 100), prize: r.prize,
      });
    }

  // Acordo detectado automaticamente, reescrito aqui: posições consecutivas e diferentes, dentro dos premiados, que pontuaram igual (±0,01) e cujas
  // bases da tabela não são todas iguais. Mesma posição repetida e posições de mesma base não são acordo. Onde há K informado, o informado vale.
  const baseV = (p: number) => (p <= 18 ? TABELA[p] : 100);
  const detectados = new Map<string, { de: number; ate: number; cent: number }[]>();
  for (const t of d.torneios) {
    const alvo = brutas.filter((b) => b.torneioId === t.id && !b.pendente && !b.satelite && !b.particip && b.pos != null && b.pos <= b.np);
    const posicoes = [...new Set(alvo.map((b) => b.pos as number))].sort((a, b) => a - b);
    const achados: { de: number; ate: number; cent: number }[] = [];
    let corrente: { de: number; ate: number; cent: number } | null = null;
    const encerra = () => {
      if (corrente && corrente.ate > corrente.de) {
        const bases = new Set<number>();
        for (let p = corrente.de; p <= corrente.ate; p++) bases.add(baseV(p));
        if (bases.size > 1) achados.push(corrente);
      }
      corrente = null;
    };
    for (const p of posicoes) {
      const pts = alvo.filter((b) => b.pos === p).map((b) => b.reg);
      const igual = Math.max(...pts) - Math.min(...pts) <= 1;
      if (corrente && igual && p === corrente.ate + 1 && Math.abs(pts[0] - corrente.cent) <= 1) corrente.ate = p;
      else {
        encerra();
        if (igual) corrente = { de: p, ate: p, cent: pts[0] };
      }
    }
    encerra();
    if (achados.length) detectados.set(t.id, achados);
    if (!((acordos[t.id] ?? 0) >= 2))
      for (const b of alvo)
        for (const g of achados)
          if (b.pos! >= g.de && b.pos! <= g.ate) {
            b.acordo = true; b.acDe = g.de; b.acAte = g.ate; b.acOrigem = "automatico";
            b.base = baseV(g.ate); b.fixo = true; b.acCent = centavos(b.base, b.field, b.f100);
          }
  }

  // Dedução por torneio: testa cada inteiro de inscritos de 1 a MAX e conta as linhas que ele reproduz.
  const div: Divergencia[] = [];
  const nome = (id: string) => d.torneios.find((t) => t.id === id)?.name ?? id;
  const achados = new Map<string, number>(); // torneioId → inscritos do site
  for (const t of d.torneios) {
    const ls = brutas.filter((b) => b.torneioId === t.id && !b.pendente && !b.fixo);
    const usado = brutas.find((b) => b.torneioId === t.id)?.field ?? ((ehFinalV(t) || ehFlightV(t)) && somaFlights > 0 ? somaFlights : t.players);
    let melhorF = 0;
    let melhorN = 0;
    for (let f = 1; f <= MAX_INSCRITOS && ls.length; f++) {
      let n = 0;
      for (const l of ls) if (centavos(l.base, f, l.f100) === l.reg) n++;
      if (n > melhorN || (n === melhorN && n > 0 && f === usado && melhorF !== usado)) { melhorN = n; melhorF = f; }
    }
    const achado = melhorN > 0 && ls.length >= MIN_LINHAS_ACHADO && melhorF !== usado && melhorN === ls.length;
    if (achado) achados.set(t.id, melhorF);

    const m = torneiosMotor.find((x) => x.torneioId === t.id);
    const cmp = (campo: string, motor: unknown, ver: unknown) => {
      if (motor !== ver) div.push({ jogador: "—", torneio: t.name, posicao: null, campo, motor, verificador: ver });
    };
    if (!m) { cmp("torneio presente", false, true); continue; }
    cmp("inscritos deduzidos", m.fieldDeduzido, melhorN > 0 ? melhorF : null);
    cmp("linhas que reproduzem", m.melhorCandidato?.linhas ?? null, melhorN > 0 ? melhorN : null);
    cmp("linhas não pendentes", m.melhorCandidato?.de ?? null, melhorN > 0 ? ls.length : null);
    cmp("divergência de inscritos", m.achado != null, achado);
    cmp("acordos detectados", JSON.stringify(m.acordosAuto ?? []), JSON.stringify((detectados.get(t.id) ?? []).map((g) => ({ de: g.de, ate: g.ate, pontos: g.cent / 100 }))));
    if (achado && m.achado) {
      cmp("inscritos do site", m.achado.fieldSite, melhorF);
      cmp("inscritos da API", m.achado.fieldApi, usado);
      cmp("diferença de inscritos", m.achado.diferenca, melhorF - usado);
      cmp("linhas explicadas", m.achado.linhasExplicadas, ls.length);
    }
  }

  // Linhas: recalcula base, fatores, esperado, diferença e situação.
  if (brutas.length !== linhas.length)
    div.push({ jogador: "*", torneio: "*", posicao: null, campo: "nº de linhas", motor: linhas.length, verificador: brutas.length });
  brutas.forEach((b, i) => {
    const l = linhas[i];
    if (!l) return;
    const site = achados.get(b.torneioId);
    const explicada = site != null && !b.pendente && !b.fixo;
    const field = explicada ? site : b.field;
    const flightComAcoes = b.particip && !b.pendente;
    const cent = b.satelite ? 0 : b.acordo ? b.acCent : flightComAcoes ? centavos(10, field, b.f100) : centavos(b.base, field, b.f100);
    // Os 4 cenários (A a D), reescritos aqui: só mudam o campo (entradas ou ações) e o fator da faixa até R$ 1.000 (1,0 ou 0,9). C e D: null sem reentradas.
    const cenV = (campo: number | null, faixa: number): number | null => {
      if (b.satelite) return 0;
      if (campo == null) return null;
      const f = fatorBuyIn100(b.bif, faixa);
      return b.acordo ? centavos(b.base, campo, f) : flightComAcoes ? centavos(10, campo, f) : centavos(b.base, campo, f);
    };
    const entradasLinha = explicada ? site : b.entradas;
    const cenV4 = { A: cenV(entradasLinha, 1), B: cenV(entradasLinha, 0.9), C: cenV(b.acoes, 1), D: cenV(b.acoes, 0.9) };
    const dif = b.reg - cent;
    const tol = Math.round(regras.toleranciaArredondamento * 100);
    const situacao = b.pendente
      ? "PENDENTE_REGRA"
      : b.suspeito
        ? "SUSPEITO"
        : dif === 0
          ? explicada ? "CORRETO_SITE" : "CORRETO"
          : !b.satelite && !b.particip && !b.acordo && Math.abs(dif) <= tol ? "ARREDONDAMENTO" : "ERRO";
    const esperado: Record<string, unknown> = {
      jogador: b.jogador, torneioId: b.torneioId, field, buyIn: b.buyIn, premiados: b.np, base: b.base,
      fatorParticipantes: field * 100 + 5000, fatorBuyIn: b.f100, esperadoCent: cent, registradoCent: b.reg,
      diferenca: dif, situacao, pendencia: b.motivo, participacao: b.particip, canceladoUsuario: b.canc, acordo: b.acAte, acordoDe: b.acDe, acordoOrigem: b.acOrigem,
      cenarioA: cenV4.A, cenarioB: cenV4.B, cenarioC: cenV4.C, cenarioD: cenV4.D, cenariosMotivo: cenV4.C == null ? (b.acoes == null && d.torneios.find((x) => x.id === b.torneioId)?.acoesMotivo) || "reentradas não disponíveis: falta o Excel da etapa" : null, acoesCampo: b.acoes,
    };
    const motor: Record<string, unknown> = {
      jogador: l.jogador, torneioId: l.torneioId, field: l.field, buyIn: l.buyIn, premiados: l.premiados, base: l.base,
      fatorParticipantes: Math.round(l.fatorParticipantes * 10000), fatorBuyIn: Math.round(l.fatorBuyIn * 100),
      esperadoCent: l.esperadoCent, registradoCent: l.registradoCent, diferenca: Math.round(l.diferenca * 100), situacao: l.situacao, pendencia: l.pendencia, participacao: l.participacao, canceladoUsuario: l.canceladoUsuario ?? false, acordo: l.acordo ?? null, acordoDe: l.acordoDe ?? null, acordoOrigem: l.acordoOrigem ?? null,
      cenarioA: l.cenarios?.A ?? null, cenarioB: l.cenarios?.B ?? null, cenarioC: l.cenarios?.C ?? null, cenarioD: l.cenarios?.D ?? null, cenariosMotivo: l.cenariosMotivo ?? null, acoesCampo: l.acoesCampo ?? null,
    };
    for (const campo of Object.keys(esperado))
      if (motor[campo] !== esperado[campo]) div.push({ jogador: b.jogador, torneio: nome(b.torneioId), posicao: b.pos, campo, motor: motor[campo], verificador: esperado[campo] });
  });
  return div;
}
