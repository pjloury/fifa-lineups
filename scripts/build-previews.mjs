// Generates link-preview assets: a 1200x630 screenshot per route (previews/*.png)
// plus static stub pages (club/<id>/index.html, nation/<code>/index.html, top/, )
// whose Open Graph tags give dynamic previews when the path URL is shared.
// Scrapers read the tags; humans get redirected into the hash-routed app.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CHROME =
  process.env.CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SITE = "https://fifa-lineups.vercel.app";

const load = (file, key) =>
  new Function(`const window={}; ${readFileSync(path.join(root, file), "utf8")}; return window.${key};`)();
const DATA = load("data.js", "APP_DATA");
const WC = load("wc.js", "WC");
const SEASONS = load("seasons.js", "CLUB_SEASONS");

function shot(hash, out) {
  execFileSync(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--window-size=1200,630",
    "--hide-scrollbars",
    "--virtual-time-budget=12000",
    `--screenshot=${path.join(root, out)}`,
    `file://${path.join(root, "index.html")}${hash}`,
  ], { stdio: "ignore" });
  console.log(`shot ${out}`);
}

function stub(dir, { title, desc, image, hash }) {
  mkdirSync(path.join(root, dir), { recursive: true });
  writeFileSync(
    path.join(root, dir, "index.html"),
    `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/>
<title>${title}</title>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="FIFA Lineups"/>
<meta property="og:title" content="${title}"/>
<meta property="og:description" content="${desc}"/>
<meta property="og:image" content="${SITE}/${image}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:url" content="${SITE}/${dir}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${title}"/>
<meta name="twitter:description" content="${desc}"/>
<meta name="twitter:image" content="${SITE}/${image}"/>
<meta http-equiv="refresh" content="0;url=/${hash}"/>
<script>location.replace("/${hash}");</script>
</head><body></body></html>\n`
  );
}

mkdirSync(path.join(root, "previews"), { recursive: true });

// root/home
shot("", "previews/home.png");

// top players
shot("#top", "previews/top.png");
stub("top", {
  title: "★ Top Players — World Cup 2026 · FIFA Lineups",
  desc: "The biggest names of the tournament, ranked — goals, assists and cards, live.",
  image: "previews/top.png",
  hash: "#top",
});

// clubs
for (const c of DATA.clubs) {
  const png = `previews/club-${c.id}.png`;
  shot(`#club/${c.id}`, png);
  const s = SEASONS[c.name];
  const desc = s
    ? `Typical starting XI · ${c.formation} · ${s.league} ${s.season}: ${s.pos === 1 ? "champions 🏆" : `${s.pos}ᵗʰ`}, ${s.pts} pts. Tap through to every player's bio and national team.`
    : `Typical starting XI · ${c.formation}`;
  stub(`club/${c.id}`, {
    title: `${c.name} — Starting XI · FIFA Lineups`,
    desc,
    image: png,
    hash: `#club/${c.id}`,
  });
}

// nations
for (const [code, n] of Object.entries(DATA.nations)) {
  const png = `previews/nation-${code}.png`;
  shot(`#nation/${code}`, png);
  const t = WC.nationsInfo?.[code];
  const status = WC.nations?.[code];
  let desc = `Typical XI · ${n.formation}`;
  if (status === "nq") desc += " · did not qualify for World Cup 2026";
  else if (t?.out) desc += ` · eliminated in ${t.out.round.replace("the ", "")} by ${t.out.by}`;
  else if (t?.next) desc += ` · W${t.w} D${t.d} L${t.l} at WC 2026 · next: ${t.next.round.replace("the ", "")} vs ${t.next.opp}`;
  stub(`nation/${code}`, {
    title: `${n.name} — World Cup 2026 XI · FIFA Lineups`,
    desc,
    image: png,
    hash: `#nation/${code}`,
  });
}
console.log("done");
