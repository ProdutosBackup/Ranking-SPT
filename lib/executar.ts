import { ErroExtracao } from "./api-spt";
import { buscar, guardar, lerCompartilhado } from "./cache";
import { auditar } from "./auditoria";
import { conferir, ErroAuditoria, identificador } from "./integridade";
import { lerRegras } from "./regras";

class ErroParametro extends Error {}

/** Lê stage e opções da URL, busca os dados e audita. Usado pelas três rotas. */
export async function executar(request: Request, onProgresso?: (feito: number, total: number) => void) {
  const q = new URL(request.url).searchParams;
  const stage = q.get("stage");
  if (!stage) throw new ErroParametro("Escolha uma etapa.");
  let regras;
  try {
    regras = lerRegras(q);
  } catch (e) {
    throw new ErroParametro((e as Error).message);
  }
  // `id` = hash dos dados que o usuário viu na tela; se ainda estiver no cache, o arquivo sai do mesmo resultado.
  const idPedido = q.get("id");
  const guardado = idPedido ? buscar(stage, idPedido, regras) : null;
  if (guardado) return { ...guardado, mudou: false };
  const dados = await lerCompartilhado(stage, onProgresso);
  const aud = auditar(dados, regras);
  conferir(dados, regras, aud);
  const id = identificador(dados);
  guardar({ stage, regras, dados, aud, id });
  return { stage, regras, dados, aud, id, mudou: idPedido != null && idPedido !== id.sha256 };
}

export function descreverErro(e: unknown) {
  const status = e instanceof ErroParametro ? 400 : e instanceof ErroExtracao ? 502 : 500;
  const detalhes = e instanceof ErroAuditoria ? e.detalhes : undefined;
  const conhecido = e instanceof ErroParametro || e instanceof ErroExtracao || e instanceof ErroAuditoria;
  if (!conhecido) console.error(e);
  return { status, corpo: { erro: conhecido ? (e as Error).message : "Ocorreu um erro inesperado durante a auditoria. Tente novamente.", detalhes } };
}

export function respostaErro(e: unknown) {
  const { status, corpo } = descreverErro(e);
  return Response.json(corpo, { status });
}

/** AAAA-MM-DD-HHmm no fuso de Brasília. */
export function carimbo(d = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}`;
}
