# Extração visual: site oficial do SPT × Auditoria do Ranking

Data da medição: 21/10/2026. Nada foi implementado no app. Screenshots numerados nesta pasta (índice no fim).
Fonte das medições do site: estilos computados pelo Playwright em 1440 e 375 px, mais o `home-v4/styles.css` público (849 linhas), lido só para conferir valores. Nenhum arquivo do site foi copiado para o projeto.

## 0. Quatro achados que mudam a conversa

1. **A paleta aprovada não é a do site.** O site mede `#0E0E0F` (fundo), `#EFA144` (laranja), `#F5F0EA` (creme). A paleta aprovada (`docs/marca/marca.css`, amostrada do PNG do logo) é `#1A1C1E`, `#DAA763`, `#F3F0EB`. E o **app hoje usa os valores do site** (`app/globals.css`, `--ink`, `--orange`…), não os aprovados. Este relatório e o `DESIGN.md` seguem a paleta aprovada, como você pediu; o `globals.css` atual está fora dela. Isso precisa de uma confirmação sua (seção 8).
2. **O site oficial tem dois sistemas visuais.** A home (`/`) é preto + laranja, Archivo, caixa baixa. A página `/ranking` é outra coisa: hero verde com borda rasgada, fundo branco, Montserrat, tabela clara (`site-1440-10-pagina-ranking.png`). A referência de identidade é **só a home**. A tabela de `/ranking` não serve de modelo.
3. **Dois pontos do briefing não conferem.** (a) O hero não é um vídeo em loop: é uma sequência de 97 quadros `.webp` desenhada num `<canvas>` e controlada pela rolagem (`assets/hero/m/000–096.webp`); há também um `.webm` de 579 KB em outro ponto. (b) Não há seções numeradas 01–04: a numeração 01–04 existe só na lista de etapas do menu suspenso (`site-1440-09-menu-etapas-aberto.png`). Os títulos de seção da home não têm número.
4. **O logo no site nunca está numa caixa.** É um SVG inline, direto sobre o fundo (cabeçalho) ou preto sobre o laranja (rodapé). A caixa com borda do app existe só porque o PNG do logo tem fundo opaco.

## 1. Cobertura da inspeção

Todas as seções da home carregaram nos dois tamanhos: menu, hero, contagem regressiva (dentro de "etapas"), satélites, ranking, galeria, etapas anteriores, perguntas frequentes, rodapé. Dois pontos de cuidado: o hero e as etapas são "presos" à rolagem (altura 420 vh e 580 vh), então os screenshots são de um ponto da rolagem, não da seção inteira. A página `/ranking` não chegou a `networkidle` (tempo esgotado); foi capturada com `load` e 5 s de espera, e só serviu para descartá-la como referência.

## 2. O sistema visual real (home)

### 2.1 Fontes
| Uso | Família | Origem | Licença |
|---|---|---|---|
| Tudo (UI, títulos, números) | **Archivo**, variável (`wght` 100–900, `wdth` 62–125, normal e itálico) | Google Fonts (`fonts.googleapis.com`), arquivos `fonts.gstatic.com/s/archivo/v25/*.woff2` | SIL Open Font License 1.1 (pública) |
| Aviso à mão no post-it | Caveat 700 | Google Fonts | SIL OFL 1.1 |
| Ícones | Phosphor Icons 2.1.1 | `unpkg.com/@phosphor-icons/web` | MIT |

Um único family para tudo. O contraste vem do **eixo de largura e peso** só no título do hero ("punta" em 900/`wdth` 68, "cana" em 300/`wdth` 118), não de uma segunda fonte.

