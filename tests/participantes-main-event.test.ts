import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { lerParticipantesMainEvent } from "../lib/participantes-main-event";

// Planilha inventada, montada aqui: nomes e números fictícios.
const CAB = ["Jogador", "Dias jogados", "Entradas", "Foi ao Dia Final", "Posição no Dia Final"];
type Linha = (string | number | null)[];
type Abas = Record<string, { cab?: string[]; linhas: Linha[] }>;

const padrao = (): Abas => ({
  Resumo: { cab: ["Etapa"], linhas: [["1a Etapa"]] },
  "1a Etapa": { linhas: [["Ana Teste", "1A", 1, "Não", null], ["Bia Teste", "1A, 1C", 3, "Sim", 7], ["Caio Teste", "", null, "Sim", 2]] },
  "2a Etapa": { linhas: [["Ana Teste", "1B", 2, "Não", null], ["Dora Teste", "1A", 5, "Sim", 1]] },
  "3a Etapa": { linhas: [["Edu Teste", "1E", 4, "Não", null]] },
  "Todas as etapas": { cab: ["Jogador"], linhas: [["Ana Teste"]] },
});

async function montar(abas: Abas): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  for (const [nome, a] of Object.entries(abas)) {
    const ws = wb.addWorksheet(nome);
    ws.addRow(a.cab ?? CAB);
    for (const l of a.linhas) ws.addRow(l);
  }
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

const erros = async (abas: Abas) => {
  const r = await lerParticipantesMainEvent(await montar(abas));
  if (r.ok) throw new Error("esperava erro");
  return r.erros;
};

describe("lerParticipantesMainEvent", () => {
  it("devolve o total de Entradas e o número de jogadores de cada etapa", async () => {
    const r = await lerParticipantesMainEvent(await montar(padrao()));
    expect(r).toEqual({ ok: true, etapas: { 1: { entradas: 4, jogadores: 3 }, 2: { entradas: 7, jogadores: 2 }, 3: { entradas: 4, jogadores: 1 } } });
  });

  it("trata Entradas em branco como 0 (jogador só do Dia Final) e conta o jogador", async () => {
    const a = padrao();
    a["1a Etapa"].linhas = [["Caio Teste", "", null, "Sim", 2], ["Fabi Teste", null, "", "Sim", 3]];
    const r = await lerParticipantesMainEvent(await montar(a));
    expect(r.ok && r.etapas[1]).toEqual({ entradas: 0, jogadores: 2 });
  });

  it("ignora a coluna extra 'Voltar ao Resumo' e as linhas em branco", async () => {
    const a = padrao();
    a["2a Etapa"] = { cab: [...CAB, "Voltar ao Resumo"], linhas: [["Ana Teste", "1B", 2, "Não", null, "Voltar"], [null, null, null, null, null], ["Dora Teste", "1A", 5, "Sim", 1, 99]] };
    const r = await lerParticipantesMainEvent(await montar(a));
    expect(r.ok && r.etapas[2]).toEqual({ entradas: 7, jogadores: 2 });
  });

  it("aceita o nome da aba com ª ou º e com outras maiúsculas", async () => {
    const a = padrao();
    a["1ª ETAPA"] = a["1a Etapa"];
    delete a["1a Etapa"];
    const r = await lerParticipantesMainEvent(await montar(a));
    expect(r.ok && r.etapas[1].jogadores).toBe(3);
  });

  it("recusa arquivo que não é .xlsx", async () => {
    expect(await lerParticipantesMainEvent(new TextEncoder().encode("não sou planilha"))).toEqual({ ok: false, erros: ["O arquivo não é uma planilha .xlsx válida."] });
    // cabeçalho PK, mas conteúdo quebrado
    expect(await lerParticipantesMainEvent(new Uint8Array([0x50, 0x4b, 1, 2, 3, 4]))).toEqual({ ok: false, erros: ["O arquivo não é uma planilha .xlsx válida."] });
  });

  it("avisa de cada aba de etapa ausente", async () => {
    const a = padrao();
    delete a["2a Etapa"];
    delete a["3a Etapa"];
    expect(await erros(a)).toEqual(['A planilha não tem a aba "2a Etapa".', 'A planilha não tem a aba "3a Etapa".']);
  });

  it("recusa cabeçalho diferente do esperado", async () => {
    const a = padrao();
    a["3a Etapa"].cab = ["Jogador", "Dias jogados", "Inscrições", "Foi ao Dia Final", "Posição no Dia Final"];
    const e = await erros(a);
    expect(e).toHaveLength(1);
    expect(e[0]).toContain('"3a Etapa"');
    expect(e[0]).toContain("cabeçalho");
  });

  it("recusa Entradas com texto", async () => {
    const a = padrao();
    a["1a Etapa"].linhas[0][2] = "dois";
    const e = await erros(a);
    expect(e).toEqual(['Aba "1a Etapa", linha 2: Entradas precisa ser um número, e veio texto.']);
  });

  it("recusa Entradas negativa ou fracionada", async () => {
    const a = padrao();
    a["1a Etapa"].linhas[0][2] = -1;
    a["2a Etapa"].linhas[0][2] = 1.5;
    const e = await erros(a);
    expect(e).toHaveLength(2);
    expect(e[0]).toContain('"1a Etapa", linha 2');
    expect(e[1]).toContain('"2a Etapa", linha 2');
  });

  it("recusa nome de jogador repetido na mesma aba (sem diferenciar maiúsculas e acentos), mas aceita o mesmo nome em outra aba", async () => {
    const a = padrao();
    a["1a Etapa"].linhas.push(["ANA  TESTÉ", "1C", 1, "Não", null]);
    const e = await erros(a);
    expect(e).toHaveLength(1);
    expect(e[0]).toContain('"1a Etapa"');
    expect(e[0]).toContain("repetido");
  });
});
