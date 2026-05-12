// Renders data/publications.json into the publications page using the
// redesign's row layout (year | content | venue). Keeps the existing
// search + year/type chip toolbar and the abstract / BibTeX toggles.
//
// No external dependencies; vanilla DOM APIs only.

const ME = "Ruas";
const TYPE_ORDER = ["Conference", "Journal", "Preprint", "Workshop", "Book", "Report", "Thesis", "Other"];

const state = {
  all: [],
  query: "",
  yearFilter: null,
  typeFilter: null,
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

function fmtAuthors(authors) {
  return authors.map((name) => {
    const isMe = name.toLowerCase().endsWith(ME.toLowerCase());
    return el("span", { class: isMe ? "me" : "" }, name);
  });
}

function joinNodes(nodes, sep) {
  const out = [];
  nodes.forEach((n, i) => {
    if (i > 0) out.push(document.createTextNode(sep));
    out.push(n);
  });
  return out;
}

function entryMatches(e) {
  if (state.yearFilter !== null && e.year !== state.yearFilter) return false;
  if (state.typeFilter !== null && e.type !== state.typeFilter) return false;
  if (state.query) {
    const q = state.query.toLowerCase();
    const hay = (e.title + " " + e.authors.join(" ") + " " + (e.venue || "")).toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

// --- render building blocks --------------------------------------------------

function renderCard(e) {
  const article = el("article", { class: "pub", "data-id": e.id });

  // Year column.
  article.appendChild(el("div", { class: "pub-year" }, String(e.year || "")));

  // Middle column: title, authors, action links, optional detail panels.
  const mid = el("div", { class: "pub-mid" });

  const titleInner = e.url
    ? el("a", { href: e.url, target: "_blank", rel: "noopener noreferrer" }, e.title)
    : document.createTextNode(e.title);
  mid.appendChild(el("h3", { class: "pub-title" }, titleInner));
  mid.appendChild(el("div", { class: "pub-authors" }, ...joinNodes(fmtAuthors(e.authors), ", ")));

  const links = el("div", { class: "pub-links" });
  const abstractPanel = el("div", { class: "pub-detail", hidden: true });
  const bibtexPanel = el("div", { class: "pub-detail pub-bibtex", hidden: true });

  if (e.doi) {
    links.appendChild(el("a", {
      class: "pub-link",
      href: `https://doi.org/${e.doi}`,
      target: "_blank",
      rel: "noopener noreferrer",
      "aria-label": `DOI ${e.doi}`,
    }, "doi"));
  }
  if (e.url && (!e.doi || e.url !== `https://doi.org/${e.doi}`)) {
    links.appendChild(el("a", {
      class: "pub-link",
      href: e.url,
      target: "_blank",
      rel: "noopener noreferrer",
    }, "link"));
  }

  if (e.abstract) {
    abstractPanel.appendChild(el("p", { class: "pub-abstract" }, e.abstract));
    const absBtn = el("button", {
      class: "pub-link",
      type: "button",
      "aria-pressed": "false",
      "aria-expanded": "false",
    }, "abstract");
    absBtn.addEventListener("click", () => {
      const open = abstractPanel.hasAttribute("hidden");
      if (open) abstractPanel.removeAttribute("hidden"); else abstractPanel.setAttribute("hidden", "");
      absBtn.setAttribute("aria-pressed", String(open));
      absBtn.setAttribute("aria-expanded", String(open));
    });
    links.appendChild(absBtn);
  }

  if (e.bibtex) {
    const pre = el("pre", { tabindex: "0" }, e.bibtex);
    const copy = el("button", { class: "pub-bibtex-copy", type: "button" }, "Copy");
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(e.bibtex);
        copy.classList.add("copied");
        copy.textContent = "Copied";
        setTimeout(() => { copy.classList.remove("copied"); copy.textContent = "Copy"; }, 1500);
      } catch {
        copy.textContent = "Press Ctrl+C";
      }
    });
    bibtexPanel.appendChild(copy);
    bibtexPanel.appendChild(pre);

    const bibBtn = el("button", {
      class: "pub-link",
      type: "button",
      "aria-pressed": "false",
      "aria-expanded": "false",
    }, "bibtex");
    bibBtn.addEventListener("click", () => {
      const open = bibtexPanel.hasAttribute("hidden");
      if (open) bibtexPanel.removeAttribute("hidden"); else bibtexPanel.setAttribute("hidden", "");
      bibBtn.setAttribute("aria-pressed", String(open));
      bibBtn.setAttribute("aria-expanded", String(open));
    });
    links.appendChild(bibBtn);
  }

  if (links.children.length) mid.appendChild(links);
  if (abstractPanel.children.length) mid.appendChild(abstractPanel);
  if (bibtexPanel.children.length) mid.appendChild(bibtexPanel);

  article.appendChild(mid);

  // Venue column.
  const venueParts = [];
  if (e.venue) venueParts.push(e.venue);
  if (e.type)  venueParts.push(e.type);
  article.appendChild(el("div", { class: "pub-venue" }, venueParts.join(" · ")));

  return article;
}

function renderList() {
  const root = document.getElementById("publications-list");
  root.innerHTML = "";

  const matched = state.all.filter(entryMatches);

  document.getElementById("pubs-stats").textContent =
    `Showing ${matched.length} of ${state.all.length} publications`;

  if (matched.length === 0) {
    root.appendChild(el("div", { class: "pub-empty" }, "No publications match your filters."));
    return;
  }

  // Group by year (descending).
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
      el("span", { class: "pubs-year-count" }, `${items.length} ${items.length === 1 ? "publication" : "publications"}`)
    );
    details.appendChild(summary);
    const list = el("div", { class: "pubs" });
    items.forEach((e) => list.appendChild(renderCard(e)));
    details.appendChild(list);
    root.appendChild(details);
  }
}

// --- chips -------------------------------------------------------------------

function renderChips() {
  const yearWrap = document.getElementById("pubs-year-chips");
  const typeWrap = document.getElementById("pubs-type-chips");
  yearWrap.innerHTML = "";
  typeWrap.innerHTML = "";

  const yearCounts = new Map();
  const typeCounts = new Map();
  for (const e of state.all) {
    if (e.year) yearCounts.set(e.year, (yearCounts.get(e.year) || 0) + 1);
    typeCounts.set(e.type, (typeCounts.get(e.type) || 0) + 1);
  }

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

  typeWrap.appendChild(el("span", { class: "pubs-filter-label" }, "Type"));
  typeWrap.appendChild(makeChip("All", state.typeFilter === null, () => {
    state.typeFilter = null; renderChips(); renderList();
  }));
  const presentTypes = TYPE_ORDER.filter((t) => typeCounts.has(t));
  presentTypes.forEach((t) => {
    typeWrap.appendChild(makeChip(t, state.typeFilter === t, () => {
      state.typeFilter = state.typeFilter === t ? null : t;
      renderChips(); renderList();
    }, typeCounts.get(t)));
  });
}

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

// --- boot --------------------------------------------------------------------

async function init() {
  const root = document.getElementById("publications-list");
  if (!root) return;

  root.innerHTML = `<div class="pub-empty">Loading publications…</div>`;
  try {
    const res = await fetch("data/publications.json", { cache: "default" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.all = await res.json();
  } catch (err) {
    root.innerHTML = `<div class="pub-empty">Could not load publications (${err.message}).</div>`;
    return;
  }

  const search = document.getElementById("pubs-search-input");
  const clearBtn = document.getElementById("pubs-search-clear");
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