### 2.2 Escala tipográfica medida (1440 px)
| Papel | Tamanho | Peso | Entrelinha | Espaço entre letras | Caixa |
|---|---|---|---|---|---|
| Título de seção `.h2` | 74,9 px (`clamp(40px,5.2vw,88px)`) | 500 | 1,02 | −0,045 em (−3,37 px) | minúscula |
| Frase da galeria | 129,7 px (`clamp(52px,9vw,170px)`) | 500 | 1,04 | −0,055 em | minúscula |
| Hero "punta cana" | até 250 px | 900 / 300 | 0,78 / 0,9 | −0,03 / −0,045 em | minúscula |
| Nome gigante da etapa | 145–313 px | 900 | 1 | −0,01 em | MAIÚSCULA |
| Frase de apoio do hero | 23 px | 500 | 1,5 | −0,02 em | normal |
| Corpo | 17 px | 400 | 1,5 | normal | normal |
| Lead de seção | 19 px | 400 | 1,5 | normal | normal |
| Pergunta (FAQ) | 20 px | 500 | 1,5 | −0,02 em | normal |
| Título de cartão | 24 px | 500 | 1,15 | −0,02 em | normal |
| Data da etapa | 26 px | 700 | 1,5 | −0,02 em | normal |
| Contagem regressiva | 30 px | 600 | 1 | −0,03 em | números tabulares |
| Item de menu / chip | 15 px | 500 | 1,5 | normal | normal |
| Rótulo miúdo (`dp-k`, selos) | 10–11 px | 700 | 1,5 | +0,16 a +0,18 em | MAIÚSCULA |
| Número da lista de etapas | 13 px | 600 | 1,5 | +0,06 em | tabular |

Leitura: **poucos tamanhos, saltos enormes** (15–30 px de um lado, 75–130 px do outro). Quase nada entre 30 e 75.

### 2.3 Paleta medida (hex)
Cores computadas na página (contagem de usos): `#F5F0EA` creme (441), `#FFFFFF` (179, só dentro das fotos das etapas), `#0E0E0F` (152), `#EFA144` laranja (94), `rgba(245,240,234,.66)` texto de apoio (74).
| Token do site | Valor | Papel |
|---|---|---|
| `--ink` | `#0E0E0F` | fundo (igual ao `theme-color`) |
| `--ink-2` | `#19191B` | cartões, FAQ fechado, chips internos |
| `--ink-3` | `#2A2A2D` | hover de superfície, trilhos |
| `--mist` | `#F5F0EA` | texto principal |
| `--mist-2` | creme a 66% | texto de apoio |
| `--mist-3` | creme a 14% | filete e anel de botão/chip |
| `--orange` | `#EFA144` | ação, destaque, rodapé |
| `--orange-2` | `#F4B567` | hover do laranja |
| `--peach` | `#F8D3A8` | superfície clara (cartão de satélites, FAQ aberto) |
| `--cream` | `#FCEBD6` | brilho radial no cartão pêssego |
| `--caneta` | `#C40F14` | só o aviso do post-it |
Contraste medido: laranja sobre `#0E0E0F` 9,05:1; apoio sobre fundo 7,7:1.

### 2.4 Grade, contêiner e espaçamento
- Contêiner: `min(1440px, 100% − 2·gutter)`; **gutter** `clamp(20px, 4vw, 56px)`.
- Seções: respiro vertical **120 px** (72–80 px no celular); FAQ 80 px em cima e 140 px embaixo.
- Duas colunas dominam: ranking `1fr 1fr` (gap 32–80 px), FAQ `1fr 1.4fr` (gap 56 px), satélites `1fr 1.2fr` (gap 56 px). Rodapé em 3 colunas. Abaixo de 1100 px tudo vira uma coluna, alinhada à esquerda.
- Escala de espaços que aparece: 6, 8, 10, 12, 16, 20, 24, 28, 32, 40, 56, 72, 96, 120. Não é uma grade de 8 estrita.
- Cabeçalho: 88 px (72 px ao rolar, 68/64 no celular), fixo, transparente sobre o hero e **sólido `#0E0E0F` com filete de 1 px** ao rolar.

