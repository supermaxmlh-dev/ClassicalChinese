(() => {
  const G = window.Guanzhi;

  function normalize(value = "") {
    return String(value || "").trim().toLowerCase();
  }

  function entryText(entry) {
    return [
      entry.char,
      ...(entry.pinyin || []),
      ...(entry.variants || []),
      ...(entry.senses || []).flatMap((sense) => [
        sense.word,
        sense.def,
        sense.example,
        sense.articleTitle
      ])
    ].join(" ").toLowerCase();
  }

  function matchEntry(entry, keyword, mode) {
    if (!keyword) return true;
    if (mode === "char") return entry.char === keyword || (entry.senses || []).some((sense) => String(sense.word || "").includes(keyword));
    if (mode === "pinyin") return (entry.pinyin || []).some((py) => py.toLowerCase().includes(keyword));
    if (mode === "sense") return (entry.senses || []).some((sense) => `${sense.word}${sense.def}${sense.example}${sense.articleTitle}`.toLowerCase().includes(keyword));
    return entryText(entry).includes(keyword);
  }

  function renderSense(sense) {
    return `
      <li>
        <div><strong>${G.escapeHTML(sense.word || "")}</strong>：${G.escapeHTML(sense.def || "")}</div>
        ${sense.example ? `<blockquote>${G.escapeHTML(sense.example)}</blockquote>` : ""}
        <a href="article.html?id=${G.escapeHTML(sense.articleId || "")}">${G.escapeHTML(sense.articleTitle || "查看出处")}</a>
      </li>
    `;
  }

  function renderEntries(entries) {
    if (!entries.length) return `<div class="empty-state">没有找到匹配的字。</div>`;
    return `
      <div class="dict-grid">
        ${entries.map((entry) => `
          <article class="dict-card">
            <div class="dict-card-head">
              <strong class="dict-char">${G.escapeHTML(entry.char)}</strong>
              <div>
                <div class="dict-pinyin">${(entry.pinyin || []).map((py) => `<span>${G.escapeHTML(py)}</span>`).join("")}</div>
                <p>${entry.frequency || 0} 次出现 · ${(entry.senses || []).length} 条义项</p>
              </div>
            </div>
            <ol class="dict-senses">
              ${(entry.senses || []).slice(0, 6).map(renderSense).join("")}
            </ol>
          </article>
        `).join("")}
      </div>
    `;
  }

  function bindDictionary(root, entries) {
    const search = G.qs("#dict-search", root);
    const result = G.qs("#dict-result", root);
    const count = G.qs("#dict-count", root);
    let mode = "all";

    function apply() {
      const keyword = normalize(search.value);
      const filtered = entries.filter((entry) => matchEntry(entry, keyword, mode)).slice(0, 80);
      count.textContent = `显示 ${filtered.length} / ${entries.length} 字`;
      result.innerHTML = renderEntries(filtered);
    }

    G.qsa(".tab-row button", root).forEach((button) => {
      button.addEventListener("click", () => {
        mode = button.dataset.mode;
        G.qsa(".tab-row button", root).forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        apply();
      });
    });

    search.addEventListener("input", apply);
    apply();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const root = G.qs("#dict-page");
    if (!root) return;
    try {
      const dictionary = await G.fetchJSON("data/dictionary.json");
      const entries = dictionary.entries || [];
      const initial = G.getParam("q", "");
      root.innerHTML = `
        <div class="content-card">
          <div class="search-row">
            <input id="dict-search" value="${G.escapeHTML(initial)}" placeholder="按字、拼音、释义、例句或篇名搜索">
          </div>
          <div class="tab-row" aria-label="字典检索范围">
            <button class="active" type="button" data-mode="all">全部</button>
            <button type="button" data-mode="char">字/词</button>
            <button type="button" data-mode="pinyin">拼音</button>
            <button type="button" data-mode="sense">释义</button>
          </div>
          <p id="dict-count">显示 0 / 0 字</p>
        </div>
        <div id="dict-result" style="margin-top: var(--space-4);"></div>
      `;
      bindDictionary(root, entries);
      if (initial) G.setDocumentTitle(`${initial} 字典`);
    } catch (error) {
      G.showError(root, error);
    }
  });
})();
