// Quadro de marca: ícones, anel de fichas, molduras de tela e contrastes. Sem dependências.

/** Ícones de estado (16 px, traço). Servem de reforço: o texto ao lado sempre diz o estado. */
const ICONES = {
  correto: '<path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  "correto-site": '<path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="13" cy="13" r="2" fill="currentColor"/>',
  erro: '<circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  atencao: '<path d="M8 2.2l6.2 11H1.8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 6.4v3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="11.6" r="0.9" fill="currentColor"/>',
  pendente: '<circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2.2"/><path d="M8 5v3.4l2 1.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  fechar: '<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  baixar: '<path d="M8 2.5v8M4.5 7.5L8 11l3.5-3.5M3 13.5h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  enviar: '<path d="M8 11V3M4.5 6L8 2.5 11.5 6M3 13.5h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  buscar: '<circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
};
const icone = (nome) => `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">${ICONES[nome]}</svg>`;
document.querySelectorAll("[data-icone]").forEach((el) => el.insertAdjacentHTML("afterbegin", icone(el.dataset.icone)));

/**
 * Anel de fichas, como o do logo: `total` fichas arredondadas em volta de um círculo, `cheias` em dourado.
 * Usado como indicador de progresso e de proporção (nunca como enfeite). `aberto` deixa a abertura do "C" do logo.
 */
function anel({ total = 8, cheias = 0, tamanho = 48, aberto = false, rotulo = "" }) {
  const c = tamanho / 2, raio = tamanho * 0.36, w = tamanho * 0.25, h = tamanho * 0.18;
  const arco = aberto ? 280 : 360, inicio = aberto ? -230 : -90;
  let fichas = "";
  for (let i = 0; i < total; i++) {
    const ang = inicio + (arco / (aberto ? total - 1 : total)) * i;
    const rad = (ang * Math.PI) / 180;
    const x = c + raio * Math.cos(rad), y = c + raio * Math.sin(rad);
    fichas += `<rect class="f${i < cheias ? " cheia" : ""}" x="${(x - w / 2).toFixed(2)}" y="${(y - h / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="${(h * 0.32).toFixed(2)}" transform="rotate(${(ang + 90).toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})"/>`;
  }
  const a11y = rotulo ? `role="img" aria-label="${rotulo}"` : 'aria-hidden="true"';
  return `<svg class="anel" width="${tamanho}" height="${tamanho}" viewBox="0 0 ${tamanho} ${tamanho}" ${a11y}>${fichas}</svg>`;
}
document.querySelectorAll("[data-anel]").forEach((el) => {
  const [total, cheias, tamanho, aberto] = el.dataset.anel.split(",").map(Number);
  el.insertAdjacentHTML("afterbegin", anel({ total, cheias, tamanho, aberto: aberto === 1, rotulo: el.dataset.anelRotulo || "" }));
});

// ---------- telas dentro de molduras (index.html) ----------
// Cada moldura é um iframe com a largura real (1440 ou 375 px), reduzido para caber na coluna. A tela informa a própria altura.
const molduras = [...document.querySelectorAll(".moldura")];
function ajustar(m) {
  const f = m.querySelector("iframe");
  const largura = Number(f.getAttribute("width"));
  const escala = Math.min(1, m.clientWidth / largura);
  f.style.transform = `scale(${escala})`;
  m.style.height = `${(Number(f.dataset.altura) || Number(f.getAttribute("height"))) * escala}px`;
}
if (molduras.length) {
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (!d || d.tipo !== "altura") return;
    for (const m of molduras) {
      const f = m.querySelector("iframe");
      if (f.contentWindow === e.source) {
        f.dataset.altura = d.altura;
        f.setAttribute("height", d.altura);
        ajustar(m);
      }
    }
  });
  new ResizeObserver(() => molduras.forEach(ajustar)).observe(document.body);
  molduras.forEach(ajustar);
}

// ---------- telas.html: mostra só a tela pedida (#resumo, #erros...) e informa a altura ----------
if (document.body.dataset.telas != null) {
  const mostrar = () => {
    const alvo = location.hash.slice(1) || "resumo";
    document.querySelectorAll("[data-tela]").forEach((s) => (s.hidden = s.dataset.tela !== alvo));
    avisar();
  };
  const avisar = () => parent !== window && parent.postMessage({ tipo: "altura", altura: Math.ceil(document.body.getBoundingClientRect().height) }, "*");
  window.addEventListener("hashchange", mostrar);
  new ResizeObserver(avisar).observe(document.body);
  mostrar();
}

// ---------- contrastes (index.html): calculados aqui, pela fórmula WCAG 2.1, a partir dos tokens ----------
const lum = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const razao = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const tabela = document.querySelector("#tabela-contraste tbody");
if (tabela) {
  const css = getComputedStyle(document.documentElement);
  const tk = (n) => css.getPropertyValue(`--${n}`).trim();
  // [texto, fundo, uso, mínimo exigido]
  const pares = [
    ["creme", "grafite-0", "texto principal na página", 4.5],
    ["creme", "grafite-1", "texto principal em superfície", 4.5],
    ["creme", "grafite-2", "texto em superfície elevada", 4.5],
    ["creme-apoio", "grafite-0", "texto de apoio na página", 4.5],
    ["creme-apoio", "grafite-1", "texto de apoio em superfície", 4.5],
    ["creme-apoio", "grafite-2", "texto de apoio em superfície elevada", 4.5],
    ["dourado", "grafite-0", "link, marcador e número de destaque", 4.5],
    ["dourado", "grafite-1", "link em superfície", 4.5],
    ["grafite-0", "dourado", "texto do botão principal", 4.5],
    ["grafite-0", "dourado-claro", "texto do botão principal (mouse sobre)", 4.5],
    ["creme", "dourado-fundo", "etiqueta de filtro ativo", 4.5],
    ["dourado", "dourado-fundo", "chave da etiqueta de filtro", 4.5],
    ["creme", "erro-forte", "botão destrutivo", 4.5],
    ["correto", "grafite-1", "estado Correto", 4.5],
    ["correto", "correto-fundo", "diferença zero", 4.5],
    ["correto-site", "grafite-1", "estado Correto com inscritos do site", 4.5],
    ["erro", "grafite-1", "estado Erro", 4.5],
    ["erro", "erro-fundo", "diferença negativa", 4.5],
    ["atencao", "grafite-1", "estado Revisar / atenção", 4.5],
    ["atencao", "atencao-fundo", "aviso de atenção", 4.5],
    ["pendente", "grafite-1", "estado Aguardando regra", 4.5],
    ["pendente", "pendente-fundo", "aviso de pendência", 4.5],
    ["linha-forte", "grafite-1", "borda de campo e botão secundário (não texto)", 3],
    ["dourado-claro", "grafite-0", "anel de foco (não texto)", 3],
  ];
  tabela.innerHTML = pares
    .map(([t, f, uso, min]) => {
      const r = razao(tk(t), tk(f));
      const ok = r >= min;
      return `<tr><td><span class="amostra-par" style="color:${tk(t)};background:${tk(f)}">Aa 488,65</span></td>
        <td><code>--${t}</code> ${tk(t)}</td><td><code>--${f}</code> ${tk(f)}</td><td>${uso}</td>
        <td class="num">${r.toFixed(2).replace(".", ",")}:1</td>
        <td><span class="estado ${ok ? "correto" : "erro"}">${icone(ok ? "correto" : "erro")}${ok ? (min === 3 ? "AA (3:1)" : r >= 7 ? "AAA" : "AA") : "Reprovado"}</span></td></tr>`;
    })
    .join("");
}