### 2.5 Raios, bordas e sombras
- Raios: **999 px** (botões, chips, selos), **24 px** (cartões, FAQ), **32 px** (cartão de destaque, prêmios), 20 px (miniaturas dentro de cartão), 18 px (itens de menu), 16 px (contagem regressiva), 8 px (anel de foco).
- **Não há `border`.** O "contorno" é sempre `box-shadow: inset 0 0 0 1px` (creme a 14%, ou laranja a 40–45%, ou 1,5 px no botão "reserve").
- Sombra externa só em dois lugares: o painel suspenso (`0 50px 90px −30px rgba(0,0,0,.85)`) e o post-it. Cartões e botões não têm sombra.
- Profundidade vem de **troca de tom**: `#0E0E0F` → `#19191B` → `#2A2A2D`, e de **inversão** (cartão pêssego e rodapé laranja em seção escura).

### 2.6 Componentes
- **Botão** (`site-1440-01`, `-04`): pílula 50 px (58 px o grande), 24–30 px de padding horizontal, 16–17 px/500, −0,01 em, minúsculo. Três versões: laranja cheio (texto `#0E0E0F`), "ghost" (anel creme 14%, hover vira anel laranja + texto laranja), contorno laranja 1,5 px (o "reserve sua suíte", hover enche de laranja). Seta `↗` que desloca 2 px no hover.
- **Chip** (`site-1440-04`): pílula 46 px, 15 px/500, anel creme 14%; **hover enche de laranja** com texto escuro.
- **Navegação** (`site-1440-01`): texto 15 px/500 em creme 66%; o item atual fica creme com **traço laranja de 2 px que cresce do centro** (`scaleX`, 0,45 s). Não há "aba preenchida".
- **Cartão** (`site-1440-04`): `#19191B`, raio 32 px, padding 16/28 px, foto interna de raio 20 px. Um único cartão da sequência é laranja cheio (o prêmio principal). Nenhum levanta no hover.
- **FAQ** (`site-1440-07`): linhas `#19191B` de raio 24 px, gap 10 px, 24/28 px de padding, `+` laranja que gira 45°; **aberto vira pêssego** com texto escuro.
- **Título** (`site-1440-04`, `-07`): minúsculo, ponto final, e uma palavra ou frase em *itálico laranja* ("conquiste o título *mais desejado* do poker.", "perguntas *frequentes*.").
- **Rótulo de seção** (hero): kicker de 15 px em creme 66% precedido de um **filete laranja de 2,6 em** (`site-1440-01`, "próxima parada").
- **Rodapé do hero e dos slides** (`site-1440-01`, `-02`): **linha de 1 px a 22% de creme** separando uma base em colunas (frase à esquerda, apoio no meio, ação à direita).
- **Menu suspenso de etapas** (`site-1440-09`): cartão `#111112` raio 28 px; linhas com número `01–04` (13 px/600 tabular), nome 21 px/700, subtítulo 13 px, selo "FINALIZADA"/"A FINAL" em microcaixa-alta; um fundo `#19191B` com filete laranja de 3 px desliza entre os itens.
- **Satélites** (`site-1440-03`): cartão pêssego raio 32 px, padding 72 px, cinco pílulas de horário de 72 px; "agora" = fundo preto com texto laranja; passado = só anel e texto a 42%.

### 2.7 Movimento (durações e curvas medidas)
- Curva única: `cubic-bezier(.16, 1, .3, 1)` (`--ease`, saída suave e longa).
- Cor/fundo de botão, chip, link: **0,3 s** linear. Transformação do botão: 0,4 s. Traço da navegação: 0,45 s. Cabeçalho encolhendo: 0,5 s. Entrada do cabeçalho: 0,9 s, em cascata de 40 ms. Menu suspenso: cortina `clip-path` de 0,85 s com itens em cascata de 50 ms e desfoque de 6 px.
- Bibliotecas: Lenis 1.2.3 (rolagem suave), GSAP 3.13 + ScrollTrigger + SplitText.
- Contínuos: brilho do botão "reserve" (6 s), post-it ao vento (5,2 s), grão de filme (1,2 s), brilhos em cruz (3,2 s).
- `prefers-reduced-motion`: o site trata (desliga animações, troca o hero por imagem estática).

