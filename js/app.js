(() => {
  const G = window.Guanzhi;

  function markActiveNav() {
    const page = document.body.dataset.page;
    G.qsa(".site-nav a").forEach((link) => {
      const href = link.getAttribute("href") || "";
      const pageTarget = {
        home: "index",
        week: "index",
        review: "index",
        dict: "dict",
        vocab: "vocab",
        extend: "extend",
        progress: "progress",
        about: "about"
      }[page];
      const active =
        pageTarget && href.includes(pageTarget);
      if (active) link.classList.add("active");
    });
  }

  function renderBackupReminder() {
    if (!G.Progress?.shouldShowBackupReminder()) return;
    const banner = document.createElement("div");
    banner.className = "backup-banner";
    banner.innerHTML = `
      <span>学习记录已经超过 14 天没有导出，建议备份一次。</span>
      <button type="button">导出进度</button>
    `;
    banner.querySelector("button").addEventListener("click", () => {
      G.Progress.exportProgress();
      banner.remove();
    });
    document.body.prepend(banner);
  }

  function renderCookieSizeNotice(progress) {
    if (!G.Progress?.isProgressCookieLarge(progress)) return "";
    return `
      <section class="notice progress-cookie-notice" role="status">
        进度数据较大，建议导出备份。
      </section>
    `;
  }

  function showCookieSizeNotice() {
    const root = G.qs("#progress-page");
    if (!root || G.qs(".progress-cookie-notice")) return;
    root.insertAdjacentHTML("afterbegin", renderCookieSizeNotice(G.Progress.getProgress()));
  }

  async function renderProgressPage() {
    const root = G.qs("#progress-page");
    if (!root) return;
    try {
      const indexData = await G.fetchJSON("data/index.json");
      const progress = G.Progress.getProgress();
      const stats = G.Progress.getStats(indexData);
      const stages = indexData.stages.map((stage) => {
        const stageWeeks = indexData.weeks.filter((week) => week.week >= stage.startWeek && week.week <= stage.endWeek);
        const articleIds = stageWeeks.flatMap((week) => week.articleIds);
        const completed = articleIds.filter((id) => G.Progress.isArticleLearned(progress, id)).length;
        const pct = G.percent(completed, articleIds.length || 1);
        return `
          <div class="stat-card">
            <h2>${G.escapeHTML(stage.name)}</h2>
            <p>${completed}/${articleIds.length} 篇</p>
            <div class="mini-track"><span style="width:${pct}%"></span></div>
          </div>
        `;
      }).join("");

      root.innerHTML = `
        ${renderCookieSizeNotice(progress)}
        <section class="stats-grid">
          <div class="stat-card">
            <h2>${stats.completed}/${stats.total}</h2>
            <p>主线已学文章（全书目标 ${stats.targetTotal} 篇）</p>
            <div class="mini-track"><span style="width:${stats.percent}%"></span></div>
          </div>
          <div class="stat-card">
            <h2>第 ${stats.currentWeek} 周</h2>
            <p>当前进度</p>
          </div>
          <div class="stat-card">
            <h2>${stats.averageScore}%</h2>
            <p>平均练习正确率</p>
          </div>
          <div class="stat-card">
            <h2>${stats.badges.length}</h2>
            <p>已获称号</p>
          </div>
        </section>
        <section class="content-card" style="margin-top: var(--space-4);">
          <h2>学生信息</h2>
          <div class="search-row">
            <input id="student-name" class="form-input" value="${G.escapeHTML(progress.studentName)}" placeholder="填写学生姓名">
            <button id="save-name" class="btn primary" type="button">保存</button>
          </div>
          <p>已获称号：${stats.badges.length ? stats.badges.map((badge) => `<span class="badge">${G.escapeHTML(badge)}</span>`).join(" ") : "暂无"}</p>
        </section>
        <section class="stats-grid" style="margin-top: var(--space-4);">${stages}</section>
        <section class="content-card" style="margin-top: var(--space-4);">
          <h2>进度备份</h2>
          <div class="button-row">
            <button id="export-progress" class="btn primary" type="button">导出进度</button>
            <label class="btn" for="import-progress">导入进度</label>
            <input id="import-progress" type="file" accept="application/json" hidden>
          </div>
          <p id="import-message"></p>
        </section>
      `;

      G.qs("#save-name").addEventListener("click", () => {
        G.Progress.updateProgress((next) => {
          next.studentName = G.qs("#student-name").value.trim();
          return next;
        });
      });
      G.qs("#export-progress").addEventListener("click", G.Progress.exportProgress);
      G.qs("#import-progress").addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const message = G.qs("#import-message");
        try {
          await G.Progress.importProgress(file);
          message.textContent = "导入成功，页面已更新。";
          renderProgressPage();
        } catch (error) {
          message.textContent = error.message;
        }
      });
    } catch (error) {
      G.showError(root, error);
    }
  }

  async function renderReviewPage() {
    const root = G.qs("#review-page");
    if (!root) return;
    const week = Number(G.getParam("week", "13"));
    try {
      const review = await G.fetchJSON(`data/reviews/review-${week}.json`);
      G.setDocumentTitle(`第${week}周阶段测评`);
      root.innerHTML = `
        <section class="week-hero">
          <a href="week.html?week=${week}" class="btn">返回第 ${week} 周</a>
          <p class="eyebrow">阶段测评</p>
          <h1>${G.escapeHTML(review.title)}</h1>
          <p>${G.escapeHTML(review.description)}</p>
          <p>通过标准：${review.passScore}%</p>
        </section>
        <section class="content-card">
          <div id="review-quiz"></div>
        </section>
      `;
      G.Quiz.renderReview(G.qs("#review-quiz"), review, week);
    } catch (error) {
      G.showError(root, error);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    markActiveNav();
    renderBackupReminder();
    renderProgressPage();
    renderReviewPage();
  });

  window.addEventListener("guanzhi:progress-too-large", showCookieSizeNotice);
})();
