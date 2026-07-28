(() => {
  const STORAGE_KEY = "algorithm-webbook-reading-position";
  const SAVE_DEBOUNCE_MS = 300;
  const READ_ANCHOR_SELECTOR = [
    ".chapter-body > p",
    ".chapter-body > ul",
    ".chapter-body > ol",
    ".chapter-body > blockquote",
    ".chapter-body > table",
    ".chapter-body > figure",
    ".chapter-body > .editorial-card",
    ".chapter-body > .process-list",
    ".chapter-body > .process-flow",
    ".chapter-body > .process-summary",
    ".intro > p",
    ".intro > ul",
    ".intro > ol",
    ".intro > blockquote",
    ".author-page > p",
    "h2[data-reader-section]",
    "h3[data-reader-section]",
    "h4[data-reader-section]",
  ].join(",");

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
  const readAnchors = Array.from(document.querySelectorAll(READ_ANCHOR_SELECTOR));
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
  const normalizeAnchorText = (value) => value.replace(/\s+/g, " ").trim().slice(0, 180);

  const hashText = (value) => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index++) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  };

  const assignReadAnchorKeys = () => {
    const seen = new Map();
    readAnchors.forEach((anchor) => {
      const explicitKey = anchor.id ? `id-${anchor.id}` : "";
      const textKey = hashText(normalizeAnchorText(anchor.textContent || anchor.getAttribute("aria-label") || anchor.tagName));
      const baseKey = explicitKey || `${anchor.tagName.toLowerCase()}-${textKey}`;
      const count = seen.get(baseKey) || 0;
      seen.set(baseKey, count + 1);
      anchor.dataset.readerAnchor = count ? `${baseKey}-${count + 1}` : baseKey;
    });
  };

  const normalizeRenderedEllipses = () => {
    const walker = document.createTreeWalker(reader, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue.includes("…")) return NodeFilter.FILTER_REJECT;
        if (node.parentElement?.closest("script, style, code, pre")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      node.nodeValue = node.nodeValue.replaceAll("…", "...");
    });
  };

  const getDocumentProgress = () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    return maxScroll > 0 ? clamp(window.scrollY / maxScroll, 0, 1) : 0;
  };

  const getElementTop = (element) => element.getBoundingClientRect().top + window.scrollY;
  const getRestoreMargin = () => (coarsePointer.matches ? 18 : 76);
  const getReadViewportTop = () => window.scrollY + getRestoreMargin();

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
    const readY = getRestoreMargin();
    return rect.top <= readY && rect.bottom >= readY;
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

  const getSectionAtViewportTop = () => {
    const viewportTop = getReadViewportTop();
    let active = sections[0];
    for (const section of sections) {
      if (getElementTop(section) <= viewportTop) active = section;
    }
    return active;
  };

  const getActiveReadAnchor = () => {
    const viewportTop = getReadViewportTop();
    let active = null;
    for (const anchor of readAnchors) {
      if (getElementTop(anchor) <= viewportTop) active = anchor;
    }
    return active;
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
      if (!parsed.anchorKey && !parsed.sectionId && typeof parsed.documentProgress !== "number") return null;
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
    const section = getSectionAtViewportTop();
    if (progressPercent >= 98 || section?.matches(".back-cover")) {
      storage.remove();
      clearResumeNotice();
      return;
    }
    if (progressPercent < 2) return;

    if (!section || isCoverPosition(section)) return;

    const { start, end } = getSectionRange(section);
    const viewportTop = getReadViewportTop();
    const sectionProgress = clamp((viewportTop - start) / (end - start), 0, 1);
    const anchor = getActiveReadAnchor();
    const anchorTop = anchor ? getElementTop(anchor) : null;
    const anchorOffset = anchor ? clamp(viewportTop - anchorTop, 0, Math.max(1, anchor.offsetHeight)) : 0;

    storage.set(JSON.stringify({
      chapterId: getChapterId(section),
      sectionId: section.id || "",
      sectionProgress,
      sectionOffset: clamp(viewportTop - start, 0, end - start),
      anchorKey: anchor?.dataset.readerAnchor || "",
      anchorOffset,
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
    const anchor = record.anchorKey
      ? readAnchors.find((candidate) => candidate.dataset.readerAnchor === record.anchorKey)
      : null;
    const section = record.sectionId ? document.getElementById(record.sectionId) : null;

    if (anchor) {
      destination = getElementTop(anchor) + clamp(record.anchorOffset || 0, 0, Math.max(1, anchor.offsetHeight)) - getRestoreMargin();
    } else if (section) {
      const { start, end } = getSectionRange(section);
      const sectionOffset = typeof record.sectionOffset === "number"
        ? clamp(record.sectionOffset, 0, end - start)
        : clamp(record.sectionProgress || 0, 0, 1) * (end - start);
      destination = start + sectionOffset - getRestoreMargin();
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
    const anchor = record.anchorKey
      ? readAnchors.find((candidate) => candidate.dataset.readerAnchor === record.anchorKey)
      : null;
    const section = record.sectionId ? document.getElementById(record.sectionId) : null;
    if (!anchor && !section && record.contentVersion !== contentVersion && typeof record.documentProgress !== "number") return;

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

  normalizeRenderedEllipses();
  assignReadAnchorKeys();
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
  window.addEventListener("beforeunload", saveReadingPosition);
  window.addEventListener("pagehide", saveReadingPosition);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveReadingPosition();
  });
  coarsePointer.addEventListener?.("change", () => setReaderUi(false));
})();
