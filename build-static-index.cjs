const fs = require("fs");
const path = require("path");

const SOURCE_PATH = path.join("docs", "webbook.md");
const TEMPLATE_PATH = path.join("templates", "index-template.html");
const OUTPUT_PATH = "index.html";

const chapterMeta = {
  "Chapter 0. 풀이를 어떻게 떠올리나요?": {
    id: "chapter-0",
    number: "00",
    label: "CHAPTER 0",
    title: "풀이를 어떻게 떠올리나요?",
    subtitle: "초보자가 가장 많이 막히는 지점",
    theme: "slate",
  },
  "Chapter 1": {
    id: "chapter-1",
    number: "01",
    label: "CHAPTER 1",
    title: "문제를 해체하는 5가지 관점",
    subtitle: "풀이의 흐름을 설계하고 코드로 연결하는 방법",
    theme: "violet",
  },
  "Chapter 2 - 실전 문제 풀이 1": {
    id: "chapter-2",
    number: "02",
    label: "CHAPTER 2",
    title: "동굴 탐험",
    subtitle: "스토리에서 조건을 추출하고 상태로 바꾸는 과정",
    theme: "teal",
  },
  "Chapter 3 - 실전 문제 풀이 2": {
    id: "chapter-3",
    number: "03",
    label: "CHAPTER 3",
    title: "아이템 줍기",
    subtitle: "낯선 아이디어를 직접 검증해 풀이로 만드는 과정",
    theme: "orange",
  },
};

const bookTocItems = [
  { id: "chapter-0", number: "00", title: "풀이를 어떻게 떠올리나요?", subtitle: "초보자가 가장 많이 막히는 지점" },
  { id: "chapter-1", number: "01", title: "문제를 해체하는 5가지 관점", subtitle: "풀이의 흐름을 설계하고 코드로 연결하는 방법" },
  { id: "chapter-2", number: "02", title: "동굴 탐험", subtitle: "상태와 자료구조를 연결하는 실전 풀이" },
  { id: "chapter-3", number: "03", title: "아이템 줍기", subtitle: "시뮬레이션과 검증으로 만든 다른 풀이" },
  { id: "epilogue", number: "04", title: "에필로그", subtitle: "공부 방식과 기록에 대한 마지막 이야기" },
];

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

const escapeAttr = (value) => escapeHtml(value).replaceAll('"', "&quot;");

const inline = (value) => escapeHtml(value)
  .replace(/`([^`]+)`/g, "<code>$1</code>")
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

function normalizeTitle(raw) {
  return raw.replace(/^제목\s*:\s*/, "").replace(/^부제\s*:\s*/, "").trim();
}

function makeBookCover(title, subtitle) {
  return `
<section class="book-cover" id="cover" data-reader-section data-reader-title="${escapeAttr(title)}">
  <div class="book-cover__art">
    <picture>
      <source media="(max-width: 820px)" srcset="./assets/images/book-cover-mobile.webp" />
      <source media="(max-width: 1180px)" srcset="./assets/images/book-cover-tablet.webp" />
      <img src="./assets/images/book-cover.webp" alt="${escapeAttr(title)} 표지" />
    </picture>
  </div>
  <div class="book-cover__content">
    <p class="book-cover__eyebrow">ALGORITHM WEB BOOK</p>
    <h1>${escapeHtml(title).replace(" 어떻게", "<br />어떻게")}</h1>
    <p class="book-cover__subtitle">${escapeHtml(subtitle)}</p>
  </div>
  <a class="scroll-cue" href="#intro"><span aria-hidden="true"></span>SCROLL TO READ</a>
</section>`;
}

function makeBookToc() {
  return `
<section class="book-toc" id="contents" data-reader-section data-reader-title="목차">
  <p class="book-toc__label">CONTENTS</p>
  ${bookTocItems.map((item) => `
  <a href="#${item.id}" class="book-toc__item">
    <span class="book-toc__number">${item.number}</span>
    <div>
      <strong>${escapeHtml(item.title)}</strong>
      <small>${escapeHtml(item.subtitle)}</small>
    </div>
  </a>`).join("")}