### 2.8 Logo
- SVG inline `.logo-hd`: **178 px de largura no topo, 150 px com o cabeçalho sólido** (68 px de altura de linha; 116 px no celular). Sem caixa, sem borda, sem fundo; fichas em laranja, "SUPREMA" e globo em creme.
- Posição: canto esquerdo do contêiner, centralizado na vertical numa barra de 88/72 px; gap de 40 px até o menu.
- Rodapé: versão **preta sobre o laranja**, 220 px, com 48–96 px de respiro abaixo.
- No app (`.logo`): PNG 184×64 px (161×56 no celular), raio 16 px, borda 1 px, degradê `#1A1C1E → #222427` imitando o fundo do PNG.

### 2.9 Recursos visuais (só listados, nada copiado)
| Recurso | Tipo | Uso no site |
|---|---|---|
| `assets/logo/spt_b_c.svg` e SVG inline | vetor | logo (cabeçalho, rodapé) |
| `assets/hero/{m,d}/000–096.webp` + `poster.webp` | 97 quadros por tamanho | hero desenhado em canvas pela rolagem |
| `assets/video/cartas-e-fichas.webm` (579 KB), `*.webp` animados | vídeo curto / webp animado | faixas de apoio, pílulas de imagem nas frases |
| `assets/etapas/*.webp` e `*-frente.webp` | fotos + recorte frontal | etapas (o nome gigante passa **entre** a foto e o recorte) |
| `assets/img/bracelete.webp`, `nome-gravado.webp` | fotos de produto | cartões de prêmio |
| `assets/textura/grao-a.webp` | textura 256 px | grão de filme sobre o hero |
Nenhum entra no app (ferramenta interna, sem fotos nem vídeo).

## 3. Os 7 traços que definem a identidade (home)

1. **Títulos em minúsculas, peso médio, apertados, com ponto final e uma palavra em itálico laranja.** 500, −0,045 em, entrelinha 1,02. → `site-1440-04-ranking.png`, `site-1440-07-faq.png`
2. **Tudo que se toca é pílula.** Botão, chip, selo, campo de idioma: raio 999 px, 46–58 px de altura, contorno fino em vez de borda. → `site-1440-04-ranking.png`
3. **Preto quente + um único laranja, com seções "invertidas" em pêssego/laranja.** Cartão pêssego, FAQ aberto, rodapé laranja. O contraste de seção é a decoração. → `site-1440-03-satelites.png`, `site-1440-08-rodape.png`
4. **Superfícies por tom, sem borda nem sombra.** `#0E0E0F` → `#19191B` → `#2A2A2D`; "borda" é anel inset de 1 px. → `site-1440-04-ranking.png`, `site-1440-07-faq.png`
5. **Escala de contraste extremo.** Texto de interface 15–17 px contra títulos de 75–130 px; quase nenhum tamanho intermediário. → `site-1440-05-galeria.png`
6. **Filete fino de 1 px e colunas como estrutura.** Linha a 22% separando a base do hero, kicker com traço laranja, grade 1fr/1fr e 1fr/1,4fr. → `site-1440-01-menu-hero.png`, `site-1440-02-contagem-etapas.png`
7. **Logo solto, sem moldura, e cabeçalho que encolhe e fica sólido ao rolar.** Traço laranja que cresce do centro marca o item atual. → `site-1440-01-menu-hero.png`, `site-1440-09-menu-etapas-aberto.png`

Observação honesta: o site também usa microcaixa-alta espaçada (11 px/700/+0,18 em) e animação pesada. São traços reais, mas servem a divulgação; a seção 5 explica por que não os levamos.

## 4. Diagnóstico do app atual (1440 e 375 px)

Importante: o app **já usa pílulas, Archivo e preto/laranja do site**. O "cara de IA" não vem da cor, e sim de montar os componentes na receita padrão de painel SaaS.

