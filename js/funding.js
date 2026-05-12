// Renders data/funding.json into the funding page using the design's
// row layout. Year-grouped, with one card per project: title, agency,
// period.
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
  const article = el("article", { class: "fund-card" });

  article.appendChild(el("h3", { class: "fund-title" }, e.title));

  const meta = el("dl", { class: "fund-meta" });
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

function renderList() {
  const root = document.getElementById("funding-list");
  root.innerHTML = "";

  const stats = document.getElementById("fund-stats");
  if (stats) stats.textContent = `${state.all.length} ${state.all.length === 1 ? "project" : "projects"}`;

  if (!state.all.length) {
    root.appendChild(el("div", { class: "pub-empty" }, "No funding entries yet."));
    return;
  }

  const byYear = new Map();
  for (const e of state.all) {
    const y = e.year || "Unknown";
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(e);
  }
  const years = [...byYear.keys()].sort((a, b) => (b === "Unknown" ? -1 : a === "Unknown" ? 1 : b - a));

  for (const y of years) {
    const items = byYear.get(y);
    const details = el("details", { class: "pubs-year-group", open: true });
    const summary = el("summary", { class: "pubs-year-summary" },
      String(y),
      el("span", { class: "pubs-year-count" }, `${items.length} ${items.length === 1 ? "project" : "projects"}`)
    );
    details.appendChild(summary);
    const list = el("div", { class: "fund-list" });
    items.forEach((e) => list.appendChild(renderCard(e)));
    details.appendChild(list);
    root.appendChild(details);
  }
}

async function init() {
  const root = document.getElementById("funding-list");
  if (!root) return;
  root.innerHTML = `<div class="pub-empty">Loading funding…</div>`;
  try {
    const res = await fetch("data/funding.json", { cache: "default" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.all = await res.json();
  } catch (err) {
    root.innerHTML = `<div class="pub-empty">Could not load funding (${err.message}).</div>`;
    return;
  }
  renderList();
}

init();
