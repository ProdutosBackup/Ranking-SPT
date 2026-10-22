# DESIGN.md — contrato de design da Auditoria do Ranking (SPT)

Status: **rascunho para aprovação**. Nada aqui foi implementado. Derivado de `docs/extracao-visual/relatorio.md`.
Cada valor traz sua origem:
- **[P]** paleta/medidas aprovadas (`docs/marca/marca.css`, amostradas do logo);
- **[S]** medido no site oficial (home, 21/10/2026), com o valor do site entre parênteses quando difere;
- **[N]** decisão nova, **proposta**, ainda não aprovada.

Limites que valem sobre tudo: a estrutura travada (`docs/interface.md`, `app/components/estrutura.ts`, `tests/interface.test.ts`) não muda sem autorização. O **painel lateral** e a aba **Jogadores** recebem só cores e fontes deste contrato: nenhum raio, espaçamento, botão ou layout.

## 1. Princípios
1. **Dado primeiro.** A identidade do SPT está na tipografia, na forma e na cor; nunca em ilustração, foto, vídeo ou texto promocional.
2. **Um destaque por tela.** O dourado é a ação principal e o foco. Só um elemento por vista tem preenchimento dourado.
3. **Profundidade por tom, não por sombra.** Superfícies sobem de grafite-0 a grafite-3; contorno é anel de 1 px.
4. **Editorial só no título.** O jeito do site (minúsculo, apertado, ponto final) vale para títulos de página e seção. Nomes de jogador, torneio e valores aparecem exatamente como vêm do site.
5. **Movimento responde a uma ação.** Nada anima sozinho.
6. **Estado = cor + texto/ícone.** Nunca só cor.
7. **Funciona em 375 px.** Sem overflow de página, alvos ≥ 44 px, nada abaixo de 12 px.

## 2. Tokens

### 2.1 Cores (todas [P], exceto onde marcado)
| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `--grafite-0` | `#1A1C1E` | fundo da página (= topo do logo) | — |
| `--grafite-1` | `#222427` | superfície (cartão, lista, painel) | — |
| `--grafite-2` | `#2C2F33` | superfície elevada, trilho | — |
| `--grafite-3` | `#363A3F` | hover de superfície | — |
| `--creme` | `#F3F0EB` | texto principal | 15,0:1 em g0; 13,7:1 em g1 |
| `--creme-apoio` | `#AEAAA3` | texto de apoio | 7,4:1 em g0; 6,7:1 em g1 |
| `--linha` | creme a 12% | filete e anel decorativo | só separador |
| `--linha-forte` | `#7A7873` | limite de campo, botão secundário, chip | 3,9:1 em g0 |
| `--dourado` | `#DAA763` | ação principal, marca do item atual, foco | 7,9:1 em g0 |
| `--dourado-claro` | `#E6BD85` | hover, anel de foco | — |
| `--dourado-fundo` | `#3A3123` | fundo de etiqueta ativa | — |
| `--correto` / `-fundo` | `#8CCAA0` / `#22322A` | estado correto | 8,2:1 em g1 |
| `--correto-site` | `#C3DCAE` | correto com inscritos do site | — |
| `--erro` / `-fundo` / `-forte` | `#F28B82` / `#3B2523` / `#A3302A` | erro; fundo; ação destrutiva (texto creme) | 6,5:1 em g1 |
| `--atencao` / `-fundo` | `#E8C766` / `#37321F` | revisar | 9,5:1 em g1 |
| `--pendente` / `-fundo` | `#A7ABB2` / `#2C2F33` | aguardando regra | 6,8:1 em g1 |
Texto sobre dourado: `--grafite-0` (7,9:1).
Referência do site (não usar no app): `#0E0E0F`, `#19191B`, `#2A2A2D`, `#F5F0EA`, `#EFA144`, `#F4B567`, `#F8D3A8`. **Hoje `app/globals.css` usa estes, não os aprovados** (ver relatório §0).
Proporção alvo na tela [N]: ~60% grafite-0, ~30% grafite-1/2, ≤10% dourado.

