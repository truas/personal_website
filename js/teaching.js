// Renders data/teaching.json into the teaching page using the redesign's
// row layout (term | course + institution | role). Keeps the existing
// search + year/institution/role chip toolbar with year-grouped collapsibles.
//
// No external dependencies; vanilla DOM APIs only.

const ROLE_ORDER = ["Lecturer", "Graduate Student Instructor", "Teaching Assistant"];

const state = {
  all: [],
  query: "",
  yearFilter: null,
  institutionFilter: null,
  roleFilter: null,
};

// --- helpers -----------------------------------------------------------------

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

function debounce(fn, wait = 150) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

function entryMatches(e) {
  if (state.yearFilter !== null && e.year !== state.yearFilter) return false;
  if (state.institutionFilter !== null && e.institution !== state.institutionFilter) return false;
  if (state.roleFilter !== null && e.role !== state.roleFilter) return false;
  if (state.query) {
    const q = state.query.toLowerCase();
    const hay = [e.course, e.code, e.institution, e.institution_short, e.term, e.role]
      .filter(Boolean).join(" ").toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function roleSlug(role) {
  return role.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// --- render building blocks --------------------------------------------------

function renderCard(e) {
  const article = el("article", { class: "teach-card", "data-id": e.id });

  const titleText = e.code ? `${e.code} — ${e.course}` : e.course;
  article.appendChild(el("h3", { class: "teach-title" }, titleText));

  const meta = el("div", { class: "teach-meta" });
  if (e.institution) {
    meta.appendChild(el("span", { class: "teach-institution" }, e.institution));
  }
  if (e.term) {
    if (meta.children.length) meta.appendChild(el("span", { class: "teach-sep" }, "·"));
    meta.appendChild(el("span", { class: "teach-term" }, e.term));
  }
  article.appendChild(meta);

  if (e.role) {
    article.appendChild(el("span", { class: `teach-role role-${roleSlug(e.role)}` }, e.role));
  }

  return article;
}

function renderList() {
  const root = document.getElementById("teaching-list");
  root.innerHTML = "";

  const matched = state.all.filter(entryMatches);

  document.getElementById("teach-stats").textContent =
    `Showing ${matched.length} of ${state.all.length} courses`;

  if (matched.length === 0) {
    root.appendChild(el("div", { class: "pub-empty" }, "No courses match your filters."));
    return;
  }

  const byYear = new Map();
  for (const e of matched) {
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
      el("span", { class: "pubs-year-count" }, `${items.length} ${items.length === 1 ? "course" : "courses"}`)
    );
    details.appendChild(summary);
    const list = el("div", { class: "teach-list" });
    items.forEach((e) => list.appendChild(renderCard(e)));
    details.appendChild(list);
    root.appendChild(details);
  }
}

// --- chips -------------------------------------------------------------------

function makeChip(label, active, onClick, count) {
  const btn = el("button", {
    class: "chip",
    type: "button",
    "aria-pressed": String(active),
    onclick: onClick,
  }, label);
  if (count !== undefined) btn.appendChild(el("span", { class: "chip-count" }, String(count)));
  return btn;
}

function renderChips() {
  const yearWrap = document.getElementById("teach-year-chips");
  const instWrap = document.getElementById("teach-institution-chips");
  const roleWrap = document.getElementById("teach-role-chips");
  yearWrap.innerHTML = "";
  instWrap.innerHTML = "";
  roleWrap.innerHTML = "";

  const yearCounts = new Map();
  const instCounts = new Map();
  const roleCounts = new Map();
  for (const e of state.all) {
    if (e.year) yearCounts.set(e.year, (yearCounts.get(e.year) || 0) + 1);
    if (e.institution) instCounts.set(e.institution, (instCounts.get(e.institution) || 0) + 1);
    if (e.role) roleCounts.set(e.role, (roleCounts.get(e.role) || 0) + 1);
  }

  // Year
  yearWrap.appendChild(el("span", { class: "pubs-filter-label" }, "Year"));
  yearWrap.appendChild(makeChip("All", state.yearFilter === null, () => {
    state.yearFilter = null; renderChips(); renderList();
  }));
  [...yearCounts.keys()].sort((a, b) => b - a).forEach((y) => {
    yearWrap.appendChild(makeChip(`${y}`, state.yearFilter === y, () => {
      state.yearFilter = state.yearFilter === y ? null : y;
      renderChips(); renderList();
    }, yearCounts.get(y)));
  });

  // Institution
  instWrap.appendChild(el("span", { class: "pubs-filter-label" }, "Institution"));
  instWrap.appendChild(makeChip("All", state.institutionFilter === null, () => {
    state.institutionFilter = null; renderChips(); renderList();
  }));
  const instOrder = [...instCounts.keys()].sort((a, b) => instCounts.get(b) - instCounts.get(a));
  instOrder.forEach((inst) => {
    const sample = state.all.find((e) => e.institution === inst);
    const label = sample && sample.institution_short ? sample.institution_short : inst;
    const chip = makeChip(label, state.institutionFilter === inst, () => {
      state.institutionFilter = state.institutionFilter === inst ? null : inst;
      renderChips(); renderList();
    }, instCounts.get(inst));
    chip.setAttribute("title", inst);
    chip.setAttribute("aria-label", inst);
    instWrap.appendChild(chip);
  });

  // Role
  roleWrap.appendChild(el("span", { class: "pubs-filter-label" }, "Role"));
  roleWrap.appendChild(makeChip("All", state.roleFilter === null, () => {
    state.roleFilter = null; renderChips(); renderList();
  }));
  const presentRoles = ROLE_ORDER.filter((r) => roleCounts.has(r))
    .concat([...roleCounts.keys()].filter((r) => !ROLE_ORDER.includes(r)));
  presentRoles.forEach((r) => {
    roleWrap.appendChild(makeChip(r, state.roleFilter === r, () => {
      state.roleFilter = state.roleFilter === r ? null : r;
      renderChips(); renderList();
    }, roleCounts.get(r)));
  });
}

// --- boot --------------------------------------------------------------------

async function init() {
  const root = document.getElementById("teaching-list");
  if (!root) return;

  root.innerHTML = `<div class="pub-empty">Loading courses…</div>`;
  try {
    const res = await fetch("data/teaching.json", { cache: "default" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.all = await res.json();
  } catch (err) {
    root.innerHTML = `<div class="pub-empty">Could not load courses (${err.message}).</div>`;
    return;
  }

  const search = document.getElementById("teach-search-input");
  const clearBtn = document.getElementById("teach-search-clear");
  const onChange = debounce(() => {
    state.query = search.value.trim();
    clearBtn.classList.toggle("show", state.query.length > 0);
    renderList();
  }, 120);
  search.addEventListener("input", onChange);
  clearBtn.addEventListener("click", () => {
    search.value = "";
    state.query = "";
    clearBtn.classList.remove("show");
    search.focus();
    renderList();
  });

  renderChips();
  renderList();
}

init();
