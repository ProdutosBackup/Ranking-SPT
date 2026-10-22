// Cada arquivo de teste usa pastas temporárias próprias para o armazenamento local de acordos e de planilha,
// criadas antes e apagadas depois: os testes nunca leem nem escrevem em .acordos-local/ e .planilha-local/ (os dados do usuário).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll } from "vitest";

let raiz = "";
beforeAll(() => {
  raiz = mkdtempSync(join(tmpdir(), "spt-testes-"));
  process.env.ACORDOS_LOCAL_DIR = join(raiz, "acordos");
  process.env.PLANILHA_LOCAL_DIR = join(raiz, "planilha");
});
afterAll(() => {
  delete process.env.ACORDOS_LOCAL_DIR;
  delete process.env.PLANILHA_LOCAL_DIR;
  rmSync(raiz, { recursive: true, force: true });
});
