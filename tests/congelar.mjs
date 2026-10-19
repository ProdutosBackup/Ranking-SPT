// Congela as respostas da API do SPT em tests/fixtures/{stage}.json. Uso: node tests/congelar.mjs taua-2026 vale-suico-2026
import { writeFileSync } from "node:fs";
const BASE = "https://supremapokertour.com/api/spt";
const get = async (u) => {
  const r = await fetch(u);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${u}`);
  return r.json();
};
for (const stage of process.argv.slice(2)) {
  const q = encodeURIComponent(stage);
  const ranking = await get(`${BASE}/ranking?stage=${q}`);
  const tournaments = await get(`${BASE}/tournaments?stage=${q}`);
  const playerSummaries = {};
  let i = 0;
  const w = async () => {
    while (i < ranking.ranking.length) {
      const p = ranking.ranking[i++];
      playerSummaries[p.name] = await get(`${BASE}/player-summary?stage=${q}&name=${encodeURIComponent(p.name)}`);
    }
  };
  await Promise.all([w(), w(), w(), w(), w()]);
  writeFileSync(`tests/fixtures/${stage}.json`, JSON.stringify({ stage, ranking, tournaments, playerSummaries }, null, 1));
  console.log(stage, ranking.ranking.length, "jogadores", tournaments.tournaments.length, "torneios");
}
