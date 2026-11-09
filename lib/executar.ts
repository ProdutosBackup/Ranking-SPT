import { assinaturaAcordos } from "./acordo";
import { acordosDaEtapa, lerAcordos } from "./acordos";
import { ErroExtracao } from "./api-spt";
import { armazenamento, ETAPA_PLANILHA } from "./armazenamento-planilha";
import { assinaturaCancelados, canceladosDaEtapa, lerCancelados } from "./cancelados";
import { buscar, guardar, lerCompartilhado } from "./cache";
import { auditar } from "./auditoria";
import { conferir, ErroAuditoria, identificador } from "./integridade";
import { lerParticipantes } from "./participantes-armazenamento";
import { lerAcoes, mesclarAcoes } from "./planilha-acoes";
import { dadosDaPlanilha, lerRegistro } from "./planilha-guardada";
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
  // A Etapa 3 usa a planilha guardada, enquanto ela existir. A chave do cache inclui a origem e o SHA-256 da planilha,
  // então um novo envio ou uma remoção nunca devolve dados antigos.
  // Acordos da etapa (guardados para todos): entram no identificador dos dados e na chave do cache, então mudar um acordo invalida o cache.
  const acordos = acordosDaEtapa(await lerAcordos(), stage);
  // Torneios cancelados pelo usuário (também guardados para todos): entram no identificador e na chave do cache do mesmo jeito.
  const cancelados = canceladosDaEtapa(await lerCancelados(), stage);
  const sufixo = (assinaturaAcordos(acordos) ? `|acordos:${assinaturaAcordos(acordos)}` : "") + (cancelados.length ? `|cancelados:${assinaturaCancelados(cancelados)}` : "");
  const idPedido = q.get("id");
  const registro = stage === ETAPA_PLANILHA ? await lerRegistro() : null;
  // Etapas 1 e 2: a planilha (se houver) só traz os buy-ins e re-entries; o hash dela entra na chave do cache.
  const registroAcoes = stage !== ETAPA_PLANILHA ? await lerRegistro(stage) : null;
  // Etapas 2 e 3: os totais da planilha de participantes do Main Event (entradas + reentradas) são o campo de C e D nas linhas do Main Event. Sem totais, nada muda.
  const numEtapa = stage === "vale-suico-2026" ? 2 : stage === ETAPA_PLANILHA ? 3 : null;
  const participantes = numEtapa ? await lerParticipantes() : null;
  const sufixoAcoes = (registroAcoes ? `|acoes:${registroAcoes.sha256}` : "") + (participantes ? `|participantes:${participantes.chave}` : "");
  const guardado = idPedido ? buscar(stage, idPedido, regras, (registro ? `planilha:${registro.sha256}` : "site") + sufixoAcoes + sufixo) : null;
  if (guardado) return { ...guardado, mudou: false };
  let dados;
  let origem = "site";
  const planilha = registro ? await armazenamento().ler() : null;
  if (planilha) {
    dados = await dadosDaPlanilha(planilha.bytes, planilha.registro);
    origem = `planilha:${planilha.registro.sha256}`;
    onProgresso?.(dados.jogadores.length, dados.jogadores.length);
  } else {
    dados = await lerCompartilhado(stage, onProgresso);
    const guardada = registroAcoes ? await armazenamento().ler(stage) : null;
    const acoes = guardada ? await lerAcoes(guardada.bytes) : null;
    if (acoes && !acoes.ok) throw new ErroExtracao(`A planilha guardada da etapa não pôde ser lida: ${acoes.erros.join(" ")}`);
    if (acoes) dados = mesclarAcoes(dados, acoes).dados;
  }
  if (numEtapa && participantes) dados = { ...dados, acoesMainEvent: participantes.totais[numEtapa].entradas };
  const aud = auditar(dados, regras, acordos, cancelados);
  conferir(dados, regras, aud, acordos, cancelados);
  const id = identificador(dados, acordos, cancelados);
  guardar({ stage, origem: origem + sufixoAcoes + sufixo, regras, dados, aud, id });
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
