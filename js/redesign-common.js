// Shared interactive bits for every redesigned page:
//  - Wire the rail's "Theme" button to flip data-theme and persist to
//    localStorage. The initial theme is applied by an inline <script> in
//    each page's <head> so there's no flash of unstyled colour.
//
// Vanilla DOM; no dependencies.

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  });
});
