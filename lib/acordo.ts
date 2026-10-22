// Acordo (decisão do usuário em 21/10/2026, substitui a divisão igual da soma das posições 1 a N): os jogadores das posições 1 a K
// pontuam todos como o Kº colocado (base da colocação K × fatores). N, o número de pessoas no acordo, é sempre igual a K.
// Funções puras, usadas pelo motor, pelas rotas e pelos testes. O armazenamento fica em lib/acordos.ts.

/** Textos do acordo, usados pela tela e pelos arquivos Excel (a tela os importa por app/components/estrutura.ts). */
export const ACORDO = {
  rotulo: "Acordo",
  caixa: "Houve acordo neste torneio",
  pergunta: "Pontuam como qual colocação?",
  aplicar: "Aplicar",
  remover: "Remover acordo",
  confirmar: "Remover o acordo deste torneio para todos?",
  confirmarSim: "Remover",
  confirmarNao: "Cancelar",
  dica: (premiados: number) => `De 2 a ${premiados} (premiados do torneio)`,
  resumo: (k: number) => `Acordo: os ${k} primeiros pontuam como ${k}º colocado`,
  aviso: (k: number) => `Este torneio tem acordo: os ${k} primeiros pontuam como ${k}º colocado`,
  conta: (k: number) => `Acordo: pontua como ${k}º colocado`,
  marca: (k: number) => `Os ${k} primeiros, como ${k}º colocado`,
  torneio: (k: number) => `Acordo: os ${k} primeiros, como ${k}º colocado`,
  faixa: (qtd: number) => `Acordos aplicados: ${qtd} torneio(s)`,
  causa: (k: number, valor: string) => `Acordo: os ${k} primeiros pontuam como ${k}º colocado, ${valor} cada`,
} as const;

/** Assinatura estável dos acordos de uma etapa (`torneioId → K`); vazia se não houver. Entra no identificador e na chave do cache. */
export const assinaturaAcordos = (m: Record<string, number>) =>
  Object.entries(m)
    .filter(([, k]) => k >= 2)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([id, k]) => `${id}:k${k}`)
    .join(",");

/** Valida K: inteiro, de 2 até o número de premiados do torneio. Devolve a mensagem de erro, ou null se estiver certo. */
export function validarK(k: unknown, premiados: number): string | null {
  if (typeof k !== "number" || !Number.isInteger(k)) return "Informe a colocação como um número inteiro.";
  if (premiados < 2) return "Este torneio tem menos de 2 premiados, então não dá para fazer acordo.";
  if (k < 2) return "A colocação do acordo vai de 2 para cima.";
  if (k > premiados) return `A colocação não pode passar dos premiados: este torneio tem ${premiados}.`;
  return null;
}