</section>`;
}

function makeChapterCover(meta) {
  return `
  <div class="chapter-cover">
    <span class="chapter-cover__number">${meta.number}</span>
    <p class="chapter-cover__label">${escapeHtml(meta.label)}</p>
    <h2>${escapeHtml(meta.title)}</h2>
    <p class="chapter-cover__subtitle">${escapeHtml(meta.subtitle)}</p>
    <p class="chapter-cover__cue">계속 스크롤해서 읽기</p>
  </div>
  <div class="chapter-body">`;
}

function editorialCard(type, body) {
  const label = type === "key" ? "KEY POINT" : type === "check" ? "CHECK" : type === "note" ? "NOTE" : "COPYRIGHT";
  return `<aside class="editorial-card editorial-card--${type}"><span class="editorial-card__label">${label}</span>${body}</aside>`;
}

function renderLines(lines) {
  const chunks = [];
  let i = 0;

  while (i < lines.length) {
    if (!lines[i].trim()) {
      i++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(lines[i])) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      chunks.push(`<ul>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(lines[i])) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      chunks.push(processList(items));
      continue;
    }

    chunks.push(`<p>${inline(lines[i].replace(/^\*\*([^*]+)\*\*$/, "$1"))}</p>`);
    i++;
  }

  return chunks.join("");
}

function renderQuote(lines) {
  const clean = lines.filter((line) => line.trim());
  const text = clean.join("\n").trim();
  if (!text) return "";

  if (text.includes("문제 해석 → 2. 풀이 아이디어")) {
    return processSummary(["1. 문제 해석", "2. 풀이 아이디어", "3. 이동 규칙 설계", "4. 풀이 검증", "5. 오류 개선"]);
  }

  if (text.startsWith("방을 발견한다.")) {
    return processFlow([
      "방을 발견한다.",
      "방문할 수 있다면 바로 탐색한다.",
      "잠겨 있다면 잠시 보류한다.",
      "이후 Key를 방문하면 잠금을 해제하고 다시 탐색한다.",
    ]);
  }

  const marker = clean[0].match(/^\[!(IMPORTANT|WARNING|NOTE)\]$/);
  if (marker) {
    const type = marker[1] === "IMPORTANT" ? "key" : marker[1] === "WARNING" ? "check" : "note";
    return editorialCard(type, renderLines(clean.slice(1)));
  }

  if (/^\*\*COPYRIGHT\*\*/.test(clean[0])) {
    const copyrightLines = clean.slice(1).filter((line) => !line.includes("공식 문제 링크"));
    const body = renderLines(copyrightLines) + `<p class="disabled-link">공식 문제 링크는 준비 중입니다.</p>`;
    return editorialCard("copyright", body);
  }

  if (/^\*\*NOTE\*\*/.test(clean[0])) {
    return editorialCard("note", renderLines(clean.slice(1)));
  }

  if (text.includes("[도식화 구성]")) return "";

  const titled = clean[0].match(/^\*\*([^*]+)\*\*$/);
  if (titled) {
    const title = titled[1];
    const type = title.includes("검증해야 할 요소") ? "check" : "key";
    let body = `<p class="editorial-card__lead">${inline(title)}</p>${renderLines(clean.slice(1))}`;
    if (title.includes("제가 이해한 선행 조건")) {
      body += relationDiagram();
    }
    if (title.includes("풀이에서 구분해야 하는 상태")) {
      body = `<p class="editorial-card__lead">${inline(title)}</p>${stateList(["현재 방문할 수 있는 방", "발견했지만 아직 잠겨 있는 방", "Key와 Lock의 연결 관계"])}`;
    }
    if (title.includes("현재 방향을 기준으로 이동할 수 있는 칸")) {
      body = processList(["왼쪽 확인", "전진 확인", "오른쪽 확인"]);
    }
    return editorialCard(type, body);
  }

  const strongOnly = text.match(/^\*\*([\s\S]+)\*\*$/);
  if (strongOnly) {
    const type = strongOnly[1].includes("그림에서는 떨어진 경계") ? "check" : "key";
    return editorialCard(type, `<p class="editorial-card__lead">${inline(strongOnly[1])}</p>`);
  }

  if (text.includes("이거 처음에는 그리디인가")) {
    return `<aside class="prompt-card"><span class="prompt-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="prompt-label">PROMPT EXAMPLE</span><p>${inline(text.replace(/^“|”$/g, ""))}</p></aside>`;
  }

  return `<blockquote>${renderLines(clean)}</blockquote>`;
}

