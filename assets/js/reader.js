(() => {
  const STORAGE_KEY = "algorithm-webbook-reading-position";
  const SAVE_DEBOUNCE_MS = 300;

  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

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
  const coarsePointer = window.matchMedia("(max-width: 820px), (pointer: coarse)");
  const contentVersion = document.querySelector("meta[name='webbook-content-version']")?.content || "unknown";
  const sections = Array.from(document.querySelectorAll("[data-reader-section]"));
  const tocLinks = Array.from(document.querySelectorAll(".toc-list a"));
  const reader = document.querySelector(".reader");
  let saveTimer = null;
  let resumeNotice = null;

  const storage = {
    get() {
      try {
        return window.localStorage.getItem(STORAGE_KEY);
      } catch {
        return null;
      }
    },
    set(value) {
      try {
        window.localStorage.setItem(STORAGE_KEY, value);
      } catch {
        // Reading progress is optional; storage failures must never break reading.
      }
    },
    remove() {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore blocked storage.
      }
    },
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const getDocumentProgress = () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    return maxScroll > 0 ? clamp(window.scrollY / maxScroll, 0, 1) : 0;
  };

  const getElementTop = (element) => element.getBoundingClientRect().top + window.scrollY;

  const getSectionRange = (section) => {
    const index = sections.indexOf(section);
    const start = getElementTop(section);
    const next = sections.slice(index + 1).find((candidate) => getElementTop(candidate) > start + 1);
    const end = next ? getElementTop(next) : document.documentElement.scrollHeight;
    return { start, end: Math.max(start + 1, end) };
  };

  const isCoverPosition = (section) => {
    if (!section) return true;
    if (section.matches(".book-cover, .back-cover")) return true;
    const chapterCover = section.matches(".chapter") ? section.querySelector(".chapter-cover") : null;
    if (!chapterCover) return false;
    const rect = chapterCover.getBoundingClientRect();
    const centerY = window.innerHeight / 2;
    return rect.top <= centerY && rect.bottom >= centerY;
  };

  const getClosestReaderSection = () => {
    const centerY = window.innerHeight / 2;
    return sections.reduce((closest, section) => {
      const rect = section.getBoundingClientRect();
      const sectionCenter = rect.top + rect.height / 2;
      const distance = Math.abs(sectionCenter - centerY);
      if (!closest || distance < closest.distance) {
        return { section, distance };
      }
      return closest;
    }, null)?.section || null;
  };

  const getChapterId = (section) => {
    const chapter = section?.closest?.(".chapter");
    return chapter?.id || (section?.matches?.(".chapter") ? section.id : "");
  };

  const parseStoredPosition = () => {
    const raw = storage.get();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (parsed.completed) return null;
      if (parsed.sectionId === "cover" || parsed.sectionId === "back-cover") {
        storage.remove();
        return null;
      }
      if (!parsed.sectionId && typeof parsed.documentProgress !== "number") return null;
      return parsed;
    } catch {
      storage.remove();
      return null;
    }
  };

  const clearResumeNotice = () => {
    resumeNotice?.remove();
    resumeNotice = null;
  };

  const saveReadingPosition = () => {
    const documentProgress = getDocumentProgress();
    const progressPercent = documentProgress * 100;
    if (progressPercent >= 98 || getClosestReaderSection()?.matches(".back-cover")) {
      storage.remove();
      clearResumeNotice();
      return;
    }
    if (progressPercent < 2) return;

    const section = getClosestReaderSection();
    if (!section || isCoverPosition(section)) return;

    const { start, end } = getSectionRange(section);
    const centerPosition = window.scrollY + window.innerHeight / 2;
    const sectionProgress = clamp((centerPosition - start) / (end - start), 0, 1);

    storage.set(JSON.stringify({
      chapterId: getChapterId(section),
      sectionId: section.id || "",
      sectionProgress,
      documentProgress,
      savedAt: new Date().toISOString(),
      contentVersion,
      completed: false,
    }));
  };

  const scheduleSaveReadingPosition = () => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveReadingPosition, SAVE_DEBOUNCE_MS);
  };

  const getChapterLabel = (record) => {
    const chapter = record.chapterId ? document.getElementById(record.chapterId) : null;
    const title = chapter?.dataset.readerTitle || "";
    const match = record.chapterId?.match(/chapter-(\d+)/);
    if (match) return `Chapter ${Number(match[1])}`;
    return title || "읽던 위치";
  };

  const restoreReadingPosition = (record) => {
    clearResumeNotice();
    let destination = null;
    const section = record.sectionId ? document.getElementById(record.sectionId) : null;

    if (section) {
      const { start, end } = getSectionRange(section);
      destination = start + clamp(record.sectionProgress || 0, 0, 1) * (end - start) - window.innerHeight / 2;
    } else if (typeof record.documentProgress === "number") {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      destination = clamp(record.documentProgress, 0, 1) * Math.max(0, maxScroll);
    }

    if (destination !== null) {
      window.scrollTo({ top: Math.max(0, destination), behavior: "smooth" });
    }
  };

  const showResumeNotice = (record) => {
    if (!record) return;
    if (window.location.hash) return;
    const section = record.sectionId ? document.getElementById(record.sectionId) : null;
    if (!section && record.contentVersion !== contentVersion && typeof record.documentProgress !== "number") return;

    resumeNotice = document.createElement("section");
    resumeNotice.className = "resume-reading";
    resumeNotice.setAttribute("aria-live", "polite");
    resumeNotice.innerHTML = `
      <p>${getChapterLabel(record)}에서 이어서 읽을까요?</p>
      <div class="resume-reading__actions">
        <button class="resume-reading__primary" type="button">이어서 읽기</button>
        <button class="resume-reading__secondary" type="button">처음부터</button>
      </div>
    `;

    const chapter = record.chapterId ? document.getElementById(record.chapterId) : null;
    if (chapter) {
      resumeNotice.style.setProperty("--resume-accent", getComputedStyle(chapter).getPropertyValue("--chapter-accent"));
    }

    resumeNotice.querySelector(".resume-reading__primary").addEventListener("click", () => {
      restoreReadingPosition(record);
    });
    resumeNotice.querySelector(".resume-reading__secondary").addEventListener("click", () => {
      storage.remove();
      clearResumeNotice();
    });
    document.body.append(resumeNotice);
  };

  const setReaderUi = (visible) => {
    if (!coarsePointer.matches) {
      document.body.classList.remove("reader-ui-visible");
      return;
    }
    if (visible) {
      document.documentElement.style.setProperty("--reader-header-top", `${window.scrollY}px`);
    }
    document.body.classList.toggle("reader-ui-visible", visible);
  };

  const openDrawer = () => {
    setReaderUi(true);
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
    setReaderUi(false);
  };

  const toggleReaderUi = () => {
    if (!coarsePointer.matches) return;
    setReaderUi(!document.body.classList.contains("reader-ui-visible"));
  };

  const shouldIgnoreReaderTap = (target) => {
    return Boolean(target.closest(
      "a, button, input, textarea, select, .toc-drawer, .toc-backdrop, .image-modal, .figure, .reader-header"
    ));
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
    } else if (image.complete) {
      image.classList.add("is-missing");
      image.closest(".figure__button")?.classList.remove("has-image");
    }
    image.addEventListener("load", () => {
      image.classList.remove("is-missing");
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

  reader.addEventListener("click", (event) => {
    if (shouldIgnoreReaderTap(event.target)) return;
    toggleReaderUi();
  });

  updateReaderState();
  setReaderUi(false);
  window.requestAnimationFrame(() => showResumeNotice(parseStoredPosition()));
  window.addEventListener("scroll", () => {
    updateReaderState();
    scheduleSaveReadingPosition();
    if (!drawer.classList.contains("is-open")) {
      setReaderUi(false);
    }
  }, { passive: true });
  window.addEventListener("resize", () => {
    updateReaderState();
    scheduleSaveReadingPosition();
  });
  window.addEventListener("pagehide", saveReadingPosition);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveReadingPosition();
  });
  coarsePointer.addEventListener?.("change", () => setReaderUi(false));
})();
