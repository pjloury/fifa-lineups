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
const ALIASES = { "Maximiliano Araújo": "Maxi Araújo" };

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
  ci: "Ivory Coast",
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
  "gb-sct": "Scotland",
  sn: "Senegal",
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
const END = new Date(Math.min(today.getTime() + 12 * 86400e3, new Date("2026-07-20T00:00:00Z").getTime()));
const todayKey = today.toISOString().slice(0, 10).replace(/-/g, "");
const dates = [];
for (let d = new Date(START); d <= END; d.setUTCDate(d.getUTCDate() + 1))
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

// tournament record, round reached, and next fixture per team
const ROUNDS = [
  [/group/i, "the group stage"],
  [/round of 32/i, "the Round of 32"],
  [/round of 16/i, "the Round of 16"],
  [/quarter/i, "the quarterfinals"],
  [/semi/i, "the semifinals"],
  [/third/i, "the third-place match"],
  [/final/i, "the final"],
];
function roundLabel(e) {
  const txt =
    [...(e.competitions?.[0]?.notes ?? []), ...(e.notes ?? [])].map((n) => n.headline ?? "").join(" ") +
    " " +
    (e.competitions?.[0]?.altGameNote ?? "");
  for (const [re, label] of ROUNDS) if (re.test(txt)) return label;
  const d = e.date?.slice(0, 10) ?? "";
  if (d <= "2026-06-27") return "the group stage";
  if (d <= "2026-07-03") return "the Round of 32";
  if (d <= "2026-07-07") return "the Round of 16";
  if (d <= "2026-07-11") return "the quarterfinals";
  if (d <= "2026-07-15") return "the semifinals";
  if (d <= "2026-07-18") return "the third-place match";
  return "the final";
}

const teamInfo = {}; // espn name -> { w,d,l,gf,ga, lastRound, out: {round, by}, next: {opp, date, round} }
const OUR_ESPN_NAMES = new Set(Object.values(NATION_TO_ESPN));
for (const e of events) {
  const comp = e.competitions?.[0];
  const cs = comp?.competitors ?? [];
  if (cs.length !== 2) continue;
  const round = roundLabel(e);
  const completed = comp?.status?.type?.completed ?? e.status?.type?.completed;
  for (const [i, c] of cs.entries()) {
    const name = c.team?.displayName;
    if (!name || !OUR_ESPN_NAMES.has(name)) continue;
    const other = cs[1 - i];
    const t = (teamInfo[name] ??= { w: 0, d: 0, l: 0, gf: 0, ga: 0, lastRound: round, next: null, out: null });
    if (completed) {
      t.gf += Number(c.score ?? 0);
      t.ga += Number(other.score ?? 0);
      if (c.winner === true) t.w++;
      else if (c.winner === false) {
        t.l++;
        if (round !== "the group stage") t.out = { round, by: other.team?.displayName ?? "" };
      } else t.d++;
      t.lastRound = round;
    } else if (!t.next) {
      t.next = { opp: other.team?.displayName ?? "TBD", date: e.date?.slice(0, 10) ?? "", round };
    }
  }
}
const nationsInfo = {};
for (const [code, espnName] of Object.entries(NATION_TO_ESPN)) {
  const t = teamInfo[espnName];
  if (t) nationsInfo[code] = t;
}

// per-player stats from every completed match's rosters — tracked players and everyone else
const espnToCodeEarly = Object.fromEntries(Object.entries(NATION_TO_ESPN).map(([c, n]) => [n, c]));
const squads = Object.fromEntries(Object.keys(NATION_TO_ESPN).map((c) => [c, new Set()])); // matchday squad members per nation
const stats = {};
const all = new Map(); // espn name -> { team, g, a, yc, rc }
let done = 0;
for (const e of events) {
  const completed = e.status?.type?.completed;
  if (!completed) continue;
  const sum = await getJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${e.id}`);
  for (const side of sum?.rosters ?? []) {
    const teamName = side.team?.displayName ?? "";
    const squadCode = espnToCodeEarly[teamName];
    for (const entry of side.roster ?? []) {
      if (squadCode) {
        const nm = entry.athlete?.displayName ?? "";
        if (nm) squads[squadCode].add(ourPlayers.get(norm(nm)) ?? nm);
      }
      const s = Object.fromEntries((entry.stats ?? []).map((x) => [x.name, x.value ?? 0]));
      const g = s.totalGoals ?? 0, a = s.goalAssists ?? 0, yc = s.yellowCards ?? 0, rc = s.redCards ?? 0;
      if (!g && !a && !yc && !rc) continue;
      const espnName = entry.athlete?.displayName ?? "";
      const rec = all.get(espnName) ?? { team: teamName, g: 0, a: 0, yc: 0, rc: 0 };
      rec.g += g; rec.a += a; rec.yc += yc; rec.rc += rc;
      all.set(espnName, rec);
      const ours = ourPlayers.get(norm(espnName));
      if (ours) {
        const t = (stats[ours] ??= { g: 0, a: 0, yc: 0, rc: 0 });
        t.g += g; t.a += a; t.yc += yc; t.rc += rc;
      }
    }
  }
  done++;
  await sleep(150);
}
console.log(`Aggregated ${done} completed matches; ${Object.keys(stats).length} tracked players, ${all.size} total with stats`);

// bench: per nation, anyone with a goal or assist who is NOT in that nation's XI in data.js
const espnToCode = Object.fromEntries(Object.entries(NATION_TO_ESPN).map(([c, n]) => [n, c]));
const bench = {};
for (const [espnName, rec] of all) {
  const code = espnToCode[rec.team];
  if (!code || rec.g + rec.a < 1) continue;
  const display = ourPlayers.get(norm(espnName)) ?? espnName;
  if (APP_DATA.nations[code].rows.flat().some((p) => p.name === display)) continue;
  (bench[code] ??= []).push({ name: display, g: rec.g, a: rec.a, yc: rec.yc, rc: rec.rc });
}
for (const list of Object.values(bench)) list.sort((x, y) => y.g + y.a - (x.g + x.a));

writeFileSync(
  path.join(root, "wc.js"),
  `// Generated by scripts/fetch-wc.mjs — do not edit by hand.\nwindow.WC = ${JSON.stringify(
    {
      updated: todayKey,
      players: stats,
      nations,
      nationsInfo,
      bench,
      squads: Object.fromEntries(Object.entries(squads).filter(([, s]) => s.size).map(([c, s]) => [c, [...s].sort()])),
    },
    null,
    1
  )};\n`
);
console.log("Wrote wc.js");
for (const [code, list] of Object.entries(bench))
  console.log(`${code}: ${list.map((p) => `${p.name} ${p.g}g/${p.a}a`).join(", ")}`);
