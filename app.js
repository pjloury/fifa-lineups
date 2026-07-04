const DATA = window.APP_DATA;
const IMAGES = window.PLAYER_IMAGES || {};
const BIOS = window.PLAYER_BIOS || {};
const WC = window.WC || { players: {}, nations: {} };

function wcStatLine(name) {
  const s = WC.players[name];
  if (!s) return "";
  const bits = [];
  if (s.g) bits.push(`⚽ ${s.g} goal${s.g > 1 ? "s" : ""}`);
  if (s.a) bits.push(`${s.a} assist${s.a > 1 ? "s" : ""}`);
  if (s.yc) bits.push(`${s.yc} yellow`);
  if (s.rc) bits.push(`${s.rc} red`);
  return bits.length ? `World Cup 2026: ${bits.join(" · ")}` : "";
}

const $header = document.getElementById("hbar");
const $rail = document.getElementById("rail");
document.getElementById("logo").addEventListener("click", () => navigate("#home"));
const $nrail = document.getElementById("nrail");

const NATION_SHORT = { "United States": "USA" };
const $banner = document.getElementById("banner");
const $pitch = document.getElementById("pitch");

const CREDITS =
  "Typical starting XIs — 2025-26 season and recent internationals. EPL photos: premierleague.com · other portraits: Wikipedia · flags: flagcdn.com";

const flagUrl = (code, w = 80) => `https://flagcdn.com/w${w}/${code}.png`;
const clubById = (id) => DATA.clubs.find((c) => c.id === id);
const clubByName = (name) => DATA.clubs.find((c) => c.name === name);

// "Benfica (Portugal)" — add the club's country when it isn't one of the 13 headline clubs
const clubLabel = (name) =>
  DATA.clubCountries?.[name] && !clubByName(name) ? `${name} (${DATA.clubCountries[name]})` : name;

const initialsOf = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

// Ordered URL variants to try when a photo 404s (older PL size, original Wikimedia file).
function photoCandidates(url) {
  const list = [url];
  if (url.includes("/photos/players/250x250/"))
    list.push(url.replace("/photos/players/250x250/", "/photos/players/110x140/"));
  if (url.includes("/thumb/"))
    list.push(url.replace("/thumb/", "/").replace(/\/\d+px-[^/]+$/, ""));
  return list;
}

function headshot(name) {
  const wrap = document.createElement("div");
  wrap.className = "headshot";
  const url = IMAGES[name];
  if (url) {
    const candidates = photoCandidates(url);
    let i = 0;
    const img = document.createElement("img");
    img.className = "face";
    img.src = candidates[i];
    img.alt = name;
    img.loading = "lazy";
    img.onerror = () => {
      i += 1;
      if (i < candidates.length) img.src = candidates[i];
      else img.replaceWith(fallback());
    };
    wrap.appendChild(img);
  } else {
    wrap.appendChild(fallback());
  }
  return wrap;

  function fallback() {
    const d = document.createElement("div");
    d.className = "initials";
    d.textContent = initialsOf(name);
    return d;
  }
}

/* ---------------- bio hover card ---------------- */
const $bio = document.createElement("div");
$bio.id = "bio-pop";
document.body.appendChild($bio);
let bioTimer = null;

function ageFrom(born) {
  if (!born) return null;
  const m = born.match(/(\d{1,2}) (\w+) (\d{4})/);
  const d = m ? new Date(`${m[2]} ${m[1]}, ${m[3]}`) : new Date(`June 30, ${born}`);
  if (isNaN(d)) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) age -= 1;
  return age;
}

let pinned = false;

function hideBio() {
  clearTimeout(bioTimer);
  pinned = false;
  $bio.classList.remove("show", "pinned");
}

// national-team standing for a player: starter / in squad / not in squad / country absent
function natStatus(name, code) {
  const nation = DATA.nations[code];
  if (!nation) return null;
  if (nation.rows.flat().some((p) => p.name === name))
    return { cls: "starter", text: `★ Starts for ${nation.name}` };
  const wcStatus = WC.nations?.[code];
  if (wcStatus === "nq") return { cls: "none", text: `${nation.name} didn't qualify for World Cup 2026` };
  if (WC.squads?.[code]?.includes(name))
    return { cls: "squad", text: `In ${nation.name}'s World Cup squad · not in the typical XI` };
  return { cls: "none", text: `Not in ${nation.name}'s World Cup squad` };
}

