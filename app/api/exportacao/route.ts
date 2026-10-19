import { exportacaoXlsx } from "@/lib/excel";
import { carimbo, executar, respostaErro } from "@/lib/executar";

export const maxDuration = 60;

export async function GET(request: Request) {
  void request.url; // fora do try: no build, o Next interrompe aqui a pré-renderização (a rota é dinâmica)
  try {
    const { stage, dados, aud, id, mudou } = await executar(request);
    return new Response(new Uint8Array(await exportacaoXlsx(dados, aud, id)), {
      headers: {
        "X-Dados-Mudaram": mudou ? "1" : "0",
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="dados-${stage}-${carimbo()}.xlsx"`,
      },
    });
  } catch (e) {
    return respostaErro(e);
  }
}
