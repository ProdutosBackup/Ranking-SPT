# Crítica do app: Auditoria do Ranking (SPT)

Method: dual-agent (A: revisão de design, isolada · B: detector e medições de navegador, isolado). Nenhum dos dois viu o resultado do outro antes da síntese.
Data: 22/10/2026. Superfície: app local em `http://localhost:3000`, modo **Operate**. Nada foi implementado; `app/`, `lib/`, `tests/` e a estrutura travada não foram tocados. Sem commit.

Restrições que governam este relatório (do pedido): cores atuais de `app/globals.css` (`--ink`, `--orange`, `--mist`, `--peach` e derivadas) e Archivo permanecem; `docs/marca`, `docs/DESIGN.md` e `docs/extracao-visual` não valem onde divergirem disso; painel lateral e aba Jogadores só aceitam cor e fonte; textos e estrutura travados só mudam com autorização; ícones Phosphor só com função; movimento só como resposta a ação (150–300 ms, `transform`/`opacity`, desligado com `prefers-reduced-motion`).

## 0. Como esta rodada foi feita

| Item pedido | Situação |
|---|---|
| `/impeccable critique` | Rodado em duas avaliações isoladas (A e B) e sintetizado aqui. |
| `/impeccable audit` | Rodado como varredura de código e medição (resumo em §3); ele não tem comando separado de pontuação além deste relatório. |
| frontend-design, typography, spacing, colour-palette, anti-slop, viewports | Carregadas e aplicadas como régua (pesos ≤ 600, mínimo 12 px, grade de 8/4, 1 acento, sem pílula decorativa, 375 sem overflow, alvos 44 px). |
| **Emil Kowalski: `break-ui` e `find-animation-opportunities`** | **Não estão instalados** (não aparecem entre as skills disponíveis). Fiz os dois testes à mão: estresse de DOM no navegador (§5) e inventário de movimento no CSS (§8). |
| Plugin Impeccable | Já presente (`PRODUCT.md` criado no init, hook e skill locais). |

**Arquivos que o Impeccable criou no projeto (todos listados, como pedido):**
- `PRODUCT.md` (raiz): registro de produto do init.
- `.impeccable/config.local.json` (consentimento do hook).
- `.claude/settings.local.json` (hooks do detector: SessionStart, PostToolUse em Edit/Write, Stop).
- `.claude/agents/` (4 subagentes do Impeccable) e `.claude/skills/impeccable/` (referências e scripts).
- `.gemini/settings.json`.
- Ao fim desta rodada, o snapshot da crítica em `.impeccable/critique/` (ver §12).
Fora do Impeccable, desta tarefa: `docs/critique/` (este relatório e os screenshots numerados).

**Limites do que foi capturado:**
- A **barra com planilha carregada** foi simulada no navegador respondendo ao `GET /api/planilha` com um objeto de exemplo (nome longo de arquivo). Nada foi enviado nem gravado no servidor.
- O estado de **erro** é o real da Etapa 3 sem planilha ("Esta etapa ainda não tem ranking publicado"). Não foi possível provocar erro de rede sem simulação, e não simulei.
- **Aguardando regra vazio** não foi capturado (a Etapa 2 tem 126 pendentes; a Etapa 1 não foi auditada nesta rodada). **Divergências vazio** foi capturado (a Etapa 2 tem 0).
- A "carregando" é só a barra de progresso da Etapa 2; o Consolidado "carregando" não foi capturado.
- O indicador "N / Cache disabled" no canto inferior esquerdo é do Next em desenvolvimento, não do produto. Em 375 px ele cobre conteúdo nas capturas; **desligar nas capturas "depois"**.

## 1. Veredito de especificidade

**Intercambiável na casca, específico no conteúdo.** O que é do produto: a linha "Site 1.008 → Correto 1.260 −252", a conta em blocos "1.000 × 0,84 × 1,5 = 1.260" no painel, a aba Regras. O que serve para qualquer ferramenta escura: título + cinco pílulas + abas em cápsula + cartões arredondados + chips. Trocando o logo, a tela serviria para outra ferramenta interna. A identidade herdada do site do evento é só "preto + um laranja".
Detector determinístico: **1 achado** (`side-tab`, `app/globals.css:416`, `.aviso-acordo`), verdadeiro positivo, mas fica dentro do painel (ver §7).

## 2. Nota de saúde do design (Nielsen, 0–4)