### 2.2 Tipografia
- Família única: **Archivo** [S], autohospedada por `next/font`. Fallback `system-ui, sans-serif`. Números com `font-variant-numeric: tabular-nums` [P].
- Pesos: **400, 500, 600** [P]. Sem 700–900 [N] (o site usa até 900 no hero).
| Papel | Tamanho | Peso | Entrelinha | Tracking | Origem |
|---|---|---|---|---|---|
| Título de página | `clamp(32px, 4vw, 56px)` | 500 | 1,1 | −0,03 em | [N] (site: 40–88 px, −0,045 em, 1,02) |
| Título de seção | `clamp(24px, 2.4vw, 32px)` | 500 | 1,15 | −0,02 em | [N] (site FAQ 20 px/500/−0,02 em; 24 px nos cartões) |
| Veredito / fórmula | 24–30 px | 500 | 1,25 | −0,015 em | [P] (`app`) |
| Subtítulo | 20 px | 500 | 1,3 | −0,02 em | [S] |
| Corpo | 16 px | 400 | 1,55 | 0 | [P] (site 17 px/1,5) |
| Apoio | 14 px | 400 | 1,5 | 0 | [P] |
| Meta | 12 px | 400 | 1,4 | 0 | [P], só para timestamps, ajuda, legal |
| Rótulo de controle | 14–16 px | 500 | 1,2 | −0,01 em | [S] |
| Número de destaque | 28–36 px | 500–600 | 1,1 | −0,03 em | [S] contagem 30 px/600/−0,03 em |
- Títulos de página e de seção: `text-transform: lowercase`, ponto final, sem `text-wrap` quebrado [S/N]. **Nunca** em nomes de jogador, torneio, causa ou valor.
- No máximo 5 tamanhos por tela. Nada abaixo de 12 px. Célula de tabela e linha de lista: 14 ou 16 px, não 12.
- Itálico dourado: no máximo uma palavra, só no título da página (opção A da decisão 2) [N].
- Largura de leitura: 65–75 ch em texto corrido [N].

### 2.3 Espaçamento
Grade de 8, de 4 nos detalhes [P]: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`. Gutter da página `clamp(16px, 4vw, 56px)` [S: 20–56]. Contêiner `min(1440px, 100% − 2·gutter)` [S]. Respiro entre seções: 48 px (32 px no celular) [N] (site 120/72, muito para uma ferramenta). Altura mínima de alvo de toque: 44 px [P].

### 2.4 Raios
| Token | Valor | Uso | Origem |
|---|---|---|---|
| `--r-pilula` | 999 px | botão, chip, campo, selo de estado interativo | [S] |
| `--r-cartao` | 24 px | cartão de indicador, blocos recolhíveis | [S] |
| `--r-lista` | 16 px | moldura de tabela/lista quando houver | [P] (`--r-superficie`) |
| `--r-foco` | 8 px | anel de foco | [S] |
O painel lateral e Jogadores mantêm os raios atuais (só cor e fonte).

### 2.5 Sombras e contornos
- **Sem sombra** em cartões, botões, listas [S].
- Contorno decorativo: `box-shadow: inset 0 0 0 1px var(--linha)` [S].
- Contorno de controle (campo, botão secundário, chip): `inset 0 0 0 1px var(--linha-forte)` [N]; o anel creme a 14% do site não passa em 3:1.
- Única sombra permitida: camada flutuante (menu, confirmação): `0 24px 48px -24px rgba(0,0,0,.7)` [N], derivada da do painel suspenso do site.

### 2.6 Movimento
- Curva: `cubic-bezier(0.16, 1, 0.3, 1)` [S, P].
- Duração: **150 ms** (cor, anel, pressão do botão), **200 ms** (abrir/fechar, traço da aba), **300 ms** máximo (entrada do painel) [P]; o site usa 300–450 ms [S].
- Só `transform` e `opacity` (e `background-color`/`box-shadow` de estado) [P].
- Traço da aba: `scaleX(0 → 1)` do centro em 200 ms [S 450 ms → N].
- `prefers-reduced-motion: reduce`: sem transição nem animação [S, P].
- Proibido: animação contínua, parallax, brilho, desfoque, cortina `clip-path`, rolagem controlada.

## 3. Componentes

### 3.1 Cabeçalho e logo
- Faixa fixa de **72 px** (64 px no celular), fundo `--grafite-0`, filete inferior 1 px `--linha` [S: 72/64 sólido com filete].
- Logo à esquerda, **140 px** de largura, centrado na vertical, **sem caixa, borda, raio ou fundo** [S: 140–150 px sólido]. Respiro mínimo igual à altura do "S" do logo em todos os lados [N].
- Arquivo: SVG vetorial ou PNG transparente fornecido pela equipe do SPT. Alternativa [N]: o PNG atual sobre faixa `#1A1C1E`, sem moldura.
- Título da página fora da faixa fixa, na linha editorial abaixo. A faixa fixa não passa de 160 px no celular [N].

### 3.2 Botão
- Altura 44 px [P] (site 50 px), padding horizontal 22 px, raio 999, 16 px/500, −0,01 em [S].
- **Primário**: fundo `--dourado`, texto `--grafite-0`; hover `--dourado-claro`; pressionado `scale(.98)` [S]. **Um por vista.**
- **Secundário (ghost)**: fundo transparente, texto `--creme`, anel `--linha-forte`; hover: anel e texto `--dourado` [S].
- **Destrutivo**: fundo `--erro-forte`, texto `--creme`; só na confirmação, nunca na barra [P].
- Desabilitado: sem fundo, anel `--linha`, texto `--creme-apoio`, `cursor: not-allowed` [P].
- Foco: `outline: 2px solid --dourado-claro; offset 3px` [S, P]. Sem seta decorativa.

