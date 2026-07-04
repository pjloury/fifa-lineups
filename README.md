# EPL Starting XIs → FIFA National Teams

A zero-dependency web app showing the typical starting lineups of the top Premier League
clubs laid out TV-style on a pitch, with each player's photo and national-team flag.
Click any player to see his FIFA national team's typical starting XI with him highlighted
(or, if he isn't an international regular, a banner plus the XI he's competing to break into).
EPL players in a national lineup are clickable to jump back to their club view.

## Run it

Just open `index.html` in a browser — no build step, no server needed
(data and photo URLs are baked into `data.js` / `images.js`).

```sh
open index.html
```

## Files

- `index.html` / `styles.css` / `app.js` — the app (vanilla JS, hash routing: `#club/<id>`, `#nation/<code>/<player>`)
- `data.js` — hand-curated lineups: 6 EPL clubs + 23 national teams (typical XIs, 2025-26 season / recent internationals)
- `images.js` — generated photo-URL map (Premier League headshots + Wikipedia portraits)
- `scripts/fetch-images.mjs` — regenerates `images.js`; incremental, so reruns only fetch what's missing:

```sh
node scripts/fetch-images.mjs
```

Photos are hot-linked from resources.premierleague.com and upload.wikimedia.org; flags from flagcdn.com.
Players without a resolvable photo get an initials avatar.
