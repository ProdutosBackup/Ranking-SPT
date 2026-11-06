import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { get, put } from "@vercel/blob";
import type { Cancelados } from "./cancelado";
import { MSG_SEM_ARMAZENAMENTO_CANCELADOS, soValidos } from "./cancelado";

// Torneio cancelado: guardado para todos (sem login), no mesmo estilo do acordo: Blob privado em produção, pasta local em desenvolvimento.
// Os textos e as funções puras ficam em lib/cancelado.ts; aqui eles são reexportados.
export * from "./cancelado";

// ---------- armazenamento ----------
export interface ArmazenamentoCancelados {
  ler(): Promise<Cancelados>;
  gravar(cancelados: Cancelados): Promise<void>;
}

export class CanceladosLocal implements ArmazenamentoCancelados {
  constructor(private pasta = process.env.CANCELADOS_LOCAL_DIR || join(process.cwd(), ".cancelados-local")) {}
  async ler() {
    try {
      return JSON.parse(await readFile(join(this.pasta, "cancelados.json"), "utf8")) as Cancelados;
    } catch {
      return {};
    }
  }
  async gravar(cancelados: Cancelados) {
    await mkdir(this.pasta, { recursive: true });
    await writeFile(join(this.pasta, "cancelados.json"), JSON.stringify(cancelados));
  }
}

const CAMINHO = "cancelados/cancelados.json";
export class CanceladosBlob implements ArmazenamentoCancelados {
  async ler() {
    const r = await get(CAMINHO, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) return {};
    return JSON.parse(new TextDecoder().decode(new Uint8Array(await new Response(r.stream).arrayBuffer()))) as Cancelados;
  }
  async gravar(cancelados: Cancelados) {
    await put(CAMINHO, JSON.stringify(cancelados), { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json" });
  }
}

let substituto: ArmazenamentoCancelados | null = null;
/** Só para testes. */
export const trocarArmazenamentoCancelados = (a: ArmazenamentoCancelados | null) => (substituto = a);

export function armazenamentoCancelados(): ArmazenamentoCancelados {
  if (substituto) return substituto;
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) return new CanceladosBlob();
  if (process.env.VERCEL) {
    return {
      ler: async () => {
        throw new Error(MSG_SEM_ARMAZENAMENTO_CANCELADOS);
      },
      gravar: async () => {
        throw new Error(MSG_SEM_ARMAZENAMENTO_CANCELADOS);
      },
    };
  }
  return new CanceladosLocal();
}

/** Lê os cancelamentos para a auditoria; se o armazenamento não estiver configurado, não há cancelamentos. */
export async function lerCancelados(): Promise<Cancelados> {
  try {
    return soValidos(await armazenamentoCancelados().ler());
  } catch (e) {
    if ((e as Error).message === MSG_SEM_ARMAZENAMENTO_CANCELADOS) return {};
    throw e;
  }
}
