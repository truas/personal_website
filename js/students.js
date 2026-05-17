// Renders a JSON list of students (or alumni) grouped by program.
// The page sets <html data-students-src="data/students.json"> (or
// data/alumni.json) so the same script powers both students.html
// and alumni.html.
//
// Vanilla DOM; no dependencies.

const SRC = document.documentElement.dataset.studentsSrc;
const PROGRAM_ORDER = ["Bachelor", "Masters", "Doctorate"];
const PROGRAM_LABEL = {
  Bachelor: "Bachelor's",
  Masters: "Master's",
  Doctorate: "Doctorate",
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

  const stats = document.getElementById("students-stats");
  if (stats) {
    stats.textContent = `${all.length} ${all.length === 1 ? "student" : "students"}`;
  }

  root.innerHTML = "";
  PROGRAM_ORDER.forEach((prog) => {
    const items = all.filter((s) => (s.program || "").trim() === prog);
    if (!items.length) return;

    const group = document.createElement("section");
    group.className = "student-group";

    const h = document.createElement("h2");
    h.className = "student-group-title";
    h.textContent = PROGRAM_LABEL[prog] || prog;
    group.appendChild(h);

    const list = document.createElement("ul");
    list.className = "students-list";
    items.forEach((s) => {
      const li = document.createElement("li");
      li.className = "student-row";

      const name = document.createElement("div");
      name.className = "student-name";
      name.textContent = s.name;
      li.appendChild(name);

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
