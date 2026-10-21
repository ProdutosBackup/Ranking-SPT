// Verificador independente: reimplementa a regra do zero, sem importar calculo.ts nem auditoria.ts.
// Só usa inteiros. Recalcula 100% das linhas e a dedução de inscritos por torneio (por tentativa, sem fórmula inversa)
// a partir dos dados brutos e aponta qualquer divergência.
import type { DadosSpt } from "./api-spt";
import type { Regras } from "./regras";

// Pontos por posição 1..18; 19+ tratado à parte.
const TABELA: Record<number, number> = {
  1: 1000, 2: 800, 3: 700, 4: 600, 5: 500, 6: 450, 7: 400, 8: 350, 9: 300,
  10: 250, 11: 250, 12: 250, 13: 200, 14: 200, 15: 200, 16: 200, 17: 200, 18: 200,
};
// Faixas de buy-in (limite inferior inclusivo) → fator ×100.
const FAIXAS: [number, number][] = [[3000, 250], [2000, 150], [1001, 120], [500, 100]];
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
};
type TorneioMotor = {
  torneioId: string;
  fieldDeduzido: number | null;
  melhorCandidato: { field: number; linhas: number; de: number } | null;
  achado: { fieldApi: number; fieldSite: number; diferenca: number; linhasExplicadas: number } | null;
};
export type Divergencia = { jogador: string; torneio: string; posicao: number | null; campo: string; motor: unknown; verificador: unknown };

type Bruta = {
  jogador: string; torneioId: string; pos: number | null; np: number; field: number; buyIn: number; f100: number;
  base: number; satelite: boolean; particip: boolean; pendente: boolean; motivo: string | null; fixo: boolean; itm: boolean; suspeito: boolean; reg: number; prize: number | null;
};

export function verificar(d: DadosSpt, regras: Regras, linhas: Linha[], torneiosMotor: TorneioMotor[]): Divergencia[] {
  const somaFlights = d.torneios.filter((t) => t.role === "FLIGHT").reduce((a, t) => a + t.players, 0);
  const premiados: Record<string, number> = {};
  for (const j of d.jogadores)
    for (const r of j.resultados) if (r.prize != null && r.prize > 0) premiados[r.tournamentId] = (premiados[r.tournamentId] ?? 0) + 1;

  const brutas: Bruta[] = [];
  for (const j of d.jogadores)
    for (const r of j.resultados) {
      const t = d.torneios.find((x) => x.id === r.tournamentId);
      if (!t) throw new Error(`verificador: torneio ${r.tournamentId} inexistente`);
      const final = t.role === "FINAL";
      const field = final && somaFlights > 0 ? somaFlights : t.players;
      const buyIn = final && t.buyIn === 0 ? regras.buyInDiaFinalZero : t.buyIn;
      const np = premiados[t.id] ?? 0;
      const pos = r.position;
      const flight = t.role === "FLIGHT" || (t.role === "STANDALONE" && /dia 1/i.test(t.name));
      // Motivo da pendência, na mesma ordem de precedência da regra (reescrita aqui, de forma independente).
      let motivo: string | null = null;
      let satelite = false;
      let particip = false; // participação de flight: 10 pontos fixos
      if (/^cancel/i.test(t.status ?? "")) motivo = "CANCELADO";
      else if (t.status !== "FINISHED") motivo = "NAO_FINALIZADO";
      else if (/sat[eé]lite/i.test(t.name)) satelite = true;
      else if (flight || (final && pos == null)) particip = true; // flights e Dia Final sem posição
      else if (!(buyIn > 0)) motivo = "SEM_BUYIN";
      const pendente = motivo != null;
      const itm = !pendente && pos != null && pos <= np && r.prize != null && r.prize > 0;
      const base = satelite ? 0 : itm ? (pos! <= 18 ? TABELA[pos!] : regras.aposDecimoOitavo === "base10" ? 10 : 100) : 10;
      let f100 = Math.round(regras.fatorBuyInAbaixo500 * 100);
      for (const [min, f] of FAIXAS) if (buyIn >= min) { f100 = f; break; }
      const comPremio = r.prize != null && r.prize > 0;
      const suspeito = !satelite && !particip && ((pos != null && pos <= np && !comPremio) || (pos == null && comPremio) || (pos != null && pos > np && comPremio));
      brutas.push({
        jogador: j.name, torneioId: t.id, pos, np, field, buyIn, f100, base, satelite, particip, pendente, motivo, itm, suspeito,
        fixo: satelite || particip || (!pendente && !itm && regras.foraDoItm === "10fixos"), reg: Math.round(r.points * 100), prize: r.prize,
      });
    }

  // Dedução por torneio: testa cada inteiro de inscritos de 1 a MAX e conta as linhas que ele reproduz.
  const div: Divergencia[] = [];
  const nome = (id: string) => d.torneios.find((t) => t.id === id)?.name ?? id;
  const achados = new Map<string, number>(); // torneioId → inscritos do site
  for (const t of d.torneios) {
    const ls = brutas.filter((b) => b.torneioId === t.id && !b.pendente && !b.fixo);
    const usado = brutas.find((b) => b.torneioId === t.id)?.field ?? (t.role === "FINAL" && somaFlights > 0 ? somaFlights : t.players);
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
    const cent = b.satelite ? 0 : b.particip ? 1000 : b.fixo ? 1000 : centavos(b.base, field, b.f100);
    const dif = b.reg - cent;
    const tol = Math.round(regras.toleranciaArredondamento * 100);
    const situacao = b.pendente
      ? "PENDENTE_REGRA"
      : b.suspeito
        ? "SUSPEITO"
        : dif === 0
          ? explicada ? "CORRETO_SITE" : "CORRETO"
          : !b.satelite && !b.particip && Math.abs(dif) <= tol ? "ARREDONDAMENTO" : "ERRO";
    const esperado: Record<string, unknown> = {
      jogador: b.jogador, torneioId: b.torneioId, field, buyIn: b.buyIn, premiados: b.np, base: b.base,
      fatorParticipantes: field * 100 + 5000, fatorBuyIn: b.f100, esperadoCent: cent, registradoCent: b.reg,
      diferenca: dif, situacao, pendencia: b.motivo, participacao: b.particip,
    };
    const motor: Record<string, unknown> = {
      jogador: l.jogador, torneioId: l.torneioId, field: l.field, buyIn: l.buyIn, premiados: l.premiados, base: l.base,
      fatorParticipantes: Math.round(l.fatorParticipantes * 10000), fatorBuyIn: Math.round(l.fatorBuyIn * 100),
      esperadoCent: l.esperadoCent, registradoCent: l.registradoCent, diferenca: Math.round(l.diferenca * 100), situacao: l.situacao, pendencia: l.pendencia, participacao: l.participacao,
    };
    for (const campo of Object.keys(esperado))
      if (motor[campo] !== esperado[campo]) div.push({ jogador: b.jogador, torneio: nome(b.torneioId), posicao: b.pos, campo, motor: motor[campo], verificador: esperado[campo] });
  });
  return div;
}
