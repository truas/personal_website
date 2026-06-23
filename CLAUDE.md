# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

Personal academic website for **PD Dr. Terry Ruas** — Research Group Leader in NLP & AI at the
University of Göttingen and the Göttingen State & University Library (SUB), in the GippLab.

- **Live site**: https://terryruas.com (custom domain on **GitHub Pages**)
- **Repo**: https://github.com/truas/personal_website — Pages serves the `main` branch directly.
- **Stack**: hand-written static **HTML + CSS + vanilla JS**. No framework, no bundler,
  **no build step**. The browser `fetch()`es `data/*.json` at runtime and renders client-side.

## Golden rules

- **Never keep this repo inside a cloud-synced folder (OneDrive / Dropbox / iCloud).** Syncing
  `.git` corrupts the object store. This clone lives under `C:\Users\ruast\dev\` specifically to
  avoid that — do not move it back into OneDrive.
- **No build step, no dependencies.** Don't introduce a framework, bundler, or `package.json`
  for the site itself. Edit HTML/CSS/JS/JSON directly. The *only* tool is the Node publications
  generator (below).
- **Deploy = commit + push to `main`.** GitHub Pages rebuilds automatically; there is no CI.
- Preserve accessibility (the code uses `aria-*`, `aria-live`, focus-visible, and a
  `prefers-reduced-motion` block) and keep everything dependency-free.
- Text files are normalized to **LF** via `.gitattributes`; image types are marked binary.

## Local preview

Serve over HTTP — do **not** open via `file://` (client-side `fetch()` of the JSON needs a server):

```
npx serve            # ships with Node → http://localhost:3000
# or
python -m http.server 8000   # → http://localhost:8000
```

Spot-check: dark/light toggle, the four palettes, and responsive widths (320 / 480 / 750 / 1024).

## Publications workflow  ← primary maintenance task

`data/publications.json` is **generated**, not edited by hand. It is built from Terry's Zotero
group via BibBase. To refresh after new papers appear:

```
node tools/generate-publications.mjs      # requires Node >= 18
```

- **Source**: BibBase feed for Zotero group `ruasterry/2503580`.
- The script fetches the feed, parses the BibTeX, normalizes each entry to the schema below,
  de-duplicates, sorts newest-first by year, and overwrites `data/publications.json`.
- Then review and ship:
  ```
  git diff --stat data/publications.json
  git add data/publications.json && git commit -m "data: refresh publications"
  git push          # deploys via GitHub Pages
  ```
- Caveats: arXiv entries are typed `Preprint` and may carry arXiv DOIs (`10.48550/arXiv.*`).
- Shortcut: the `/refresh-pubs` project command runs and reviews this for you.

## Data files (this is where the content lives)

All under `data/`. Edited by hand **except** `publications.json` (generated).

| File | Drives | Schema (keys) |
|---|---|---|
| `publications.json` | publications.html, index.html | `id, type, bibtype, year, title, authors[], venue, publisher, doi, url, abstract, bibtex` |
| `teaching.json` | teaching.html, index.html | `id, year, course, code, institution, institution_short, term, role` |
| `projects.json` | projects.html, index.html | `year, role` ("pi"/"kc"), `period, title, agency` |
| `students.json` | students.html | `name, program, school, interests[]?` |
| `alumni.json` | alumni.html | rendered by `students.js` (with summary stats) |

`type` for publications is one of: Conference, Journal, Preprint, Workshop, Book, Report, Thesis, Other.

## Pages

Most pages use the **rail layout** (sticky left sidebar nav + main column; collapses to a hamburger
`mobile-nav` below 900px, built by JS). All load `css/redesign.css` and `js/redesign-common.js`.

| Page | Extra JS | Data | Mount points |
|---|---|---|---|
| `index.html` | `index.js` | publications, teaching, projects | `#index-pubs`, `#index-teach`, `#index-projects`, `#pubs-count` |
| `publications.html` | `publications.js` | publications | `#pubs-search-input`, `#pubs-year-chips`, `#pubs-type-chips`, `#pubs-stats`, `#publications-list` |
| `teaching.html` | `teaching.js` | teaching | `#teach-*-chips`, `#teach-stats`, `#teaching-list` |
| `projects.html` | `projects.js` | projects | `#proj-stats`, `#projects-list` |
| `students.html` | `students.js` | students | `#students-stats`, `#students-list` (path from `data-students-src` attr) |
| `alumni.html` | `students.js` | alumni | reuses students renderer; `data-students-src="data/alumni.json"`, `data-show-summary="true"` |
| `about.html` | — | static | long-form bio (no JS render) |
| `collaborators.html` | — | static | collaborator grid in HTML |
| `meet.html` | inline | — | standalone redirect to Google Calendar (no rail) |
| `template.html` | — | — | skeleton for creating a new rail page |

## Theming

Driven entirely by attributes on `<html>`, resolved by CSS custom-property overrides in
`css/redesign.css`:

- `data-palette`: **ink** (default) · sand · paper · sage
- `data-theme`: **dark** (default; persisted to `localStorage.theme`) · light
- `data-type`: **modern** (default) · editorial · instrument
- `data-density`: **regular** (default) · compact · airy

Theme is applied **before paint** by a tiny inline `<script>` in each `<head>` (avoids a flash).
The rail "Theme" button (wired in `js/redesign-common.js`) flips and persists it.
Fonts: Newsreader (serif) / Geist (sans) / Geist Mono, loaded from Google Fonts.

## JS modules (`js/`, vanilla, no deps)

- `redesign-common.js` — shared: theme toggle, builds the mobile nav from the rail, fills
  `.revised-date` from `document.lastModified`.
- `index.js` — landing page: top 5 publications, 4 courses, 3 projects.
- `publications.js` — full list: search (title/author/venue) + year/type filter chips +
  year-grouped `<details>` + per-entry Abstract/BibTeX toggles + copy-to-clipboard.
- `teaching.js`, `students.js` (also powers alumni), `projects.js` — render their JSON sources.

**Cache-busting:** when you change a CSS/JS file, bump its `?v=N` query string in the HTML that
loads it (and on the favicon links). GitHub Pages caches aggressively.

## Conventions & housekeeping

- `_log/` — dated session logs documenting *what changed and why*. Add one for substantial work.
- `_archiv/*.empty` — retired page snapshots kept for reference; **not** served.
- Author highlighting: any author surname ending in "Ruas" is bolded in rendered author lists.

## Known cleanups (not yet done — confirm before touching content)

- `images/portrait.png` (~680 KB) and `images/logo.png` appear unused by the current rail pages.
