// Imports relativos (não "@/"), para os testes importarem esta rota direto.
import {
  armazenamentoCancelados,
  chaveRegistro,
  lerCancelados,
  MSG_CANCELADO_DADOS,
  MSG_CANCELADO_NAO_ACHADO,
  MSG_SEM_ARMAZENAMENTO_CANCELADOS,
  validarCancelamento,
  type Cancelados,
} from "../../../lib/cancelados";
import { executar, respostaErro } from "../../../lib/executar";

export const maxDuration = 60;

const falha = (e: unknown) => {
  if ((e as Error)?.message === MSG_SEM_ARMAZENAMENTO_CANCELADOS) return Response.json({ erro: MSG_SEM_ARMAZENAMENTO_CANCELADOS }, { status: 500 });
  return respostaErro(e);
};
const erro = (msg: string, status = 400) => Response.json({ erro: msg }, { status });
const SEM_STORE = { headers: { "Cache-Control": "no-store" } };

/** Lista os torneios cancelados (todos, ou só os de `?etapa=`). */
export async function GET(request: Request) {
  void request.url; // fora do try: no build, o Next interrompe aqui a pré-renderização (a rota é dinâmica)
  try {
    const etapa = new URL(request.url).searchParams.get("etapa");
    const todos = Object.values(await lerCancelados()).filter((c) => !etapa || c.etapa === etapa);
    return Response.json({ cancelados: todos }, SEM_STORE);
  } catch (e) {
    return falha(e);
  }
}

/** Marca um torneio como cancelado: corpo { etapa, chave }. A chave é a de `painel.torneios[].chaveCancelamento` (a mesma leitura e o mesmo cache das telas). */
export async function PUT(request: Request) {
  try {
    const b = (await request.json().catch(() => null)) as { etapa?: unknown; chave?: unknown } | null;
    const msg = validarCancelamento(b);
    if (msg) return erro(msg);
    const { etapa, chave } = b as { etapa: string; chave: string };
    const { aud } = await executar(new Request(`http://localhost/api/auditoria?stage=${encodeURIComponent(etapa)}`));
    const torneio = aud.torneios.find((t) => t.chaveCancelamento === chave);
    if (!torneio) return erro(MSG_CANCELADO_NAO_ACHADO);
    const todos = await lerCancelados();
    const registro = { etapa, chave, nome: torneio.torneio, atualizadoEm: new Date().toISOString() };
    await armazenamentoCancelados().gravar({ ...todos, [chaveRegistro(etapa, chave)]: registro });
    return Response.json({ cancelado: registro });
  } catch (e) {
    return falha(e);
  }
}

/** Reativa o torneio (tira a marca de cancelado): `?etapa=...&chave=...`. Qualquer pessoa pode desfazer. */
export async function DELETE(request: Request) {
  try {
    const q = new URL(request.url).searchParams;
    const etapa = q.get("etapa");
    const chave = q.get("chave");
    if (!etapa || !chave) return erro(MSG_CANCELADO_DADOS);
    const todos = await lerCancelados();
    const k = chaveRegistro(etapa, chave);
    const havia = k in todos;
    if (havia) {
      const { [k]: _, ...resto } = todos as Cancelados;
      await armazenamentoCancelados().gravar(resto);
    }
    return Response.json({ removido: havia });
  } catch (e) {
    return falha(e);
  }
}