function bioHTML(name, teamLine, extraNote, natLine) {
  const bio = BIOS[name] ?? {};
  const age = ageFrom(bio.born);
  const wcLine = wcStatLine(name);
  return `
    <div class="bio-head">${name}${age != null ? ` <span class="bio-age">· ${age} yrs</span>` : ""}</div>
    <div class="bio-meta">${teamLine}</div>
    ${natLine ? `<div class="bio-nat ${natLine.cls}">${natLine.text}</div>` : ""}
    ${extraNote ? `<div class="bio-note">${extraNote}</div>` : ""}
    ${wcLine ? `<div class="bio-wc">${wcLine}</div>` : ""}
    ${bio.b ? `<div class="bio-text">${bio.b}</div>` : ""}`;
}

function actionButtons(actions, onNavigate) {
  const row = document.createElement("div");
  row.className = "bio-actions";
  for (const a of actions) {
    const btn = document.createElement("button");
    btn.textContent = a.label;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onNavigate?.();
      navigate(a.hash);
    });
    row.appendChild(btn);
  }
  return row;
}

function showBioFor(el, { name, teamLine, actions, natLine }, pin) {
  $bio.innerHTML = bioHTML(name, teamLine, null, natLine);
  if (pin && actions?.length) $bio.appendChild(actionButtons(actions, hideBio));
  const r = el.getBoundingClientRect();
  $bio.style.visibility = "hidden";
  $bio.classList.add("show");
  $bio.classList.toggle("pinned", pin);
  const w = $bio.offsetWidth;
  const h = $bio.offsetHeight;
  let x = r.right + 12;
  if (x + w > innerWidth - 8) x = r.left - w - 12;
  if (x < 8) x = Math.min(Math.max(8, r.left), innerWidth - w - 8);
  let y = Math.min(Math.max(8, r.top + r.height / 2 - h / 2), innerHeight - h - 8);
  $bio.style.left = `${x}px`;
  $bio.style.top = `${y}px`;
  $bio.style.visibility = "";
}

function attachBio(el, info) {
  if (!BIOS[info.name]) return;
  el.addEventListener("mouseenter", () => {
    if (pinned) return;
    clearTimeout(bioTimer);
    bioTimer = setTimeout(() => showBioFor(el, info, false), 180);
  });
  el.addEventListener("mouseleave", () => {
    clearTimeout(bioTimer);
    if (!pinned) $bio.classList.remove("show");
  });
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    clearTimeout(bioTimer);
    pinned = true;
    showBioFor(el, info, true);
  });
}

// click anywhere outside the pinned card dismisses it
document.addEventListener("click", (e) => {
  if (pinned && !$bio.contains(e.target)) hideBio();
});

function playerCard({ name, pos, meta, bioMeta, chipUrl, chipRound, featured, natStarter, actions, natLine }) {
  const el = document.createElement("button");
  el.className =
    "player" + (featured ? " featured" : "") + (natStarter ? " nat-starter" : "");
  const head = headshot(name);
  const wc = WC.players[name];
  if (wc && (wc.g || wc.a)) {
    const badges = document.createElement("div");
    badges.className = "wc-badges";
    if (wc.g) badges.innerHTML += `<span class="wc-badge goals">⚽${wc.g}</span>`;
    if (wc.a) badges.innerHTML += `<span class="wc-badge assists">A${wc.a}</span>`;
    head.appendChild(badges);
  }
  if (chipUrl) {
    const chip = document.createElement("img");
    chip.className = "chip" + (chipRound ? " round" : "");
    chip.src = chipUrl;
    chip.alt = "";
    chip.onerror = () => chip.remove();
    head.appendChild(chip);
  }
  el.appendChild(head);
  const nameEl = document.createElement("div");
  nameEl.className = "pname";
  nameEl.textContent = name;
  el.appendChild(nameEl);
  const metaEl = document.createElement("div");
  metaEl.className = "pmeta";
  metaEl.textContent = pos + (meta ? ` · ${meta}` : "");
  el.appendChild(metaEl);
  attachBio(el, { name, teamLine: pos + (bioMeta ?? (meta ? ` · ${meta}` : "")), actions, natLine });
  return el;
}

