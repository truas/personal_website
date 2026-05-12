// Renders data/teaching.json into the teaching page with search
// (course + code + institution + term), year/institution/role
// filter chips, and year-grouped cards.
//
// Mirrors js/publications.js conventions; no external deps.

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

// --- render building blocks --------------------------------------------------

function renderCard(e) {
  const card = el("article", { class: "teach-card", "data-id": e.id });

  const titleText = e.code ? `${e.code} — ${e.course}` : e.course;
  card.appendChild(el("h3", { class: "teach-title" }, titleText));

  const metaParts = [];
  metaParts.push(el("span", { class: "teach-institution" }, e.institution));
  metaParts.push(el("span", { class: "teach-term" }, e.term));
  card.appendChild(el("p", { class: "teach-meta" }, ...joinNodes(metaParts, " · ")));

  if (e.role) {
    card.appendChild(el("span", { class: `teach-role role-${roleSlug(e.role)}` }, e.role));
  }
  return card;
}

function joinNodes(nodes, sep) {
  const out = [];
  nodes.forEach((n, i) => {
    if (i > 0) out.push(document.createTextNode(sep));
    out.push(n);
  });
  return out;
}

function roleSlug(role) {
  return role.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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
    if (e.institution) {
      const key = e.institution;
      instCounts.set(key, (instCounts.get(key) || 0) + 1);
    }
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

  // Institution — use short name for chip label, full name as title/aria.
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

  root.innerHTML = `<div class="pub-loading">Loading courses…</div>`;
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
