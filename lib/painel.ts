// Monta os dados da tela a partir do resultado da auditoria: agrupamentos, totais e textos em linguagem simples.
// Nenhuma regra de pontuação aqui; só soma e agrupa números que o motor já calculou (em centésimos inteiros).
import type { DadosSpt } from "./api-spt";
import { descreverBase, type auditar } from "./auditoria";
import { baseDaPosicao, fb100 } from "./calculo";
import type { identificador } from "./integridade";
import type { Regras } from "./regras";

type Aud = ReturnType<typeof auditar>;
type Linha = Aud["linhas"][number];

const ROTULO: Record<string, { rotulo: string; classe: string }> = {
  CORRETO: { rotulo: "Correto", classe: "ok" },
  CORRETO_SITE: { rotulo: "Correto com os inscritos do site", classe: "ok" },
  ARREDONDAMENTO: { rotulo: "Arredondamento", classe: "arred" },
  ERRO: { rotulo: "Erro", classe: "erro" },
  SUSPEITO: { rotulo: "Revisar", classe: "revisar" },
  PENDENTE_REGRA: { rotulo: "Aguardando regra", classe: "aguarda" },
};
const ehProblema = (l: Linha) => l.situacao === "ERRO" || l.situacao === "SUSPEITO";

const n = (x: number, casas = 2) => x.toLocaleString("pt-BR", { maximumFractionDigits: casas });
const posicao = (p: number | null) => (p == null ? "sem posição" : p === 1 ? "campeão" : `${p}º colocado`);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

const MOTIVO_TEXTO: Record<string, string> = {
  NAO_FINALIZADO: "torneio não finalizado",
  CANCELADO: "torneio cancelado",
  SEM_BUYIN: "buy-in não informado",
};

const EXPLICACAO: Record<string, string> = {
  FIXOS10: "O site deu 10 pontos fixos, mas a regra manda multiplicar os 10 pontos pelos fatores de participantes e de buy-in.",
  CAMPO: "É uma hipótese: os pontos registrados batem com um número de inscritos diferente do usado na conta.",
  BASE: "É uma hipótese: os pontos registrados batem com o valor de outra posição, e a causa real não é conhecida.",
  SEM_CAUSA: "A diferença não corresponde a nenhuma causa conhecida. Confira a conta.",
  SUSPEITO: "A posição e o prêmio não concordam (posição premiada sem prêmio, ou prêmio sem posição).",
};

const FAIXAS_BUYIN = [
  { min: 3000, rotulo: "R$ 3.000 ou mais" },
  { min: 2000, rotulo: "de R$ 2.000 a R$ 2.999" },
  { min: 1001, rotulo: "de R$ 1.001 a R$ 1.999" },
  { min: 500, rotulo: "de R$ 500 a R$ 1.000" },
  { min: 0, rotulo: "abaixo de R$ 500" },
];
const faixaDe = (buyIn: number) => (FAIXAS_BUYIN.find((f) => buyIn >= f.min) ?? FAIXAS_BUYIN[4]).rotulo;

const ETAPA: Record<string, number> = { "taua-2026": 1, "vale-suico-2026": 2, "bendito-cacao-2026": 3 };

const PENDENCIA: Record<string, { titulo: string; pendente: string; decisao: string }> = {
  FINAL_SEM_POSICAO: {
    titulo: "Dia Final sem posição registrada",
    pendente: "O site não registra a posição destes jogadores no Dia Final; eles aparecem só com 10 pontos.",
    decisao: "Definir quantos pontos recebe quem jogou o Dia Final e não tem posição.",
  },
  FLIGHT: {
    titulo: "Dias classificatórios (Dia 1)",
    pendente: "Estes resultados são de dias classificatórios, e a regra de pontuação deles ainda não foi definida.",
    decisao: "Definir se os dias classificatórios pontuam e como.",
  },
  SATELITE: {
    titulo: "Satélites",
    pendente: "Estes resultados são de satélites, e ainda não foi decidido se satélites contam pontos.",
    decisao: "Decidir se satélites contam pontos (a pergunta no topo da tela).",
  },
  NAO_FINALIZADO: {
    titulo: "Torneios não finalizados",
    pendente: "Estes torneios ainda não terminaram, então os resultados podem mudar.",
    decisao: "Esperar o torneio terminar e auditar a etapa de novo.",
  },
  CANCELADO: {
    titulo: "Torneios cancelados",
    pendente: "Estes torneios foram cancelados, mas têm resultados registrados.",
    decisao: "Confirmar com a organização se o torneio cancelado pontua ou se os resultados devem sair.",
  },
  SEM_BUYIN: {
    titulo: "Buy-in não informado",
    pendente: "O site não informa o buy-in destes torneios, e sem ele não há como calcular o fator.",
    decisao: "Informar o buy-in do torneio no site.",
  },
};