| # | Heurística | Nota | Problema-chave |
|---|---|---|---|
| 1 | Visibilidade do estado | 3 | Progresso honesto ("Lendo jogadores: 39 de 208"). O selo "✓ Conta conferida…" ao lado de 7 erros soa como veredito positivo. |
| 2 | Linguagem do usuário | 3 | Vocabulário certo. Rótulos de causa longos viram filtros enormes. |
| 3 | Controle e liberdade | 3 | Fechar, Anterior/Próximo, Voltar à auditoria, remoção com confirmação. |
| 4 | Consistência | 2 | Três linguagens de controle (pílula de barra, cápsula de aba, chip) com o mesmo raio e peso; tabela do Consolidado em caixa, Regras sem caixa, listas em cartão por linha. |
| 5 | Prevenção de erro | 3 | Confirmação existe; "Sim"/"Não" têm o mesmo peso e rótulos fracos para ação coletiva. |
| 6 | Reconhecimento | 2 | "Baixar relatório" × "Exportar dados" não se distinguem; "Identificador" sem função clara. |
| 7 | Eficiência | 2 | Sem ordenação por coluna em Jogadores/Consolidado; 12 chips por visita. |
| 8 | Minimalismo | 2 | Barra com 5 pílulas; faixa de 4 metadados soltos; o número 7 aparece 3 vezes no Resumo. |
| 9 | Recuperação de erro | 2 | O erro da Etapa 3 não aponta "Enviar planilha", que é a saída real. |
| 10 | Ajuda | 2 | "Como começar" só no estado vazio; painel não aponta para Regras. |
| **Total** | | **24/40** (A deu 25; ajustei a nota 6 após conferir) | **Aceitável** |

## 3. Auditoria técnica (Impeccable audit, pontuação 0–4)

| # | Dimensão | Nota | Achado-chave |
|---|---|---|---|
| 1 | Acessibilidade | 3 | **Contraste: 0 pares abaixo de 4,5:1** na varredura do Resumo e do Consolidado (menor medido: th 6,39:1). Alvos < 44 px: 0 em 1440 e 375. Foco visível OK (2 px laranja/pêssego, offset 3 px). Dúvida do agente A sobre contraste do chip de diferença **não se confirmou**. Lacuna: abas (`role=tab`) não foram tabuladas na medição. |
| 2 | Desempenho | 3 (provisório) | Não medi tempo de carga. Pelo código: só CSS, listas paginadas de 50 (`Paginada.tsx`), Consolidado fatiado por `mostrar`. |
| 3 | Tema | 3 | Todo hex está em tokens `:root` (14 ocorrências); nenhum hex em `app/components/*.tsx`. Pesos 400/500/600. Alguns tamanhos fora de token (18, 21, 24, 56 px). |
| 4 | Responsivo | 2 | Sem overflow de página em 375 (scrollWidth = clientWidth em todas as abas), mas a barra fixa ocupa 234 px de 812 e o cabeçalho antes do 1º dado passa de 500 px. |
| 5 | Integridade | 3 | Coerente, com 1 achado `side-tab` e a mistura de laranja = ação e = destaque. |
| **Total** | | **14/20** | **Bom** (atacar responsivo e consistência) |

Medições do navegador (agente B, desktop com zoom ~0,73 no Playwright; alvos e overflow conferidos também em 375): fontes < 12 px: 0; tamanhos de fonte distintos por tela: 5 a 6; box-shadow: nenhum; transições: `.btn` 0,15 s `transform`, `.cartao` 0,2 s `transform`; animação: `barra-entrar` 0,3 s; `prefers-reduced-motion` desliga tudo (`transition/animation: none`).

## 4. Achados por tela

Legenda: gravidade **alta / média / baixa**. Arquivos são onde o ajuste seria feito; seletores vêm de `app/globals.css`. Sufixos de screenshot: `-1440` e `-375` (pasta `docs/critique/`).

### 4.1 Tela inicial (`01-tela-inicial`)
- **alta** Título "Como começar" a ~56 px (`.comecar h2`, `--fs-exibicao`) é o maior texto do produto, num app de uso recorrente. Reduzir para a escala de subtítulo.
- **média** Três passos em caixa com divisórias, numerais 1/2/3 enormes, o "2" em laranja (laranja = ação, aqui é só um número). Bloco centralizado em tela de trabalho. `.passos`, `.numero`.
- **média** `.comecar` e `.passos li` animam na carga com atraso escalonado (30/60/90 ms): não é resposta a ação; contraria a regra de movimento.
- **baixa** 1/3 da tela vazio embaixo no 1440.

### 4.2 Barra superior sem planilha (`01-tela-inicial`, `03-resumo`)
- **alta** Logo em caixa com borda (184×64, raio 16, borda 1 px, degradê) ao lado do título de 44 px: reprovação explícita. `.logo` (globals.css 115), `app/page.tsx:364`. Origem: PNG de fundo opaco (`public/logo-spt.png`).
- **alta** Cinco pílulas de mesmo tamanho (44 px, raio 999, 16 px/500): só "Auditar etapa" se destaca; Enviar, Baixar, Exportar e Consolidado têm o mesmo peso. `Barra.tsx`, `.btn`, `.btn.sec`.
- **alta (375)** A barra fixa mede **234 px de 812** (29%) já sem dados; botões em 3 linhas; antes do primeiro resultado passam de 500 px (`03-resumo-375`, `04-erros-375`, `07-torneios-375`). `.barra-topo` é `position: sticky`.
- **média** Faixa de confiança com 4 itens soltos e o selo âmbar "✓ Conta conferida…" (pílula decorativa em volta de metadado estático). `.confianca`, `.selo`.
- **média** Rótulo "Etapa" em 13 px cinza (`.campo > label`); título "Auditoria do Ranking" não diz a etapa em uso; só o seletor.
- **baixa** Estados desabilitados: "Baixar relatório/Exportar dados" ficam cinza demais e diferem pouco do secundário habilitado.