| # | Traço genérico | Onde (screenshot) | Motivo |
|---|---|---|---|
| 1 | **Logo em caixa com borda** (184×64, raio 16, borda 1 px, degradê) ao lado de um h1 de 44 px | `app-1440-02-resumo.png`, `app-375-04-erros.png` | Parece um selo/avatar de app. O site nunca emoldura o logo. A caixa só disfarça o fundo opaco do PNG. |
| 2 | **Cinco pílulas do mesmo tamanho em fila** (Auditar, Enviar, Baixar, Exportar, Consolidado) | `app-1440-03-barra-superior.png` | Só a cor diferencia a ação principal; as outras quatro têm o mesmo peso visual. É a barra de ferramentas padrão de dashboard. No site, ghost e laranja têm papéis distintos. |
| 3 | **Barra superior em três faixas** (logo + título, controles, faixa de confiança) | `app-1440-02-resumo.png` | O cabeçalho ocupa ~237 px antes do conteúdo. A barra fixa mede 84 px sem dados no desktop e **234 px no celular (29% dos 812 px)**. O site encolhe o cabeçalho (88→72) em vez de empilhar. |
| 4 | **Abas como controle segmentado**: trilho em pílula com borda, aba ativa preenchida de creme, contador em pílula | `app-1440-02-resumo.png`, `app-375-04-erros.png` | É o "segmented control" padrão. O site marca o item atual com traço laranja, nunca com preenchimento creme. No celular a aba "Divergências de inscritos" corta no scroll. |
| 5 | **Filtros em chips de 44 px com enchimento creme quando ativos**, quebrando em 3 linhas | `app-1440-04-erros.png` | Rótulos longos em caixa-alta ("EV #8 CHAMPIONSHIP SUPER HIGH ROLLER 200K (3)") viram uma massa de pílulas. O creme cheio compete com o laranja cheio do botão principal. |
| 6 | **Seis cartões de indicador iguais** (número grande + rótulo), um em laranja, com elevação no hover | `app-1440-02-resumo.png` | Receita de KPI-card. Todos com o mesmo raio de 24 px e o mesmo peso. No site, cartão tem conteúdo e hierarquia, e não levanta ao passar o mouse. |
| 7 | **Selo "✓ Conta conferida por dois cálculos independentes"** em pílula âmbar com ✓ | `app-1440-02-resumo.png` | Pílula decorativa em volta de um metadado estático. |
| 8 | **Tabela em caixa arredondada** com cabeçalho em bloco `#2A2A2D` e sem hierarquia entre colunas | `app-1440-05-consolidado.png` | Parece uma tabela de biblioteca de componentes. Posição, jogador e pontos têm o mesmo peso; o líder da tabela não se destaca. |
| 9 | **Títulos de seção sem sistema** ("Como ficaram os 270 resultados", "A fórmula"): 30 px/600 em frase normal | `app-1440-02-resumo.png`, `app-1440-06-regras.png` | Sem o traço editorial do site (minúsculo, apertado, ponto final). Só o veredito tem tamanho de título. |
| 10 | **Tela inicial centralizada com três cartões numerados 1·2·3** | `app-1440-01-tela-inicial.png` | Layout de onboarding de template. Os números aqui são uma sequência real (passos), mas o arranjo é genérico; o site alinha à esquerda em colunas. |
| 11 | **Ação destrutiva e links de texto sublinhados** em estilos diferentes | `app/globals.css` (`.texto-btn`, `.acordo-link`, `.btn.perigo`; não capturado em screenshot) | Três tratamentos de "link" no mesmo app (pêssego sublinhado, cinza sublinhado, botão). |

O que **já está certo** e se mantém: o veredito em corpo grande (`app-1440-02-resumo.png`), a densidade das linhas de erro, os 44 px de alvo de toque, o foco laranja de 2 px, o respeito a `prefers-reduced-motion`.

Pendências de medição no app: `scrollWidth` 1441 px com viewport de 1440 px na tela inicial (pode haver 16 px de overflow escondido por `overflow-x: clip`); a confirmar na implementação. No celular não há overflow horizontal de página (360/360).

