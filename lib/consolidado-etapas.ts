// Mapeamento do resultado de uma etapa auditada (a resposta de montarResposta, a mesma que a tela recebe de /api/auditoria) para a entrada do consolidar().
// Usado pela tela (app/page.tsx) e pela rota do Relatório: uma cópia só.
import type { EtapaConsolidado } from "./consolidado";
import type { Cenario } from "./regras";

/** As três etapas, em ordem: o Consolidado soma da primeira até a escolhida. */
export const ETAPAS_SLUGS = ["taua-2026", "vale-suico-2026", "bendito-cacao-2026"] as const;

/** O que o consolidar() precisa de uma etapa auditada (a resposta do servidor e o tipo da tela cabem aqui). */
export type RespostaConsolidavel = {
  painel: { jogadores: { nome: string; id?: string | null }[] };
  linhas: {
    jogador: string;
    posicaoPontua: number | null;
    esperado: number;
    classe: string;
    participacao: boolean;
    acordo: number | null;
    registradoCent: number;
    cenarios: Partial<Record<Cenario, number | null>>;
    cenariosMotivo: string | null;
  }[];
};

export const etapaParaConsolidar = (numero: number, d: RespostaConsolidavel): EtapaConsolidado => ({
  numero,
  jogadores: d.painel.jogadores.map((j) => ({ nome: j.nome, id: j.id })),
  // `posicao` é a posição que deu a pontuação (no primeiro flight de quem chegou ao Dia Final, a do Dia Final): é por ela que o 1º lugar conta no desempate.
  linhas: d.linhas.map((l) => ({ jogador: l.jogador, posicao: l.posicaoPontua, esperadoCent: Math.round(l.esperado * 100), aguarda: l.classe === "aguarda", participacao: l.participacao, acordo: l.acordo != null, registradoCent: l.registradoCent, cenarios: l.cenarios, cenariosMotivo: l.cenariosMotivo })),
});
