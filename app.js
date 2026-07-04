const DATA = window.APP_DATA;
const IMAGES = window.PLAYER_IMAGES || {};

const $header = document.getElementById("header");
const $banner = document.getElementById("banner");
const $pitch = document.getElementById("pitch");

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

function playerCard({ name, pos, meta, chipUrl, chipRound, featured, onClick }) {
  const el = document.createElement(onClick ? "button" : "div");
  el.className = "player" + (featured ? " featured" : "") + (onClick ? "" : " static");
  const head = headshot(name);
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

/* ---------------- club view ---------------- */
function renderClub(clubId) {
  const club = clubById(clubId) || DATA.clubs[0];
  $banner.innerHTML = "";

  $header.innerHTML = "";
  const titleRow = document.createElement("div");
  titleRow.className = "title-row";
  titleRow.innerHTML = `
    <img class="badge" src="${club.badge}" alt="" />
    <div>
      <h1>${club.name}</h1>
      <div class="sub">Typical starting XI · ${club.formation} · click a player to see his national team</div>
    </div>`;
  $header.appendChild(titleRow);

  const tabs = document.createElement("div");
  tabs.className = "tabs";
  for (const c of DATA.clubs) {
    const tab = document.createElement("button");
    tab.className = "tab" + (c.id === club.id ? " active" : "");
    tab.style.setProperty("--tab-color", c.color);
    tab.innerHTML = `<img src="${c.badge}" alt="" />${c.name.replace("Manchester", "Man").replace(" Hotspur", "")}`;
    tab.addEventListener("click", () => navigate(`#club/${c.id}`));
    tabs.appendChild(tab);
  }
  $header.appendChild(tabs);

  renderPitch(club.rows, (p) =>
    playerCard({
      name: p.name,
      pos: p.pos,
      meta: DATA.nations[p.nation]?.name ?? "",
      chipUrl: flagUrl(p.nation, 40),
      featured: false,
      onClick: () => navigate(`#nation/${p.nation}/${encodeURIComponent(p.name)}`),
    })
  );
}

/* ---------------- nation view ---------------- */
function renderNation(code, featuredName, fromClubId) {
  const nation = DATA.nations[code];
  if (!nation) return renderClub(DATA.clubs[0].id);

  $header.innerHTML = "";
  const titleRow = document.createElement("div");
  titleRow.className = "title-row";

  const back = document.createElement("button");
  back.className = "back-btn";
  back.textContent = "← Back to " + (clubById(fromClubId)?.name ?? "clubs");
  back.addEventListener("click", () => navigate(`#club/${fromClubId || DATA.clubs[0].id}`));
  titleRow.appendChild(back);

  const flag = document.createElement("img");
  flag.className = "flag";
  flag.src = flagUrl(code, 160);
  flag.alt = "";
  titleRow.appendChild(flag);

  const t = document.createElement("div");
  t.innerHTML = `<h1>${nation.name}</h1>
    <div class="sub">National team · typical XI · ${nation.formation}</div>`;
  titleRow.appendChild(t);
  $header.appendChild(titleRow);

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

/* ---------------- routing ---------------- */
let lastClubId = DATA.clubs[0].id;

function navigate(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function route() {
  const parts = location.hash.slice(1).split("/");
  if (parts[0] === "nation" && parts[1]) {
    renderNation(parts[1], decodeURIComponent(parts[2] || ""), lastClubId);
  } else {
    lastClubId = parts[1] && clubById(parts[1]) ? parts[1] : lastClubId;
    renderClub(lastClubId);
  }
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);
route();
