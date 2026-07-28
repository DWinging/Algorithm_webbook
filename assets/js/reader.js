(() => {
  const drawer = document.querySelector("#toc-drawer");
  const openButton = document.querySelector(".toc-button");
  const closeButton = document.querySelector(".toc-drawer__close");
  const backdrop = document.querySelector("[data-toc-backdrop]");
  const header = document.querySelector("[data-reader-header]");
  const currentTitle = document.querySelector("[data-current-title]");
  const progressText = document.querySelector("[data-progress-text]");
  const modal = document.querySelector("[data-image-modal]");
  const modalImage = document.querySelector("[data-modal-image]");
  const modalCaption = document.querySelector("[data-modal-caption]");

  const openDrawer = () => {
    drawer.classList.add("is-open");
    backdrop.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    openButton.setAttribute("aria-expanded", "true");
  };

  const closeDrawer = () => {
    drawer.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    openButton.setAttribute("aria-expanded", "false");
  };

  openButton.addEventListener("click", openDrawer);
  closeButton.addEventListener("click", closeDrawer);
  backdrop.addEventListener("click", closeDrawer);

  document.querySelectorAll(".toc-list a").forEach((link) => {
    link.addEventListener("click", closeDrawer);
  });

  document.querySelectorAll("img").forEach((image) => {
    if (image.complete && image.naturalWidth > 0) {
      image.closest(".figure__button")?.classList.add("has-image");
    }
    image.addEventListener("load", () => {
      image.closest(".figure__button")?.classList.add("has-image");
    });
    image.addEventListener("error", () => {
      image.classList.add("is-missing");
      image.closest(".figure__button")?.classList.remove("has-image");
    });
  });

  document.querySelectorAll(".figure__button").forEach((button) => {
    button.addEventListener("click", () => {
      const image = button.querySelector("img");
      if (!image || image.classList.contains("is-missing")) return;
      modalImage.src = button.dataset.imageSrc;
      modalImage.alt = image.alt;
      modalCaption.textContent = button.closest("figure")?.querySelector("figcaption")?.textContent || "";
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
    });
  });

  const closeModal = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    modalImage.removeAttribute("src");
  };

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });
  document.querySelector(".image-modal__close").addEventListener("click", closeModal);

  const sections = Array.from(document.querySelectorAll("[data-reader-section]"));
  const tocLinks = Array.from(document.querySelectorAll(".toc-list a"));

  const updateReaderState = () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? Math.round((window.scrollY / maxScroll) * 100) : 0;
    progressText.textContent = `${Math.min(100, Math.max(0, progress))}%`;
    header.classList.toggle("is-cover", window.scrollY < 80);

    let active = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= 90) active = section;
    }

    if (active) {
      currentTitle.textContent = active.dataset.readerTitle || document.title;
      tocLinks.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${active.id}`);
      });
    }
  };

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDrawer();
      closeModal();
    }
  });

  updateReaderState();
  window.addEventListener("scroll", updateReaderState, { passive: true });
  window.addEventListener("resize", updateReaderState);
})();
