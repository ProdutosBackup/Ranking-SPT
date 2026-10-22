import { defineConfig } from "vitest/config";

export default defineConfig({ test: { setupFiles: ["tests/isolar-armazenamento.ts"] } });