### 4.3 Barra com planilha carregada (`12-barra-com-planilha`, `12b-barra-confirmar-remocao`) — simulada
- **média** A marca "Planilha carregada: arquivo · enviada em…" é uma linha de apoio de 13 px; o X (44 px, círculo) fica sozinho no fim da linha e, em 375, **órfão numa linha própria** (`12-barra-com-planilha-375`). `Planilha.tsx`, `.marca-planilha`, `.x-planilha`.
- **média** Nome de arquivo longo não trunca (só quebra). Truncar no meio.
- **média** Confirmação "Remover a planilha para todos? Sim / Não": dois `btn sec` idênticos. A ação coletiva e destrutiva não tem peso próprio. Rótulos "Sim/Não" são **travados** (PLANILHA_ITENS): só estilo e ordem de foco mudam sem autorização.
- **baixa** Com planilha na Etapa 3 a tela ainda mostra "Como começar" (onboarding repetido) em vez de um estado "pronto para auditar".

### 4.4 Resumo (`03-resumo`, `03b-resumo-pagina-inteira`)
- **alta** Seis cartões de indicador iguais (raio 24, mesmo peso), só "7 Erros" em laranja. `.cartao`, `.cartao.destaque`, `Resumo.tsx:40`.
- **alta** **Laranja com dois significados:** cartão "Erros" laranja cheio = destaque de erro, igual ao laranja da ação "Auditar etapa". Em auditoria isso engana.
- **média** Veredito de ~45 palavras a 28–30 px, última linha curta ("de regra."). `.veredito`.
- **média** Redundância: o número 7 e o 126 aparecem na frase, nos cartões e na lista "Como ficaram os 270 resultados"; barras de 96 px não comunicam proporção. `.situacoes`.
- **média** Linhas "0" (Corretos com inscritos do site, Revisar) ocupam espaço mesmo apagadas.
- **baixa** O cartão "95,1%" quebra em duas linhas e fica de altura diferente.
- **baixa** Cartões levantam `translateY(-2px)` no hover; é decoração, não resposta a ação.

### 4.5 Erros (`04-erros`, `04b-erros-pagina-inteira`, `14-quebra-erros`)
- **alta** 12 chips em 3 linhas (Causa 3 + Torneio 6 + Ordenar 3; "EV #11 HIGH ROLLER 50K" órfão). `.filtros`, `.chip`, `Erros.tsx:43-74`. Reprovação explícita.
- **alta** Chip ativo = creme cheio: a maior mancha clara da tela, compete com o laranja de ação. `.chip.ativo`.
- **média** Cada linha é um cartão com borda e raio; o torneio "flutua" no meio e começa em x diferentes (538, 551, 564). Alinhar em coluna fixa. `.linha-erro`.
- **média** Em 1440 a lista ocupa a largura toda: 400+ px entre jogador e valores dificulta seguir a linha.
- **baixa** Nomes vêm da fonte em caixas diferentes ("BRENNO LENZI RESENDE", "Caio Fábio russo"); não podem mudar, mas o negrito amplifica.

### 4.6 Divergências (`05-divergencias`)
- **média** Vazio = caixa de uma linha ("Nenhuma divergência de inscritos nesta etapa.") sobre 2/3 de tela vazia; lê-se como tela quebrada. Tratar como confirmação (ícone Check + texto, sem caixa de alerta). Texto: ver §6 (pode ser travado).
- **baixa** O contador "0" tem o mesmo peso dos contadores com dados.

### 4.7 Jogadores (`06-jogadores`) — só cor e fonte
- **média (cor)** "+252" em laranja (`.dif.pos`): laranja = ação aqui vira "diferença". Passar para a cor de erro.
- **média (cor/fonte)** "4 resultados · 1 erro" em 13 px cinza médio: subir contraste.
- **baixa (cor)** Campo "Buscar jogador" quase sem borda no fundo; subir contraste da borda.
- Estresse: nome longo quebra em 4 linhas sem quebrar o layout (`14c-quebra-jogadores`).
- **Não mexer:** layout das linhas, raio, espaçamento, textos. Atenção: `.linha-erro`, `.chip`, `.dif`, `.busca` são **classes compartilhadas** com Erros e o painel (ver §9).

### 4.8 Torneios (`07-torneios`)
- **alta** Cada torneio é um cartão alto com duas a três linhas e a frase "Buy-ins — · Re-entries — · Ações — · não informado pelo site" **repetida nos 9 cartões**. Colunas alinhadas, sem caixa por linha. `.linha-erro.torneio`, `Outras.tsx`.
- **média** "Com erro / Sem problema" em 12–13 px cinza ao lado do nome: o status é o item mais importante da linha e é o mais fraco.
- **média (375)** O ícone ✕/✓ fica **acima** do título e o cartão passa de 4 linhas (`07-torneios-375`).
- **baixa** O Dia Final tem 3 linhas e fica mais alto, sem hierarquia.

### 4.9 Aguardando regra (`08-aguardando-regra`)
- **média** Causa → decisão → evidência está bem estruturado, mas a "Decisão que resolve" (a ação) fica no mesmo peso do texto e as evidências atrás de um `<details>` com marcador nativo ▸. `Outras.tsx:165`, `details`, `summary`.
- **baixa** 126 de 270 resultados (46,7%) tratados como nota de rodapé; 2/3 da tela vazia.

