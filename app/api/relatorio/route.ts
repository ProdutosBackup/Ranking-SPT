import { ETAPAS_SLUGS } from "@/lib/consolidado-etapas";
import { relatorioXlsx, type EtapaAnterior } from "@/lib/excel";
import { carimbo, descreverErro, executar, respostaErro } from "@/lib/executar";

export const maxDuration = 60;

export async function GET(request: Request) {
  void request.url; // fora do try: no build, o Next interrompe aqui a pré-renderização (a rota é dinâmica)
  try {
    const { stage, regras, dados, aud, id, mudou } = await executar(request);
    // A aba Consolidado soma da Etapa 1 até a etapa escolhida: audita as anteriores aqui, com as mesmas regras (e, como na tela, cada uma com a sua origem).
    const k = (ETAPAS_SLUGS as readonly string[]).indexOf(stage);
    let anteriores: EtapaAnterior[] | string = [];
    if (k > 0) {
      try {
        anteriores = await Promise.all(
          ETAPAS_SLUGS.slice(0, k).map(async (s) => {
            const u = new URL(request.url);
            u.searchParams.set("stage", s);
            u.searchParams.delete("id");
            const e = await executar(new Request(u));
            return { stage: s, dados: e.dados, aud: e.aud, id: e.id, regras: e.regras };
          }),
        );
      } catch (e) {
        // Como na tela: o consolidado não sai, com o motivo; o resto do Relatório sai normalmente.
        anteriores = descreverErro(e).corpo.erro;
      }
    }
    return new Response(new Uint8Array(await relatorioXlsx(stage, dados, aud, regras, id, anteriores)), {
      headers: {
        "X-Dados-Mudaram": mudou ? "1" : "0",
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="relatorio-${stage}-${carimbo()}.xlsx"`,
      },
    });
  } catch (e) {
    return respostaErro(e);
  }
}
