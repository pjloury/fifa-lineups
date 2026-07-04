// Generates images.js: a { "Player Name": "photo url" } map for every player in data.js.
// EPL-based players get official Premier League headshots (via the FPL API);
// everyone else gets a Wikipedia portrait thumbnail.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataSrc = readFileSync(path.join(root, "data.js"), "utf8");
const APP_DATA = new Function(`const window={}; ${dataSrc}; return window.APP_DATA;`)();

const EPL_CLUB_TO_FPL = {
  Arsenal: "Arsenal",
  "Aston Villa": "Aston Villa",
  Bournemouth: "Bournemouth",
  Brentford: "Brentford",
  "Brighton & Hove Albion": "Brighton",
  Burnley: "Burnley",
  Chelsea: "Chelsea",
  "Crystal Palace": "Crystal Palace",
  Everton: "Everton",
  Fulham: "Fulham",
  "Leeds United": "Leeds",
  Liverpool: "Liverpool",
  "Manchester City": "Man City",
  "Manchester United": "Man Utd",
  "Newcastle United": "Newcastle",
  "Nottingham Forest": "Nott'm Forest",
  Sunderland: "Sunderland",
  "Tottenham Hotspur": "Spurs",
  "West Ham United": "West Ham",
  Wolves: "Wolves",
};

// Wikipedia article titles for names that are ambiguous or differ from the page title.
const WIKI_OVERRIDES = {
  Rodri: ["Rodri (footballer, born 1996)"],
  "João Pedro": ["João Pedro (footballer, born September 2001)"],
  Vitinha: ["Vitinha (footballer, born February 2000)"],
  "Nuno Mendes": ["Nuno Mendes (footballer, born 2002)"],
  Estêvão: ["Estêvão Willian"],
  Trezeguet: ["Trézéguet (Egyptian footballer)"],
  Zizo: ["Ahmed Sayed Zizo", "Zizo (footballer)"],
  "Moumi Ngamaleu": ["Nicolas Moumi Ngamaleu"],
  "Jamal Lewis": ["Jamal Lewis (footballer)"],
  "Wesley Fofana": ["Wesley Fofana (footballer)"],
  "Reece James": ["Reece James (footballer, born 1999)"],
  "Viktor Johansson": ["Viktor Johansson (footballer, born 1998)"],
  "Barnabás Varga": ["Barnabás Varga (footballer, born 1994)"],
  "Gideon Mensah": ["Gideon Mensah (footballer, born 1998)"],
  "Emiliano Martínez": ["Emiliano Martínez (footballer, born 1992)", "Emiliano Martínez"],
  "Alisson Becker": ["Alisson Becker", "Alisson"],
};

const norm = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z\s'-]/g, "")
    .toLowerCase()
    .trim();

// ---- collect every (name, club) pair in the dataset ----
const players = new Map(); // name -> club name (EPL club name or foreign club)
for (const club of APP_DATA.clubs)
  for (const row of club.rows) for (const p of row) players.set(p.name, club.name);
for (const nation of Object.values(APP_DATA.nations))
  for (const row of nation.rows)
    for (const p of row) if (!players.has(p.name)) players.set(p.name, p.club);

// ---- FPL lookup ----
async function fplIndex() {
  const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/", {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`FPL API ${res.status}`);
  const data = await res.json();
  const teamName = Object.fromEntries(data.teams.map((t) => [t.id, t.name]));
  return data.elements.map((e) => ({
    team: teamName[e.team],
    web: norm(e.web_name),
    full: norm(`${e.first_name} ${e.second_name}`),
    tokens: new Set(norm(`${e.first_name} ${e.second_name} ${e.web_name}`).split(/\s+/)),
    photo: e.photo.replace(/\..+$/, ""),
  }));
}

function fplMatch(index, name, fplTeam) {
  const n = norm(name);
  const myTokens = n.split(/\s+/);
  const candidates = index.filter((e) => e.team === fplTeam);
  let best = null;
  let bestScore = 0;
  for (const e of candidates) {
    let score = 0;
    if (e.full === n || e.web === n) score += 5;
    for (const t of myTokens) if (e.tokens.has(t)) score += 1;
    if (e.tokens.has(myTokens[myTokens.length - 1])) score += 1; // surname weight
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return bestScore >= 2 ? best : null;
}

// ---- Wikipedia lookup ----
async function wikiThumb(title) {
  let res;
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      { headers: { "User-Agent": "lineups-app/1.0 (personal project; contact: none)" } }
    );
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  if (!res.ok) return null;
  const data = await res.json();
  if (data.type === "disambiguation") return null;
  const text = `${data.description ?? ""} ${data.extract ?? ""}`.toLowerCase();
  if (!/foot|goalkeeper|soccer/.test(text)) return null;
  return data.thumbnail?.source ?? null; // keep API-provided size; upscaled thumb URLs 404
}

async function wikiLookup(name) {
  const tries = [...(WIKI_OVERRIDES[name] ?? []), name, `${name} (footballer)`];
  for (const t of tries) {
    const url = await wikiThumb(t);
    if (url) return url;
  }
  return null;
}

// ---- main ----
const index = await fplIndex();
console.log(`FPL index: ${index.length} players`);

// Incremental: keep photos already resolved by a previous run.
let images = {};
try {
  const prev = readFileSync(path.join(root, "images.js"), "utf8");
  images = new Function(`const window={}; ${prev}; return window.PLAYER_IMAGES;`)() ?? {};
  console.log(`Resuming with ${Object.keys(images).length} cached photos`);
} catch {}
const misses = [];
for (const [name, clubName] of players) {
  if (images[name]) continue;
  const fplTeam = EPL_CLUB_TO_FPL[clubName];
  if (fplTeam) {
    const hit = fplMatch(index, name, fplTeam);
    if (hit) {
      images[name] = `https://resources.premierleague.com/premierleague/photos/players/250x250/p${hit.photo}.png`;
      continue;
    }
    console.log(`  FPL miss: ${name} (${clubName}) — trying Wikipedia`);
  }
  const url = await wikiLookup(name);
  if (url) images[name] = url;
  else misses.push(`${name} (${clubName})`);
  await new Promise((r) => setTimeout(r, 350)); // be polite to Wikipedia
}

writeFileSync(
  path.join(root, "images.js"),
  `// Generated by scripts/fetch-images.mjs — do not edit by hand.\nwindow.PLAYER_IMAGES = ${JSON.stringify(images, null, 2)};\n`
);
console.log(`\nWrote images.js: ${Object.keys(images).length}/${players.size} players with photos`);
if (misses.length) console.log(`Missing (will show initials avatar):\n  ${misses.join("\n  ")}`);