### 3.3 Aba
- **Opção A (recomendada) [N]**: texto 15–16 px/500; inativa `--creme-apoio`; ativa `--creme` com traço de 2 px `--dourado` embaixo (`left/right 14px`, `bottom 6px`), crescendo do centro [S]. Sem trilho, sem preenchimento. Altura 44 px. Contador: número tabular 14 px em `--creme-apoio`, sem pílula.
- **Opção B [N]**: grupo em pílula; ativa = anel dourado 1,5 px + texto dourado [S: padrão do botão "reserve"].
- Em 375 px: rolagem horizontal dentro da lista de abas, nunca da página.

### 3.4 Filtro (chip)
- Pílula 44 px, 14 px/500, padding 0 16 px; anel `--linha-forte` [S: 46 px, 15 px].
- Ativo: anel dourado 1,5 px + texto `--dourado` [S/N]. O preenchimento dourado fica reservado ao botão primário.
- Hover: anel `--creme-apoio` [N] (o site enche de laranja; descartado para não confundir com ação).
- Grupos de filtro em uma linha com rolagem horizontal interna; contagem entre parênteses mantida (texto travado).

### 3.5 Cartão
- Fundo `--grafite-1`, raio 24, padding 24 px (16 px no celular), sem sombra, anel `--linha` [S/P].
- Sem elevação no hover. Quando clicável: fundo `--grafite-2` e anel `--linha-forte`, em 150 ms [N].
- Um cartão da vista pode ser dourado cheio (texto `--grafite-0`) [S: prêmio laranja].
- Número 28–36 px/500–600 tabular; rótulo 14 px `--creme-apoio`.

### 3.6 Tabela e lista
- Sem moldura arredondada de cartão quando for a vista principal: filetes de 1 px `--linha` entre linhas [S/N]. Se houver moldura, `--r-lista`, fundo `--grafite-1`, anel `--linha` [P].
- Cabeçalho: 12–13 px/500, `--creme-apoio`, sentence case (sem caixa-alta espaçada), `sticky`, fundo `--grafite-1` [N].
- Células 14 px (secundário), linha de 48 px, padding 12 px 16 px [N]; números à direita e tabulares; coluna de maior importância em 600.
- Hover de linha: `--grafite-2` em 150 ms. Sem zebra.
- Largura maior que a tela: rolagem **dentro** da região, primeira coluna fixa em ≤ 720 px [P].

### 3.7 Título de seção
- Minúsculo, ponto final, 500, −0,02 a −0,03 em [S/N]. Filete de 1 px `--linha` acima quando abrir bloco novo [S].
- Kicker opcional: 14 px `--creme-apoio` com filete dourado de 2,6 em à esquerda, **só no título da página** [S/N].
- Numeração `01, 02, 03`: **somente** para sequências reais (etapas, passos de "Como começar"), 13 px/600 tabular, +0,06 em, em `--creme-apoio`; nunca em seções [S].

### 3.8 Campo e seletor
- Altura 44 px, raio 999, fundo `--grafite-1`, anel `--linha-forte` (3,9:1), texto 16 px [N].
- Rótulo sempre visível acima, 14 px `--creme-apoio`. Foco: anel dourado-claro 2 px.
- Erro: anel `--erro` + mensagem com ícone e texto.

### 3.9 Estados e etiquetas
- Etiqueta: 12–13 px/500, raio 999 **só** se for filtro ou estado interativo; metadado estático (data, identificador) vai em texto simples [N].
- Cada estado: cor do token + texto + marca (ícone/forma). Correto/erro/revisar/pendente conforme 2.1.

## 4. Proibições
1. Logo dentro de caixa, selo, círculo ou com borda/sombra.
2. Texto abaixo de 12 px; pesos 700–900; caixa-alta espaçada para rótulos.
3. Minúscula, itálico ou ponto final em dados (nomes, torneios, valores, causas).
4. Sombra em cartão, botão ou lista; glassmorphism e `backdrop-filter`.
5. Gradiente em botão ou superfície; mais de um preenchimento dourado por vista.
6. Elevação (`translateY`) ao passar o mouse em cartões e linhas.
7. Animação contínua, parallax, vídeo, canvas, rolagem controlada, grão, brilho.
8. Foto, vídeo, ilustração e texto promocional do site oficial; copiar qualquer arquivo do site.
9. Pílula decorativa em volta de metadado estático; ícone dentro de campo sem função.
10. Uma terceira cor de ação; cor como único sinal de estado.
11. Largura de página fixa; overflow horizontal da página em 375 px.
12. Mudar estrutura travada, ou layout/texto do painel lateral e de Jogadores, sem autorização.

## 5. Pendências para aprovação
1. Confirmar a **paleta aprovada** como fonte de verdade (hoje o app usa a do site).
2. Escolher entre as opções A/B de: marca da aba (3.3), títulos (2.2), logo (3.1).
3. Obter o logo vetorial oficial.
4. Autorizações da seção 7 do relatório, se algum desses itens for desejado.
