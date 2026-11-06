// Ranking correto acumulado por etapa. Funções puras, sem acesso a rede nem a servidor: a tela as chama com resultados já auditados.
//
// Regras (docs/compendio.md): o ranking é a soma simples dos torneios ("somada aos pontos acumulados anteriormente", seção 3.1;
// "Total do jogador: soma simples de todos os torneios", linha 184). Desempate do regulamento (seção 3.5, linha 111): "maior número
// de primeiros lugares; maior número de mesas finais; maior número de participações; maior soma de buy-ins investidos". Só o 1º critério
// existe nos dados (mesas finais e buy-ins investidos não vêm do site nem da planilha, e o 3º só vale depois do 2º); quem continua
// empatado divide a posição.

import { CENARIOS, type Cenario } from "./regras";

/** Texto usado quando a linha não traz os cenários (o motor sempre os traz; isto só vale para dados montados à mão). */
const MOTIVO_SEM_CENARIO = "cenário não calculado para esta linha";

/**
 * Uma linha de resultado já auditada. `esperadoCent`: pontos corretos (do motor) em centésimos.
 * `registradoCent`: os pontos publicados (no site, ou na planilha da Etapa 3). `cenarios`: o esperado nos 4 cenários A a D em centésimos, ou null onde não existe (`cenariosMotivo` diz por quê).
 */
export type LinhaConsolidado = { jogador: string; posicao: number | null; esperadoCent: number; aguarda: boolean; participacao?: boolean; registradoCent?: number; cenarios?: Partial<Record<Cenario, number | null>>; cenariosMotivo?: string | null; /** Em acordo (detectado ou informado): não conta como 1º lugar no desempate. */ acordo?: boolean };
export type EtapaConsolidado = {
  numero: number;
  jogadores: { nome: string; id?: string | null }[];
  linhas: LinhaConsolidado[];
};

/** Total de um jogador num cenário. `totalCent` é null (dados insuficientes) quando alguma linha dele não tem o valor no cenário; `motivos` diz por etapa quais linhas e por quê. */
export type TotalCenario = {
  totalCent: number | null;
  /** Soma só das linhas que têm valor (quando `insuficiente`, não é o total). */
  parcialCent: number;
  insuficiente: boolean;
  motivos: { etapa: number; motivo: string; linhas: number }[];
  /** Por etapa incluída: o total daquela etapa (cent null = dados insuficientes nela); o item é null se o jogador não jogou a etapa. */
  porEtapa: ({ cent: number | null; insuficiente: boolean } | null)[];
  /** Posição só entre os jogadores com total; empate pelo mesmo critério em todos os cenários (primeiros lugares). Null se `insuficiente`. */
  posicao: number | null;
  empate: boolean;
};

export type JogadorConsolidado = {
  nome: string;
  id: string | null;
  /** Pontos corretos por etapa incluída, em centésimos; null = não jogou aquela etapa. */
  porEtapa: (number | null)[];
  totalCent: number;
  primeiros: number;
  posicao: number;
  /** Empatado com outro jogador em pontos e em primeiros lugares. */
  empate: boolean;
  /** "Ranking como estava": os pontos publicados (site, ou planilha na Etapa 3), por etapa e acumulado; soma de todas as linhas, inclusive as que aguardam regra. */
  publicadoCent: number;
  publicadoPorEtapa: (number | null)[];
  /** Os totais nos 4 cenários (A a D): por etapa e acumulado até a etapa escolhida. */
  cenarios: Record<Cenario, TotalCenario>;
};
export type Consolidado = {
  etapas: number[];
  jogadores: JogadorConsolidado[];
  /** Resultados "aguardando regra" por etapa: ficam fora da soma. */
  aguardando: { etapa: number; n: number }[];
  avisos: string[];
};

