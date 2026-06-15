(() => {
  const G = window.Guanzhi;

  function categorize(word, categories) {
    const text = `${word.word} ${word.ancient} ${word.modern} ${word.example}`;
    const found = categories.find((category) => (category.keywords || []).some((keyword) => text.includes(keyword)));
    return found?.id || "common";
  }

  function renderCards(words) {
    if (!words.length) return `<div class="empty-state">没有找到匹配的词汇。</div>`;
    return `
      <div class="vocab-grid">
        ${words.map((item) => `
          <article class="vocab-card">
            <h2>${G.escapeHTML(item.word)}</h2>
            <dl>
              <div><dt>古义</dt><dd>${G.escapeHTML(item.ancient || "")}</dd></div>
              <div><dt>今义</dt><dd>${G.escapeHTML(item.modern || "")}</dd></div>
              <div><dt>例句</dt><dd>${G.escapeHTML(item.example || "")}</dd></div>
              <div><dt>出处</dt><dd><a href="article.html?id=${item.articleId}">${G.escapeHTML(item.articleTitle)}</a></dd></div>
              <div><dt>相关成语</dt><dd>${G.escapeHTML(item.idiom || "—")}</dd></div>
            </dl>
          </article>
        `).join("")}
      </div>
    `;
  }

  async function loadWords(indexData, categories) {
    const ids = indexData.availableArticleIds || [];
    const results = await Promise.allSettled(ids.map((id) => G.fetchJSON(`data/articles/${id}.json`)));
    const articles = results.filter((item) => item.status === "fulfilled").map((item) => item.value);
    return G.uniqueBy(articles.flatMap((article) => (article.keyVocab || []).map((word) => ({
      ...word,
      articleId: article.id,
      articleTitle: article.title
    }))), (item) => `${item.word}-${item.articleId}`).map((word) => ({
      ...word,
      category: categorize(word, categories)
    }));
  }

  function bindFilters(root, words, categories) {
    const search = G.qs("#vocab-search", root);
    const result = G.qs("#vocab-result", root);
    let active = "all";

    function apply() {
      const keyword = search.value.trim();
      const filtered = words.filter((word) => {
        const inCategory = active === "all" || word.category === active;
        const inSearch = !keyword || `${word.word}${word.ancient}${word.modern}${word.example}${word.articleTitle}`.includes(keyword);
        return inCategory && inSearch;
      });
      result.innerHTML = renderCards(filtered);
    }

    G.qsa(".tab-row button", root).forEach((button) => {
      button.addEventListener("click", () => {
        active = button.dataset.category;
        G.qsa(".tab-row button", root).forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        apply();
      });
    });
    search.addEventListener("input", apply);
    apply();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const root = G.qs("#vocab-page");
    if (!root) return;
    try {
      const [indexData, categoryData] = await Promise.all([
        G.fetchJSON("data/index.json"),
        G.fetchJSON("data/vocab-categories.json")
      ]);
      const categories = categoryData.categories || [];
      const words = await loadWords(indexData, categories);
      G.Progress.updateProgress((progress) => {
        progress.vocabLearned = Math.max(progress.vocabLearned || 0, words.length);
        return progress;
      });
      root.innerHTML = `
        <div class="content-card">
          <div class="search-row">
            <input id="vocab-search" placeholder="按词、古义、今义或出处搜索">
          </div>
          <div class="tab-row">
            <button class="active" type="button" data-category="all">全部</button>
            ${categories.map((category) => `<button type="button" data-category="${category.id}">${G.escapeHTML(category.name)}</button>`).join("")}
          </div>
          <p>当前已整理 ${words.length} 个重点词汇。</p>
        </div>
        <div id="vocab-result" style="margin-top: var(--space-4);"></div>
      `;
      bindFilters(root, words, categories);
    } catch (error) {
      G.showError(root, error);
    }
  });
})();