function processList(items) {
  return `<ol class="process-list">${items.map((item, index) => `
    <li><span class="process-list__number">${String(index + 1).padStart(2, "0")}</span><span class="process-list__text">${inline(item)}</span></li>`).join("")}
  </ol>`;
}

function processFlow(items) {
  return `<div class="process-flow">${items.map((item, index) => `
    <div class="process-flow__item"><span class="process-flow__number">${String(index + 1).padStart(2, "0")}</span><p>${inline(item)}</p></div>`).join("")}
  </div>`;
}

function processSummary(items) {
  return `<div class="process-summary" aria-label="풀이 흐름">${items.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`;
}

function questionList(items) {
  return `<ul class="question-list">${items.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`;
}

function stateList(items) {
  return `<ul class="state-list">${items.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`;
}

function compareList(items) {
  return `${`<ul class="compare-list">${items.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`}<p class="choice-line">두 값 중 작은 값 선택</p>`;
}

function relationDiagram() {
  return `
<div class="relation-diagram">
  <div class="relation-node"><strong>A</strong><span>KEY</span></div>
  <div class="relation-arrow" aria-hidden="true">→</div>
  <div class="relation-node"><strong>B</strong><span>LOCK</span></div>
</div>`;
}

function figure({ src, alt, caption }) {
  return `
<figure class="figure">
  <button class="figure__button" type="button" data-image-src="${escapeAttr(src)}" aria-label="이미지 확대 보기">
    <img class="figure__image" src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" loading="lazy" />
  </button>
  <figcaption>${escapeHtml(caption)}</figcaption>
</figure>`;
}

function renderTable(lines) {
  const rows = lines
    .filter((line) => !/^\|\s*:?-+/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => inline(cell.trim())));
  const head = rows.shift() || [];
  return `<table><thead><tr>${head.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function getTitleAndSubtitle(lines) {
  const titleLine = lines.find((line) => line.startsWith("# 제목"));
  const subtitleLine = lines.find((line) => line.startsWith("## 부제"));
  return {
    title: normalizeTitle(titleLine?.replace(/^#\s*/, "") || "알고리즘 웹북"),
    subtitle: normalizeTitle(subtitleLine?.replace(/^##\s*/, "") || ""),
  };
}

function parseMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const { title, subtitle } = getTitleAndSubtitle(lines);
  const output = [makeBookCover(title, subtitle)];
  const drawerItems = [
    { id: "cover", title: "표지", type: "chapter" },
  ];

  let i = 0;
  let currentChapter = null;
  let currentStandalone = null;
  let sectionCount = 0;
  let detailCount = 0;
  let inChapterBody = false;
  let introLeadApplied = false;
  let pendingChapter3PathFigure = false;
  const usedIds = new Set(["cover"]);

  const uniqueId = (id) => {
    let candidate = id;
    let n = 2;
    while (usedIds.has(candidate)) {
      candidate = `${id}-${n}`;
      n++;
    }
    usedIds.add(candidate);
    return candidate;
  };

  const closeChapter = () => {
    if (currentChapter) {
      if (inChapterBody) output.push("  </div>");
      output.push("</section>");
      currentChapter = null;
      inChapterBody = false;
    }
  };

  const closeStandalone = () => {
    if (currentStandalone) {
      output.push("</section>");
      currentStandalone = null;
    }
  };

  const closeOpenSection = () => {
    closeChapter();
    closeStandalone();
  };

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    if (line.startsWith("# 제목") || line.startsWith("## 부제")) {
      i++;
      continue;
    }

    if (line.trim() === "목차") {
      while (i < lines.length && !/^---+$/.test(lines[i].trim())) i++;
      if (i < lines.length) i++;
      closeStandalone();
      output.push(makeBookToc());
      drawerItems.push({ id: "contents", title: "목차", type: "chapter" });
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      output.push("<hr>");
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const raw = heading[2].trim();

      if (raw === "들어가며") {
        closeOpenSection();
        const id = uniqueId("intro");
        output.push(`<section class="intro" id="${id}" data-reader-section data-reader-title="들어가며"><h2>들어가며</h2>`);
        currentStandalone = id;
        introLeadApplied = false;
        drawerItems.push({ id, title: "들어가며", type: "chapter" });
        i++;
        continue;
      }

      if (chapterMeta[raw]) {
        closeOpenSection();
        const meta = chapterMeta[raw];
        currentChapter = meta;
        sectionCount = 0;
        detailCount = 0;
        usedIds.add(meta.id);
        output.push(`<section class="chapter" id="${meta.id}" data-theme="${meta.theme}" data-reader-section data-reader-title="${escapeAttr(meta.title)}">`);
        output.push(makeChapterCover(meta));
        inChapterBody = true;
        drawerItems.push({ id: meta.id, title: `${meta.label} ${meta.title}`, type: "chapter" });
        i++;
        continue;
      }

      if (raw === "에필로그") {
        closeOpenSection();
        currentChapter = { id: "epilogue", title: "마치며", theme: "slate" };
        sectionCount = 0;
        usedIds.add("epilogue");
        output.push(`<section class="chapter epilogue" id="epilogue" data-theme="slate" data-reader-section data-reader-title="마치며">`);
        output.push(makeChapterCover({ number: "", label: "EPILOGUE", title: "마치며", subtitle: "혼자 공부한 시간과 기록에 대한 이야기" }));
        inChapterBody = true;
        drawerItems.push({ id: "epilogue", title: "에필로그", type: "chapter" });
        i++;
        continue;
      }

      if (raw === "작성자") {
        closeOpenSection();
        usedIds.add("author");
        output.push(`<section class="author-page" id="author" data-reader-section data-reader-title="작성자"><h2>작성자</h2>`);
        currentStandalone = "author";
        drawerItems.push({ id: "author", title: "작성자", type: "chapter" });
        i++;
        continue;
      }

      const base = currentChapter?.id || "intro";
      const id = level === 3
        ? uniqueId(`${base}-section-${++sectionCount}`)
        : uniqueId(`${base}-detail-${++detailCount}`);
      output.push(`<h${level} id="${id}" data-reader-section data-reader-title="${escapeAttr(raw.replace(/^\d+\.\s*/, ""))}">${inline(raw)}</h${level}>`);
      drawerItems.push({ id, title: raw.replace(/^\d+\.\s*/, ""), type: level === 3 ? "section" : "detail" });
      i++;
      continue;
    }

    if (line.startsWith(">")) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      output.push(renderQuote(quoteLines));
      continue;
    }

    if (/^\|/.test(line.trim())) {
      const tableLines = [];
      while (i < lines.length && /^\|/.test(lines[i].trim())) {
        tableLines.push(lines[i]);
        i++;
      }
      output.push(renderTable(tableLines));
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      output.push(`<ul>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      output.push(`<ol>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</ol>`);
      continue;
    }

    const parts = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim()) &&
      !lines[i].startsWith(">") &&
      !/^\|/.test(lines[i].trim()) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      parts.push(lines[i].trim());
      i++;
    }

    const paragraphText = parts.join(" ");

    if (paragraphText.startsWith("**풀이의 흐름을 떠올리고")) {
      const first = "풀이의 흐름을 떠올리고, 필요한 알고리즘과 자료구조를 찾아 연결하는 능력.";
      const second = "이 부분이 코딩테스트에서 문제를 잘 푸는지 못 푸는지를 가르는 핵심이라고 생각합니다.";
      output.push(editorialCard("key", `<p class="editorial-card__lead">${escapeHtml(first)}</p><p class="editorial-card__support">${escapeHtml(second)}</p>`));
      continue;
    }

    if (paragraphText.startsWith("정리하면 문제를 읽는 순서는 다음과 같습니다.")) {
      output.push(`<p>${inline(paragraphText)}</p>`);
      const ordered = [];
      while (i < lines.length && (/^\s*$/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))) {
        if (/^\s*\d+\.\s+/.test(lines[i])) ordered.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      output.push(processList(ordered));
      continue;
    }

    if (paragraphText.startsWith("앞에서 정리한 풀이의 흐름을 하나씩 살펴보면서")) {
      output.push(`<p>${inline(paragraphText)}</p>`);
      const questions = [];
      while (i < lines.length && (/^\s*$/.test(lines[i]) || /^\s*[-*]\s+/.test(lines[i]))) {
        if (/^\s*[-*]\s+/.test(lines[i])) questions.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      output.push(questionList(questions));
      continue;
    }

    if (paragraphText.startsWith("따라서 다음 두 값 중 더 짧은 값을 정답으로 선택했습니다.")) {
      output.push(`<p>${inline(paragraphText)}</p>`);
      const items = [];
      while (i < lines.length && (/^\s*$/.test(lines[i]) || /^\s*[-*]\s+/.test(lines[i]))) {
        if (/^\s*[-*]\s+/.test(lines[i])) items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      output.push(compareList(items));
      if (pendingChapter3PathFigure) {
        output.push(figure({
          src: "./assets/images/chapter3-path.webp",
          alt: "겹친 사각형과 캐릭터 아이템 사이의 두 이동 경로",
          caption: "여러 사각형이 겹쳐 하나의 다각형을 만들고, 캐릭터와 아이템 사이에는 서로 반대 방향으로 이동하는 두 경로가 만들어진다.",
        }));
        pendingChapter3PathFigure = false;
      }
      continue;
    }

    let renderedParagraph = paragraphText
      .replaceAll("왼쪽, 앞쪽, 오른쪽", "왼쪽, 전진, 오른쪽")
      .replace(
        "이동 방향을 기준으로 오른쪽 벽을 계속 유지하면, 볼록한 꼭짓점에서는 자연스럽게 방향을 전환하고 오목한 부분에서는 벽을 따라 안쪽으로 들어갔다가 다시 빠져나오게 됩니다.",
        "경계의 형태가 달라져도 진행 방향을 기준으로 왼쪽, 전진, 오른쪽 순서로 다음 칸을 확인했습니다. 실제 이동 과정은 아래 이미지에서 각 상황별 선택 순서를 확인할 수 있습니다."
      )
      .replace(
        "볼록한 꼭짓점에서는 오른쪽으로 방향을 전환하고, 오목한 꼭짓점에서는 앞으로 이동할 수 없을 때까지 진행한 뒤 다시 벽을 따라 방향을 바꾸게 됩니다.",
        "경계의 형태가 달라져도 같은 우선순위를 적용했고, 실제로 이동 가능한 칸에 따라 다음 방향이 결정되었습니다."
      );

    if (currentStandalone === "intro" && !introLeadApplied && renderedParagraph.startsWith("“코딩테스트가 줄어드는 추세다”")) {
      output.push(`<p class="lead-paragraph">${inline(renderedParagraph)}</p>`);
      introLeadApplied = true;
    } else {
      output.push(`<p>${inline(renderedParagraph)}</p>`);
    }

    if (renderedParagraph.includes("여러 사각형이 겹치면서 하나의 다각형이 만들어졌습니다.")) {
      pendingChapter3PathFigure = true;
    }

    if (renderedParagraph.includes("이 과정은 글만으로 이해하기보다 실제 그림을 따라가 보는 편이 훨씬 쉬웠습니다.")) {
      output.push(figure({
        src: "./assets/images/chapter3-grid.webp",
        alt: "이동 후보 확인 순서와 좌표 2배 확장 비교",
        caption: "진행 방향을 기준으로 왼쪽, 전진, 오른쪽 순서로 다음 칸을 확인한다. 좌표를 2배로 확장하면 붙어 보이던 경계 사이의 간격도 표현할 수 있다.",
      }));
    }
  }

  closeOpenSection();
  if (pendingChapter3PathFigure) {
    throw new Error("chapter3-path figure was queued but never inserted after the distance comparison");
  }
  output.push(`
<section class="back-cover" id="back-cover" data-reader-section data-reader-title="끝 표지">
  <div class="back-cover__art">
    <picture>
      <source media="(max-width: 820px)" srcset="./assets/images/back-cover-mobile.webp" />
      <source media="(max-width: 1180px)" srcset="./assets/images/back-cover-tablet.webp" />
      <img src="./assets/images/back-cover.webp" alt="웹북 끝 표지" />
    </picture>
  </div>
  <div class="back-cover__content">
    <h2>끝까지 읽어주셔서 감사합니다.</h2>
    <p>알고리즘을 바라보는 자신만의 관점을 만드는 데 도움이 되었으면 좋겠습니다.</p>
  </div>
</section>`);

  return { title, content: output.join("\n"), drawerItems };
}

