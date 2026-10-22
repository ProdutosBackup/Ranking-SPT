// Imports relativos (não "@/"), para os testes importarem esta rota direto.
import { validarK } from "../../../lib/acordo";
import { armazenamentoAcordos, chaveAcordo, lerAcordos, MSG_SEM_ARMAZENAMENTO_ACORDOS, type Acordos } from "../../../lib/acordos";
import { executar, respostaErro } from "../../../lib/executar";

export const maxDuration = 60;

const falha = (e: unknown) => {
  if ((e as Error)?.message === MSG_SEM_ARMAZENAMENTO_ACORDOS) return Response.json({ erro: MSG_SEM_ARMAZENAMENTO_ACORDOS }, { status: 500 });
  return respostaErro(e);
};
const erro = (msg: string, status = 400) => Response.json({ erro: msg }, { status });
const SEM_STORE = { headers: { "Cache-Control": "no-store" } };

/** Lista os acordos (todos, ou só os de `?etapa=`). */
export async function GET(request: Request) {
  void request.url; // fora do try: no build, o Next interrompe aqui a pré-renderização (a rota é dinâmica)
  try {
    const etapa = new URL(request.url).searchParams.get("etapa");
    const todos = Object.values(await lerAcordos()).filter((a) => !etapa || a.etapa === etapa);
    return Response.json({ acordos: todos }, SEM_STORE);
  } catch (e) {
    return falha(e);
  }
}

/** Grava (ou troca) o acordo de um torneio: corpo { etapa, torneioId, k }. K (pontuam como qual colocação): inteiro, de 2 até o número de premiados do torneio. */
export async function PUT(request: Request) {
  try {
    const b = (await request.json().catch(() => null)) as { etapa?: unknown; torneioId?: unknown; k?: unknown } | null;
    if (!b || typeof b.etapa !== "string" || !b.etapa || typeof b.torneioId !== "string" || !b.torneioId) return erro("Informe a etapa, o torneio e a colocação do acordo.");
    // O número de premiados vem da própria auditoria da etapa (a mesma leitura e o mesmo cache das telas).
    const { aud } = await executar(new Request(`http://localhost/api/auditoria?stage=${encodeURIComponent(b.etapa)}`));
    const torneio = aud.torneios.find((t) => t.torneioId === b.torneioId);
    if (!torneio) return erro("Torneio não encontrado nesta etapa.");
    const msg = validarK(b.k, torneio.premiados);
    if (msg) return erro(msg);
    const todos = await lerAcordos();
    const acordo = { etapa: b.etapa, torneioId: b.torneioId, k: b.k as number, atualizadoEm: new Date().toISOString() };
    await armazenamentoAcordos().gravar({ ...todos, [chaveAcordo(b.etapa, b.torneioId)]: acordo });
    return Response.json({ acordo });
  } catch (e) {
    return falha(e);
  }
}

/** Remove o acordo de um torneio: `?etapa=...&torneioId=...`. Qualquer pessoa pode desfazer. */
export async function DELETE(request: Request) {
  try {
    const q = new URL(request.url).searchParams;
    const etapa = q.get("etapa");
    const torneioId = q.get("torneioId");
    if (!etapa || !torneioId) return erro("Informe a etapa e o torneio.");
    const todos = await lerAcordos();
    const chave = chaveAcordo(etapa, torneioId);
    const havia = chave in todos;
    if (havia) {
      const { [chave]: _, ...resto } = todos as Acordos;
      await armazenamentoAcordos().gravar(resto);
    }
    return Response.json({ removido: havia });
  } catch (e) {
    return falha(e);
  }
}
