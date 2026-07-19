(() => {
  const G = window.Guanzhi;
  const TYPE_LABELS = {
    original: "原文问题",
    pinyin: "拼音问题",
    annotation: "注释/翻译问题",
    quiz: "题目问题",
    ui: "页面问题",
    privacy: "隐私/数据问题",
    other: "其他"
  };

  function currentPageValue() {
    const articleId = G.getParam("article", "") || G.getParam("id", "");
    return articleId ? `article:${articleId}` : window.location.pathname.replace(/^\//, "");
  }

  function apiPath() {
    return "/api/feedback";
  }

  function renderForm(root, recentItems = [], serviceOnline = true) {
    root.innerHTML = `
      ${serviceOnline ? "" : `
        <section class="notice">
          反馈服务当前不可用。阅读、判分、进度和字典仍可正常使用。
        </section>
      `}
      <section class="content-card feedback-panel">
        <form id="feedback-form" class="feedback-form">
          <input id="feedback-website" name="website" autocomplete="off" tabindex="-1" aria-hidden="true">
          <div class="form-grid">
            <label>
              <span>问题类型</span>
              <select id="feedback-type" class="form-input" name="type" ${serviceOnline ? "" : "disabled"}>
                ${Object.entries(TYPE_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
              </select>
            </label>
            <label>
              <span>文章编号</span>
              <input id="feedback-article" class="form-input" name="articleId" inputmode="numeric" maxlength="3" placeholder="如 070，可不填" ${serviceOnline ? "" : "disabled"}>
            </label>
          </div>
          <label>
            <span>所在页面</span>
            <input id="feedback-page-field" class="form-input" name="page" maxlength="200" value="${G.escapeHTML(currentPageValue())}" ${serviceOnline ? "" : "disabled"}>
          </label>
          <label>
            <span>反馈内容</span>
            <textarea id="feedback-content" class="form-input" name="content" rows="7" maxlength="1200" placeholder="请写清楚看到的问题、原句或建议。" ${serviceOnline ? "" : "disabled"}></textarea>
          </label>
          <label>
            <span>联系方式</span>
            <input id="feedback-contact" class="form-input" name="contact" type="email" maxlength="120" placeholder="邮箱，可不填" ${serviceOnline ? "" : "disabled"}>
          </label>
          <label class="checkbox-row">
            <input id="feedback-consent" type="checkbox" ${serviceOnline ? "" : "disabled"}>
            <span>我知道联系方式可不填，且不会提交真实姓名、住址、身份证号等个人敏感信息。</span>
          </label>
          <div class="button-row">
            <button id="feedback-submit" class="btn primary" type="submit" ${serviceOnline ? "" : "disabled"}>提交反馈</button>
            <span id="feedback-message" class="form-message" role="status"></span>
          </div>
        </form>
      </section>
      <section class="content-card feedback-board">
        <h2>最近反馈</h2>
        <div id="feedback-list">
          ${renderList(recentItems)}
        </div>
      </section>
    `;
  }

  function renderList(items) {
    if (!items.length) return `<p class="muted">暂无公开反馈。</p>`;
    return `
      <div class="feedback-list">
        ${items.map((item) => `
          <article class="feedback-item">
            <div class="card-meta">
              <span>${G.escapeHTML(TYPE_LABELS[item.type] || TYPE_LABELS.other)}</span>
              ${item.articleId ? `<span>文章 ${G.escapeHTML(item.articleId)}</span>` : ""}
              <span>${G.escapeHTML((item.createdAt || "").slice(0, 10))}</span>
            </div>
            <p>${G.escapeHTML(item.content || "")}</p>
          </article>
        `).join("")}
      </div>
    `;
  }

  async function fetchRecent() {
    const response = await fetch(apiPath(), { cache: "no-store" });
    if (!response.ok) throw new Error("feedback offline");
    const payload = await response.json();
    return Array.isArray(payload.items) ? payload.items : [];
  }

  function bindForm(root) {
    const form = G.qs("#feedback-form", root);
    const message = G.qs("#feedback-message", root);
    const submit = G.qs("#feedback-submit", root);
    if (!form || !submit) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!navigator.onLine) {
        message.textContent = "当前离线，反馈功能联网后可用。";
        return;
      }
      submit.disabled = true;
      message.textContent = "正在提交...";
      const payload = {
        type: G.qs("#feedback-type", root).value,
        articleId: G.qs("#feedback-article", root).value.trim(),
        page: G.qs("#feedback-page-field", root).value.trim(),
        content: G.qs("#feedback-content", root).value.trim(),
        contact: G.qs("#feedback-contact", root).value.trim(),
        privacyConsent: G.qs("#feedback-consent", root).checked,
        website: G.qs("#feedback-website", root).value
      };

      try {
        const response = await fetch(apiPath(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) {
          throw new Error(result.message || "提交失败，请稍后再试。");
        }
        message.textContent = "已收到反馈。";
        form.reset();
        G.qs("#feedback-page-field", root).value = currentPageValue();
        const recent = await fetchRecent().catch(() => []);
        G.qs("#feedback-list", root).innerHTML = renderList(recent);
      } catch (error) {
        message.textContent = error.message || "反馈服务暂不可用。";
      } finally {
        submit.disabled = false;
      }
    });
  }

  async function renderFeedbackPage() {
    const root = G.qs("#feedback-page");
    if (!root) return;
    G.setDocumentTitle("反馈留言");
    if (!navigator.onLine) {
      renderForm(root, [], false);
      return;
    }
    try {
      const recent = await fetchRecent();
      renderForm(root, recent, true);
      bindForm(root);
    } catch (error) {
      renderForm(root, [], false);
    }
  }

  document.addEventListener("DOMContentLoaded", renderFeedbackPage);
})();
