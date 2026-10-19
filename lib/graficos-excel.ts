// Gráficos do Resumo do Excel, desenhados em SVG e convertidos em PNG (2x) com sharp.
// Os números vêm do mesmo resultado que a tela mostra; nada é recalculado além de somas simples.
import type { montarResposta } from "./painel";

type Resp = ReturnType<typeof montarResposta>;
export type ItemBarra = { rotulo: string; sub?: string; valor: number; texto: string };
export type DadosGraficos = { torneios: ItemBarra[]; causas: ItemBarra[]; jogadores: ItemBarra[] };

const n = (x: number) => x.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nSinal = (x: number) => x.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" }).replace(/^-/, "−");
const nInt = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

// Cores: SPT (laranja, fundo escuro da logo) e estado de erro da tela.
const COR = { erro: "#C40F14", laranja: "#EFA144", tinta: "#1A1C1E", apoio: "#6B6E73", trilho: "#F1EEE9", linha: "#E3DFDA" };

/** Os três conjuntos de números dos gráficos. As somas batem com as tabelas das abas correspondentes. */
export function dadosDosGraficos(r: Resp): DadosGraficos {
  const porTorneio = new Map<string, number>();
  for (const l of r.linhas) {
    if (l.situacao !== "ERRO" && l.situacao !== "SUSPEITO") continue;
    porTorneio.set(l.torneio, (porTorneio.get(l.torneio) ?? 0) + Math.abs(l.registradoCent - l.esperadoCent));
  }
  const torneios = [...porTorneio.entries()]
    .map(([rotulo, cent]) => ({ rotulo, valor: cent / 100, texto: n(cent / 100) }))
    .sort((a, b) => b.valor - a.valor);
  const causas = r.painel.grupos.map((g) => ({
    rotulo: g.titulo,
    sub: `${nInt(g.indices.length)} ${g.indices.length === 1 ? "caso" : "casos"}`,
    valor: g.pontos,
    texto: n(g.pontos),
  }));
  const jogadores = r.painel.jogadores
    .filter((j) => j.erros > 0)
    .sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca) || a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, 10)
    .map((j) => ({ rotulo: j.nome, valor: Math.abs(j.diferenca), texto: nSinal(j.diferenca) }));
  return { torneios, causas, jogadores };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Quebra o texto em até `max` linhas de ~`larg` caracteres, sem cortar palavras (a última linha leva o resto). */
function quebrar(s: string, larg: number, max = 2): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const p of s.split(" ")) {
    if ((atual + " " + p).trim().length > larg && atual) {
      linhas.push(atual);
      atual = p;
    } else atual = (atual + " " + p).trim();
  }
  if (atual) linhas.push(atual);
  if (linhas.length > max) {
    const resto = linhas.splice(max - 1).join(" ");
    linhas.push(resto);
  }
  return linhas;
}

export function svgBarras(titulo: string, itens: ItemBarra[], W: number, H: number, cor: string): string {
  const f = "font-family=\"Calibri, 'Segoe UI', Arial, sans-serif\"";
  const partes: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2}" height="${H * 2}" viewBox="0 0 ${W} ${H}">`,
    `<rect width="${W}" height="${H}" rx="10" fill="#FFFFFF"/><rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="none" stroke="${COR.linha}"/>`,
    `<rect x="14" y="14" width="4" height="18" rx="2" fill="${COR.laranja}"/>`,
    ...quebrar(titulo, Math.floor((W - 40) / 7.2), 2).map((t, i) => `<text x="26" y="${27 + i * 16}" ${f} font-size="14" font-weight="700" fill="${COR.tinta}">${esc(t)}</text>`),
  ];
  const topo = 56;
  if (!itens.length) {
    partes.push(`<text x="${W / 2}" y="${(H + topo) / 2}" text-anchor="middle" ${f} font-size="15" fill="${COR.apoio}">Nenhuma diferença encontrada</text></svg>`);
    return partes.join("");
  }
  const labelW = Math.round(W * 0.4);
  const xBarra = 14 + labelW + 8;
  const textoW = 62; // espaço para o valor escrito depois da barra
  const maxBarra = W - xBarra - textoW - 10;
  const maximo = Math.max(...itens.map((i) => i.valor), 1e-9);
  const altura = Math.min(40, (H - topo - 12) / itens.length);
  itens.forEach((it, i) => {
    const y = topo + i * altura;
    const cx = y + altura / 2;
    const linhas = quebrar(it.rotulo, Math.floor(labelW / 5.6), 2);
    const bloco = linhas.length + (it.sub ? 1 : 0);
    const y0 = cx - (bloco * 12) / 2 + 9;
    linhas.forEach((t, k) => partes.push(`<text x="${14 + labelW}" y="${y0 + k * 12}" text-anchor="end" ${f} font-size="10.5" fill="${COR.tinta}">${esc(t)}</text>`));
    if (it.sub) partes.push(`<text x="${14 + labelW}" y="${y0 + linhas.length * 12}" text-anchor="end" ${f} font-size="10" fill="${COR.apoio}">${esc(it.sub)}</text>`);
    const larg = Math.max(3, (it.valor / maximo) * maxBarra);
    const alt = Math.min(18, altura - 8);
    partes.push(`<rect x="${xBarra}" y="${cx - alt / 2}" width="${maxBarra}" height="${alt}" rx="3" fill="${COR.trilho}"/>`);
    partes.push(`<rect x="${xBarra}" y="${cx - alt / 2}" width="${larg}" height="${alt}" rx="3" fill="${cor}"/>`);
    partes.push(`<text x="${xBarra + maxBarra + 6}" y="${cx + 4}" ${f} font-size="11" font-weight="700" fill="${COR.tinta}">${esc(it.texto)}</text>`);
  });
  partes.push("</svg>");
  return partes.join("");
}

/** PNG em escala 2x dos três gráficos, ou null se o conversor (sharp) não estiver disponível. */
export async function gerarGraficos(r: Resp, W: number, H: number): Promise<{ torneios: Buffer; causas: Buffer; jogadores: Buffer } | null> {
  type Sharp = (entrada: Buffer) => { png(): { toBuffer(): Promise<Buffer> } };
  let sharp: Sharp;
  try {
    const mod = (await import("sharp")) as unknown as { default?: Sharp } & Sharp;
    sharp = (mod.default ?? mod) as Sharp;
  } catch {
    return null;
  }
  const d = dadosDosGraficos(r);
  const png = (svg: string) => sharp(Buffer.from(svg)).png().toBuffer();
  return {
    torneios: await png(svgBarras("Pontos em discordância por torneio", d.torneios, W, H, COR.erro)),
    causas: await png(svgBarras("Casos e pontos por causa (hipóteses)", d.causas, W, H, COR.erro)),
    jogadores: await png(svgBarras("Os 10 jogadores com maior diferença em pontos", d.jogadores, W, H, COR.erro)),
  };
}
