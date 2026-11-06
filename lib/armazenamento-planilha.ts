import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { del, get, put } from "@vercel/blob";
import type { ResumoPlanilha } from "./planilha";

/** A Etapa 3: a planilha dela traz os resultados (as Etapas 1 e 2 só guardam a planilha de ações). Mantém os nomes de arquivo antigos. */
export const ETAPA_PLANILHA = "bendito-cacao-2026";
/** Etapas que aceitam planilha: uma por etapa. */
export const ETAPAS_COM_PLANILHA = ["taua-2026", "vale-suico-2026", "bendito-cacao-2026"] as const;

/** O que se guarda junto com os bytes originais do .xlsx. */
export type Registro = {
  arquivo: string;
  enviadoEm: string;
  tamanho: number;
  sha256: string;
  /** Inscritos do Dia Final informados no envio (opcional). */
  inscritosDiaFinal: number | null;
  resumo: ResumoPlanilha;
  avisos: string[];
  /** Etapas 1 e 2 (planilha só de ações): o que casou com os torneios do site no envio. */
  acoes?: ResumoAcoes;
};

export type ResumoAcoes = { abas: number; casadas: number; abasSemTorneio: string[]; torneiosSemAba: string[]; ambiguos: string[] };

/** Armazenamento compartilhado: uma planilha por etapa (sem `etapa`, a da Etapa 3). */
export interface Armazenamento {
  salvar(bytes: Uint8Array, registro: Registro, etapa?: string): Promise<void>;
  ler(etapa?: string): Promise<{ bytes: Uint8Array; registro: Registro } | null>;
  estado(etapa?: string): Promise<Registro | null>;
  remover(etapa?: string): Promise<void>;
}

export const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export const MSG_SEM_ARMAZENAMENTO = "O armazenamento da planilha não está configurado neste ambiente (falta o Vercel Blob).";
const MSG_INCONSISTENTE = "A planilha guardada está sendo atualizada agora. Tente novamente em instantes.";

// ---------- pasta local (desenvolvimento) ----------
export class ArmazenamentoLocal implements Armazenamento {
  constructor(private pasta = process.env.PLANILHA_LOCAL_DIR || join(process.cwd(), ".planilha-local")) {}
  // A Etapa 3 mantém os nomes antigos (planilha.xlsx e registro.json); as outras usam o slug da etapa.
  private xlsx = (e: string) => join(this.pasta, e === ETAPA_PLANILHA ? "planilha.xlsx" : `planilha-${e}.xlsx`);
  private json = (e: string) => join(this.pasta, e === ETAPA_PLANILHA ? "registro.json" : `registro-${e}.json`);

  async salvar(bytes: Uint8Array, registro: Registro, etapa = ETAPA_PLANILHA) {
    await mkdir(this.pasta, { recursive: true });
    await writeFile(this.xlsx(etapa), bytes);
    await writeFile(this.json(etapa), JSON.stringify(registro)); // o registro vem por último: é ele que "confirma" o envio
  }
  async estado(etapa = ETAPA_PLANILHA) {
    try {
      return JSON.parse(await readFile(this.json(etapa), "utf8")) as Registro;
    } catch {
      return null;
    }
  }
  async ler(etapa = ETAPA_PLANILHA) {
    const registro = await this.estado(etapa);
    if (!registro) return null;
    try {
      const bytes = new Uint8Array(await readFile(this.xlsx(etapa)));
      if (sha256(bytes) !== registro.sha256) throw new Error(MSG_INCONSISTENTE);
      return { bytes, registro };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  async remover(etapa = ETAPA_PLANILHA) {
    await rm(this.json(etapa), { force: true }); // registro primeiro: o estado passa a "sem planilha" de imediato
    await rm(this.xlsx(etapa), { force: true });
  }
}

// ---------- Vercel Blob (produção) ----------
// Exige um Blob store privado ligado ao projeto; a Vercel cria BLOB_READ_WRITE_TOKEN (ou usa OIDC com BLOB_STORE_ID).
const CAMINHO_XLSX = (etapa: string) => `planilha/${etapa}.xlsx`;
const CAMINHO_JSON = (etapa: string) => `planilha/${etapa}.json`;

async function lerBlob(caminho: string) {
  const r = await get(caminho, { access: "private", useCache: false }); // useCache: false → sempre a versão mais recente
  if (!r || r.statusCode !== 200 || !r.stream) return null;
  return new Uint8Array(await new Response(r.stream).arrayBuffer());
}

export class ArmazenamentoBlob implements Armazenamento {
  async salvar(bytes: Uint8Array, registro: Registro, etapa = ETAPA_PLANILHA) {
    const opcoes = { access: "private", allowOverwrite: true, addRandomSuffix: false } as const;
    await put(CAMINHO_XLSX(etapa), Buffer.from(bytes), { ...opcoes, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    await put(CAMINHO_JSON(etapa), JSON.stringify(registro), { ...opcoes, contentType: "application/json" }); // por último: confirma o envio
  }
  async estado(etapa = ETAPA_PLANILHA) {
    const b = await lerBlob(CAMINHO_JSON(etapa));
    return b ? (JSON.parse(new TextDecoder().decode(b)) as Registro) : null;
  }
  async ler(etapa = ETAPA_PLANILHA) {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const registro = await this.estado(etapa);
      if (!registro) return null;
      const bytes = await lerBlob(CAMINHO_XLSX(etapa));
      if (bytes && sha256(bytes) === registro.sha256) return { bytes, registro };
    }
    throw new Error(MSG_INCONSISTENTE);
  }
  async remover(etapa = ETAPA_PLANILHA) {
    await del(CAMINHO_JSON(etapa));
    await del(CAMINHO_XLSX(etapa));
  }
}

class NaoConfigurado implements Armazenamento {
  private falha = (): never => {
    throw new Error(MSG_SEM_ARMAZENAMENTO);
  };
  salvar = async () => this.falha();
  ler = async () => this.falha();
  estado = async () => this.falha();
  remover = async () => this.falha();
}

// ---------- escolha ----------
let substituto: Armazenamento | null = null;
/** Só para testes. */
export const trocarArmazenamento = (a: Armazenamento | null) => (substituto = a);

export function armazenamento(): Armazenamento {
  if (substituto) return substituto;
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) return new ArmazenamentoBlob();
  if (process.env.VERCEL) return new NaoConfigurado(); // na Vercel o disco é só leitura e não é compartilhado
  return new ArmazenamentoLocal();
}
