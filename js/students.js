// Renders a JSON list of students (or alumni) grouped by program.
// The page sets <html data-students-src="data/students.json"> (or
// data/alumni.json) so the same script powers both students.html
// and alumni.html.
//
// Vanilla DOM; no dependencies.

const SRC = document.documentElement.dataset.studentsSrc;
const PROGRAM_ORDER = ["Postdoc", "Doctorate", "Masters", "Bachelor"];
const PROGRAM_LABEL = {
  Postdoc: "Postdocs (co-supervisors)",
  Doctorate: "Doctorate",
  Masters: "Master's",
  Bachelor: "Bachelor's",
};

async function init() {
  const root = document.getElementById("students-list");
  if (!root || !SRC) return;
  root.innerHTML = `<div class="pub-empty">Loading…</div>`;
  let all;
  try {
    const res = await fetch(SRC, { cache: "default" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    all = await res.json();
  } catch (err) {
    root.innerHTML = `<div class="pub-empty">Could not load (${err.message}).</div>`;
    return;
  }

  // Postdocs are co-supervised colleagues -- they don't count toward the
  // student totals on either the stats line or the summary bar.
  const studentTotal = all.filter((s) => (s.program || "").trim() !== "Postdoc").length;

  const stats = document.getElementById("students-stats");
  if (stats) {
    stats.textContent = `${studentTotal} ${studentTotal === 1 ? "student" : "students"}`;
  }

  root.innerHTML = "";

  // Optional per-program summary at the top of the list.
  if (document.documentElement.dataset.showSummary === "true") {
    const summary = document.createElement("div");
    summary.className = "students-summary";
    const totalCell = document.createElement("div");
    totalCell.className = "summary-cell summary-total";
    totalCell.innerHTML = `<span class="num">${studentTotal}</span><span class="label">Total</span>`;
    summary.appendChild(totalCell);
    PROGRAM_ORDER.forEach((prog) => {
      const n = all.filter((s) => (s.program || "").trim() === prog).length;
      if (!n) return;
      const cell = document.createElement("div");
      cell.className = "summary-cell";
      cell.innerHTML = `<span class="num">${n}</span><span class="label">${PROGRAM_LABEL[prog] || prog}</span>`;
      summary.appendChild(cell);
    });
    root.appendChild(summary);
  }

  PROGRAM_ORDER.forEach((prog) => {
    const items = all.filter((s) => (s.program || "").trim() === prog);
    if (!items.length) return;

    const group = document.createElement("section");
    group.className = "student-group";

    const h = document.createElement("h2");
    h.className = "student-group-title";
    h.textContent = PROGRAM_LABEL[prog] || prog;
    group.appendChild(h);

    // Former students (have a Year) sort newest first; current students
    // sort alphabetically by name.
    if (items.some((s) => s.year)) {
      items.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
    } else {
      items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }

    const list = document.createElement("ul");
    list.className = "students-list";
    items.forEach((s) => {
      const li = document.createElement("li");
      li.className = "student-row";

      // Top row: name on the left, year (if any) on the right.
      const head = document.createElement("div");
      head.className = "student-head";
      const nameWrap = document.createElement("div");
      nameWrap.className = "student-name-wrap";
      const name = document.createElement("div");
      name.className = "student-name";
      name.textContent = s.name;
      nameWrap.appendChild(name);
      if (Array.isArray(s.interests) && s.interests.length) {
        const tags = document.createElement("div");
        tags.className = "student-interests";
        s.interests.forEach((kw) => {
          const tag = document.createElement("span");
          tag.className = "student-tag";
          tag.textContent = kw;
          tags.appendChild(tag);
        });
        nameWrap.appendChild(tags);
      }
      head.appendChild(nameWrap);
      if (s.year) {
        const yr = document.createElement("div");
        yr.className = "student-year";
        yr.textContent = String(s.year);
        head.appendChild(yr);
      }
      li.appendChild(head);

      if (s.thesis) {
        const th = document.createElement("div");
        th.className = "student-thesis";
        th.textContent = s.thesis;
        li.appendChild(th);
      }
      if (s.school) {
        const school = document.createElement("div");
        school.className = "student-school";
        school.textContent = s.school;
        li.appendChild(school);
      }
      list.appendChild(li);
    });
    group.appendChild(list);
    root.appendChild(group);
  });
}

init();
