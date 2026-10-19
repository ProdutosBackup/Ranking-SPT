import { createHash } from "node:crypto";
import { centDe } from "./calculo";

const BASE = "https://supremapokertour.com/api/spt";
const SIMULTANEAS = 5;

/** Ajustes da leitura. Mutável só para os testes encurtarem as esperas. */
export const extracao = { timeoutMs: 15000, tentativas: 3, esperasMs: [500, 1500] as number[] };

export type Torneio = {
  id: string;
  name: string;
  buyIn: number;
  players: number;
  role: string;
  flightLabel: string | null;
  status: string;
};
export type Resultado = {
  tournamentId: string;
  tournamentName: string;
  position: number | null;
  points: number;
  prize: number | null;
};
export type Jogador = { name: string; rank: number; rankingPoints: number; resultados: Resultado[] };
export type DadosSpt = {
  stage: string;
  updatedAt: { ranking: string; tournaments: string };
  torneios: Torneio[];
  jogadores: Jogador[];
};

/** Falha de leitura: a auditoria é bloqueada e a mensagem já vem em português simples. */
export class ErroExtracao extends Error {}
/** Leitura interrompida porque outra chamada falhou; nunca chega ao usuário. */
class Interrompida extends Error {}
/** Falha passageira (rede, tempo limite, 429, 5xx): vale tentar de novo. */
class Passageira extends Error {}

export const MSG_FORA = "O site do SPT não respondeu. Tente novamente em alguns minutos.";
const MSG_INVALIDA = "O site do SPT devolveu uma resposta que não foi possível entender. Tente novamente em alguns minutos.";
const MSG_RECUSOU = "O site do SPT não aceitou o pedido. Tente novamente em alguns minutos.";
export const MSG_MUDOU = "Os dados do site mudaram durante a leitura. Tente novamente em alguns minutos.";
export const MSG_SEM_RANKING = "Esta etapa ainda não tem ranking publicado.";
const MSG_SEM_TORNEIOS = "Esta etapa ainda não tem torneios publicados.";

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET com tempo limite por chamada e até `tentativas` tentativas, com espera crescente, em falha passageira. */
async function getJson<T>(url: string, parar: AbortSignal): Promise<T> {
  for (let i = 0; i < extracao.tentativas; i++) {
    if (parar.aborted) throw new Interrompida();
    try {
      const r = await fetch(url, { cache: "no-store", signal: AbortSignal.any([parar, AbortSignal.timeout(extracao.timeoutMs)]) });
      if (r.status === 429 || r.status >= 500) throw new Passageira(`código ${r.status}`);
      if (!r.ok) throw new ErroExtracao(MSG_RECUSOU);
      try {
        return (await r.json()) as T;
      } catch {
        if (parar.aborted) throw new Interrompida();
        throw new ErroExtracao(MSG_INVALIDA);
      }
    } catch (e) {
      if (e instanceof ErroExtracao || e instanceof Interrompida) throw e;
      if (parar.aborted) throw new Interrompida();
      // rede, tempo limite ou falha passageira: tenta de novo
    }
    if (i < extracao.tentativas - 1) await dormir(extracao.esperasMs[Math.min(i, extracao.esperasMs.length - 1)] ?? 0);
  }
  throw new ErroExtracao(MSG_FORA);
}

type Rk = { updatedAt: string; ranking: { rank: number; name: string; points: number }[] };
type Tn = { updatedAt: string; tournaments: Torneio[] };

const porTexto = (a: unknown, b: unknown) => {
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  return x < y ? -1 : x > y ? 1 : 0;
};
/** Hash do conteúdo do ranking e dos torneios (sem updatedAt), para detectar mudança durante a leitura. */
const hashBase = (rk: Rk, tn: Tn) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        r: rk.ranking.map((p) => [p.name, centDe(p.points)]).sort(porTexto),
        t: tn.tournaments.map((t) => [t.id, t.name, t.buyIn, t.players, t.role, t.flightLabel ?? null, t.status]).sort(porTexto),
      }),
    )
    .digest("hex");