function renderDrawerToc(items) {
  return items.map((item) => {
    const cls = item.type === "chapter" ? "toc-list__chapter" : "toc-list__section";
    return `<a class="${cls}" href="#${escapeAttr(item.id)}">${escapeHtml(item.title)}</a>`;
  }).join("\n");
}

function assertNoDuplicateIds(html) {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) {
    throw new Error(`Duplicate ids found: ${[...new Set(duplicates)].join(", ")}`);
  }
}

function assertIncludesOnce(html, text) {
  const count = html.split(text).length - 1;
  if (count !== 1) {
    throw new Error(`Expected exactly one occurrence of "${text}", found ${count}`);
  }
}

function assertSourceMarkerOnce(source, marker) {
  const count = source.split(marker).length - 1;
  if (count !== 1) {
    throw new Error(`Expected source marker exactly once: "${marker}", found ${count}`);
  }
}

function assertOrder(html, labels) {
  let cursor = -1;
  for (const label of labels) {
    const next = html.indexOf(label, cursor + 1);
    if (next === -1) {
      throw new Error(`Missing ordered marker: ${label}`);
    }
    if (next < cursor) {
      throw new Error(`Out of order marker: ${label}`);
    }
    cursor = next;
  }
}

function sliceBetween(html, start, end) {
  const startIndex = html.indexOf(start);
  const endIndex = html.indexOf(end, startIndex + start.length);
  if (startIndex === -1 || endIndex === -1) {
    throw new Error(`Could not slice between "${start}" and "${end}"`);
  }
  return html.slice(startIndex, endIndex);
}