const $stage = document.getElementById("stage");

// team identity: colored ambience behind the pitch, watermark crest/flag + giant label on it
function setIdentity(identity) {
  if (!identity) {
    $stage.style.background = "";
    $pitch.style.removeProperty("--team-glow");
    $pitch.style.removeProperty("--team-frame");
    document.querySelector("header").style.borderBottom = "";
    return;
  }
  const [c1, c2 = c1] = identity.colors ?? [];
  if (c1) {
    $stage.style.background = `
      radial-gradient(700px 560px at 6% -6%, ${c1}66, transparent 72%),
      radial-gradient(700px 560px at 94% 106%, ${c2}59, transparent 72%)`;
    $pitch.style.setProperty("--team-glow", `${c1}73`);
    $pitch.style.setProperty("--team-frame", c1);
    document.querySelector("header").style.borderBottom = `2px solid ${c1}aa`;
  } else {
    document.querySelector("header").style.borderBottom = "";
  }
  const mark = document.createElement("img");
  mark.className = "pitch-mark" + (identity.flag ? " flag-mark" : "");
  mark.src = identity.img;
  mark.alt = "";
  $pitch.appendChild(mark);
  const label = document.createElement("div");
  label.className = "pitch-label";
  label.textContent = identity.label;
  $pitch.appendChild(label);
}

function renderPitch(rows, cardFor, identity) {
  $pitch.innerHTML = '<div class="halfway"></div>';
  setIdentity(identity);
  const n = rows.length;
  rows.forEach((row, i) => {
    const y = n > 1 ? 89 - (i * 77) / (n - 1) : 50; // GK at bottom, attack at top
    row.forEach((p, j) => {
      const x = ((j + 1) / (row.length + 1)) * 100;
      const card = cardFor(p);
      card.style.left = `${x}%`;
      card.style.top = `${y}%`;
      $pitch.appendChild(card);
    });
  });
}

/* ---------------- club rail ---------------- */
function renderRail(activeClubId) {
  $rail.innerHTML = "";
  for (const c of DATA.clubs) {
    const btn = document.createElement("button");
    btn.className = "rail-btn" + (c.id === activeClubId ? " active" : "");
    btn.style.setProperty("--club-color", c.color);
    btn.innerHTML = `<img src="${c.badge}" alt="" /><span>${c.short ?? c.name}</span>`;
    btn.addEventListener("click", () => navigate(`#club/${c.id}`));
    $rail.appendChild(btn);
  }
}

/* ---------------- national-team rail (right edge) ---------------- */
function renderNationRail(activeCode, topActive = false) {
  $nrail.innerHTML = "";
  const top = document.createElement("button");
  top.className = "rail-btn top-players-btn" + (topActive ? " active" : "");
  top.innerHTML = `<span class="star">★</span><span>Top Players</span>`;
  top.addEventListener("click", () => navigate("#top"));
  $nrail.appendChild(top);
  for (const code of DATA.featuredNations ?? []) {
    const n = DATA.nations[code];
    if (!n) continue;
    const status = WC.nations?.[code] ?? "active";
    const btn = document.createElement("button");
    btn.className =
      "rail-btn" + (code === activeCode ? " active" : "") + (status !== "active" ? " dim" : "");
    const tag = status === "out" ? `<span class="status-tag">OUT</span>` : status === "nq" ? `<span class="status-tag">DNQ</span>` : "";
    btn.innerHTML = `<img class="flag-ico" src="${flagUrl(code, 40)}" alt="" /><span>${NATION_SHORT[n.name] ?? n.name}</span>${tag}`;
    btn.addEventListener("click", () => navigate(`#nation/${code}`));
    $nrail.appendChild(btn);
  }
}

function infoDot() {
  const dot = document.createElement("div");
  dot.className = "info-dot";
  dot.textContent = "i";
  dot.title = CREDITS;
  return dot;
}

