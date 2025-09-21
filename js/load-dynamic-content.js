// Apply saved theme immediately before anything else
(function applySavedTheme() {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
        document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
        document.documentElement.setAttribute("data-theme", "light"); // default is light, maybe change to match user preference?
    }
})();

document.addEventListener("DOMContentLoaded", () => {
  // Get the "placeholder" elements for navbar and footer
  const navbar = document.querySelector(".navbar");
  const footer = document.querySelector(".footer");

  // Fetch the content of the footer to load it into the placeholder
  fetch("footer.html")
    .then(res => res.text())
    .then(html => {
      footer.innerHTML = html;
    })
    .catch(err => console.error("Failed to load footer:", err));

  // Fetch the content of the navbar to load it into the placeholder
  fetch("navbar.html")
    .then(res => res.text())
    .then(html => {
      navbar.innerHTML = html;

      // Highlight the active link (Works by matching the correct link by comparing the current url path to the href paths of the navbar links)
      // Strip the current url path
      const currentPage = window.location.pathname.split("/").pop().replace(/\/index\.html$/, "/").replace(/\.html$/, "/").replace("/", "") || "index";
      // Get the links from the navbar
      const links = navbar.querySelectorAll(".nav-right a, .mobile-nav-right a");
      links.forEach(link => {
        // For each link in the navbar, strip the href and compare to the url path
        const linkPage = link.getAttribute("href").replace(/\/index\.html$/, "/").replace(/\.html$/, "/").replace("/", "");
        if (linkPage === currentPage) {
          // If the element href matches the url path, set it to active to highlight it
          link.classList.add("active");
        }
      });

      // Load references for the mobile menu button and the menu itself, and make the button open the menu
      const hamburger = navbar.querySelector(".hamburger");
      const navMenu = navbar.querySelector(".mobile-nav-right");
      hamburger.addEventListener("click", () => {
        navMenu.classList.toggle("show");
      });
      
      // All following code regards the theme switcher

      // Load reference for the theme toggle button and get the saved theme from localstorage
      const themeToggleBtn = document.getElementById("theme-toggle-btn");
      const savedTheme = localStorage.getItem("theme");

      // Apply saved theme on website load, if it is already set
      if (savedTheme) {
        document.documentElement.setAttribute("data-theme", savedTheme);
      }

      // Make the theme button toggle the theme
      themeToggleBtn.addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        // Switch theme to opposite of current
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        // Set new theme
        document.documentElement.setAttribute("data-theme", newTheme);
        // Save new theme to localstorage
        localStorage.setItem("theme", newTheme);
      });
    })
    .catch(err => console.error("Failed to load navbar:", err));
});