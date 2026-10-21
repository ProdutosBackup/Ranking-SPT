// Acordo (decisão do usuário em 21/10/2026): os N jogadores que restam na mesa dividem igualmente os pontos das posições 1 a N.
// Funções puras, usadas pelo motor, pelas rotas e pelos testes. O armazenamento fica em lib/acordos.ts.

/** Textos do acordo, usados pela tela e pelos arquivos Excel (a tela os importa por app/components/estrutura.ts). */
export const ACORDO = {
  rotulo: "Acordo",
  pergunta: "Acordo entre quantas pessoas?",
  aplicar: "Aplicar",
  desfazer: "Desfazer o acordo para todos?",
  sim: "Sim",
  nao: "Não",
  contaTitulo: "Conta com acordo",
  soma: "Soma",
  aviso: (n: number) => `Este torneio tem acordo entre ${n} pessoas`,
  torneio: (n: number) => `Acordo: ${n} pessoas`,
  faixa: (qtd: number) => `Acordos aplicados: ${qtd} torneio(s)`,
  causa: (n: number, valor: string) => `Acordo entre ${n} jogadores: cada um recebe ${valor}`,
} as const;

/** Divide a soma (em centésimos) entre N, arredondando a 2 casas, metade para cima: o mesmo valor para os N. */
export const dividirAcordo = (somaCent: number, n: number) => Math.floor((2 * somaCent + n) / (2 * n));

/** Assinatura estável dos acordos de uma etapa (`torneioId → N`); vazia se não houver. Entra no identificador e na chave do cache. */
export const assinaturaAcordos = (m: Record<string, number>) =>
  Object.entries(m)
    .filter(([, n]) => n >= 2)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([id, n]) => `${id}:${n}`)
    .join(",");

/** Valida N: inteiro, de 2 até o número de premiados do torneio. Devolve a mensagem de erro, ou null se estiver certo. */
export function validarN(n: unknown, premiados: number): string | null {
  if (typeof n !== "number" || !Number.isInteger(n)) return "O número de pessoas do acordo deve ser um número inteiro.";
  if (n < 2) return "O acordo é entre 2 ou mais pessoas.";
  if (premiados < 2) return "Este torneio tem menos de 2 premiados, então não dá para fazer acordo.";
  if (n > premiados) return `O acordo não pode ter mais pessoas do que premiados: este torneio tem ${premiados}.`;
  return null;
}

/** Uma posição de 1 a N na conta do acordo. */
export type PassoAcordo = { posicao: number; conta: string; cent: number };
export type ContaAcordo = { n: number; passos: PassoAcordo[]; somaCent: number; valorCent: number };
