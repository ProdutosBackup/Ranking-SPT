import { createHash } from "node:crypto";
import type { DadosSpt } from "./api-spt";
import type { auditar } from "./auditoria";
import { centDe } from "./calculo";
import { VERSAO_REGRAS, type Regras } from "./regras";
import { verificar } from "./verificador";

/** Falha de integridade: a auditoria não devolve resultado parcial. */
export class ErroAuditoria extends Error {
  constructor(msg: string, public detalhes: unknown[]) {
    super(msg);
  }
}

const ROLES = ["STANDALONE", "FLIGHT", "FINAL", "PARENT"];
const SITUACOES = ["CORRETO", "CORRETO_SITE", "ARREDONDAMENTO", "ERRO", "SUSPEITO", "PENDENTE_REGRA"];
type Aud = ReturnType<typeof auditar>;

const porTexto = (a: unknown, b: unknown) => {
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  return x < y ? -1 : x > y ? 1 : 0;
};

/**
 * Identificador dos dados: hash SHA-256 só do conteúdo (torneios e resultados normalizados e ordenados, valores em
 * centésimos inteiros). O `updatedAt` da API é a hora da consulta, não da mudança dos dados, por isso fica de fora.
 */
export function identificador(d: DadosSpt) {
  const torneios = d.torneios
    .map((t) => [t.id, t.name, t.buyIn, t.players, t.role, t.flightLabel ?? null, t.status])
    .sort(porTexto);
  const jogadores = d.jogadores
    .map((j) => [
      j.name,
      centDe(j.rankingPoints),
      j.resultados.map((r) => [r.tournamentId, r.position, centDe(r.points), r.prize == null ? null : centDe(r.prize)]).sort(porTexto),
    ])
    .sort(porTexto);
  return {
    updatedAt: d.updatedAt,
    sha256: createHash("sha256").update(JSON.stringify({ stage: d.stage, torneios, jogadores })).digest("hex"),
    versaoRegras: VERSAO_REGRAS,
  };
}

/** Roda checagens de integridade e o verificador independente. Lança ErroAuditoria se algo não fechar. */
export function conferir(d: DadosSpt, regras: Regras, aud: Aud) {
  const f: string[] = [];
  const ids = new Set(d.torneios.map((t) => t.id));

  for (const t of d.torneios) if (!ROLES.includes(t.role)) f.push(`role desconhecido "${t.role}" em "${t.name}"`);
  for (const j of d.jogadores) {
    if (!j.resultados.length) f.push(`jogador sem resultados: ${j.name}`);
    const soma = j.resultados.reduce((a, r) => a + centDe(r.points), 0);
    if (soma !== centDe(j.rankingPoints)) f.push(`soma de "${j.name}" (${soma / 100}) ≠ ranking.points (${j.rankingPoints})`);
    for (const r of j.resultados) if (!ids.has(r.tournamentId)) f.push(`tournamentId inexistente em "${j.name}": ${r.tournamentId}`);
  }

  const totalApi = d.jogadores.reduce((a, j) => a + j.resultados.length, 0);
  if (aud.linhas.length !== totalApi) f.push(`linhas auditadas (${aud.linhas.length}) ≠ linhas da API (${totalApi})`);
  aud.linhas.forEach((l, i) => {
    if (!SITUACOES.includes(l.situacao)) f.push(`linha ${i + 1} sem situação válida`);
    for (const [k, v] of Object.entries({ esperado: l.esperado, fatorParticipantes: l.fatorParticipantes, fatorBuyIn: l.fatorBuyIn, field: l.field }))
      if (typeof v !== "number" || !Number.isFinite(v)) f.push(`linha ${i + 1} (${l.jogador}, ${l.torneio}): ${k} inválido (${v})`);
  });

  aud.linhas.forEach((l, i) => {
    const fi = l.inverso?.fieldImplicito;
    if (fi != null && !(Number.isInteger(fi) && fi >= 1)) f.push(`linha ${i + 1} (${l.jogador}, ${l.torneio}): inscritos do cálculo inverso inválido (${fi})`);
    if (l.inverso && !(Number.isFinite(l.inverso.fatorTotal) && l.inverso.fatorTotal >= 0))
      f.push(`linha ${i + 1} (${l.jogador}, ${l.torneio}): fator total do cálculo inverso inválido (${l.inverso.fatorTotal})`);
  });

  const r = aud.resumo as unknown as Record<string, number>;
  if (SITUACOES.reduce((a, s) => a + r[s], 0) !== r.total) f.push("resumo: soma das situações ≠ total");
  for (const t of aud.torneios as unknown as Record<string, number | string>[]) {
    const s = SITUACOES.reduce((a, k) => a + (t[k] as number), 0);
    if (s !== t.total) f.push(`torneio "${t.torneio}": soma das situações (${s}) ≠ linhas (${t.total})`);
  }
  if (f.length) throw new ErroAuditoria("Checagem de integridade falhou", f);

  const div = verificar(d, regras, aud.linhas, aud.torneios);
  if (div.length) throw new ErroAuditoria(`Verificador independente divergiu em ${div.length} ponto(s)`, div);
}