const limpar = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim();
export const chaveNome = (s: string) => limpar(s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

type AcumCenario = { porEtapa: ({ cent: number; nulos: number } | null)[]; motivos: Map<string, { etapa: number; motivo: string; linhas: number }> };
type Pessoa = { nome: string; id: string | null; porEtapa: (number | null)[]; totalCent: number; primeiros: number; publicadoPorEtapa: (number | null)[]; cen: Record<Cenario, AcumCenario> };
type SomaCenario = { cent: number; nulos: number; motivos: Map<string, number> };
const semCenarios = () => Object.fromEntries(CENARIOS.map((k) => [k, { cent: 0, nulos: 0, motivos: new Map<string, number>() }])) as Record<Cenario, SomaCenario>;

/** Soma dos pontos corretos de cada jogador numa etapa (centésimos inteiros), sem as linhas aguardando regra. */
function somarEtapa(e: EtapaConsolidado) {
  type Soma = { cent: number; primeiros: number; publicado: number; cen: Record<Cenario, SomaCenario> };
  const nova = (): Soma => ({ cent: 0, primeiros: 0, publicado: 0, cen: semCenarios() });
  const por = new Map<string, Soma>();
  for (const j of e.jogadores) por.set(j.nome, nova());
  for (const l of e.linhas) {
    const p = por.get(l.jogador) ?? por.set(l.jogador, nova()).get(l.jogador)!;
    p.publicado += l.registradoCent ?? 0; // o publicado é o que o site (ou a planilha) mostra, com todas as linhas
    if (l.aguarda) continue;
    for (const k of CENARIOS) {
      const v = l.cenarios ? (l.cenarios[k] ?? null) : k === "A" ? l.esperadoCent : null;
      const c = p.cen[k];
      if (v == null) {
        c.nulos++;
        const m = l.cenariosMotivo ?? MOTIVO_SEM_CENARIO;
        c.motivos.set(m, (c.motivos.get(m) ?? 0) + 1);
      } else c.cent += v;
    }
    p.cent += l.esperadoCent;
    if (l.posicao === 1 && l.esperadoCent > 0 && !l.participacao && !l.acordo) p.primeiros++; // o 1º lugar de um torneio que pontua (satélites valem 0; flights são só participação; quem está em acordo não conta [CONFIRMADO 05/11/2026])
  }
  return por;
}

/** Acumulado das etapas dadas (em ordem crescente), identificando o jogador pelo ID e, sem ID, pelo nome. */
export function consolidar(etapas: EtapaConsolidado[]): Consolidado {
  const avisos: string[] = [];
  const pessoas: Pessoa[] = [];
  const porId = new Map<string, Pessoa>();
  const porNome = new Map<string, Pessoa[]>();
  let unidosPorNome = 0;
  const ambiguos = new Set<string>();

  etapas.forEach((e, k) => {
    const soma = somarEtapa(e);
    const jaVistos = new Set<Pessoa>();
    for (const j of e.jogadores) {
      const nome = limpar(j.nome);
      const id = j.id ? j.id.toLowerCase() : null;
      const chave = chaveNome(nome);
      let p: Pessoa | undefined;
      if (id && porId.has(id)) {
        p = porId.get(id)!;
        if (p.nome !== nome) avisos.push(`O ID ${id} aparece como "${p.nome}" e como "${nome}" (Etapa ${e.numero}); usei "${nome}".`);
      } else {
        const candidatos = (porNome.get(chave) ?? []).filter((c) => !jaVistos.has(c) && (id == null || c.id == null));
        if (candidatos.length === 1) {
          p = candidatos[0];
          unidosPorNome++;
        } else if (candidatos.length > 1) ambiguos.add(nome);
        if (p && id) p.id = id;
      }
      if (!p) {
        p = {
          nome, id, porEtapa: etapas.map(() => null), totalCent: 0, primeiros: 0, publicadoPorEtapa: etapas.map(() => null),
          cen: Object.fromEntries(CENARIOS.map((c) => [c, { porEtapa: etapas.map(() => null), motivos: new Map() }])) as Record<Cenario, AcumCenario>,
        };
        pessoas.push(p);
        (porNome.get(chave) ?? porNome.set(chave, []).get(chave)!).push(p);
      }
      if (id) porId.set(id, p);
      p.nome = nome; // o nome da etapa mais recente
      jaVistos.add(p);
      const s = soma.get(j.nome) ?? { cent: 0, primeiros: 0, publicado: 0, cen: semCenarios() };
      p.publicadoPorEtapa[k] = (p.publicadoPorEtapa[k] ?? 0) + s.publicado;
      for (const c of CENARIOS) {
        const a = p.cen[c];
        const antes = a.porEtapa[k] ?? { cent: 0, nulos: 0 };
        a.porEtapa[k] = { cent: antes.cent + s.cen[c].cent, nulos: antes.nulos + s.cen[c].nulos };
        for (const [motivo, linhas] of s.cen[c].motivos) {
          const chave = `${e.numero}|${motivo}`;
          const m = a.motivos.get(chave) ?? { etapa: e.numero, motivo, linhas: 0 };
          m.linhas += linhas;
          a.motivos.set(chave, m);
        }
      }
      p.porEtapa[k] = (p.porEtapa[k] ?? 0) + s.cent;
      p.totalCent += s.cent;
      p.primeiros += s.primeiros;
    }
  });

  if (unidosPorNome) avisos.push(`${unidosPorNome} ${unidosPorNome === 1 ? "jogador sem ID no site foi unido" : "jogadores sem ID no site foram unidos"} entre etapas pelo nome.`);
  if (ambiguos.size) avisos.push(`Não uni nomes que pertencem a mais de uma pessoa: ${[...ambiguos].slice(0, 5).join("; ")}${ambiguos.size > 5 ? "; …" : ""}.`);

  // Ordem: pontos, depois primeiros lugares (1º critério de desempate do regulamento), depois nome só para a lista ficar estável.
  pessoas.sort((a, b) => b.totalCent - a.totalCent || b.primeiros - a.primeiros || a.nome.localeCompare(b.nome, "pt-BR"));
  const jogadores: JogadorConsolidado[] = pessoas.map(({ cen, publicadoPorEtapa, ...p }) => ({
    ...p,
    posicao: 0,
    empate: false,
    publicadoPorEtapa,
    publicadoCent: publicadoPorEtapa.reduce<number>((a, x) => a + (x ?? 0), 0),
    cenarios: Object.fromEntries(
      CENARIOS.map((c) => {
        const porEtapa = cen[c].porEtapa.map((x) => (x == null ? null : { cent: x.nulos ? null : x.cent, insuficiente: x.nulos > 0 }));
        const insuficiente = porEtapa.some((x) => x?.insuficiente);
        const parcialCent = cen[c].porEtapa.reduce((a, x) => a + (x?.cent ?? 0), 0);
        const t: TotalCenario = { totalCent: insuficiente ? null : parcialCent, parcialCent, insuficiente, motivos: [...cen[c].motivos.values()], porEtapa, posicao: null, empate: false };
        return [c, t];
      }),
    ) as Record<Cenario, TotalCenario>,
  }));
  jogadores.forEach((j, i) => {
    const anterior = jogadores[i - 1];
    const igual = anterior && anterior.totalCent === j.totalCent && anterior.primeiros === j.primeiros;
    j.posicao = igual ? anterior.posicao : i + 1;
    if (igual) j.empate = anterior.empate = true;
  });

  // Posição em cada cenário: pelo total do cenário e, no empate, pelo mesmo critério em todos (primeiros lugares); quem tem dados insuficientes não recebe posição.
  for (const c of CENARIOS) {
    const ranque = jogadores.filter((j) => j.cenarios[c].totalCent != null).sort((a, b) => b.cenarios[c].totalCent! - a.cenarios[c].totalCent! || b.primeiros - a.primeiros || a.nome.localeCompare(b.nome, "pt-BR"));
    ranque.forEach((j, i) => {
      const a = ranque[i - 1];
      const igual = a && a.cenarios[c].totalCent === j.cenarios[c].totalCent && a.primeiros === j.primeiros;
      j.cenarios[c].posicao = igual ? a.cenarios[c].posicao : i + 1;
      if (igual) j.cenarios[c].empate = a.cenarios[c].empate = true;
    });
  }

  return {
    etapas: etapas.map((e) => e.numero),
    jogadores,
    aguardando: etapas.map((e) => ({ etapa: e.numero, n: e.linhas.filter((l) => l.aguarda).length })),
    avisos,
  };
}

/** Texto fixo do topo: quantos resultados aguardando regra ficaram fora da soma. */
export const avisoAguardando = (n: number) => (n === 1 ? "1 resultado aguardando regra não entra na soma" : `${n.toLocaleString("pt-BR")} resultados aguardando regra não entram na soma`);