function validateGeneratedHtml(html) {
  assertNoDuplicateIds(html);

  const questions = [
    "현재 어떤 값을 알고 있어야 하는가?",
    "다음 동작을 결정하기 위해 어떤 상태가 필요한가?",
    "처리 순서를 보장해야 하는가?",
    "같은 계산이 반복되는가?",
    "한 번 확인한 대상을 다시 방문해야 하는가?",
    "지금 처리하지 못한 값을 나중에 다시 확인해야 하는가?",
  ];
  questions.forEach((question) => assertIncludesOnce(html, question));

  const questionRange = sliceBetween(
    html,
    "앞에서 정리한 풀이의 흐름을 하나씩 살펴보면서 다음과 같은 질문을 던져봅니다.",
    "이러한 질문에 하나씩 답하면서 관리해야 하는 상태와 필요한 연산을 정리합니다."
  );
  questions.forEach((question) => {
    if (!questionRange.includes(question)) {
      throw new Error(`Question is outside the expected Chapter 1 range: ${question}`);
    }
  });

  assertOrder(html, [
    "풀이에서 구분해야 하는 상태",
    "현재 방문할 수 있는 방",
    "Key와 Lock의 연결 관계",
    "이 상태를 기준으로 전체 흐름을 정리하면 다음과 같습니다.",
    "process-flow__number\">01</span><p>방을 발견한다.",
    "process-flow__number\">02</span><p>방문할 수 있다면 바로 탐색한다.",
    "process-flow__number\">03</span><p>잠겨 있다면 잠시 보류한다.",
    "process-flow__number\">04</span><p>이후 Key를 방문하면 잠금을 해제하고 다시 탐색한다.",
    "처음에는 트리 전체를 탐색하는 문제로 보였지만",
    "관리할 대상",
  ]);

  const flowRange = sliceBetween(html, '<div class="process-flow">', "</div>");
  if (flowRange.includes("<table")) {
    throw new Error("Chapter 2 process-flow contains a table");
  }

  assertOrder(html, [
    "따라서 다음 두 값 중 더 짧은 값을 정답으로 선택했습니다.",
    "캐릭터와 아이템 사이를 직접 이동한 거리",
    "전체 둘레에서 해당 거리를 뺀 나머지 거리",
    "두 값 중 작은 값 선택",
    "./assets/images/chapter3-path.webp",
    "3. 이동 규칙 설계",
  ]);

  assertOrder(html, [
    '<li><span class="process-list__number">01</span><span class="process-list__text">왼쪽 확인</span></li>',
    '<li><span class="process-list__number">02</span><span class="process-list__text">전진 확인</span></li>',
    '<li><span class="process-list__number">03</span><span class="process-list__text">오른쪽 확인</span></li>',
  ]);

  const forbidden = ["볼록", "오목", "앞쪽", "Queue ,", "PriorityQueue ,", "Set ,", "BFS ,", "href=\"#\"", "fetch("];
  for (const text of forbidden) {
    if (html.includes(text)) {
      throw new Error(`Forbidden generated output found: ${text}`);
    }
  }
}

