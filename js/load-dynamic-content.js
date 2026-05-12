// Apply saved theme immediately to avoid a flash of the wrong palette.
// Default is dark; user preference is persisted to localStorage.
(function applySavedTheme() {
  const saved = localStorage.getItem("theme");
  document.documentElement.setAttribute("data-theme", saved || "dark");
})();

document.addEventListener("DOMContentLoaded", () => {
  const navbar = document.querySelector(".navbar");
  const footer = document.querySelector(".footer");

  if (footer) {
    fetch("footer.html")
      .then((r) => r.text())
      .then((html) => { footer.innerHTML = html; })
      .catch((err) => console.error("Failed to load footer:", err));
  }

  if (!navbar) return;

  fetch("navbar.html")
    .then((r) => r.text())
    .then((html) => {
      navbar.innerHTML = html;

      // Highlight active nav link by comparing pathnames.
      const current = window.location.pathname.split("/").pop().replace(/\.html$/, "") || "index";
      const links = navbar.querySelectorAll(".nav-right a, .mobile-nav-right a");
      links.forEach((link) => {
        const target = link.getAttribute("href").split("/").pop().replace(/\.html$/, "") || "index";
        if (target === current) {
          link.classList.add("active");
          link.setAttribute("aria-current", "page");
        }
      });

      // Mobile menu toggle.
      const hamburger = navbar.querySelector(".hamburger");
      const navMenu = navbar.querySelector(".mobile-nav-right");
      if (hamburger && navMenu) {
        hamburger.addEventListener("click", () => {
          const open = navMenu.classList.toggle("show");
          hamburger.setAttribute("aria-expanded", String(open));
        });
        // Close the mobile menu when a link is tapped.
        navMenu.querySelectorAll("a").forEach((a) =>
          a.addEventListener("click", () => {
            navMenu.classList.remove("show");
            hamburger.setAttribute("aria-expanded", "false");
          })
        );
      }

      // Theme toggle.
      const btn = document.getElementById("theme-toggle-btn");
      if (btn) {
        btn.addEventListener("click", () => {
          const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
          document.documentElement.setAttribute("data-theme", next);
          localStorage.setItem("theme", next);
        });
      }
    })
    .catch((err) => console.error("Failed to load navbar:", err));
});
