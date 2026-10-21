import type { Resposta } from "./tipos";

export type LeituraAuditoria = { resultado?: Resposta; erro?: { erro?: string; detalhes?: unknown[] }; semServidor?: boolean };

/** Chama /api/auditoria (a mesma rota da tela) e devolve o resultado ou o erro, sem mexer na tela. */
export async function lerAuditoria(params: string, onProgresso?: (feito: number, total: number) => void): Promise<LeituraAuditoria> {
  try {
    const r = await fetch(`/api/auditoria?${params}&progresso=1`);
    if (!r.body) return { semServidor: true };
    const leitor = r.body.getReader();
    const dec = new TextDecoder();
    let resto = "";
    let saida: LeituraAuditoria = {};
    for (let fim = false; !fim; ) {
      const { value, done } = await leitor.read();
      resto += dec.decode(value, { stream: !done });
      const partes = resto.split("\n");
      resto = done ? "" : partes.pop()!;
      for (const txt of partes.filter(Boolean)) {
        const m = JSON.parse(txt);
        if (m.progresso) onProgresso?.(m.progresso[0], m.progresso[1]);
        else if (m.resultado) saida = { resultado: m.resultado };
        else if (m.erro) saida = { erro: m.erro };
      }
      fim = done;
    }
    return saida;
  } catch {
    return { semServidor: true };
  }
}