## 5. Proposta de adaptação para auditoria

Princípio: **a identidade do evento (tipografia, tom dos títulos, forma da pílula, troca de tom entre superfícies, logo solto) com o rigor de uma ferramenta** (dados legíveis, sem promoção, sem movimento que não responda a uma ação).

### O que levamos
| Traço do site | Como entra no app | Por quê |
|---|---|---|
| Archivo, pesos 400/500/600 | Já é a fonte do app. Fixar três pesos e deixar 700–900 de fora | Mesma voz, sem o contraste de 900 do hero |
| Título editorial (minúsculo, −0,03 a −0,045 em, ponto final) | Só no título de página e nos títulos de seção, em tamanho menor (proposta: 32–56 px) | É o traço mais reconhecível do site |
| Ponto laranja/itálico em palavra | Opcional, no máximo uma vez por tela (ver opção B) | Identidade, mas dado nunca em itálico |
| Pílula como forma de controle | Botões, chips e campos continuam 999 px | Já existe no app e no site |
| Anel inset em vez de borda | Anel de 1 px `--linha`; **nos campos e controles, `--linha-forte` (3,88:1)** | O anel do site (creme 14%) dá ~1,3:1, abaixo do mínimo de 3:1 para limites de controle |
| Troca de tom em vez de sombra | `grafite-0 → 1 → 2 → 3` da paleta aprovada; sem sombra | É a regra de elevação do site |
| Filete de 1 px + colunas | Separador da barra, das seções e da base do painel; títulos à esquerda, dado à direita | Estrutura do site, também boa para dado |
| Traço de 2 px que cresce do centro | Marca da aba ativa e do item atual | Substitui o preenchimento creme |
| Logo solto, 140–150 px | Sem caixa (ver opção do logo) | O site nunca emoldura |
| Cabeçalho que fica sólido com filete | Barra fixa compacta (72 px) com filete de 1 px | Libera a tela |
| Superfície clara invertida | **Só um uso**: o cartão do resultado "correto"/veredito, se aprovado; nunca como fundo de seção | Mantém o contraste sem virar vitrine |

### O que NÃO levamos
| Item | Por quê |
|---|---|
| Vídeo, quadros em canvas, post-it, grão de filme, brilhos, 3D | Divulgação; custam banda e atenção; a ferramenta é de trabalho |
| Fotos grandes, nome gigante de etapa, recorte em camadas | Sem fotos no app; o nome da etapa é um dado |
| Lenis/GSAP, rolagem presa (420–580 vh), cortina `clip-path` | Quebra a rolagem de quem audita; dependência sem função |
| Animação contínua (brilho do botão, rolo de texto) | Competem com dados |
| Microcaixa-alta espaçada (11 px/+0,18 em) | Abaixo do mínimo de 12 px, difícil de ler com acentos |
| Nomes de jogador e torneio em minúscula | São dados. Preservar o texto exato é requisito de auditoria (comparar com o site) |
| Peso 700–900 e tamanhos de 130–313 px | Fora dos limites de legibilidade da ferramenta |
| Tom promocional ("reserve sua suíte") e chamadas de venda | Fora de escopo |
| Cartão pêssego e rodapé laranja como fundos de seção | Uma tela de dados com grandes áreas claras cansa e muda o contraste das tabelas |
| Idiomas pt/es/en, menu de etapas com foto | Fora de escopo |

### Opções nas decisões mais subjetivas (máximo 2 cada)

**Decisão 1 — Marca da aba ativa**
- **A (recomendada):** texto simples, sem trilho; ativo = texto creme + **traço dourado de 2 px** que cresce do centro (idêntico ao menu do site); contador como número tabular em apoio, sem pílula. Mais próxima do site e mais leve; as 7 abas cabem melhor em 1440 px.
- **B:** manter o grupo em pílula, mas com ativo = anel dourado de 1,5 px + texto dourado (padrão do botão "reserve" e do "todas as etapas"). Conserva a forma atual, menos mudança.

