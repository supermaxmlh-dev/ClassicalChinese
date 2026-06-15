(() => {
  const G = window.Guanzhi;

  function collectAnnotations(article) {
    return (article.sections || []).flatMap((section) => section.annotations || []);
  }

  function buildAnnotationRanges(text, annotations) {
    const ranges = [];
    annotations
      .filter((item) => item.word)
      .sort((a, b) => b.word.length - a.word.length)
      .forEach((annotation) => {
        let start = text.indexOf(annotation.word);
        while (start >= 0) {
          const end = start + annotation.word.length;
          const overlaps = ranges.some((range) => start < range.end && end > range.start);
          if (!overlaps) ranges.push({ start, end, annotation });
          start = text.indexOf(annotation.word, end);
        }
      });
    return ranges.sort((a, b) => a.start - b.start);
  }

  function renderText(text, rubyAnnotations = [], annotations = []) {
    const rubyByPos = new Map((rubyAnnotations || []).map((item) => [Number(item.pos), item]));
    const ranges = buildAnnotationRanges(text, annotations);
    let html = "";
    let cursor = 0;

    function charHTML(char, pos) {
      const ruby = rubyByPos.get(pos);
      const safeChar = G.escapeHTML(char);
      if (!ruby) return safeChar;
      return `<ruby>${safeChar}<rp>(</rp><rt>${G.escapeHTML(ruby.pinyin)}</rt><rp>)</rp></ruby>`;
    }

    while (cursor < text.length) {
      const range = ranges.find((item) => item.start === cursor);
      if (range) {
        let inner = "";
        for (let i = range.start; i < range.end; i += 1) {
          inner += charHTML(text[i], i);
        }
        const ann = range.annotation;
        html += `<span class="annotated" data-word="${G.escapeHTML(ann.word)}" data-meaning="${G.escapeHTML(ann.meaning || "")}" data-pinyin="${G.escapeHTML(ann.pinyin || "")}" data-modern="${G.escapeHTML(ann.modernMeaning || ann.modern || "")}">${inner}</span>`;
        cursor = range.end;
      } else {
        html += charHTML(text[cursor], cursor);
        cursor += 1;
      }
    }
    return html;
  }

  function renderSections(article) {
    return (article.sections || []).map((section, index) => `
      <details ${index === 0 ? "open" : ""}>
        <summary>${G.escapeHTML(section.title || `第 ${index + 1} 段`)}</summary>
        <div class="section-body">
          <blockquote class="classic-quote">${G.escapeHTML(section.original || "")}</blockquote>
          <ul class="annotation-list">
            ${(section.annotations || []).map((ann) => `
              <li><strong>${G.escapeHTML(ann.word)}</strong>：${G.escapeHTML(ann.meaning || "")}${ann.pinyin ? `（${G.escapeHTML(ann.pinyin)}）` : ""}</li>
            `).join("")}
          </ul>
          <div><strong>翻译：</strong>${G.escapeHTML(section.translation || "")}</div>
          ${section.modernLink ? `<div class="modern-link"><strong>古今联系：</strong>${G.escapeHTML(section.modernLink)}</div>` : ""}
        </div>
      </details>
    `).join("");
  }

  function renderExtended(extended = {}) {
    const facts = Array.isArray(extended.funFacts) ? extended.funFacts : [];
    return `
      <details>
        <summary>展开延伸阅读</summary>
        <div class="section-body">
          ${extended.author ? `<p><strong>关于作者：</strong>${G.escapeHTML(extended.author)}</p>` : ""}
          ${extended.background ? `<p><strong>历史背景：</strong>${G.escapeHTML(extended.background)}</p>` : ""}
          ${facts.length ? `<ul>${facts.map((fact) => `<li>${G.escapeHTML(fact)}</li>`).join("")}</ul>` : ""}
          ${extended.relatedStory ? `<p><strong>相关故事：</strong>${G.escapeHTML(extended.relatedStory)}</p>` : ""}
        </div>
      </details>
    `;
  }

  function renderVocabTable(vocab = []) {
    if (!vocab.length) return `<p>本篇重点词汇正在整理中。</p>`;
    return `
      <div class="vocab-table-wrap">
        <table class="vocab-table">
          <thead><tr><th>词</th><th>古义</th><th>今义</th><th>例句</th><th>相关成语</th></tr></thead>
          <tbody>
            ${vocab.map((item) => `
              <tr>
                <td><strong>${G.escapeHTML(item.word)}</strong></td>
                <td>${G.escapeHTML(item.ancient || "")}</td>
                <td>${G.escapeHTML(item.modern || "")}</td>
                <td>${G.escapeHTML(item.example || "")}</td>
                <td>${G.escapeHTML(item.idiom || "")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function showTooltip(target) {
    G.qsa(".tooltip").forEach((item) => item.remove());
    const rect = target.getBoundingClientRect();
    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    tooltip.innerHTML = `
      <strong>${target.dataset.word}</strong>
      ${target.dataset.pinyin ? `<div>拼音：${target.dataset.pinyin}</div>` : ""}
      <div>词义：${target.dataset.meaning || "暂无注释"}</div>
      ${target.dataset.modern ? `<div>今义：${target.dataset.modern}</div>` : ""}
    `;
    document.body.append(tooltip);
    const left = Math.min(rect.left, window.innerWidth - tooltip.offsetWidth - 12);
    tooltip.style.left = `${Math.max(12, left)}px`;
    tooltip.style.top = `${Math.max(12, rect.bottom + 8)}px`;
  }

  function bindArticleInteractions(article, indexData) {
    const original = G.qs("#article-original");
    const rubyToggle = G.qs("#toggle-ruby");
    const rhythmToggle = G.qs("#toggle-rhythm");
    const annotations = collectAnnotations(article);

    function updateOriginal() {
      const text = rhythmToggle.checked ? article.rhythmMarked || article.fullTextPlain : article.fullTextPlain;
      original.classList.toggle("hide-ruby", !rubyToggle.checked || rhythmToggle.checked);
      original.innerHTML = renderText(text, rhythmToggle.checked ? [] : article.rubyAnnotations, annotations);
    }

    rubyToggle.addEventListener("change", updateOriginal);
    rhythmToggle.addEventListener("change", updateOriginal);
    updateOriginal();

    document.addEventListener("click", (event) => {
      if (event.target.closest(".annotated")) {
        showTooltip(event.target.closest(".annotated"));
      } else if (!event.target.closest(".tooltip")) {
        G.qsa(".tooltip").forEach((item) => item.remove());
      }
    });

    G.qs("#toggle-translation").addEventListener("click", () => {
      const box = G.qs("#full-translation");
      box.classList.toggle("open");
      G.qs("#toggle-translation").textContent = box.classList.contains("open") ? "收起翻译 ▲" : "点击查看翻译 ▼";
    });

    G.qs("#mark-complete").addEventListener("click", () => {
      G.Progress.markArticleComplete(article.id, indexData);
      G.qs("#mark-complete").textContent = "已完成 ✓";
      G.qs("#mark-complete").disabled = true;
    });
  }

  function getPrevNext(indexData, id) {
    const ids = indexData.weeks.flatMap((week) => week.articleIds);
    const index = ids.indexOf(id);
    return {
      prev: index > 0 ? ids[index - 1] : null,
      next: index >= 0 && index < ids.length - 1 ? ids[index + 1] : null
    };
  }

  async function renderArticlePage() {
    const root = G.qs("#article-page");
    if (!root) return;
    const id = G.getParam("id", "001").padStart(3, "0");
    try {
      const [article, indexData] = await Promise.all([
        G.fetchJSON(`data/articles/${id}.json`),
        G.fetchJSON("data/index.json")
      ]);
      const progress = G.Progress.getProgress();
      const done = progress.completedArticles.includes(article.id);
      const nav = getPrevNext(indexData, article.id);
      G.setDocumentTitle(article.title);

      root.innerHTML = `
        <section class="article-header">
          <div class="article-title">
            <a class="btn" href="week.html?week=${article.week}">返回第 ${article.week} 周</a>
            <p class="eyebrow">${G.escapeHTML(article.source || "")}</p>
            <h1>${G.escapeHTML(article.title)}</h1>
            <div class="card-meta">
              <span>${G.escapeHTML(article.author)}</span>
              <span>${G.escapeHTML(article.dynasty)}</span>
              <span>${article.wordCount} 字</span>
              <span>${G.renderStars(article.difficulty)}</span>
            </div>
            <div class="article-tags">${(article.tags || []).map((tag) => `<span class="tag">${G.escapeHTML(tag)}</span>`).join("")}</div>
          </div>
          <div class="article-visual" role="img" aria-label="${G.escapeHTML(article.title)}意境图"></div>
        </section>
        <div class="article-layout" style="margin-top: var(--space-5);">
          <div class="article-main">
            <section class="article-section story-intro">
              <h2>故事导读</h2>
              <p>${G.escapeHTML(article.storyIntro || "")}</p>
            </section>
            <section class="article-section">
              <div class="reading-toolbar">
                <label class="toggle"><input id="toggle-ruby" type="checkbox">显示全部拼音</label>
                <label class="toggle"><input id="toggle-rhythm" type="checkbox">显示节奏标注</label>
              </div>
              <h2>原文</h2>
              <div id="article-original" class="article-original hide-ruby"></div>
              <button id="toggle-translation" class="btn" type="button" style="margin-top: var(--space-4);">点击查看翻译 ▼</button>
              <div id="full-translation" class="translation-box">${G.escapeHTML(article.fullTranslation || "")}</div>
            </section>
            <section class="article-section">
              <h2>逐句精读</h2>
              <div class="accordion">${renderSections(article)}</div>
            </section>
            <section class="article-section">
              <h2>延伸阅读</h2>
              <div class="accordion">${renderExtended(article.extendedReading)}</div>
            </section>
            <section class="article-section">
              <h2>想一想</h2>
              <ol class="thinking-list">${(article.thinkingQuestions || []).map((question) => `<li>${G.escapeHTML(question)}</li>`).join("")}</ol>
            </section>
            <section class="article-section">
              <h2>小试牛刀</h2>
              <div id="article-quiz"></div>
            </section>
            <section class="article-section">
              <h2>词汇积累</h2>
              ${renderVocabTable(article.keyVocab)}
            </section>
            <nav class="article-bottom-nav" aria-label="文章导航">
              ${nav.prev ? `<a class="btn" href="article.html?id=${nav.prev}">← 上一篇</a>` : `<span></span>`}
              <button id="mark-complete" class="btn primary" type="button" ${done ? "disabled" : ""}>${done ? "已完成 ✓" : "标记完成 ✓"}</button>
              ${nav.next ? `<a class="btn next" href="article.html?id=${nav.next}">下一篇 →</a>` : `<span></span>`}
            </nav>
          </div>
          <aside class="article-aside">
            <div class="content-card">
              <h2>学习提示</h2>
              <p>先通读原文，再打开拼音和节奏。遇到带虚线的词，点一下查看注释。</p>
            </div>
            <div class="content-card">
              <h2>练习记录</h2>
              <p>当前得分：${G.Progress.getQuizScore(article.id) || "未完成"}</p>
            </div>
          </aside>
        </div>
      `;

      bindArticleInteractions(article, indexData);
      G.Quiz.renderArticleQuiz(G.qs("#article-quiz"), article.quiz, article.id);
    } catch (error) {
      G.showError(root, error);
    }
  }

  document.addEventListener("DOMContentLoaded", renderArticlePage);
})();
