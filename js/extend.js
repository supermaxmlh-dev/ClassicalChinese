(() => {
  const G = window.Guanzhi;

  function renderCard(article, progress) {
    const done = G.Progress.isArticleLearned(progress, article.id);
    const score = progress.quizScores?.[article.id];
    return `
      <a class="week-article-card" href="article.html?id=${article.id}">
        <div class="week-number">
          <span>${G.escapeHTML(article.id)}</span>
          <span class="status-pill ${done ? "completed" : ""}">${done ? (Number.isFinite(Number(score)) ? `已练习 ${score}%` : "已完成") : "开始学习"}</span>
        </div>
        <h2>${G.escapeHTML(article.title)}</h2>
        <div class="card-meta">
          <span>${G.escapeHTML(article.author)}</span>
          <span>${G.escapeHTML(article.dynasty || article.source)}</span>
          <span>${G.renderStars(article.difficulty)}</span>
          <span>${article.wordCount || article.word_count || 0} 字</span>
        </div>
        <div class="article-tags"><span class="tag">拓展阅读 · 课内名篇（非《古文观止》）</span></div>
        <p>${G.escapeHTML(article.storyIntro || "内容正在整理中。")}</p>
      </a>
    `;
  }

  async function renderExtendPage() {
    const root = G.qs("#extend-page");
    if (!root) return;
    try {
      const indexData = await G.fetchJSON("data/index.json");
      const ids = indexData.extendedReading || [];
      const progress = G.Progress.getProgress();
      const articleResults = await Promise.allSettled(
        ids.map((id) => G.fetchJSON(`data/articles/${id}.json`))
      );
      const articles = articleResults
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);
      const missingIds = ids.filter((id) => !articles.some((article) => article.id === id));

      G.setDocumentTitle("拓展阅读");
      root.innerHTML = `
        <section class="page-title">
          <p class="eyebrow">课内名篇 · 主线之外</p>
          <h1>拓展阅读</h1>
          <p>这里收录已完成教学内容、但不计入 52 周《古文观止》主线进度的经典文言篇目。</p>
        </section>
        <section class="progress-summary" aria-label="拓展阅读数量">
          <div>
            <span class="metric-label">拓展篇目</span>
            <strong>${articles.length}/${ids.length}</strong>
          </div>
          <div>
            <span class="metric-label">进度口径</span>
            <strong>不计入主线</strong>
          </div>
        </section>
        <section class="article-card-grid">
          ${articles.map((article) => renderCard(article, progress)).join("")}
        </section>
        ${missingIds.length ? `<section class="notice">还有 ${missingIds.length} 篇拓展阅读 JSON 待生成：${missingIds.join("、")}</section>` : ""}
      `;
    } catch (error) {
      G.showError(root, error);
    }
  }

  document.addEventListener("DOMContentLoaded", renderExtendPage);
})();