### 4.10 Regras (`09-regras`)
- É a **tela mais coerente** (tabelas sem caixa, linhas finas). **média** "Participação nos flights" mistura regra, exemplo, fonte e hipótese em 4 parágrafos de 13–16 px; "Fonte: …" em 12–13 px cinza com pouco contraste. **baixa** As duas tabelas lado a lado deixam "Posição" a ~480 px de "Pontos".

### 4.11 Consolidado (`11-consolidado`, `11b-consolidado-pagina-inteira`)
- **alta** Tabela em caixa arredondada com cabeçalho em bloco cinza (`.quadro-rolagem`, `.tabela-cons`, `.tabela-cons thead th`). Reprovação explícita.
- **alta** Ao entrar na vista, o `h2` "Consolidado" recebe foco programático e aparece **com uma caixa clara em volta** (`.cons-topo h2:focus-visible`), que parece defeito (visível em `11-consolidado-1440`).
- **média** O aviso "328 resultados aguardando regra não entram na soma" é o dado mais importante do Consolidado e usa uma caixa laranja/marrom (laranja = ação). `.aviso.atencao`, `.aviso-fixo`.
- **média** "Por etapa" e "Avisos (1)" são `<details>` crus. O botão "Consolidado" ativo é só um fundo cinza (igual ao hover). Rótulos "Etapa" e "Buscar jogador" desalinhados (366 × 359). "Auditar etapa" continua laranja numa vista em que não se aplica.
- **média (375)** Coluna "Jogador" fixa e boa; o cabeçalho antes da tabela passa de 600 px.

### 4.12 Painel lateral (`10-painel-resultado`) — só cor e fonte
- **média (cor)** "Pontos corretos 1.260" em laranja cheio (`.fator.total`): mesma cor da ação "Marcar como revisado". Usar `--estado-correto` (creme) no resultado.
- **média (cor/fonte)** Rótulos "Jogador / Torneio / Posição" em 13 px cinza × valores em 16 px: subir contraste.
- **média (cor)** A caixa "Houve acordo neste torneio" é um checkbox nativo; só `accent-color`/contraste do marcado.
- **média (375)** O rodapé fixo (Anterior / Próximo / Marcar como revisado) ocupa 2 linhas e cobre conteúdo.
- **Detector:** `.aviso-acordo` com `border-left: 3px` (`side-tab`). Corrigir exige mexer em borda/forma dentro do painel: **bloqueado pela restrição**, pede autorização (§6).

### 4.13 Estados carregando, vazio e erro
- **carregando (`02-carregando`)**: bom (número real, sem spinner). **média** o corpo fica 100% vazio e os botões mudam de largura ("Auditando…") deslocando "Enviar planilha"; "Enviar planilha" e "Consolidado" ficam habilitados enquanto os outros desabilitam, sem critério visível.
- **erro (`13-etapa3-sem-dados`)**: **média** caixa vermelha de uma linha, correta no que diz, mas sem rota de recuperação (a saída é "Enviar planilha").
- **vazio**: ver 4.6, 4.1 e 4.3.

## 5. Teste de quebra (break-ui feito à mão; nada salvo no app)

Método: no navegador, em 1440 e 375, injetei no DOM da aba Erros 300 linhas clonadas (307 no total), um nome de 80 caracteres + 78 letras sem espaço, e números de `9.999.999.999,99` e `−1.234.567.890,12`. Depois repeti o nome longo na aba Jogadores. Capturas: `14-quebra-erros`, `14b-quebra-erros-linha-longa`, `14c-quebra-jogadores`.

| Cenário | Resultado |
|---|---|
| Overflow horizontal de página | **0 px** em 1440 e 375 (também na aba Jogadores) |
| Nome longo sem espaços | Quebra (`overflow-wrap: anywhere`), linha cresce a ~4 linhas e empurra a lista; sem corte. Aceitável. |
| Números enormes na linha | Nenhum elemento da linha passa da viewport (medido por script; **não confirmado por screenshot em 375**: a captura rolou além da linha alterada) |
| 307 linhas | A página chega a 19 047 px (1440) e 36 023 px (375) se renderizadas todas. **Na prática o app pagina de 50 em 50** (`Paginada.tsx`: "Mostrar mais (n restantes)") e o Consolidado fatia por `mostrar`; o risco real é só o custo de rolagem em 375 ao clicar "Mostrar mais" várias vezes. |
| Lista vazia | Divergências vazio ok (ver 4.6). Aguardando vazio, Consolidado vazio e Torneios vazio **não testados**. |
| Painel com nome longo; Excel | **Não testados** |

## 6. Ajustes por impacto (b)

"Só visual" = cor, fonte, espaço, raio, acabamento, classes CSS e `className` nos componentes, sem mudar nomes, ordem, abas, seções, blocos, parâmetros do endereço, atalhos nem texto. O `tests/interface.test.ts` só confere as constantes de `estrutura.ts` e se os componentes ainda as importam; ele **não lê CSS**.

