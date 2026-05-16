// Renders data/projects.json into the projects page as a continuous
// list (no year-grouping) using the redesign's row layout. Each card
// shows title, funding agency, and period.
//
// No external dependencies; vanilla DOM APIs only.

const state = { all: [] };

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

function renderCard(e) {
  const article = el("article", { class: "proj-card" });

  article.appendChild(el("h3", { class: "proj-title" }, e.title));

  const meta = el("dl", { class: "proj-meta" });
  if (e.agency) {
    meta.appendChild(el("dt", {}, "Funding Agency"));
    meta.appendChild(el("dd", {}, e.agency));
  }
  if (e.period) {
    meta.appendChild(el("dt", {}, "Period"));
    meta.appendChild(el("dd", {}, e.period));
  }
  article.appendChild(meta);

  return article;
}

const ROLE_ORDER = [
  { key: "pi", label: "Principal Investigator" },
  { key: "kc", label: "Key Contributor" },
];

function renderList() {
  const root = document.getElementById("projects-list");
  root.innerHTML = "";

  const stats = document.getElementById("proj-stats");
  if (stats) stats.textContent = `${state.all.length} ${state.all.length === 1 ? "project" : "projects"}`;

  if (!state.all.length) {
    root.appendChild(el("div", { class: "pub-empty" }, "No projects yet."));
    return;
  }

  ROLE_ORDER.forEach(({ key, label }) => {
    const items = state.all
      .filter((e) => (e.role || "pi") === key)
      .sort((a, b) => (b.year || 0) - (a.year || 0));
    if (!items.length) return;
    const section = el("section", { class: "proj-group" });
    section.appendChild(el("h2", { class: "proj-group-title" }, label));
    const list = el("div", { class: "proj-list" });
    items.forEach((e) => list.appendChild(renderCard(e)));
    section.appendChild(list);
    root.appendChild(section);
  });
}

async function init() {
  const root = document.getElementById("projects-list");
  if (!root) return;
  root.innerHTML = `<div class="pub-empty">Loading projects…</div>`;
  try {
    const res = await fetch("data/projects.json", { cache: "default" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.all = await res.json();
  } catch (err) {
    root.innerHTML = `<div class="pub-empty">Could not load projects (${err.message}).</div>`;
    return;
  }
  renderList();
}

init();