/* ---------------- club view ---------------- */
function renderClub(clubId) {
  const club = clubById(clubId) || DATA.clubs[0];
  $banner.innerHTML = "";
  renderClubBench(club);
  renderRail(club.id);
  renderNationRail(null);

  $header.innerHTML = "";
  const badge = document.createElement("img");
  badge.className = "badge";
  badge.src = club.badge;
  badge.alt = "";
  $header.appendChild(badge);
  const t = document.createElement("div");
  t.innerHTML = `<h1>${club.name}</h1>
    <div class="sub">Typical starting XI · ${club.formation} · click a player for his bio &amp; national team · <span class="legend-ring"></span> starts for his country</div>`;
  $header.appendChild(t);
  const spacer = document.createElement("div");
  spacer.className = "spacer";
  $header.appendChild(spacer);
  $header.appendChild(infoDot());

  renderPitch(club.rows, (p) =>
    playerCard({
      name: p.name,
      pos: p.pos,
      meta: DATA.nations[p.nation]?.name ?? "",
      bioMeta: ` · ${club.name} · ${DATA.nations[p.nation]?.name ?? ""}`,
      chipUrl: flagUrl(p.nation, 40),
      featured: false,
      natStarter: DATA.nations[p.nation]?.rows.flat().some((x) => x.name === p.name) ?? false,
      natLine: natStatus(p.name, p.nation),
      actions: [
        { label: `${DATA.nations[p.nation]?.name ?? "National"} XI →`, hash: `#nation/${p.nation}/${encodeURIComponent(p.name)}` },
      ],
    }),
    { img: club.badge, label: club.short ?? club.name, colors: [club.color] }
  );
}

/* ---------------- nation view ---------------- */
function renderNation(code, featuredName, fromClubId) {
  const nation = DATA.nations[code];
  if (!nation) return renderClub(DATA.clubs[0].id);
  renderRail(null);
  renderNationRail(code);

  $header.innerHTML = "";
  const back = document.createElement("button");
  back.className = "back-btn";
  back.textContent = "← " + (clubById(fromClubId)?.short ?? "Clubs");
  back.addEventListener("click", () => navigate(`#club/${fromClubId || DATA.clubs[0].id}`));
  $header.appendChild(back);

  const flag = document.createElement("img");
  flag.className = "flag";
  flag.src = flagUrl(code, 160);
  flag.alt = "";
  $header.appendChild(flag);

  const t = document.createElement("div");
  t.innerHTML = `<h1>${nation.name}</h1>
    <div class="sub">National team · typical XI · ${nation.formation}</div>`;
  $header.appendChild(t);
  const spacer = document.createElement("div");
  spacer.className = "spacer";
  $header.appendChild(spacer);
  $header.appendChild(infoDot());

  const inXI = nation.rows.flat().some((p) => p.name === featuredName);
  $banner.innerHTML = "";
  if (featuredName && !inXI) {
    const inner = document.createElement("div");
    inner.className = "banner-inner";
    const img = document.createElement("img");
    img.src = IMAGES[featuredName] || "";
    img.onerror = () => img.remove();
    inner.appendChild(img);
    const span = document.createElement("span");
    span.innerHTML = `<b>${featuredName}</b> plays for ${nation.name} but isn't a regular starter — here's the typical XI he's competing to break into.`;
    inner.appendChild(span);
    $banner.appendChild(inner);
  }

  renderPitch(nation.rows, (p) => {
    const eplClub = clubByName(p.club);
    return playerCard({
      name: p.name,
      pos: p.pos,
      meta: p.club,
      bioMeta: ` · ${clubLabel(p.club)} · ${nation.name}`,
      chipUrl: eplClub ? eplClub.badge : null,
      chipRound: true,
      featured: p.name === featuredName,
      actions: eplClub ? [{ label: `${eplClub.short ?? eplClub.name} XI →`, hash: `#club/${eplClub.id}` }] : [],
    });
  }, { img: flagUrl(code, 320), label: nation.name, flag: true, colors: DATA.nationColors?.[code] });
  renderBench(code, nation.name);
}