| # | Ajuste | Marca | Onde |
|---|---|---|---|
| 1 | **Logo sem caixa, borda ou degradê**, a 140–160 px, direto sobre o fundo. Requer arquivo vetorial/transparente da equipe do SPT; sem ele, só remover borda e raio e igualar o fundo do PNG à faixa. | só visual (o arquivo é entrega externa) | `globals.css` `.logo`, `.topo`; `app/page.tsx:364`; `public/` |
| 2 | **Barra: hierarquia de papéis.** Auditar etapa = único primário; Enviar planilha = secundário em anel; Baixar relatório e Exportar dados = terciário (texto com anel leve, divisória à esquerda); Consolidado = fica separado, à direita, estilo próprio. Mesma ordem, mesmos nomes. | só visual | `Barra.tsx` (classes), `.btn`, `.btn.sec`, `.controles` |
| 3 | **Barra no celular compacta:** controles em 2 linhas, faixa de confiança sem 4 itens soltos, barra fixa ≤ 160 px (ou só a linha Etapa + Auditar fixa). Mover os itens para um menu ("Mais") muda estrutura. | só visual; **menu "Mais" pede autorização** (reordena/oculta itens da barra) | `.barra-topo`, `.controles`, `.confianca`, media 720 |
| 4 | **Laranja só para ação.** Estado de erro/diferença usa `--caneta`/`--estado-erro*`; resultado correto usa `--estado-correto`. Cartão "Erros" deixa de ser laranja cheio; `.dif.pos` e `.fator.total` mudam de cor; aviso do Consolidado deixa de ser caixa laranja. | só visual (nas áreas do painel e Jogadores é **só cor**, permitido) | `.cartao.destaque`, `.dif.pos`, `.fator.total`, `.aviso.atencao` |
| 5 | **Abas sem preenchimento:** texto + traço de 2 px laranja embaixo (ou anel), sem trilho; contador como número simples. | só visual, **mas `docs/interface.md` descreve "Abas (botões segmentados)"**: atualizar essa linha exige OK do usuário | `Abas.tsx`, `.abas`, `.aba`, `.contador` |
| 6 | **Filtros de Erros em 1 linha por grupo** (rolagem horizontal interna), chip ativo = anel laranja e texto, não creme cheio; rótulos de causa com truncamento e `title`. Trocar chips por `<select>` muda controle e comportamento. | só visual; **select pede autorização** | `Erros.tsx`, `.filtros`, `.chip` (escopo por classe nova: o chip de Jogadores usa a mesma classe) |
| 7 | **Resumo com 1 indicador dominante** (erros e pontos em discordância maiores; os demais menores), veredito com largura/quebra melhor, barras de composição em largura total. Converter cartões em linhas de texto muda o bloco "Indicadores" (cartões clicáveis). | só visual (tamanho/peso/fundo); **cartões → texto pede autorização** | `Resumo.tsx`, `.cartoes`, `.cartao`, `.situacoes` |
| 8 | **Linhas e tabelas sem caixa:** Erros e Torneios com divisória fina e colunas alinhadas; Consolidado sem moldura e com cabeçalho leve (12–13 px, sem bloco cinza). Escopar por classe nova para não alterar Jogadores e o painel. | só visual | `.linha-erro`, `.cartao-torneio`, `.quadro-rolagem`, `.tabela-cons`; `Erros.tsx`, `Outras.tsx`, `Consolidado.tsx` |
| 9 | **Títulos com sistema:** escala fixa (h1/h2/h3), peso 500–600, tracking −0,015 a −0,03 em, espaço acima/abaixo constantes. **Minúscula, ponto final e itálico** nos nomes travados (abas, seções do Resumo, botões) **pedem autorização**; nos títulos que não estão em `estrutura.ts` (ex.: "A fórmula", "Como ficaram os n resultados") ainda é texto, então também pede. | tipografia: só visual; ponto/itálico/minúscula: **pede autorização** | `h1`–`h4` em `globals.css`; `app/page.tsx` |
| 10 | **Tela inicial:** "Como começar" menor e à esquerda, passos sem caixa; sem animação de carga. | só visual | `.comecar`, `.passos` |
| 11 | **Planilha:** X com rótulo/tooltip visível, nome do arquivo truncado, "Sim" com tratamento de ação destrutiva, foco inicial em "Não" (já existe). | só visual; **trocar "Sim/Não" por "Remover/Manter" pede autorização** (PLANILHA_ITENS) | `Planilha.tsx`, `.marca-planilha`, `.confirmar-remocao` |
| 12 | **Consolidado:** tirar a caixa de foco do `h2` (foco programático), estado "ativo" do botão Consolidado distinto do hover, alinhar rótulos, `<details>` sem marcador nativo. | só visual | `.cons-topo h2`, `.btn.sec[aria-pressed]`, `.cons-controles` |
| 13 | **Estados:** carregando mantém a forma da página (sem salto de largura nos botões); vazio de Divergências com ícone Check; erro com ação de recuperação. **Texto novo** ("use Enviar planilha…", "o que significa 0 divergências") **pede autorização**. | visual: só visual; texto: **pede autorização** | `page.tsx`, `Outras.tsx`, `.aviso` |
| 14 | **Contrastes finos:** rótulos de 13 px (`.campo > label`, `h4`, `dl dt`), "Fonte:" em Regras e "4 resultados · 1 erro" sobem para `--mist-2` mais forte ou 14 px. | só visual (no painel e em Jogadores, só cor/fonte) | `--mist-2`, `.muted`, `.small` |
| 15 | `.aviso-acordo` (`side-tab`, detector): trocar a borda lateral por borda inteira. | **pede autorização** (está no painel; só cor é permitido) | `globals.css:416` |
| 16 | Ícones (§7) | só visual; **por último** | `Barra.tsx`, `Planilha.tsx`, `Outras.tsx`, `Painel.tsx` |
| 17 | Movimento (§8) | só visual; **por último** | `globals.css` |

