/**
 * Torneios da Etapa 3 com bounty (K.O e Mystery) [CONFIRMADO 05/11/2026, docs/compendio.md seção 3.4]: o fator de buy-in usa o buy-in total
 * (buy-in + bounty), mas a planilha traz só o buy-in base. O bounty vem da API do site, por nome. É só dado: o motor e o verificador
 * usam esta lista, cada um com a sua própria lógica. Os nomes são os das abas da planilha (a comparação ignora maiúsculas, acentos, hífen, barra e ´).
 * Valores da API em 05/11/2026: 200K OMAHA 5 K.O 2000 + KO 1000; SUPER K.O 500 + KO 500; 100K OMAHA MYSTERY BOUNTY 1500 + MYSTERY 1000.
 */
export const TORNEIOS_COM_BOUNTY_ETAPA3: readonly string[] = ["200K OMAHA 5 K.O", "SUPER K.O", "100K OMAHA MYSTERY BOUNTY"];
