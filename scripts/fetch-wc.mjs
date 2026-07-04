// Generates wc.js from ESPN's World Cup 2026 API:
//   players: { "Name": { g, a, yc, rc } }  — aggregated tournament stats (only players in data.js)
//   nations: { code: "active" | "out" | "nq" } — tournament status per nation in data.js
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const APP_DATA = new Function(
  `const window={}; ${readFileSync(path.join(root, "data.js"), "utf8")}; return window.APP_DATA;`
)();

const CHAR_MAP = { đ: "d", Đ: "D", ø: "o", Ø: "O", ł: "l", Ł: "L", ı: "i", İ: "I", ß: "ss", æ: "ae", Æ: "AE", ð: "d", þ: "th" };
const norm = (s) =>
  s
    .replace(/[đĐøØłŁıİßæÆðþ]/g, (c) => CHAR_MAP[c] ?? c)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z\s'-]/g, "")
    .toLowerCase()
    .trim();

// our name -> ESPN name, for spellings normalization can't bridge
const ALIASES = {};

const NATION_TO_ESPN = {
  "gb-eng": "England",
  fr: "France",
  br: "Brazil",
  es: "Spain",
  nl: "Netherlands",
  pt: "Portugal",
  ar: "Argentina",
  be: "Belgium",
  it: "Italy",
  no: "Norway",
  se: "Sweden",
  hr: "Croatia",
  hu: "Hungary",
  "gb-nir": "Northern Ireland",
  de: "Germany",
  eg: "Egypt",
  ec: "Ecuador",
  ci: "Côte d'Ivoire",
  dk: "Denmark",
  cm: "Cameroon",
  si: "Slovenia",
  uy: "Uruguay",
  gh: "Ghana",
  pl: "Poland",
  at: "Austria",
  co: "Colombia",
  rs: "Serbia",
  us: "United States",
  ch: "Switzerland",
  tr: "Türkiye",
  ma: "Morocco",
  ge: "Georgia",
};

const ourPlayers = new Map(); // norm -> canonical name
for (const club of APP_DATA.clubs) for (const p of club.rows.flat()) ourPlayers.set(norm(p.name), p.name);
for (const n of Object.values(APP_DATA.nations)) for (const p of n.rows.flat()) ourPlayers.set(norm(p.name), p.name);
for (const [ours, espn] of Object.entries(ALIASES)) ourPlayers.set(norm(espn), ours);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (res.ok) return await res.json();
    } catch {}
    await sleep(800 * (attempt + 1));
  }
  return null;
}

const START = new Date("2026-06-11T00:00:00Z");
const today = new Date();
const dates = [];
for (let d = new Date(START); d <= today; d.setUTCDate(d.getUTCDate() + 1))
  dates.push(d.toISOString().slice(0, 10).replace(/-/g, ""));

const events = [];
for (const date of dates) {
  const sb = await getJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${date}`);
  for (const e of sb?.events ?? []) events.push(e);
  await sleep(150);
}
console.log(`Fetched ${events.length} matches across ${dates.length} days`);

const KO_RE = /round of 32|round of 16|quarter|semi|third place|final/i;
const isKO = (e) => {
  const notes = [...(e.competitions?.[0]?.notes ?? []), ...(e.notes ?? [])]
    .map((n) => n.headline ?? "")
    .join(" ");
  const alt = e.competitions?.[0]?.altGameNote ?? "";
  if (KO_RE.test(notes + " " + alt)) return true;
  if (/group/i.test(notes + " " + alt)) return false;
  return new Date(e.date) >= new Date("2026-06-28T00:00:00Z"); // fallback: knockouts began Jun 28
};

const qualified = new Set();
const koTeams = new Set();
const koLosers = new Set();
let anyKO = false;
for (const e of events) {
  const comp = e.competitions?.[0];
  const teams = (comp?.competitors ?? []).map((c) => c.team?.displayName).filter(Boolean);
  teams.forEach((t) => qualified.add(t));
  if (isKO(e)) {
    anyKO = true;
    teams.forEach((t) => koTeams.add(t));
    if (comp?.status?.type?.completed ?? e.status?.type?.completed) {
      const loser = (comp?.competitors ?? []).find((c) => c.winner === false);
      if (loser?.team?.displayName) koLosers.add(loser.team.displayName);
    }
  }
}

const nations = {};
for (const [code, espnName] of Object.entries(NATION_TO_ESPN)) {
  if (!qualified.has(espnName)) nations[code] = "nq";
  else if (koLosers.has(espnName) || (anyKO && !koTeams.has(espnName))) nations[code] = "out";
  else nations[code] = "active";
}
console.log("nation status:", JSON.stringify(nations));

// per-player stats from every completed match's rosters
const stats = {};
const unmatched = new Map();
let done = 0;
for (const e of events) {
  const completed = e.status?.type?.completed;
  if (!completed) continue;
  const sum = await getJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${e.id}`);
  for (const side of sum?.rosters ?? []) {
    for (const entry of side.roster ?? []) {
      const s = Object.fromEntries((entry.stats ?? []).map((x) => [x.name, x.value ?? 0]));
      const g = s.totalGoals ?? 0, a = s.goalAssists ?? 0, yc = s.yellowCards ?? 0, rc = s.redCards ?? 0;
      if (!g && !a && !yc && !rc) continue;
      const espnName = entry.athlete?.displayName ?? "";
      const ours = ourPlayers.get(norm(espnName));
      if (!ours) {
        unmatched.set(espnName, (unmatched.get(espnName) ?? 0) + g + a);
        continue;
      }
      const t = (stats[ours] ??= { g: 0, a: 0, yc: 0, rc: 0 });
      t.g += g; t.a += a; t.yc += yc; t.rc += rc;
    }
  }
  done++;
  await sleep(150);
}
console.log(`Aggregated ${done} completed matches; ${Object.keys(stats).length} of our players with stats`);

writeFileSync(
  path.join(root, "wc.js"),
  `// Generated by scripts/fetch-wc.mjs — do not edit by hand.\nwindow.WC = ${JSON.stringify(
    { updated: dates[dates.length - 1], players: stats, nations },
    null,
    1
  )};\n`
);
console.log("Wrote wc.js");
const noisy = [...unmatched.entries()].filter(([, v]) => v >= 2);
if (noisy.length) console.log(`Unmatched ESPN players with 2+ goal involvements (candidates for ALIASES):\n  ${noisy.map(([k, v]) => `${k} (${v})`).join("\n  ")}`);
