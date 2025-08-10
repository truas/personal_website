// Apply saved theme immediately before anything else
(function applySavedTheme() {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
        document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
        document.documentElement.setAttribute("data-theme", "light"); // default
    }
})();

document.addEventListener("DOMContentLoaded", () => {
  const navbar = document.querySelector(".navbar");

  fetch("navbar.html")
    .then(res => res.text())
    .then(html => {
      navbar.innerHTML = html;

      // Highlight the active link
      const currentPage = window.location.pathname.split("/").pop() || "index.html";
      const links = navbar.querySelectorAll(".nav-right a");
      links.forEach(link => {
        const linkPage = link.getAttribute("href");
        if (linkPage === currentPage) {
          link.classList.add("active");
        }
      });

      // Mobile menu toggle
      const hamburger = navbar.querySelector(".hamburger");
      const navMenu = navbar.querySelector(".nav-right");
      hamburger.addEventListener("click", () => {
        navMenu.classList.toggle("show");
      });
      
      // All following code regards the theme switcher
      const themeToggleBtn = document.getElementById("theme-toggle-btn");
      const savedTheme = localStorage.getItem("theme");

      // Apply saved theme on load
      if (savedTheme) {
        document.documentElement.setAttribute("data-theme", savedTheme);
      }

      themeToggleBtn.addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
      });
    })
    .catch(err => console.error("Failed to load navbar:", err));
});