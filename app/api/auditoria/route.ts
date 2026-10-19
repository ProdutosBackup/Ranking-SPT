import { descreverErro, executar } from "@/lib/executar";
import { montarResposta } from "@/lib/painel";

export const maxDuration = 60;

async function rodar(request: Request, onProgresso?: (feito: number, total: number) => void) {
  const { stage, regras, dados, aud, id } = await executar(request, onProgresso);
  return montarResposta(stage, dados, regras, aud, id);
}

// Com ?progresso=1 a resposta vem em linhas JSON: {"progresso":[feitos,total]} e, no fim, {"resultado":...} ou {"erro":...}.
export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get("progresso") !== "1") {
    try {
      return Response.json(await rodar(request));
    } catch (e) {
      const { status, corpo } = descreverErro(e);
      return Response.json(corpo, { status });
    }
  }
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      async start(c) {
        const linha = (o: unknown) => c.enqueue(enc.encode(JSON.stringify(o) + "\n"));
        try {
          linha({ resultado: await rodar(request, (f, t) => linha({ progresso: [f, t] })) });
        } catch (e) {
          linha({ erro: descreverErro(e).corpo });
        }
        c.close();
      },
    }),
    { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } },
  );
}