/* ---------------- top players view ---------------- */
const $list = document.getElementById("list");
const $pitchWrap = document.getElementById("pitch-wrap");
const $bench = document.getElementById("bench");

/* club bench: players at this club who start for a featured national team but not for the club */
function renderClubBench(club) {
  $bench.innerHTML = "";
  const entries = [];
  for (const [code, n] of Object.entries(DATA.nations)) {
    for (const p of n.rows.flat()) {
      if (p.club !== club.name) continue;
      if (club.rows.flat().some((x) => x.name === p.name)) continue;
      entries.push({ name: p.name, code, pos: p.pos, natName: n.name });
    }
  }
  if (!entries.length) return;
  const title = document.createElement("div");
  title.className = "bench-title";
  title.textContent = "Internationals · not in XI";
  $bench.appendChild(title);
  for (const b of entries) {
    const card = document.createElement("button");
    card.className = "bench-card";
    card.appendChild(headshot(b.name));
    const s = WC.players[b.name];
    const badges =
      (s?.g ? `<span class="wc-badge goals">⚽${s.g}</span>` : "") +
      (s?.a ? `<span class="wc-badge assists">A${s.a}</span>` : "");
    const info = document.createElement("div");
    info.className = "bench-info";
    info.innerHTML = `<div class="bench-name">${b.name}</div>
      <div class="bench-stats"><img class="flag-mini" src="${flagUrl(b.code, 40)}" alt="" />${badges}</div>`;
    card.appendChild(info);
    attachBio(card, {
      name: b.name,
      teamLine: `${b.pos} · ${club.name} · ${b.natName}`,
      natLine: natStatus(b.name, b.code),
      actions: [{ label: `${b.natName} XI →`, hash: `#nation/${b.code}/${encodeURIComponent(b.name)}` }],
    });
    $bench.appendChild(card);
  }
}

/* bench: players with WC goal involvements who aren't in the shown XI */
function renderBench(code, nationName) {
  $bench.innerHTML = "";
  const listData = (WC.bench?.[code] ?? []).slice(0, 9);
  if (!listData.length) return;
  const title = document.createElement("div");
  title.className = "bench-title";
  title.textContent = "In form · not in XI";
  $bench.appendChild(title);
  for (const b of listData) {
    const card = document.createElement("button");
    card.className = "bench-card";
    card.appendChild(headshot(b.name));
    const info = document.createElement("div");
    info.className = "bench-info";
    const badges =
      (b.g ? `<span class="wc-badge goals">⚽${b.g}</span>` : "") +
      (b.a ? `<span class="wc-badge assists">A${b.a}</span>` : "");
    info.innerHTML = `<div class="bench-name">${b.name}</div><div class="bench-stats">${badges}</div>`;
    card.appendChild(info);
    const club = DATA.clubs.find((c) => c.rows.flat().some((x) => x.name === b.name));
    const actions = club ? [{ label: `${club.short ?? club.name} XI →`, hash: `#club/${club.id}` }] : [];
    attachBio(card, { name: b.name, teamLine: `${nationName} squad${club ? ` · ${club.name}` : ""}`, natLine: natStatus(b.name, code), actions });
    $bench.appendChild(card);
  }
}

const $home = document.getElementById("home");

function showView(view) {
  $list.hidden = view !== "list";
  $home.hidden = view !== "home";
  $pitchWrap.style.display = view === "pitch" ? "" : "none";
}
const showList = (on) => showView(on ? "list" : "pitch");