**Itens que exigem autorização, em resumo (e por quê):**
1. Minúscula, ponto final e itálico em nomes travados e em títulos (§6.9): muda o texto/forma de nomes protegidos.
2. Menu "Mais" ou ocultar botões da barra no celular (§6.3): muda a estrutura da barra.
3. Atualizar `docs/interface.md` ("botões segmentados" → abas com traço) (§6.5).
4. Trocar chips por `<select>` (§6.6) e cartões por linhas de texto (§6.7): muda controle/bloco travado.
5. Rótulos "Remover/Manter" no lugar de "Sim/Não" (§6.11): PLANILHA_ITENS.
6. Textos novos nos estados de erro, vazio e Etapa 3, e a versão das regras junto do Identificador (§6.13).
7. Ordenação por coluna em Jogadores/Consolidado e contador "3 de 7" no painel: comportamento novo (Jogadores e painel são só cor e fonte).
8. Borda do `.aviso-acordo` dentro do painel (§6.15).
9. Posição do selo "Conta conferida…" ou da faixa de confiança, se for mudar de lugar.

## 7. Mapa de ícones (Phosphor, MIT)

Regra: ícone só onde dá função (estado, baixar, enviar, remover, abrir). Sempre com texto ou `aria-label`; `aria-hidden` quando há texto ao lado. Peso `regular`, 16–20 px, cor do texto.

| Onde | Ícone | Função |
|---|---|---|
| Baixar relatório e Exportar dados (barra) | `DownloadSimple` | distingue saída de navegação |
| Enviar planilha (barra) | `UploadSimple` | entrada de dados |
| X da marca "Planilha carregada" | `X` | remover (já é um X desenhado à mão; unificar) |
| Botão "Fechar" do painel | `X` | fechar |
| Anterior / Próximo (painel) | `ArrowLeft` / `ArrowRight` | trocar as setas de texto (← →) |
| "Site X → Correto Y" | `ArrowRight` | trocar o "→" de texto (alinhamento) |
| Estado dos torneios e linhas (✓ / ✕) | `CheckCircle` / `XCircle` | estado com forma + cor, uniformiza os círculos desenhados |
| Selo "Conta conferida por dois cálculos…" | `Check` (ou `SealCheck`) | trocar o ✓ de texto |
| Vazio de Divergências | `Check` pequeno | confirma o resultado sem ilustração |
| Marcador de `<details>` (Por etapa, Avisos, Ver os resultados) | `CaretRight` (gira 90° ao abrir) | substitui o ▸ nativo |
| Aviso real ("dados mudaram", Avisos do Consolidado) | `Warning` | só quando houver aviso |

**Onde nenhum ícone entra:** logo e título; "Auditar etapa" e "Consolidado" (o rótulo basta); abas; chips de filtro; cartões do Resumo; "Como começar" e seus passos (os números 1/2/3 são sequência real); estados vazios sem ação; tabela de Regras; títulos de seção; painel lateral e Jogadores (travados: só entram ícones que já existem como texto, e só se o usuário autorizar).
Implementação sugerida (decisão a confirmar): SVGs inline copiados do Phosphor (MIT), num pequeno componente `Icone`, em vez de adicionar a dependência `@phosphor-icons/react` (menos bytes e sem novo pacote). Fica para o fim.

## 8. Mapa de movimento (find-animation-opportunities feito à mão)

Regra: resposta a ação, 150–300 ms, `transform`/`opacity`, curva `cubic-bezier(0.16, 1, 0.3, 1)`, desligado em `prefers-reduced-motion` (já existe, global).

**Onde sim:**
| Onde | Movimento | Duração |
|---|---|---|
| Botão pressionado | `scale(.98)` (já existe) | 150 ms |
| Troca de aba | traço da aba ativa desliza (`transform`) e conteúdo faz fade (`opacity`) | 200 ms |
| Chip ativado/desativado | cor/anel (sem `translate`) | 150 ms |
| Abrir/fechar `<details>` e confirmação inline ("Remover a planilha…", "Remover acordo") | `opacity` + `translateY(4px)` | 200 ms |
| Painel lateral | entrada com `translateX` e `opacity` (já existe) | 300 ms |
| Barra de progresso da leitura | `scaleX` (já existe) | 200 ms |
| Entrar no Consolidado | fade (já existe `entrada`) | 200 ms |
| Resultado da auditoria aparecendo depois de "Auditar etapa" | fade do Resumo, sem escalonar | 200 ms |