type Achado = { fieldApi: number; fieldSite: number; diferenca: number; linhasExplicadas: number };

export function montarResposta(stage: string, dados: DadosSpt, regras: Regras, aud: Aud, id: ReturnType<typeof identificador>) {
  const ROTULO_PENDENCIA: Record<string, string> = {
    NAO_FINALIZADO: "Aguardando: torneio não finalizado",
    CANCELADO: "Aguardando: torneio cancelado",
    SEM_BUYIN: "Aguardando: buy-in não informado",
  };
  // Hipótese da causa, já com os números formatados: a tela só exibe.
  const hipotese = (l: Linha): { texto: string; conta: string | null } | null => {
    const fp = n(l.fatorParticipantes, 4);
    const fb = n(l.fatorBuyIn, 4);
    switch (l.causaCodigo) {
      case "BASE":
        return { texto: `Valor igual ao de um ${descreverBase(l.baseUsada ?? 0)}`, conta: `${n(l.baseUsada ?? 0)} × ${fp} × ${fb} = ${n(l.registrado)}` };
      case "CAMPO": {
        const f = l.inverso?.fieldImplicito ?? 0;
        return { texto: `Valor compatível com ${n(f)} inscritos (a conta usou ${n(l.field)})`, conta: `${n(l.base)} × ${n((f * 100 + 5000) / 10000, 4)} × ${fb} = ${n(l.registrado)}` };
      }
      case "FIXOS10":
        return { texto: "10 pontos fixos, sem multiplicar pelos fatores", conta: "10 pontos fixos = 10" };
      case "SUSPEITO":
        return { texto: "Posição e prêmio não concordam", conta: null };
      case "SEM_CAUSA":
        return { texto: "Nenhuma causa conhecida reproduz o valor do site", conta: null };
      case "INSCRITOS_SITE":
        return { texto: `Os pontos batem com ${n(l.field)} inscritos, e não com os ${n(l.fieldApi)} informados pela API`, conta: `${n(l.base)} × ${fp} × ${fb} = ${n(l.registrado)}` };
      default:
        return null;
    }
  };
  const linhas = aud.linhas.map((l) => {
    const r = ROTULO[l.situacao];
    return { ...l, ...r, rotulo: (l.pendencia && ROTULO_PENDENCIA[l.pendencia]) || r.rotulo, hipotese: hipotese(l), faixaBuyIn: faixaDe(l.buyIn) };
  });

  // Erros agrupados pela causa.
  const porCausa = new Map<string, number[]>();
  linhas.forEach((l, i) => {
    if (!ehProblema(l)) return;
    const cod = l.causaCodigo === "BASE" ? `BASE_${l.baseUsada}` : (l.causaCodigo ?? "SEM_CAUSA");
    porCausa.set(cod, [...(porCausa.get(cod) ?? []), i]);
  });
  const grupos = [...porCausa.entries()]
    .map(([codigo, indices]) => {
      const primeira = linhas[indices[0]];
      let titulo = "Diferença sem causa identificada";
      const explicacao = EXPLICACAO[primeira.causaCodigo ?? "SEM_CAUSA"];
      if (primeira.causaCodigo === "FIXOS10") titulo = "10 pontos fixos em vez de 10 × fatores";
      else if (primeira.causaCodigo === "CAMPO") titulo = "Valor compatível com outro número de inscritos";
      else if (primeira.causaCodigo === "SUSPEITO") titulo = "Posição e prêmio não concordam";
      else if (primeira.causaCodigo === "BASE") {
        const igual = indices.every((i) => linhas[i].posicao === primeira.posicao);
        const como = descreverBase(primeira.baseUsada ?? 0);
        titulo = igual ? `${cap(posicao(primeira.posicao))} com valor igual ao de um ${como}` : `Valor igual ao de um ${como}`;
      }
      const pontos = indices.reduce((a, i) => a + Math.abs(linhas[i].registradoCent - linhas[i].esperadoCent), 0) / 100;
      return { codigo, titulo, explicacao, pontos, indices };
    })
    .sort((a, b) => b.indices.length - a.indices.length);

  const problemas = linhas.filter(ehProblema);
  const pontosEmDiscordanciaCent = problemas.reduce((a, l) => a + Math.abs(l.registradoCent - l.esperadoCent), 0);

  // Impacto por jogador (só quem tem erro): total corrigido = total do site + (correto − registrado) nas linhas com erro.
  const rankingDe = new Map(aud.somas.map((s) => [s.jogador, s.rankingPoints]));
  const porJogador = new Map<string, { casos: number; difCent: number }>();
  for (const l of problemas) {
    const a = porJogador.get(l.jogador) ?? { casos: 0, difCent: 0 };
    porJogador.set(l.jogador, { casos: a.casos + 1, difCent: a.difCent + (l.esperadoCent - l.registradoCent) });
  }
  const impacto = [...porJogador.entries()]
    .map(([jogador, a]) => {
      const site = rankingDe.get(jogador) ?? 0;
      return { jogador, casos: a.casos, pontosSite: site, pontosCorrigidos: Math.round(site * 100 + a.difCent) / 100, diferenca: a.difCent / 100 };
    })
    .sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca));

  // Casos aguardando definição de regra: uma frase por torneio e motivo.
  const porPend = new Map<string, number[]>();
  linhas.forEach((l, i) => {
    if (l.situacao !== "PENDENTE_REGRA") return;
    const k = `${l.pendencia}|${l.torneio}`;
    porPend.set(k, [...(porPend.get(k) ?? []), i]);
  });
  const aguardando = [...porPend.entries()].map(([k, indices]) => {
    const [motivo, torneio] = k.split("|");
    const q = indices.length;
    const texto =
      motivo === "FINAL_SEM_POSICAO"
        ? `${q} ${q === 1 ? "jogador" : "jogadores"} do ${torneio} sem posição registrada`
        : motivo in MOTIVO_TEXTO
          ? `${q} ${q === 1 ? "resultado" : "resultados"} de ${torneio}: ${MOTIVO_TEXTO[motivo]}`
          : motivo === "SATELITE"
          ? `${q} ${q === 1 ? "resultado" : "resultados"} de ${torneio}: ainda não foi decidido se satélites contam pontos`
          : `${q} ${q === 1 ? "resultado" : "resultados"} de ${torneio} (dia classificatório): a regra de pontuação ainda não foi definida`;
    return { texto, indices };
  });

  const aguardandoGrupos = Object.entries(PENDENCIA)
    .map(([codigo, info]) => {
      const itens = aguardando.filter((a) => linhas[a.indices[0]].pendencia === codigo);
      return { codigo, ...info, total: itens.reduce((a, x) => a + x.indices.length, 0), itens };
    })
    .filter((g) => g.total > 0);

  // Todos os jogadores: total no site, total correto (corrigindo só as linhas com erro) e diferença.
  const jogadores = dados.jogadores.map((j) => {
    const a = porJogador.get(j.name);
    const dif = a?.difCent ?? 0;
    return {
      nome: j.name,
      resultados: j.resultados.length,
      pontosSite: j.rankingPoints,
      pontosCorretos: Math.round(j.rankingPoints * 100 + dif) / 100,
      diferenca: dif / 100,
      erros: a?.casos ?? 0,
    };
  });

  const t = aud.torneios as unknown as Record<string, number | string>[];
  const torneios = t.map((x) => ({
    id: x.torneioId as string,
    nome: x.torneio as string,
    inscritos: x.players as number,
    premiados: x.premiados as number,
    resultados: x.total as number,
    corretos: (x.CORRETO as number) + (x.CORRETO_SITE as number),
    inscritosApi: x.players as number,
    inscritosUsados: x.field as number,
    inscritosDeduzidos: x.fieldDeduzido as number | null,
    achado: x.achado as unknown as Achado | null,
    erros: (x.ERRO as number) + (x.SUSPEITO as number),
    aguardando: x.PENDENTE_REGRA as number,
    estado:
      (x.total as number) === 0
        ? "vazio"
        : (x.ERRO as number) + (x.SUSPEITO as number) > 0
          ? "erro"
          : x.achado
            ? "divergencia"
            : (x.PENDENTE_REGRA as number) === (x.total as number)
              ? "aguardando"
              : "ok",
  }));

  // Divergências de inscritos: uma por torneio. Apontam inconsistência entre a API e o site; não provam que o site esteja certo.
  const divergencias = torneios
    .filter((x) => x.achado)
    .map((x) => ({
      torneioId: x.id,
      torneio: x.nome,
      inscritosApi: x.achado!.fieldApi,
      inscritosSite: x.achado!.fieldSite,
      diferenca: x.achado!.diferenca,
      resultadosExplicados: x.achado!.linhasExplicadas,
      texto: `A API informa ${n(x.achado!.fieldApi)} inscritos, mas os pontos registrados de todos os ${n(x.achado!.linhasExplicadas)} resultados só batem com ${n(x.achado!.fieldSite)}. Isso mostra uma inconsistência entre a API e o site; não prova que o site esteja certo.`,
    }));

  const avisos: string[] = [];
  if (linhas.some((l) => l.pendencia === "NAO_FINALIZADO")) avisos.push("Há torneios não finalizados nesta etapa.");
  if (linhas.some((l) => l.pendencia === "CANCELADO")) avisos.push("Há resultados registrados em torneio cancelado.");
  if (linhas.some((l) => l.pendencia === "SEM_BUYIN")) avisos.push("Há torneios sem buy-in informado.");

  const sn = (b: boolean) => (b ? "Sim" : "Não");
  const regrasTexto = [
    { titulo: "Satélites contam pontos?", valor: sn(regras.satelitesPontuam) },
    {
      titulo: "Quem fica fora da premiação",
      valor: regras.foraDoItm === "10fixos" ? "10 pontos fixos (como na calculadora do site)" : "10 pontos × os fatores (como no regulamento)",
    },
    {
      titulo: "Premiados depois do 18º lugar",
      valor: regras.aposDecimoOitavo === "base10" ? "10 pontos de base" : "100 pontos de base para todos",
    },
    { titulo: "Diferença aceita como arredondamento", valor: `${n(regras.toleranciaArredondamento)} ponto(s)` },
    { titulo: "Buy-in do Dia Final quando vem zerado no site", valor: `R$ ${n(regras.buyInDiaFinalZero)}` },
    { titulo: "Fator de buy-in abaixo de R$ 500", valor: n(regras.fatorBuyInAbaixo500) },
  ];

  const r = aud.resumo as unknown as Record<string, number>;
  const conferidos = r.total - r.PENDENTE_REGRA;
  const erros = r.ERRO + r.SUSPEITO;
  const q = (x: number, um: string, varios: string) => `${n(x)} ${x === 1 ? um : varios}`;
  const veredito = [
    ETAPA[stage] ? `Etapa ${ETAPA[stage]}: ` : "",
    erros > 0
      ? `${q(erros, "resultado com pontuação diferente da regra", "resultados com pontuação diferente da regra")}, afetando ${q(porJogador.size, "jogador", "jogadores")} (${n(pontosEmDiscordanciaCent / 100)} pontos em discordância).`
      : "Nenhum erro de pontuação encontrado.",
    divergencias.length
      ? ` ${q(divergencias.length, "torneio tem", "torneios têm")} inscritos diferentes da API (${n(divergencias.reduce((a, x) => a + x.resultadosExplicados, 0))} resultados explicados).`
      : "",
    r.PENDENTE_REGRA ? ` ${q(r.PENDENTE_REGRA, "resultado aguarda", "resultados aguardam")} definição de regra.` : "",
  ].join("");

  // Tabelas do regulamento, lidas das mesmas funções da conta (uma única fonte).
  const bases: { posicao: string; pontos: number }[] = [];
  for (let p = 1; p <= 18; p++) {
    const b = baseDaPosicao(p, regras);
    const ult = bases[bases.length - 1];
    if (ult && ult.pontos === b) ult.posicao = `${ult.posicao.split(" a ")[0]} a ${p}º`;
    else bases.push({ posicao: `${p}º`, pontos: b });
  }
  bases.push({ posicao: "19º em diante (premiados)", pontos: baseDaPosicao(19, regras) });
  const tabelas = {
    bases,
    foraDaPremiacao: regras.foraDoItm === "10fixos" ? "10 pontos fixos" : "10 pontos × os fatores",
    buyIn: [...FAIXAS_BUYIN].reverse().map((f) => ({ faixa: f.rotulo, fator: fb100(f.min, regras) / 100 })),
  };

  return {
    stage,
    updatedAt: dados.updatedAt,
    identificador: id,
    regras,
    resumo: aud.resumo,
    somas: aud.somas,
    linhas,
    painel: {
      indicadores: {
        auditados: r.total,
        corretos: r.CORRETO + r.CORRETO_SITE,
        divergenciasInscritos: { torneios: divergencias.length, resultadosExplicados: divergencias.reduce((a, x) => a + x.resultadosExplicados, 0) },
        erros: r.ERRO + r.SUSPEITO,
        pontosEmDiscordancia: pontosEmDiscordanciaCent / 100,
        jogadoresAfetados: porJogador.size,
        aguardando: r.PENDENTE_REGRA,
        arredondamento: r.ARREDONDAMENTO,
        // % dos resultados conferidos (sem os que aguardam regra) que estão corretos
        percentualCorretos: conferidos > 0 ? Math.round(((r.CORRETO + r.CORRETO_SITE) * 1000) / conferidos) / 10 : null,
        composicao: { corretos: r.CORRETO, corretosSite: r.CORRETO_SITE, erros: r.ERRO, aguardando: r.PENDENTE_REGRA, revisar: r.SUSPEITO + r.ARREDONDAMENTO },
      },
      veredito,
      numeroEtapa: ETAPA[stage] ?? null,
      avisos,
      grupos,
      divergencias,
      impacto,
      aguardando,
      aguardandoGrupos,
      jogadores,
      tabelas,
      torneios,
      regrasTexto,
    },
  };
}
