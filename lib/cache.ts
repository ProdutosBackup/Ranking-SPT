import { buscarDados, type DadosSpt } from "./api-spt";
import type { auditar } from "./auditoria";
import type { identificador } from "./integridade";
import type { Regras } from "./regras";

const VALIDADE_MS = 10 * 60 * 1000;
export type Entrada = {
  stage: string;
  /** De onde vieram os dados: "site" ou "planilha:<sha256 da planilha guardada>". Entra na chave do cache. */
  origem: string;
  regras: Regras;
  dados: DadosSpt;
  aud: ReturnType<typeof auditar>;
  id: ReturnType<typeof identificador>;
  em: number;
};

// globalThis: sobrevive ao recarregamento de módulos do `next dev`.
const g = globalThis as unknown as { __cacheAuditoria?: Map<string, Entrada> };
const mapa = (g.__cacheAuditoria ??= new Map());
const chave = (stage: string, origem: string, sha: string, r: Regras) => `${stage}|${origem}|${sha}|${JSON.stringify(r)}`;

// Leituras em andamento: duas auditorias simultâneas da mesma etapa compartilham a mesma leitura.
type Leitura = { promessa: Promise<DadosSpt>; ouvintes: Set<(feito: number, total: number) => void>; ultimo: [number, number] | null };
const gl = globalThis as unknown as { __leituras?: Map<string, Leitura> };
const emAndamento = (gl.__leituras ??= new Map());

export function lerCompartilhado(stage: string, onProgresso?: (feito: number, total: number) => void): Promise<DadosSpt> {
  let l = emAndamento.get(stage);
  if (!l) {
    const nova = { ouvintes: new Set(), ultimo: null } as unknown as Leitura;
    nova.promessa = buscarDados(stage, (f, t) => {
      nova.ultimo = [f, t];
      nova.ouvintes.forEach((o) => o(f, t));
    }).finally(() => emAndamento.delete(stage));
    emAndamento.set(stage, nova);
    l = nova;
  }
  if (onProgresso) {
    l.ouvintes.add(onProgresso);
    if (l.ultimo) onProgresso(l.ultimo[0], l.ultimo[1]);
  }
  return l.promessa;
}

export function guardar(e: Omit<Entrada, "em">) {
  const agora = Date.now();
  for (const [k, v] of mapa) if (agora - v.em > VALIDADE_MS) mapa.delete(k);
  mapa.set(chave(e.stage, e.origem, e.id.sha256, e.regras), { ...e, em: agora });
}

export function buscar(stage: string, sha: string, r: Regras, origem = "site"): Entrada | null {
  const e = mapa.get(chave(stage, origem, sha, r));
  return e && Date.now() - e.em <= VALIDADE_MS ? e : null;
}
