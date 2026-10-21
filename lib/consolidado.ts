// Ranking correto acumulado por etapa. Funções puras, sem acesso a rede nem a servidor: a tela as chama com resultados já auditados.
//
// Regras (docs/compendio.md): o ranking é a soma simples dos torneios ("somada aos pontos acumulados anteriormente", seção 3.1;
// "Total do jogador: soma simples de todos os torneios", linha 184). Desempate do regulamento (seção 3.5, linha 111): "maior número
// de primeiros lugares; maior número de mesas finais; maior número de participações; maior soma de buy-ins investidos". Só o 1º critério
// existe nos dados (mesas finais e buy-ins investidos não vêm do site nem da planilha, e o 3º só vale depois do 2º); quem continua
// empatado divide a posição.

/** Uma linha de resultado já auditada. `esperadoCent`: pontos corretos (do motor) em centésimos. */
export type LinhaConsolidado = { jogador: string; posicao: number | null; esperadoCent: number; aguarda: boolean; participacao?: boolean };
export type EtapaConsolidado = {
  numero: number;
  jogadores: { nome: string; id?: string | null }[];
  linhas: LinhaConsolidado[];
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

type Pessoa = { nome: string; id: string | null; porEtapa: (number | null)[]; totalCent: number; primeiros: number };

/** Soma dos pontos corretos de cada jogador numa etapa (centésimos inteiros), sem as linhas aguardando regra. */
function somarEtapa(e: EtapaConsolidado) {
  const por = new Map<string, { cent: number; primeiros: number }>();
  for (const j of e.jogadores) por.set(j.nome, { cent: 0, primeiros: 0 });
  for (const l of e.linhas) {
    if (l.aguarda) continue;
    const p = por.get(l.jogador) ?? por.set(l.jogador, { cent: 0, primeiros: 0 }).get(l.jogador)!;
    p.cent += l.esperadoCent;
    if (l.posicao === 1 && l.esperadoCent > 0 && !l.participacao) p.primeiros++; // o 1º lugar de um torneio que pontua (satélites valem 0; flights são só participação)
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
        p = { nome, id, porEtapa: etapas.map(() => null), totalCent: 0, primeiros: 0 };
        pessoas.push(p);
        (porNome.get(chave) ?? porNome.set(chave, []).get(chave)!).push(p);
      }
      if (id) porId.set(id, p);
      p.nome = nome; // o nome da etapa mais recente
      jaVistos.add(p);
      const s = soma.get(j.nome) ?? { cent: 0, primeiros: 0 };
      p.porEtapa[k] = (p.porEtapa[k] ?? 0) + s.cent;
      p.totalCent += s.cent;
      p.primeiros += s.primeiros;
    }
  });

  if (unidosPorNome) avisos.push(`${unidosPorNome} ${unidosPorNome === 1 ? "jogador sem ID no site foi unido" : "jogadores sem ID no site foram unidos"} entre etapas pelo nome.`);
  if (ambiguos.size) avisos.push(`Não uni nomes que pertencem a mais de uma pessoa: ${[...ambiguos].slice(0, 5).join("; ")}${ambiguos.size > 5 ? "; …" : ""}.`);

  // Ordem: pontos, depois primeiros lugares (1º critério de desempate do regulamento), depois nome só para a lista ficar estável.
  pessoas.sort((a, b) => b.totalCent - a.totalCent || b.primeiros - a.primeiros || a.nome.localeCompare(b.nome, "pt-BR"));
  const jogadores: JogadorConsolidado[] = pessoas.map((p) => ({ ...p, posicao: 0, empate: false }));
  jogadores.forEach((j, i) => {
    const anterior = jogadores[i - 1];
    const igual = anterior && anterior.totalCent === j.totalCent && anterior.primeiros === j.primeiros;
    j.posicao = igual ? anterior.posicao : i + 1;
    if (igual) j.empate = anterior.empate = true;
  });

  return {
    etapas: etapas.map((e) => e.numero),
    jogadores,
    aguardando: etapas.map((e) => ({ etapa: e.numero, n: e.linhas.filter((l) => l.aguarda).length })),
    avisos,
  };
}

/** Texto fixo do topo: quantos resultados aguardando regra ficaram fora da soma. */
export const avisoAguardando = (n: number) => (n === 1 ? "1 resultado aguardando regra não entra na soma" : `${n.toLocaleString("pt-BR")} resultados aguardando regra não entram na soma`);