/* ---------------- home page ---------------- */
function renderHome() {
  renderRail(null);
  renderNationRail(null);
  $banner.innerHTML = "";
  $bench.innerHTML = "";
  setIdentity(null);
  showView("home");

  $header.innerHTML = `<div><h1>World Cup 2026 Lineup Explorer</h1>
    <div class="sub">Top club XIs · national teams · live tournament stats</div></div>`;

  $home.innerHTML = `
    <div class="home-hero">
      <h2>Every top club XI.<br/>Every World Cup contender.<br/>One pitch.</h2>
      <p>Starting lineups laid out TV-style, cross-linked between the biggest clubs in Europe
      and the national teams chasing the 2026 World Cup — with live tournament stats.</p>
      <div class="home-ctas">
        <button data-hash="#club/arsenal">Browse clubs →</button>
        <button data-hash="#nation/fr">France XI →</button>
        <button data-hash="#top">★ Top Players →</button>
      </div>
    </div>
    <div class="home-grid">
      <div class="home-card"><span>🛡️</span><b>Pick a club</b>
        The left rail lists 13 top European clubs. Each shows its typical 2025-26 starting XI
        in real formation, with every player's photo and national flag.</div>
      <div class="home-card"><span>🏳️</span><b>Pick a nation</b>
        The right rail lists 16 World Cup contenders in seeding order. Greyed-out teams are
        knocked out (OUT) or didn't qualify (DNQ).</div>
      <div class="home-card"><span>👤</span><b>Click any player</b>
        A pinned card shows his age, bio and World Cup stats, with buttons to jump between
        his club XI and national XI. Click anywhere else to dismiss it.</div>
      <div class="home-card"><span>⚽</span><b>Read the badges</b>
        Goal and assist badges over a photo are live World Cup 2026 numbers. In club views,
        a gold ring means the player starts for his country.</div>
      <div class="home-card"><span>★</span><b>Top Players</b>
        A ranked table of the tournament's biggest names — goals, assists and cards — plus each
        nation's leading scorer.</div>
      <div class="home-card"><span>🪑</span><b>Check the bench</b>
        On national team pages, in-form players with goal involvements who aren't in the XI
        appear beside the pitch — click them for bios too.</div>
    </div>
    <div class="home-foot">${CREDITS} · World Cup stats: ESPN, refreshed through ${WC.updated ? `${WC.updated.slice(0,4)}-${WC.updated.slice(4,6)}-${WC.updated.slice(6,8)}` : "the group stage"}</div>`;
  $home.querySelectorAll("[data-hash]").forEach((b) =>
    b.addEventListener("click", () => navigate(b.dataset.hash))
  );
}

