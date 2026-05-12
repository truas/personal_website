// Landing-page logic for index.html:
//  - Scroll-spy that highlights the active rail link via IntersectionObserver.
//  - Pull the most recent 5 entries from data/publications.json and 4 from
//    data/teaching.json so the index always reflects the canonical sources.
//
// Theme handling lives in js/redesign-common.js (toggle) and a small inline
// <script> in <head> (initial apply, to avoid a flash of unstyled colour).
// No external dependencies; vanilla DOM APIs only.

const ME = "Ruas";

document.addEventListener("DOMContentLoaded", () => {
  wireScrollSpy();
  renderSelectedPubs();
  renderSelectedTeaching();
});

function wireScrollSpy() {
  const anchorLinks = document.querySelectorAll(".rail-link[href^='#']");
  if (!anchorLinks.length) return;
  const linkById = new Map();
  const targets = [];
  anchorLinks.forEach((a) => {
    const id = a.getAttribute("href").slice(1);
    const el = document.getElementById(id);
    if (el) {
      linkById.set(id, a);
      targets.push(el);
    }
  });
  if (!targets.length) return;

  const io = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((e) => e.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
    if (!visible[0]) return;
    anchorLinks.forEach((a) => a.classList.remove("active"));
    const link = linkById.get(visible[0].target.id);
    if (link) link.classList.add("active");
  }, { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] });

  targets.forEach((t) => io.observe(t));
}

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
    if (countEl) countEl.textContent = `${top.length} of ${all.length} shown`;
  } catch (err) {
    root.innerHTML = `<div class="pub-loading">Could not load publications (${err.message}).</div>`;
    if (countEl) countEl.textContent = "";
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
  venue.textContent = p.venue || p.type || "";

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
    top.forEach((c) => root.appendChild(buildCourseCard(c)));
  } catch (err) {
    root.innerHTML = `<div class="course"><div class="course-blurb">Could not load courses (${err.message}).</div></div>`;
  }
}

function buildCourseCard(c) {
  const wrap = document.createElement("div");
  wrap.className = "course";

  const term = document.createElement("div");
  term.className = "course-term";
  term.textContent = c.term || "";

  const title = document.createElement("h3");
  title.className = "course-title";
  title.textContent = c.code ? `${c.code} — ${c.course}` : c.course;

  const blurb = document.createElement("div");
  blurb.className = "course-blurb";
  blurb.textContent = c.institution || "";

  const meta = document.createElement("div");
  meta.className = "course-meta";
  meta.textContent = c.role || "";

  wrap.appendChild(term);
  wrap.appendChild(title);
  wrap.appendChild(blurb);
  wrap.appendChild(meta);
  return wrap;
}