**Onde NÃO deve haver:**
- Carga da tela inicial: `.comecar` e `.passos li` (stagger de 30/60/90 ms): **remover**, não é resposta a ação.
- Hover de cartão com `translateY(-2px)` (`.cartao`, `.cartao-torneio`): **remover**; só cor/anel.
- Linhas das listas e tabelas (270+): nenhuma animação de entrada, de ordenação ou de hover além da cor.
- Números e contadores: sem contagem animada.
- Erros e avisos: sem tremor nem pulso.
- Spinners ou brilhos contínuos, parallax, rolagem controlada: proibidos.
- Painel e Jogadores: nada novo (só cor e fonte).
Observação de acessibilidade: o `prefers-reduced-motion` global zera tudo; as mudanças de estado continuam visíveis porque são trocas de cor/forma instantâneas. Manter assim.

## 9. Plano de refinação em passos pequenos (c)

Cada passo é um commit lógico (a você decidir), com critério de aceite por screenshot **antes** (os de `docs/critique/` desta rodada) e **depois** (mesmo nome, sufixo `-depois`), em 1440 e 375, com o indicador do Next desligado, e `npm test` (tests/interface.test.ts) verde. Verificação mínima em todo passo: nenhum overflow de página em 375, alvos ≥ 44 px, nenhum texto < 12 px, foco visível, contraste ≥ 4,5:1 nos textos novos.

| Passo | Escopo | Aceite (antes → depois) |
|---|---|---|
| 0 | Linha de base: desligar o indicador de dev nas capturas, congelar os screenshots atuais, `npm test` verde, registrar `git diff --stat` | `01`–`14` existem nos dois tamanhos |
| 1 | **Logo** (ajuste 1) | `01-tela-inicial` e `03-resumo`: sem caixa, sem borda; 140–160 px; respiro ≥ altura do logo; em 375 não passa de 56 px de altura |
| 2 | **Barra superior, desktop** (ajuste 2) | `03-resumo-1440`: 1 primário, 1 secundário, 2 terciários agrupados, Consolidado separado; mesma ordem e textos; barra ≤ 90 px de altura quando sem faixa |
| 3 | **Barra no celular** (ajuste 3) | `03-resumo-375` e `04-erros-375`: barra fixa ≤ 160 px; primeiro resultado visível sem rolar na maior parte das telas |
| 4 | **Semântica de cor** (ajuste 4, incluindo painel e Jogadores só em cor) | `03-resumo`, `06-jogadores`, `10-painel-resultado`: laranja só em ação; erro em vermelho; resultado correto em creme |
| 5 | **Abas** (ajuste 5, depois de autorizar a linha em `docs/interface.md`) | `03`–`09` em 1440 e 375: sem preenchimento; em 375 o recorte da faixa tem indício (fade) |
| 6 | **Filtros de Erros** (ajuste 6) | `04-erros-1440`: 3 grupos em 3 linhas no máximo, cada um em 1 linha; chip ativo sem creme cheio |
| 7 | **Linhas** de Erros e Torneios (ajuste 8, escopado) | `04-erros`, `07-torneios`: sem caixa por linha, colunas alinhadas; **`06-jogadores` idêntico ao "antes" em layout** |
| 8 | **Resumo** (ajuste 7) | `03-resumo` e `03b`: 1 indicador dominante; veredito sem linha órfã; barras de composição em largura total |
| 9 | **Consolidado** (ajustes 8 e 12) | `11-consolidado`: sem moldura e sem caixa de foco no título; estado ativo do botão distinto |
| 10 | **Tipografia e títulos** (ajuste 9, só a parte visual sem texto) | escala de 6 passos; `h1`/`h2`/`h3` consistentes em todas as telas |
| 11 | **Tela inicial e estados** (ajustes 10 e 13, parte visual) | `01`, `02`, `05`, `13`: "Como começar" menor; carregando sem salto; vazio com Check |
| 12 | **Planilha e confirmação** (ajuste 11) | `12`, `12b` em 375: X na mesma linha, nome truncado, "Sim" com peso próprio |
| 13 | **Contrastes finos e Aguardando/Regras** (ajuste 14) | `08`, `09`: rótulos e "Fonte:" legíveis |
| 14 | **Ícones** (§7) — *fica para o fim* | cada ícone da tabela presente, com `aria-hidden`/rótulo, nenhum fora da lista |
| 15 | **Movimento** (§8) — *fica para o fim* | stagger e elevação removidos; com `prefers-reduced-motion` nada anima; nenhuma animação > 300 ms |
| 16 | Revisão final: `impeccable detect app`, nova auditoria, nova crítica, `npm test`, `npm run build` | detector sem achados (exceto o do painel, se não autorizado); nota de saúde ≥ 30/40 |

Dependências: 5 espera a autorização; 9 e 10 dependem do 1–2 para os tamanhos definitivos; 14 e 15 só depois de 1–13.

## 10. Riscos (f)

**Testes de interface.** `tests/interface.test.ts` valida só `estrutura.ts` e se cada componente importa `estrutura`. CSS e `className` não quebram o teste. Quebram: renomear itens, trocar a ordem das abas/botões, mover textos para fora de `estrutura.ts`, deixar de importar. Adicionar ícones sem alterar o `textContent` dos rótulos é seguro; trocar "Sim/Não" ou títulos exige atualizar a constante e portanto autorização.

