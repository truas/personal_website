// Landing-page logic for index.html:
//  - Pull the most recent 5 entries from data/publications.json and 4 from
//    data/teaching.json so the index always reflects the canonical sources.
//
// Theme handling lives in js/redesign-common.js (toggle) and a small inline
// <script> in <head> (initial apply, to avoid a flash of unstyled colour).
// No external dependencies; vanilla DOM APIs only.

const ME = "Ruas";

document.addEventListener("DOMContentLoaded", () => {
  renderSelectedPubs();
  renderSelectedTeaching();
  renderSelectedProjects();
});

async function renderSelectedPubs() {
  const root = document.getElementById("index-pubs");
  const countEl = document.getElementById("pubs-count");
  if (!root) return;
  try {
    const res = await fetch("data/publications.json", { cache: "default" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const all = await res.json();
    const sorted = [...all].sort((a, b) => (b.year || 0) - (a.year || 0));
    const top = sorted.slice(0, 5);

    root.innerHTML = "";
    top.forEach((p) => root.appendChild(buildPubCard(p)));
    if (countEl) countEl.textContent = `All ${all.length} publications`;
  } catch (err) {
    root.innerHTML = `<div class="pub-loading">Could not load publications (${err.message}).</div>`;
  }
}

function buildPubCard(p) {
  const article = document.createElement("article");
  article.className = "pub";

  const year = document.createElement("div");
  year.className = "pub-year";
  year.textContent = String(p.year || "");

  const mid = document.createElement("div");

  const title = document.createElement("h3");
  title.className = "pub-title";
  if (p.url) {
    const a = document.createElement("a");
    a.href = p.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = p.title;
    title.appendChild(a);
  } else {
    title.textContent = p.title;
  }
  mid.appendChild(title);

  const authors = document.createElement("div");
  authors.className = "pub-authors";
  (p.authors || []).forEach((name, i, arr) => {
    const span = document.createElement("span");
    if (name.toLowerCase().endsWith(ME.toLowerCase())) span.className = "me";
    span.textContent = name;
    authors.appendChild(span);
    if (i < arr.length - 1) authors.appendChild(document.createTextNode(", "));
  });
  mid.appendChild(authors);

  const linkRow = document.createElement("div");
  linkRow.className = "pub-links";
  if (p.doi) {
    const a = document.createElement("a");
    a.href = `https://doi.org/${p.doi}`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "pub-link";
    a.textContent = "doi";
    linkRow.appendChild(a);
  }
  if (p.url && (!p.doi || p.url !== `https://doi.org/${p.doi}`)) {
    const a = document.createElement("a");
    a.href = p.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "pub-link";
    a.textContent = "link";
    linkRow.appendChild(a);
  }
  if (linkRow.children.length) mid.appendChild(linkRow);

  const venue = document.createElement("div");
  venue.className = "pub-venue";
  venue.appendChild(document.createTextNode(p.venue || p.type || ""));
  if (p.note) {
    const note = document.createElement("div");
    note.className = "pub-venue-note";
    note.textContent = p.note;
    venue.appendChild(note);
  }

  article.appendChild(year);
  article.appendChild(mid);
  article.appendChild(venue);
  return article;
}

async function renderSelectedTeaching() {
  const root = document.getElementById("index-teach");
  if (!root) return;
  try {
    const res = await fetch("data/teaching.json", { cache: "default" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const all = await res.json();
    const sorted = [...all].sort((a, b) => (b.year || 0) - (a.year || 0));
    const top = sorted.slice(0, 4);

    root.innerHTML = "";
    top.forEach((c) => root.appendChild(buildCourseRow(c)));
  } catch (err) {
    root.innerHTML = `<div class="pub-loading">Could not load courses (${err.message}).</div>`;
  }
}

async function renderSelectedProjects() {
  const root = document.getElementById("index-projects");
  if (!root) return;
  try {
    const res = await fetch("data/projects.json", { cache: "default" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const all = await res.json();
    const top = all.slice(0, 3);

    root.innerHTML = "";
    const list = document.createElement("div");
    list.className = "rows";
    top.forEach((p) => list.appendChild(buildProjectRow(p)));
    root.appendChild(list);
  } catch (err) {
    root.innerHTML = `<div class="pub-loading">Could not load projects (${err.message}).</div>`;
  }
}

// Courses and projects share one row: title and a secondary line on the
// left, one or two short meta lines (term, role, period) on the right.
function buildRow(titleText, subText, metaTexts) {
  const row = document.createElement("article");
  row.className = "row";

  const title = document.createElement("h3");
  title.className = "row-title";
  title.textContent = titleText;
  row.appendChild(title);

  if (subText) {
    const sub = document.createElement("div");
    sub.className = "row-sub";
    sub.textContent = subText;
    row.appendChild(sub);
  }

  metaTexts.filter(Boolean).forEach((text) => {
    const meta = document.createElement("div");
    meta.className = "row-meta";
    meta.textContent = text;
    row.appendChild(meta);
  });
  return row;
}

function buildProjectRow(p) {
  return buildRow(p.title || "", p.agency, [p.period]);
}

function buildCourseRow(c) {
  const title = c.code ? `${c.code} — ${c.course}` : c.course;
  return buildRow(title, c.institution, [c.term, c.role]);
}