function renderTop() {
  renderRail(null);
  renderNationRail(null, true);
  $banner.innerHTML = "";
  showList(true);
  setIdentity(null);

  $header.innerHTML = "";
  const t = document.createElement("div");
  const upd = WC.updated ? ` · stats through ${WC.updated.slice(0, 4)}-${WC.updated.slice(4, 6)}-${WC.updated.slice(6, 8)}` : "";
  t.innerHTML = `<h1>★ Top Players</h1>
    <div class="sub">The biggest names of the 2026 World Cup · click a row to expand his bio · a crest jumps to his club${upd}</div>`;
  $header.appendChild(t);
  const spacer = document.createElement("div");
  spacer.className = "spacer";
  $header.appendChild(spacer);
  $header.appendChild(infoDot());

  $list.innerHTML = "";
  const head = document.createElement("div");
  head.className = "top-row top-head";
  head.innerHTML = `<div></div><div></div><div class="who">Player</div>
    <div class="cell">Club</div><div class="cell">Country</div>
    <div class="stats"><span title="Goals">⚽</span><span title="Assists">A</span><span title="Yellow cards" class="yc-ico"></span><span title="Red cards" class="rc-ico"></span></div>`;
  $list.appendChild(head);
  const makeRow = (p, rank) => {
    const nation = DATA.nations[p.nation];
    const eplClub = clubByName(p.club);
    const row = document.createElement("button");
    row.className = "top-row";

    const rankEl = document.createElement("div");
    rankEl.className = "rank";
    rankEl.textContent = rank;
    row.appendChild(rankEl);

    row.appendChild(headshot(p.name));

    const who = document.createElement("div");
    who.className = "who";
    who.innerHTML = `<div class="who-name">${p.name} <span class="who-pos">${p.pos}</span></div>
      <div class="who-note">${p.note}</div>`;
    row.appendChild(who);

    const clubCell = document.createElement("div");
    clubCell.className = "cell club-cell" + (eplClub ? " linked" : "");
    clubCell.innerHTML = eplClub
      ? `<img src="${eplClub.badge}" alt="" /><span>${p.club}</span>`
      : `<span>${p.club}</span>`;
    if (eplClub)
      clubCell.addEventListener("click", (e) => {
        e.stopPropagation();
        navigate(`#club/${eplClub.id}`);
      });
    row.appendChild(clubCell);

    const natCell = document.createElement("div");
    natCell.className = "cell";
    natCell.innerHTML = `<img class="flag-ico" src="${flagUrl(p.nation, 40)}" alt="" /><span>${nation?.name ?? ""}</span>`;
    row.appendChild(natCell);

    const s = WC.players[p.name] ?? { g: 0, a: 0, yc: 0, rc: 0 };
    const statCell = document.createElement("div");
    statCell.className = "stats";
    statCell.innerHTML = [s.g, s.a, s.yc, s.rc]
      .map((v, j) => `<span class="${j === 2 && v ? "has-yc" : ""}${j === 3 && v ? "has-rc" : ""}${v ? "" : " zero"}">${v}</span>`)
      .join("");
    row.appendChild(statCell);

    // accordion: click expands the bio below the row; one open at a time
    const expand = document.createElement("div");
    expand.className = "top-bio";
    expand.hidden = true;
    row.addEventListener("click", () => {
      if (openBio && openBio.expand !== expand) {
        openBio.expand.hidden = true;
        openBio.row.classList.remove("open");
      }
      const opening = expand.hidden;
      if (opening && !expand.innerHTML) {
        expand.innerHTML = bioHTML(p.name, `${p.pos} · ${clubLabel(p.club)} · ${nation?.name ?? ""}`, p.note, natStatus(p.name, p.nation));
        const actions = [{ label: `${nation?.name ?? "National"} XI →`, hash: `#nation/${p.nation}/${encodeURIComponent(p.name)}` }];
        if (eplClub) actions.push({ label: `${eplClub.short ?? eplClub.name} XI →`, hash: `#club/${eplClub.id}` });
        expand.appendChild(actionButtons(actions));
      }
      expand.hidden = !opening;
      row.classList.toggle("open", opening);
      openBio = opening ? { row, expand } : null;
    });

    const frag = document.createDocumentFragment();
    frag.appendChild(row);
    frag.appendChild(expand);
    return frag;
  };
  let openBio = null;

  const main = DATA.topPlayers ?? [];
  main.forEach((p, i) => $list.appendChild(makeRow(p, i + 1)));

  // guarantee each country's leading World Cup scorer appears
  const nationOf = {};
  for (const [code, n] of Object.entries(DATA.nations))
    for (const p of n.rows.flat()) nationOf[p.name] ??= { code, pos: p.pos, club: p.club };
  const listed = new Set(main.map((p) => p.name));
  const leaders = {};
  for (const [name, s] of Object.entries(WC.players ?? {})) {
    const info = nationOf[name];
    if (!info || !s.g) continue;
    if (!leaders[info.code] || s.g > WC.players[leaders[info.code].name].g) leaders[info.code] = { name, ...info };
  }
  const extras = Object.values(leaders)
    .filter((l) => !listed.has(l.name))
    .sort((a, b) => WC.players[b.name].g - WC.players[a.name].g)
    .map((l) => ({
      name: l.name,
      pos: l.pos,
      club: l.club,
      nation: l.code,
      note: `${DATA.nations[l.code].name}'s leading scorer at the World Cup`,
    }));
  if (extras.length) {
    const div = document.createElement("div");
    div.className = "list-divider";
    div.textContent = "Leading scorers by nation";
    $list.appendChild(div);
    extras.forEach((p, i) => $list.appendChild(makeRow(p, main.length + i + 1)));
  }
}

/* ---------------- routing ---------------- */
let lastClubId = DATA.clubs[0].id;

function navigate(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function route() {
  hideBio();
  const parts = location.hash.slice(1).split("/");
  if (parts[0] === "top") {
    renderTop();
  } else if (parts[0] === "nation" && parts[1]) {
    showView("pitch");
    renderNation(parts[1], decodeURIComponent(parts[2] || ""), lastClubId);
  } else if (parts[0] === "club") {
    showView("pitch");
    lastClubId = parts[1] && clubById(parts[1]) ? parts[1] : lastClubId;
    renderClub(lastClubId);
  } else {
    renderHome(); // default view: how-to-use landing page
  }
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);
route();
