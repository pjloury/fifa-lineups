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

const $header = document.getElementById("header");
const $rail = document.getElementById("rail");
const $nrail = document.getElementById("nrail");

const NATION_SHORT = { "United States": "USA" };
const $banner = document.getElementById("banner");
const $pitch = document.getElementById("pitch");

const CREDITS =
  "Typical starting XIs — 2025-26 season and recent internationals. EPL photos: premierleague.com · other portraits: Wikipedia · flags: flagcdn.com";

const flagUrl = (code, w = 80) => `https://flagcdn.com/w${w}/${code}.png`;
const clubById = (id) => DATA.clubs.find((c) => c.id === id);
const clubByName = (name) => DATA.clubs.find((c) => c.name === name);

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

function attachBio(el, { name, teamLine }) {
  el.addEventListener("mouseenter", () => {
    const bio = BIOS[name];
    if (!bio) return;
    clearTimeout(bioTimer);
    bioTimer = setTimeout(() => {
      const age = ageFrom(bio.born);
      const wcLine = wcStatLine(name);
      $bio.innerHTML = `
        <div class="bio-head">${name}${age != null ? ` <span class="bio-age">· ${age} yrs</span>` : ""}</div>
        <div class="bio-meta">${teamLine}</div>
        ${wcLine ? `<div class="bio-wc">${wcLine}</div>` : ""}
        ${bio.b ? `<div class="bio-text">${bio.b}</div>` : ""}`;
      const r = el.getBoundingClientRect();
      $bio.style.visibility = "hidden";
      $bio.classList.add("show");
      const w = $bio.offsetWidth;
      const h = $bio.offsetHeight;
      let x = r.right + 12;
      if (x + w > innerWidth - 8) x = r.left - w - 12;
      if (x < 8) x = Math.min(Math.max(8, r.left), innerWidth - w - 8);
      let y = Math.min(Math.max(8, r.top + r.height / 2 - h / 2), innerHeight - h - 8);
      $bio.style.left = `${x}px`;
      $bio.style.top = `${y}px`;
      $bio.style.visibility = "";
    }, 180);
  });
  el.addEventListener("mouseleave", () => {
    clearTimeout(bioTimer);
    $bio.classList.remove("show");
  });
  el.addEventListener("click", () => {
    clearTimeout(bioTimer);
    $bio.classList.remove("show");
  });
}

function playerCard({ name, pos, meta, chipUrl, chipRound, featured, natStarter, onClick }) {
  const el = document.createElement(onClick ? "button" : "div");
  el.className =
    "player" +
    (featured ? " featured" : "") +
    (natStarter ? " nat-starter" : "") +
    (onClick ? "" : " static");
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
  if (onClick) el.addEventListener("click", onClick);
  attachBio(el, { name, teamLine: pos + (meta ? ` · ${meta}` : "") });
  return el;
}

function renderPitch(rows, cardFor) {
  $pitch.innerHTML = '<div class="halfway"></div>';
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
    <div class="sub">Typical starting XI · ${club.formation} · click a player to see his national team · <span class="legend-ring"></span> starts for his country</div>`;
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
      chipUrl: flagUrl(p.nation, 40),
      featured: false,
      natStarter: DATA.nations[p.nation]?.rows.flat().some((x) => x.name === p.name) ?? false,
      onClick: () => navigate(`#nation/${p.nation}/${encodeURIComponent(p.name)}`),
    })
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
      chipUrl: eplClub ? eplClub.badge : null,
      chipRound: true,
      featured: p.name === featuredName,
      onClick: eplClub ? () => navigate(`#club/${eplClub.id}`) : null,
    });
  });
}

/* ---------------- top players view ---------------- */
const $list = document.getElementById("list");
const $pitchWrap = document.getElementById("pitch-wrap");

function showList(on) {
  $list.hidden = !on;
  $pitchWrap.style.display = on ? "none" : "";
}

function renderTop() {
  renderRail(null);
  renderNationRail(null, true);
  $banner.innerHTML = "";
  showList(true);

  $header.innerHTML = "";
  const t = document.createElement("div");
  const upd = WC.updated ? ` · stats through ${WC.updated.slice(0, 4)}-${WC.updated.slice(4, 6)}-${WC.updated.slice(6, 8)}` : "";
  t.innerHTML = `<h1>★ Top Players</h1>
    <div class="sub">The biggest names of the 2026 World Cup · click a row for his national XI, a crest for his club${upd}</div>`;
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
  (DATA.topPlayers ?? []).forEach((p, i) => {
    const nation = DATA.nations[p.nation];
    const eplClub = clubByName(p.club);
    const row = document.createElement("button");
    row.className = "top-row";
    row.addEventListener("click", () => navigate(`#nation/${p.nation}/${encodeURIComponent(p.name)}`));

    const rank = document.createElement("div");
    rank.className = "rank";
    rank.textContent = i + 1;
    row.appendChild(rank);

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

    attachBio(row, { name: p.name, teamLine: `${p.pos} · ${p.club} · ${nation?.name ?? ""}` });
    $list.appendChild(row);
  });
}

/* ---------------- routing ---------------- */
let lastClubId = DATA.clubs[0].id;

function navigate(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function route() {
  const parts = location.hash.slice(1).split("/");
  if (parts[0] !== "top") showList(false);
  if (parts[0] === "top") {
    renderTop();
  } else if (parts[0] === "nation" && parts[1]) {
    renderNation(parts[1], decodeURIComponent(parts[2] || ""), lastClubId);
  } else {
    lastClubId = parts[1] && clubById(parts[1]) ? parts[1] : lastClubId;
    renderClub(lastClubId);
  }
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);
route();
