(() => {
  const G = window.Guanzhi;

  function weekStatus(week, progress) {
    if (progress.completedWeeks.includes(week.week)) return "completed";
    if (week.week === progress.currentWeek) return "current";
    return "locked";
  }

  function statusText(status) {
    return {
      completed: "已完成",
      current: "进行中",
      locked: "未解锁"
    }[status] || "未解锁";
  }

  function renderHome(indexData) {
    const root = G.qs("#learning-map");
    if (!root) return;
    const progress = G.Progress.getProgress();
    const stats = G.Progress.getStats(indexData);

    G.qs("#completed-count").textContent = `${stats.completed}/${stats.total}`;
    G.qs("#total-progress-bar").style.width = `${stats.percent}%`;
    G.qs("#current-week").textContent = `第 ${stats.currentWeek} 周`;

    root.innerHTML = indexData.stages.map((stage) => {
      const weeks = indexData.weeks.filter((week) => week.week >= stage.startWeek && week.week <= stage.endWeek);
      return `
        <section class="stage-block stage-${stage.id}">
          <div class="stage-header">
            <div>
              <h2>${G.escapeHTML(stage.name)}</h2>
              <p>${G.escapeHTML(stage.goal)}</p>
            </div>
            <span class="status-pill">${stage.startWeek}-${stage.endWeek} 周</span>
          </div>
          <div class="week-grid">
            ${weeks.map((week) => {
              const status = weekStatus(week, progress);
              const href = week.isReview ? `pages/review.html?week=${week.week}` : `pages/week.html?week=${week.week}`;
              return `
                <a class="week-node ${status} ${week.isReview ? "review" : ""}" href="${href}">
                  <span class="week-number">第 ${week.week} 周 <span>${week.isReview ? "🏆" : ""}</span></span>
                  <span class="week-title">${G.escapeHTML(week.title)}</span>
                  <span class="week-meta">${week.articleIds.length ? `${week.articleIds.length} 篇 · ${G.escapeHTML(week.focus || "循序渐进")}` : G.escapeHTML(week.reviewStandard || "阶段复习")}</span>
                  <span class="status-pill ${status}">${statusText(status)}</span>
                </a>
              `;
            }).join("")}
          </div>
        </section>
      `;
    }).join("");
  }

  function renderArticleCard(article, progress) {
    const done = progress.completedArticles.includes(article.id);
    return `
      <a class="week-article-card" href="article.html?id=${article.id}">
        <div class="week-number">
          <span>${G.escapeHTML(article.id)}</span>
          <span class="status-pill ${done ? "completed" : ""}">${done ? "已完成" : "开始学习"}</span>
        </div>
        <h2>${G.escapeHTML(article.title)}</h2>
        <div class="card-meta">
          <span>${G.escapeHTML(article.author)}</span>
          <span>${G.escapeHTML(article.dynasty || article.source)}</span>
          <span>${G.renderStars(article.difficulty)}</span>
          <span>${article.wordCount || article.word_count || 0} 字</span>
        </div>
        <p>${G.escapeHTML(article.storyIntro || "内容正在整理中。")}</p>
      </a>
    `;
  }

  function renderPlannedCard(article) {
    return `
      <article class="week-article-card">
        <div class="week-number">
          <span>${G.escapeHTML(article.id)}</span>
          <span class="status-pill locked">待补充</span>
        </div>
        <h2>${G.escapeHTML(article.title)}</h2>
        <div class="card-meta">
          <span>${G.escapeHTML(article.source || "")}</span>
          <span>${G.renderStars(article.difficulty)}</span>
          <span>${article.wordCount || 0} 字</span>
        </div>
        <p>这篇文章的数据文件还未生成，补充 Markdown 后运行 <code>npm run build:data</code> 即可上线。</p>
      </article>
    `;
  }

  async function renderWeekPage(indexData) {
    const root = G.qs("#week-page");
    if (!root) return;
    const weekNumber = Number(G.getParam("week", "1"));
    const week = indexData.weeks.find((item) => item.week === weekNumber);
    if (!week) {
      root.innerHTML = `<div class="empty-state">没有找到第 ${weekNumber} 周。</div>`;
      return;
    }

    G.setDocumentTitle(`第${week.week}周：${week.title}`);
    const progress = G.Progress.getProgress();
    const availableIds = new Set(indexData.availableArticleIds || []);
    const articleResults = await Promise.allSettled(
      week.articleIds
        .filter((id) => availableIds.has(id))
        .map((id) => G.fetchJSON(`data/articles/${id}.json`))
    );
    const articles = articleResults.filter((result) => result.status === "fulfilled").map((result) => result.value);
    const missing = week.articleIds
      .filter((id) => !articles.some((article) => article.id === id))
      .map((id) => indexData.articles.find((article) => article.id === id) || { id, title: `文章 ${id}` });
    const completed = week.articleIds.filter((id) => progress.completedArticles.includes(id)).length;

    root.innerHTML = `
      <section class="week-hero">
        <div class="button-row">
          <a class="btn" href="../index.html">返回地图</a>
          ${week.isReview ? `<a class="btn primary" href="review.html?week=${week.week}">进入阶段测评</a>` : ""}
        </div>
        <p class="eyebrow">第 ${week.week} 周</p>
        <h1>${G.escapeHTML(week.title)}</h1>
        <p><strong>本周主题：</strong>${G.escapeHTML(week.theme || week.title)}</p>
        <p><strong>重点词汇：</strong>${G.escapeHTML(week.focus || "按文章积累重点实词与虚词")}</p>
        <p><strong>学习提示：</strong>${G.escapeHTML(week.tip || "先读故事导读，再读原文，最后完成练习。")}</p>
        <div class="mini-track"><span style="width:${G.percent(completed, week.articleIds.length || 1)}%"></span></div>
      </section>
      ${articles.length ? `
        <section class="article-card-grid">
          ${articles.map((article) => renderArticleCard(article, progress)).join("")}
          ${missing.map(renderPlannedCard).join("")}
        </section>
      ` : `
        <section class="article-card-grid">
          ${missing.map(renderPlannedCard).join("")}
        </section>
      `}
      ${missing.length ? `<section class="notice">还有 ${missing.length} 篇文章 JSON 待补充：${missing.map((item) => item.id).join("、")}</section>` : ""}
      <section class="content-card" style="margin-top: var(--space-4);">
        <h2>本周延伸</h2>
        <p>${G.escapeHTML(week.extension || "围绕本周主题，试着把文章人物、事件和成语联系起来。")}</p>
        <h2>本周思考题</h2>
        <p>${G.escapeHTML(week.thinking || "本周文章里哪一句最打动你？它和你的生活有什么关系？")}</p>
      </section>
    `;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const needsMap = G.qs("#learning-map") || G.qs("#week-page");
    if (!needsMap) return;
    try {
      const indexData = await G.fetchJSON("data/index.json");
      renderHome(indexData);
      await renderWeekPage(indexData);
    } catch (error) {
      const root = G.qs("#learning-map") || G.qs("#week-page");
      G.showError(root, error);
    }
  });
})();