**Painel lateral e Jogadores — o que sofreriam.** Eles compartilham classes com o resto. Mexer nessas classes muda layout, raio e espaço onde não pode:
- `.linha-erro` (Erros, **Jogadores**, Torneios), `.chip` ("Só com erro" em **Jogadores**), `.busca`, `.dif` (**Jogadores** e painel), `.btn` e `.btn.sec` (rodapé do **painel**), `.bloco`, `.fator`, `.etiqueta`, `.aviso`, `select/input` globais.
- Regra do plano: toda mudança de forma entra por **classe nova escopada** (por exemplo `.erros .linha-erro`), nunca na classe base. Mudanças de **cor** nos tokens/classes compartilhadas são permitidas e vão para os dois.
- Efeito colateral aceito: o painel e Jogadores ficam com raios e espaços antigos (20/14/12 px, cartões por linha) ao lado de telas novas sem caixa. Pode parecer desigual; o usuário decidiu assim.

**Acessibilidade.** Hoje: 0 pares < 4,5:1 e 0 alvos < 44 px (medidos). Riscos das mudanças: aba só com traço precisa manter `role="tab"`, `aria-selected` e foco visível; chip ativo por anel precisa de 3:1 contra o fundo; troca de laranja por vermelho em diferenças deve manter texto e ícone (nunca só cor); abas com rolagem em 375 precisam de indício de continuação; o `prefers-reduced-motion` global está bom, mas o plano deve preservar que mudança de estado seja instantânea e visível; a caixa de foco do título do Consolidado não deve ser removida sem manter o foco programático acessível.

**Desempenho.** Mudanças são de CSS. Ícones em SVG inline (poucos KB) ou pacote com tree-shaking; sem fonte nova; manter `Paginada` e o fatiamento do Consolidado (ver §5). Não animar `box-shadow`, `filter` ou propriedades de layout.

**Outros.** (1) O achado `side-tab` só some se o `.aviso-acordo` mudar de borda: depende de autorização. (2) O app ainda usa `--logo-fundo-*` para combinar com o PNG: se o arquivo mudar, ajustar tokens. (3) A paleta de `docs/marca` e o `docs/DESIGN.md` (rascunho) divergem do app aprovado; **não usá-los** como referência de cor neste plano. Convém marcá-los como superados para não confundir.

## 11. Índice de screenshots (`docs/critique/`)

Sufixos `-1440` e `-375`: `01-tela-inicial` · `02-carregando` · `03-resumo` (+ `03b` página inteira) · `04-erros` (+ `14-quebra-erros`, `14b-quebra-erros-linha-longa`) · `05-divergencias` · `06-jogadores` (+ `14c-quebra-jogadores`) · `07-torneios` · `08-aguardando-regra` · `09-regras` · `10-painel-resultado` · `11-consolidado` (+ `11b` página inteira) · `12-barra-com-planilha` (simulada) · `12b-barra-confirmar-remocao` · `13-etapa3-sem-dados` (estado de erro).

## 12. Snapshot do Impeccable

A crítica foi arquivada em `.impeccable/critique/` pelo comando `critique-storage` (alvo `http://localhost:3000`), para o `/impeccable polish` herdar as prioridades. O servidor de desenvolvimento (`npm run dev`, porta 3000) que subi para as capturas continua rodando em segundo plano.

## 13. Decisões do usuário em 22/10/2026 (resposta às perguntas da crítica)

Valem para o plano; **nada foi implementado**. Ao implementar, registrar cada uma em `CLAUDE.md` e `docs/interface.md` como as autorizações anteriores.

| Decisão | Resposta | Efeito no plano |
|---|---|---|
| Abas como texto com traço laranja; atualizar a linha "Abas (botões segmentados)" de `docs/interface.md` | **Sim** | Passo 5 liberado. |
| Laranja só para ação; erro em vermelho e correto em creme, inclusive só em cor no painel e em Jogadores | **Sim** | Passo 4 liberado (nada de layout no painel e em Jogadores). |
| Títulos em minúsculas com ponto (inclui nomes travados de abas e seções do Resumo) | **Autorizado** | Passo 10 libera minúscula e ponto final. **O itálico em uma palavra não foi autorizado**: fica fora. |
| Textos novos nos estados (erro da Etapa 3 apontando "Enviar planilha"; explicação do vazio de Divergências) | **Autorizado** | Passo 11 libera esses dois textos; qualquer outro texto novo continua pedindo autorização. |
| Filtros de Erros em `<select>` | **Autorizado** | Passo 6 passa de chips em 1 linha para `<select>` de Causa e de Torneio; "Ordenar por" continua como grupo curto. |
| "Remover/Manter" no lugar de "Sim/Não" | **Não autorizado** | Rótulos ficam; só estilo e foco. |
| Não perguntados e portanto **ainda não autorizados**: menu "Mais" na barra, cartões do Resumo como linhas de texto, ordenação por coluna, contador "3 de 7", borda do `.aviso-acordo`, versão das regras junto do Identificador, mover o selo de confiança. | — | Continuam fora do plano. |