async function lerBase(stage: string, parar: AbortSignal) {
  const q = encodeURIComponent(stage);
  const [rk, tn] = await Promise.all([getJson<Rk>(`${BASE}/ranking?stage=${q}`, parar), getJson<Tn>(`${BASE}/tournaments?stage=${q}`, parar)]);
  if (!Array.isArray(rk?.ranking) || !Array.isArray(tn?.tournaments)) throw new ErroExtracao(MSG_INVALIDA);
  if (!rk.ranking.length) throw new ErroExtracao(MSG_SEM_RANKING);
  if (!tn.tournaments.length) throw new ErroExtracao(MSG_SEM_TORNEIOS);
  return { rk, tn };
}

async function lerUmaVez(stage: string, onProgresso?: (feito: number, total: number) => void) {
  const q = encodeURIComponent(stage);
  const { rk, tn } = await lerBase(stage, new AbortController().signal);

  const vistos = new Set<string>();
  const repetidos = new Set<string>();
  for (const p of rk.ranking) (vistos.has(p.name) ? repetidos : vistos).add(p.name);
  if (repetidos.size) throw new ErroExtracao(`O ranking tem jogadores com o mesmo nome: ${[...repetidos].join(", ")}.`);

  const ids = new Set(tn.tournaments.map((t) => t.id));
  const jogadores: Jogador[] = new Array(rk.ranking.length);
  const parar = new AbortController();
  let falha: unknown = null;
  let prox = 0;
  let feitos = 0;
  const trabalhador = async () => {
    try {
      while (prox < rk.ranking.length && !parar.signal.aborted) {
        const i = prox++;
        const p = rk.ranking[i];
        const s = await getJson<{ results: Resultado[] }>(`${BASE}/player-summary?stage=${q}&name=${encodeURIComponent(p.name)}`, parar.signal);
        if (!Array.isArray(s?.results) || !s.results.length || s.results.some((r) => typeof r?.points !== "number"))
          throw new ErroExtracao(`Não foi possível ler os resultados de ${p.name}.`);
        const soma = s.results.reduce((a, r) => a + centDe(r.points), 0);
        if (soma !== centDe(p.points)) throw new ErroExtracao(`Os resultados de ${p.name} não somam os pontos do ranking.`);
        for (const r of s.results)
          if (!ids.has(r.tournamentId)) throw new ErroExtracao(`Um resultado de ${p.name} aponta para um torneio que o site não lista.`);
        jogadores[i] = { name: p.name, rank: p.rank, rankingPoints: p.points, resultados: s.results };
        onProgresso?.(++feitos, rk.ranking.length);
      }
    } catch (e) {
      if (e instanceof Interrompida) return;
      if (falha == null) {
        falha = e;
        parar.abort(); // falha definitiva: interrompe as outras chamadas
      }
    }
  };
  await Promise.all(Array.from({ length: SIMULTANEAS }, trabalhador));
  if (falha != null) throw falha;

  return {
    hash: hashBase(rk, tn),
    dados: { stage, updatedAt: { ranking: rk.updatedAt, tournaments: tn.updatedAt }, torneios: tn.tournaments, jogadores } as DadosSpt,
  };
}

/**
 * Lê a etapa. Ao final relê ranking e torneios e compara o hash do conteúdo: se mudou, refaz a leitura uma vez;
 * se mudar de novo, bloqueia.
 */
export async function buscarDados(stage: string, onProgresso?: (feito: number, total: number) => void): Promise<DadosSpt> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const { hash, dados } = await lerUmaVez(stage, onProgresso);
    const depois = await lerBase(stage, new AbortController().signal);
    if (hashBase(depois.rk, depois.tn) === hash) return dados;
  }
  throw new ErroExtracao(MSG_MUDOU);
}
