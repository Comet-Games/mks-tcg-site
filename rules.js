// Open "Game Setup" by default and wire collapsibles
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".collapse-toggle").forEach((button) => {
    const content = button.nextElementSibling;

    // Open Game Setup by default
    if (button.parentElement.id === "setup") {
      button.classList.add("active");
      content.style.display = "block";
    }

    button.addEventListener("click", () => {
      const isOpen = content.style.display === "block";
      content.style.display = isOpen ? "none" : "block";
      button.classList.toggle("active", !isOpen);
    });
  });

  // Smooth scroll for TOC links + auto-open section
  document.querySelectorAll(".toc a").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = link.getAttribute("href").slice(1);
      const targetSection = document.getElementById(targetId);
      if (!targetSection) return;

      const toggle = targetSection.querySelector(".collapse-toggle");
      const content = targetSection.querySelector(".content");

      if (content.style.display !== "block") {
        content.style.display = "block";
        toggle.classList.add("active");
      }

      window.scrollTo({
        top: targetSection.offsetTop - 10,
        behavior: "smooth",
      });
    });
  });
});