**Decisão 2 — Títulos**
- **A (recomendada):** minúsculo + ponto final + **uma** palavra em itálico dourado só no título da página ("auditoria do *ranking*."); títulos de seção só minúsculos com ponto, sem itálico. Identidade forte, uso restrito.
- **B:** frase normal (caixa de sentença), peso 500, −0,03 em, sem ponto nem itálico. Mais sóbrio; perde o traço mais reconhecível.

**Decisão 3 — Logo**
- **A (recomendada):** pedir à equipe do SPT o **SVG vetorial oficial** (ou PNG com fundo transparente) e usá-lo sem caixa a 140 px. Resolve na origem.
- **B:** manter o PNG atual, sem borda nem raio, sobre uma faixa cujo fundo é exatamente `#1A1C1E` (a cor do topo do PNG, que é o motivo de a paleta aprovada existir). Funciona, mas a base do PNG (`#222427`) deixa uma emenda sutil.

## 6. Como cada tela ficaria na nova linguagem

(Tudo é visual; estrutura travada intacta. Itens que mexem na estrutura estão na seção 7.)

- **Barra superior e logo.** Faixa de 72 px, fundo grafite-0, filete de 1 px embaixo. Logo solto à esquerda a 140 px, sem caixa. O título da página vira a linha editorial logo abaixo (minúsculo, ponto final), fora da faixa fixa. Controles na ordem travada: seletor Etapa (campo-pílula com anel forte), **Auditar etapa** em dourado cheio (único), **Enviar planilha / Baixar relatório / Exportar dados / Consolidado** como "ghost" (anel, sem enchimento). Faixa de confiança vira uma linha de texto de apoio com o selo reduzido a texto + ✓ (sem pílula). Meta no celular: ≤ 160 px fixos.
- **Resumo.** Veredito mantido em corpo grande como abertura. Indicadores em cartões planos grafite-1, sem elevação no hover; o de "Erros" em dourado cheio continua o único destacado, com o número em 500 e −0,04 em. "Composição" com as barras finas atuais; títulos de seção no padrão editorial minúsculo com ponto.
- **Erros.** Abas com traço dourado. Filtros "Causa" e "Torneio" como chips de anel (ativo = anel dourado + texto dourado), em linha única com rolagem horizontal dentro da região no celular, em vez de três linhas. Linhas de resultado em lista com filete, sem caixa por linha; "Site X → Correto Y" com a diferença em número tabular alinhado à direita.
- **Consolidado.** Título editorial; seletor e busca como campos-pílula. Tabela como lista com filetes de 1 px, sem moldura arredondada; cabeçalho em 12 px/500 em apoio (sem caixa-alta), sticky; coluna "Pontos acumulados" em peso 600 e o líder visualmente mais forte; números tabulares. Aviso fixo "n resultados aguardando regra…" como linha com filete dourado à esquerda, não bloco cheio.
- **Regras.** Fórmula em corpo grande (como o veredito), tabelas do regulamento como listas de filete, blocos recolhíveis com o `+` dourado que gira 45° (padrão do FAQ do site). Fonte e hipótese em texto de apoio.
- **Painel lateral e aba Jogadores.** Por decisão sua: **só cor e fonte**. Entram a paleta aprovada e Archivo nos três pesos. Não entram raios, espaçamentos, botões em pílula nem mudança de layout. Consequência a conhecer: formas do painel (raios 20/14/12 px, caixas) vão destoar um pouco do resto.

## 7. O que exige autorização (estrutura travada)

