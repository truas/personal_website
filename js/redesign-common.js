// Shared interactive bits for every redesigned page:
//  - Wire the rail's "Theme" button to flip data-theme and persist to
//    localStorage. The initial theme is applied by an inline <script> in
//    each page's <head> so there's no flash of unstyled colour.
//  - On mobile, inject a hamburger button into the rail and let it toggle
//    a slide-down drawer over the page. CSS handles the actual layout
//    transformation via the .open class.
//
// Vanilla DOM; no dependencies.

document.addEventListener("DOMContentLoaded", () => {
  // ---- Theme toggle ---------------------------------------------------------
  const themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    });
  }

  // ---- Mobile hamburger ----------------------------------------------------
  const rail = document.querySelector(".rail");
  if (!rail) return;

  const burger = document.createElement("button");
  burger.className = "rail-burger";
  burger.type = "button";
  burger.setAttribute("aria-label", "Toggle menu");
  burger.setAttribute("aria-expanded", "false");
  burger.innerHTML = '<span></span><span></span><span></span>';
  burger.addEventListener("click", () => {
    const open = rail.classList.toggle("open");
    burger.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("rail-open", open);
  });
  rail.appendChild(burger);

  // Close the drawer when a nav link is tapped.
  rail.querySelectorAll(".rail-link").forEach((a) => {
    a.addEventListener("click", () => {
      rail.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
      document.body.classList.remove("rail-open");
    });
  });
});
