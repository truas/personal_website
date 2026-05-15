// Shared interactive bits for every redesigned page:
//  - Wire the rail's "Theme" button to flip data-theme and persist to
//    localStorage. Initial theme is applied by an inline <script> in <head>
//    so there's no flash of unstyled colour.
//  - Build a dedicated <nav class="mobile-nav"> next to the side rail.
//    On mobile (≤900px) the CSS hides the rail and shows the mobile-nav:
//    a sticky top bar with brand + hamburger, a horizontally-scrollable
//    strip of section pills (carousel), and a drawer with all links +
//    theme toggle.
//
// Vanilla DOM; no dependencies.

document.addEventListener("DOMContentLoaded", () => {
  // ---- Rail theme toggle (desktop) ----------------------------------------
  const themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) themeBtn.addEventListener("click", flipTheme);

  // ---- Build mobile nav ---------------------------------------------------
  const rail = document.querySelector(".rail");
  const shell = document.querySelector(".shell");
  if (!rail || !shell) return;

  // Bucket the rail's children into "sections" vs "connect" using the
  // <div class="rail-section"> labels as separators.
  const sections = [], connect = [];
  let bucket = null;
  rail.querySelectorAll(":scope > *").forEach((el) => {
    if (el.classList.contains("rail-section")) {
      bucket = el.textContent.trim().toLowerCase().includes("connect")
        ? "connect" : "sections";
    } else if (el.classList.contains("rail-link") || el.classList.contains("rail-button")) {
      if (bucket === "sections") sections.push(el);
      else if (bucket === "connect") connect.push(el);
    }
  });
  const railThemeBtn = rail.querySelector("#theme-toggle");

  const mn = document.createElement("nav");
  mn.className = "mobile-nav";
  mn.setAttribute("aria-label", "Mobile primary");

  // Top bar (brand + burger)
  const top = document.createElement("div");
  top.className = "mn-top";
  const brand = document.createElement("a");
  brand.className = "mn-brand";
  brand.href = "index.html";
  brand.innerHTML = rail.querySelector(".rail-brand").innerHTML;
  const burger = document.createElement("button");
  burger.className = "mn-burger";
  burger.type = "button";
  burger.setAttribute("aria-label", "Menu");
  burger.setAttribute("aria-expanded", "false");
  burger.innerHTML = "<span></span><span></span><span></span>";
  top.appendChild(brand);
  top.appendChild(burger);
  mn.appendChild(top);

  // Section carousel (always visible)
  const strip = document.createElement("div");
  strip.className = "mn-strip";
  strip.setAttribute("role", "list");
  sections.forEach((el) => {
    const pill = el.cloneNode(true);
    pill.classList.add("mn-pill");
    strip.appendChild(pill);
  });
  mn.appendChild(strip);

  // Drawer (hidden until burger toggled)
  const drawer = document.createElement("div");
  drawer.className = "mn-drawer";
  drawer.hidden = true;
  drawer.appendChild(makeLabel("Sections"));
  const dSec = document.createElement("div");
  dSec.className = "mn-drawer-list";
  sections.forEach((el) => dSec.appendChild(makeDrawerLink(el)));
  drawer.appendChild(dSec);

  drawer.appendChild(makeLabel("Connect"));
  const dCon = document.createElement("div");
  dCon.className = "mn-drawer-list";
  connect.forEach((el) => dCon.appendChild(makeDrawerLink(el)));
  if (railThemeBtn) {
    const t = railThemeBtn.cloneNode(true);
    t.id = "theme-toggle-mobile";
    t.classList.add("mn-drawer-link");
    t.addEventListener("click", flipTheme);
    dCon.appendChild(t);
  }
  drawer.appendChild(dCon);
  mn.appendChild(drawer);

  // Burger toggles drawer + body scroll-lock
  burger.addEventListener("click", () => {
    const open = mn.classList.toggle("open");
    burger.setAttribute("aria-expanded", String(open));
    drawer.hidden = !open;
    document.body.classList.toggle("mn-open", open);
  });
  // Tapping anything inside the drawer closes it
  drawer.addEventListener("click", (e) => {
    if (!e.target.closest("a, button")) return;
    mn.classList.remove("open");
    drawer.hidden = true;
    burger.setAttribute("aria-expanded", "false");
    document.body.classList.remove("mn-open");
  });
  // Scroll the active pill into view so it's immediately visible
  const active = strip.querySelector(".mn-pill.active");
  if (active) {
    requestAnimationFrame(() => {
      active.scrollIntoView({ inline: "center", block: "nearest", behavior: "instant" });
    });
  }

  shell.insertBefore(mn, shell.firstChild);
});

function flipTheme() {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
}

function makeLabel(text) {
  const d = document.createElement("div");
  d.className = "mn-drawer-label";
  d.textContent = text;
  return d;
}

function makeDrawerLink(el) {
  const a = el.cloneNode(true);
  a.classList.add("mn-drawer-link");
  return a;
}
