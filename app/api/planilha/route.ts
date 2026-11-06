// Imports relativos (não "@/"), para os testes importarem esta rota direto.
import { armazenamento, ETAPA_PLANILHA, ETAPAS_COM_PLANILHA, MSG_SEM_ARMAZENAMENTO } from "../../../lib/armazenamento-planilha";
import { dadosDaPlanilha, enviarPlanilha, LIMITE_BYTES, lerRegistro, MSG_GRANDE } from "../../../lib/planilha-guardada";

export const maxDuration = 60;

/** Etapa pedida em `?etapa=` (padrão: a Etapa 3); null se não for uma etapa conhecida. */
const etapaDe = (request?: Request) => {
  const e = (request ? new URL(request.url).searchParams.get("etapa") : null) ?? ETAPA_PLANILHA;
  return (ETAPAS_COM_PLANILHA as readonly string[]).includes(e) ? e : null;
};
const MSG_ETAPA = "Etapa desconhecida.";

const MSG_FALHA = "Não foi possível concluir a operação com a planilha. Tente novamente.";

function falha(e: unknown) {
  const msg = e instanceof Error && e.message === MSG_SEM_ARMAZENAMENTO ? MSG_SEM_ARMAZENAMENTO : MSG_FALHA;
  if (msg === MSG_FALHA) console.error(e);
  return Response.json({ erro: msg }, { status: 500 });
}

/** Estado da planilha guardada da etapa (`?etapa=`, padrão a 3ª): carregada ou não, arquivo, data, resumo, avisos e de onde vêm os inscritos do Dia Final. */
export async function GET(request?: Request) {
  const etapa = etapaDe(request); // fora do try: no build, o Next interrompe aqui a pré-renderização (a rota é dinâmica)
  if (!etapa) return Response.json({ erro: MSG_ETAPA }, { status: 400 });
  try {
    const guardada = await armazenamento().ler(etapa);
    if (!guardada) return Response.json({ carregada: false }, { headers: { "Cache-Control": "no-store" } });
    const { registro } = guardada;
    const dados = etapa === ETAPA_PLANILHA ? await dadosDaPlanilha(guardada.bytes, registro).catch(() => null) : null;
    return Response.json(
      {
        carregada: true,
        etapa,
        arquivo: registro.arquivo,
        enviadoEm: registro.enviadoEm,
        tamanho: registro.tamanho,
        sha256: registro.sha256,
        resumo: { ...registro.resumo, inscritosDiaFinal: dados?.origem.inscritosDiaFinal ?? null },
        avisos: registro.avisos,
        acoes: registro.acoes ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return falha(e);
  }
}

/** Envia (ou substitui) a planilha: multipart com o campo "arquivo" e, opcionalmente, "inscritosDiaFinal". */
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

    let inscritos: number | null = null;
    const bruto = form.get("inscritosDiaFinal");
    if (typeof bruto === "string" && bruto.trim() !== "") {
      inscritos = Number(bruto.trim());
      if (!Number.isInteger(inscritos) || inscritos < 1) return Response.json({ erro: "Os inscritos do Dia Final devem ser um número inteiro maior que zero." }, { status: 400 });
    }

    const r = await enviarPlanilha(new Uint8Array(await arquivo.arrayBuffer()), arquivo.name, inscritos);
    if (!r.ok) return Response.json({ erro: r.erros.join(" "), erros: r.erros, avisos: r.avisos }, { status: 400 });
    return Response.json({ carregada: true, etapa: r.etapa, acoes: r.registro.acoes ?? null, arquivo: r.registro.arquivo, enviadoEm: r.registro.enviadoEm, tamanho: r.registro.tamanho, sha256: r.registro.sha256, resumo: r.registro.resumo, avisos: r.registro.avisos });
  } catch (e) {
    return falha(e);
  }
}

/** Remove a planilha da etapa (`?etapa=`, padrão a 3ª): a etapa volta a ser lida só do site. */
export async function DELETE(request?: Request) {
  const etapa = etapaDe(request);
  if (!etapa) return Response.json({ erro: MSG_ETAPA }, { status: 400 });
  try {
    const havia = (await lerRegistro(etapa)) != null;
    await armazenamento().remover(etapa);
    return Response.json({ carregada: false, removida: havia });
  } catch (e) {
    return falha(e);
  }
}
