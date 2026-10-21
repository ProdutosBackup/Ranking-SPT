import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { get, put } from "@vercel/blob";

// Acordo: os N jogadores que restam na mesa dividem igualmente os pontos das posições 1 a N.
// Guardado para todos (sem login), no mesmo estilo do armazenamento da planilha: Blob privado em produção, pasta local em desenvolvimento.

export type Acordo = { etapa: string; torneioId: string; n: number; atualizadoEm: string };
/** Todos os acordos, por chave `etapa|torneioId` (a chave estável de torneio usada na tela e no cache). */
export type Acordos = Record<string, Acordo>;

export const chaveAcordo = (etapa: string, torneioId: string) => `${etapa}|${torneioId}`;
export const MSG_SEM_ARMAZENAMENTO_ACORDOS = "O armazenamento dos acordos não está configurado neste ambiente (falta o Vercel Blob).";

/** Acordos de uma etapa, como `torneioId → N`, o formato que o motor usa. */
export function acordosDaEtapa(todos: Acordos, etapa: string): Record<string, number> {
  return Object.fromEntries(Object.values(todos).filter((a) => a.etapa === etapa).map((a) => [a.torneioId, a.n]));
}

export { assinaturaAcordos, dividirAcordo, validarN } from "./acordo";

// ---------- armazenamento ----------
export interface ArmazenamentoAcordos {
  ler(): Promise<Acordos>;
  gravar(acordos: Acordos): Promise<void>;
}

export class AcordosLocal implements ArmazenamentoAcordos {
  constructor(private pasta = join(process.cwd(), ".acordos-local")) {}
  async ler() {
    try {
      return JSON.parse(await readFile(join(this.pasta, "acordos.json"), "utf8")) as Acordos;
    } catch {
      return {};
    }
  }
  async gravar(acordos: Acordos) {
    await mkdir(this.pasta, { recursive: true });
    await writeFile(join(this.pasta, "acordos.json"), JSON.stringify(acordos));
  }
}

const CAMINHO = "acordos/acordos.json";
export class AcordosBlob implements ArmazenamentoAcordos {
  async ler() {
    const r = await get(CAMINHO, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) return {};
    return JSON.parse(new TextDecoder().decode(new Uint8Array(await new Response(r.stream).arrayBuffer()))) as Acordos;
  }
  async gravar(acordos: Acordos) {
    await put(CAMINHO, JSON.stringify(acordos), { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json" });
  }
}

let substituto: ArmazenamentoAcordos | null = null;
/** Só para testes. */
export const trocarArmazenamentoAcordos = (a: ArmazenamentoAcordos | null) => (substituto = a);

export function armazenamentoAcordos(): ArmazenamentoAcordos {
  if (substituto) return substituto;
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) return new AcordosBlob();
  if (process.env.VERCEL) {
    return {
      ler: async () => {
        throw new Error(MSG_SEM_ARMAZENAMENTO_ACORDOS);
      },
      gravar: async () => {
        throw new Error(MSG_SEM_ARMAZENAMENTO_ACORDOS);
      },
    };
  }
  return new AcordosLocal();
}

/** Lê os acordos para a auditoria; se o armazenamento não estiver configurado, não há acordos. */
export async function lerAcordos(): Promise<Acordos> {
  try {
    return await armazenamentoAcordos().ler();
  } catch (e) {
    if ((e as Error).message === MSG_SEM_ARMAZENAMENTO_ACORDOS) return {};
    throw e;
  }
}
