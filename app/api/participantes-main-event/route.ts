// Imports relativos (não "@/"), para os testes importarem esta rota direto.
import { lerParticipantesMainEvent } from "../../../lib/participantes-main-event";
import { lerParticipantes, MSG_SEM_ARMAZENAMENTO, removerParticipantes, salvarParticipantes } from "../../../lib/participantes-armazenamento";
import { LIMITE_BYTES, MSG_GRANDE } from "../../../lib/planilha-guardada";

export const maxDuration = 60;

const MSG_FALHA = "Não foi possível concluir a operação com a planilha. Tente novamente.";

function falha(e: unknown) {
  const msg = e instanceof Error && e.message === MSG_SEM_ARMAZENAMENTO ? MSG_SEM_ARMAZENAMENTO : MSG_FALHA;
  if (msg === MSG_FALHA) console.error(e);
  return Response.json({ erro: msg }, { status: 500 });
}

/** Totais guardados por etapa (entradas e jogadores), ou { carregada: false }. Nunca devolve nomes: eles não são guardados. */
export async function GET() {
  try {
    const g = await lerParticipantes();
    if (!g) return Response.json({ carregada: false }, { headers: { "Cache-Control": "no-store" } });
    return Response.json({ carregada: true, etapas: g.totais, enviadoEm: g.enviadoEm, chave: g.chave }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return falha(e);
  }
}

/** Envia a planilha (multipart, campo "arquivo"): lê, guarda só os totais e descarta o arquivo. Com erro de leitura, 400 e nada é guardado. */
export async function POST(request: Request) {
  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return Response.json({ erro: 'Envie a planilha como formulário, no campo "arquivo".' }, { status: 400 });
    }
    const arquivo = form.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size === 0) return Response.json({ erro: 'Escolha um arquivo .xlsx no campo "arquivo".' }, { status: 400 });
    if (arquivo.size > LIMITE_BYTES) return Response.json({ erro: MSG_GRANDE }, { status: 400 });

    const lida = await lerParticipantesMainEvent(new Uint8Array(await arquivo.arrayBuffer()));
    if (!lida.ok) return Response.json({ erro: lida.erros.join(" "), erros: lida.erros }, { status: 400 });
    const g = await salvarParticipantes(lida.etapas);
    return Response.json({ carregada: true, etapas: g.totais, enviadoEm: g.enviadoEm, chave: g.chave });
  } catch (e) {
    return falha(e);
  }
}

/** Remove os totais guardados. */
export async function DELETE() {
  try {
    const { havia } = await removerParticipantes();
    return Response.json({ carregada: false, removida: havia });
  } catch (e) {
    return falha(e);
  }
}