function validateSourceMarkdown(markdown) {
  [
    "앞에서 정리한 풀이의 흐름을 하나씩 살펴보면서 다음과 같은 질문을 던져봅니다.",
    "이러한 질문에 하나씩 답하면서 관리해야 하는 상태와 필요한 연산을 정리합니다.",
    "풀이에서 구분해야 하는 상태",
    "이 상태를 기준으로 전체 흐름을 정리하면 다음과 같습니다.",
    "방을 발견한다.",
    "이후 Key를 방문하면 잠금을 해제하고 다시 탐색한다.",
    "따라서 다음 두 값 중 더 짧은 값을 정답으로 선택했습니다.",
    "이 과정은 글만으로 이해하기보다 실제 그림을 따라가 보는 편이 훨씬 쉬웠습니다.",
  ].forEach((marker) => assertSourceMarkerOnce(markdown, marker));
}

function build() {
  const markdown = fs.readFileSync(SOURCE_PATH, "utf8");
  validateSourceMarkdown(markdown);
  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  const { title, content, drawerItems } = parseMarkdown(markdown);
  const html = template
    .replaceAll("{{TITLE}}", escapeHtml(title))
    .replace("{{DRAWER_TOC}}", renderDrawerToc(drawerItems))
    .replace("{{CONTENT}}", content);

  validateGeneratedHtml(html);
  fs.writeFileSync(OUTPUT_PATH, html, "utf8");

  console.log(`Built ${OUTPUT_PATH}`);
  console.log(`Sections: ${drawerItems.length}`);
  console.log("Generated HTML validation: passed");
}

build();
