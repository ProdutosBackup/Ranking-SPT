/**
 * Premiados da Etapa 3 [CONFIRMADO 05/11/2026, docs/compendio.md seção 6.5]: a planilha da Etapa 3 não traz prêmio nem nº de premiados,
 * e este é o número informado pelo responsável do ranking. Vale no lugar da inferência "premiado = pontos diferentes de 10".
 * É só dado: o motor (auditoria.ts) e o verificador (verificador.ts) usam esta tabela, cada um com a sua própria lógica de leitura.
 * `aba` é o nome da aba da planilha.
 */
export const PREMIADOS_ETAPA3: readonly { aba: string; premiados: number }[] = [
  { aba: "Main Event SPT - Dia Final", premiados: 64 },
  { aba: "200K OMAHA 5 K.O", premiados: 11 },
  { aba: "HORSE", premiados: 3 },
  { aba: "SUPER K.O", premiados: 6 },
  { aba: "8 GAME", premiados: 4 },
  { aba: "100K OMAHA MYSTERY BOUNTY", premiados: 8 },
  { aba: "CHAMPIONSHIP HIGH ROLLER 200K", premiados: 10 },
  { aba: "PLO-NLH DEALER´S CHOICE PIJAMA", premiados: 4 },
  { aba: "SECOND CHANCE", premiados: 20 },
  { aba: "HIGH ROLLER 50K", premiados: 9 },
  { aba: "OMAHA DEALER´S CHOICE", premiados: 7 },
];

/** Chave de comparação dos nomes: sem maiúsculas, acentos, apóstrofos (´ ` ' ’), hífen e barra ("PLO-NLH" na planilha é "PLO/NLH" na API). */
export const chaveTorneio = (nome: string): string =>
  nome
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[´`'’]/g, "")
    .replace(/[-–—/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Nº de premiados da lista para o torneio, ou null se o nome não está na tabela. */
export const premiadosDaLista = (nome: string): number | null => {
  const k = chaveTorneio(nome);
  return PREMIADOS_ETAPA3.find((x) => chaveTorneio(x.aba) === k)?.premiados ?? null;
};