Nada do que vem na proposta é obrigatório mudar a estrutura. Casos que **exigem** autorização explícita antes de fazer:
1. **Ponto final, itálico ou minúscula nos nomes travados** (abas "Resumo", "Erros"…, botões, seções do Resumo). A minúscula por CSS não muda o texto, mas muda a forma de "nomes" que o `tests/interface.test.ts` protege; o ponto e o itálico mudam o texto. Pergunta: só nos títulos novos de página/seção que não estão em `estrutura.ts`, ou também nos travados?
2. **Reordenar, agrupar ou recolher os botões da barra** (ex.: "Baixar relatório" e "Exportar dados" num menu "Mais") ou esconder controles atrás de um botão no celular. Mudaria ordem/atalhos.
3. **Numerar o seletor Etapa** (01·02·03, como no menu do site) ou mudar os rótulos das etapas.
4. **Mover o selo "Conta conferida por dois cálculos independentes" ou a faixa de confiança** para fora da barra (hoje está dentro).
5. **Trocar o bloco "Como começar" (3 passos)** por outra composição: o texto fica, mas confirmar se é estrutura.
6. **Qualquer mudança de layout no painel lateral e em Jogadores** (decisão sua: fora do escopo).
Fora dessas: cor, fonte, espaçamento, raio, anel, marca da aba, forma do filtro, tabela sem moldura e tratamento do logo são acabamento visual, permitidos desde que `tests/interface.test.ts` continue igual.

## 8. Riscos e decisões pendentes

- **Paleta (decisão sua):** confirmar que o app deve migrar de `#EFA144/#0E0E0F` (hoje) para `#DAA763/#1A1C1E` (aprovada). O `DESIGN.md` assume a aprovada. O dourado aprovado é um pouco mais claro e menos saturado que o laranja do site.
- **Licença das fontes:** Archivo e Caveat são OFL 1.1 (uso livre, inclusive comercial, sem redistribuir renomeado); o app já serve Archivo por `next/font` (autohospedada no build). Phosphor é MIT, mas não é necessário. O **logo e as fotos são marca/direitos do SPT**: usar o arquivo oficial entregue pela equipe, nunca extraído do site.
- **Acessibilidade — contraste:** textos medidos ≥ 6,7:1 na paleta aprovada (creme 13,7–15,0; apoio 6,7–7,4; dourado 7,2–7,9; erro 6,5; correto 8,2; atenção 9,5). Limite de campo `#7A7873` 3,88:1 (≥ 3:1). O anel creme 14% do site (~1,3:1) **não** serve como limite de campo ou botão ghost no app. Estados sempre com texto/ícone além da cor.
- **Acessibilidade — tipo:** `letter-spacing` de −0,045 em em títulos grandes pode colar letras (acentos e itálico); o site compensa com `padding-bottom: .14em`. No app usar −0,03 em e conferir "ç", "ã", "g", "p". Nada abaixo de 12 px: o site usa 10–11 px nas microetiquetas e isso não é levado.
- **Acessibilidade — movimento:** manter só transições de resposta a ação (≤ 300 ms, `transform`/`opacity`) e o `prefers-reduced-motion` já existente. Sem animação contínua.
- **Desempenho:** a home do site carrega 97 quadros + vídeo + 4 bibliotecas JS; nada disso entra. Archivo variável com os eixos `wght` apenas (sem `wdth`) basta; o eixo de largura só serve ao hero.
- **Viewport:** a barra fixa de 234 px no celular precisa cair (meta ≤ 160 px); alvos de toque de 44 px permanecem.

## 9. Índice de screenshots (`docs/extracao-visual/`)

Site oficial (home, `supremapokertour.com`), prefixo `site-1440-` e `site-375-`:
`01-menu-hero` · `02-contagem-etapas` (contagem regressiva) · `03-satelites` · `04-ranking` · `05-galeria` · `06-etapas-anteriores` · `07-faq` · `08-rodape` · `09-menu-etapas-aberto` (1440) / `09-menu-aberto` (375) · `10-pagina-ranking` (página `/ranking`, sistema diferente, só para registro).

App atual, prefixo `app-1440-` e `app-375-` (etapa 2 auditada com dados reais do site):
`01-tela-inicial` · `02-resumo` · `03-barra-superior` · `04-erros` · `05-consolidado` · `06-regras`.
