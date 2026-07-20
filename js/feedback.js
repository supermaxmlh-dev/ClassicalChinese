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

  function buildCodeMaps(indexData = {}) {
    const byId = new Map();
    const byCode = new Map();
    (indexData.articles || []).forEach((article) => {
      if (!article.id) return;
      const displayCode = article.displayCode || article.id;
      byId.set(article.id, displayCode);
      byCode.set(String(article.id).toLowerCase(), article.id);
      byCode.set(String(displayCode).toLowerCase(), article.id);
      if (article.catalogCode) byCode.set(String(article.catalogCode).toLowerCase(), article.id);
    });
    return { byId, byCode };
  }

  function articleDisplayCode(articleId, codeMaps) {
    return codeMaps?.byId?.get(articleId) || articleId;
  }

  function normalizeArticleCode(value, codeMaps) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const compact = raw.replace(/\s+/g, "").toLowerCase();
    return codeMaps?.byCode?.get(compact) || raw.padStart(3, "0");
  }

  function currentPageValue(codeMaps) {
    const articleId = G.getParam("article", "") || G.getParam("id", "");
    return articleId ? `article:${articleDisplayCode(articleId, codeMaps)}` : window.location.pathname.replace(/^\//, "");
  }

  function apiPath() {
    return "/api/feedback";
  }

  function groupFeedback(items) {
    const byParent = new Map();
    items.forEach((item) => {
      const parentId = item.parentId || "";
      if (!byParent.has(parentId)) byParent.set(parentId, []);
      byParent.get(parentId).push(item);
    });
    return byParent;
  }

  function renderItem(item, byParent, codeMaps, depth = 0) {
    const replies = byParent.get(item.id) || [];
    return `
      <article class="feedback-item ${depth ? "reply" : ""}" data-feedback-id="${G.escapeHTML(item.id)}">
        <div class="card-meta">
          <span>${G.escapeHTML(TYPE_LABELS[item.type] || TYPE_LABELS.other)}</span>
          ${item.articleId ? `<span>文章 ${G.escapeHTML(articleDisplayCode(item.articleId, codeMaps))}</span>` : ""}
          <span>${G.escapeHTML((item.createdAt || "").slice(0, 10))}</span>
          <span>编号 ${G.escapeHTML(item.id)}</span>
        </div>
        <p>${G.escapeHTML(item.content || "")}</p>
        <div class="feedback-actions">
          <button class="btn reply-feedback" type="button" data-feedback-id="${G.escapeHTML(item.id)}">回复</button>
          <button class="btn danger delete-feedback" type="button" data-feedback-id="${G.escapeHTML(item.id)}">删除</button>
        </div>
        ${replies.length ? `
          <div class="feedback-replies">
            ${replies.map((reply) => renderItem(reply, byParent, codeMaps, depth + 1)).join("")}
          </div>
        ` : ""}
      </article>
    `;
  }

  function renderList(items, codeMaps) {
    const visible = items.filter((item) => item.status === "visible");
    if (!visible.length) return `<p class="muted">暂无公开反馈。</p>`;
    const byParent = groupFeedback(visible);
    const roots = byParent.get("") || [];
    return `
      <div class="feedback-list">
        ${roots.map((item) => renderItem(item, byParent, codeMaps)).join("")}
      </div>
    `;
  }

  function renderForm(root, recentItems = [], serviceOnline = true, codeMaps) {
    root.innerHTML = `
      ${serviceOnline ? "" : `
        <section class="notice">
          反馈服务当前不可用。阅读、判分、进度和字典仍可正常使用。
        </section>
      `}
      <section class="content-card feedback-panel">
        <form id="feedback-form" class="feedback-form">
          <input id="feedback-website" name="website" autocomplete="off" tabindex="-1" aria-hidden="true">
          <input id="feedback-parent-id" name="parentId" type="hidden">
          <div id="feedback-reply-banner" class="notice compact" hidden></div>
          <div class="form-grid">
            <label>
              <span>问题类型</span>
              <select id="feedback-type" class="form-input" name="type" ${serviceOnline ? "" : "disabled"}>
                ${Object.entries(TYPE_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
              </select>
            </label>
            <label>
              <span>文章编码</span>
              <input id="feedback-article" class="form-input" name="articleId" maxlength="12" placeholder="如 观止-070 或 拓展-001，可不填" ${serviceOnline ? "" : "disabled"}>
            </label>
          </div>
          <label>
            <span>所在页面</span>
            <input id="feedback-page-field" class="form-input" name="page" maxlength="200" value="${G.escapeHTML(currentPageValue(codeMaps))}" ${serviceOnline ? "" : "disabled"}>
          </label>
          <label>
            <span>反馈内容</span>
            <textarea id="feedback-content" class="form-input" name="content" rows="7" maxlength="1200" placeholder="请写清楚看到的问题、原句或建议。" ${serviceOnline ? "" : "disabled"}></textarea>
          </label>
          <div class="form-grid">
            <label>
              <span>联系方式</span>
              <input id="feedback-contact" class="form-input" name="contact" type="email" maxlength="120" placeholder="邮箱，可不填" ${serviceOnline ? "" : "disabled"}>
            </label>
            <label>
              <span>删除密码</span>
              <input id="feedback-delete-secret" class="form-input" name="deleteSecret" type="password" maxlength="120" placeholder="可不填；不填后只能由站长删除" ${serviceOnline ? "" : "disabled"}>
            </label>
          </div>
          <label class="checkbox-row">
            <input id="feedback-consent" type="checkbox" ${serviceOnline ? "" : "disabled"}>
            <span>我知道联系方式和删除密码可不填，且不会提交真实姓名、住址、身份证号等个人敏感信息。</span>
          </label>
          <div class="button-row">
            <button id="feedback-submit" class="btn primary" type="submit" ${serviceOnline ? "" : "disabled"}>提交反馈</button>
            <button id="feedback-cancel-reply" class="btn" type="button" hidden>取消回复</button>
            <span id="feedback-message" class="form-message" role="status"></span>
          </div>
        </form>
      </section>
      <section class="content-card feedback-board">
        <h2>最近反馈</h2>
        <div id="feedback-list">
          ${renderList(recentItems, codeMaps)}
        </div>
      </section>
    `;
  }

  async function fetchRecent() {
    const response = await fetch(apiPath(), { cache: "no-store" });
    if (!response.ok) throw new Error("feedback offline");
    const payload = await response.json();
    return Array.isArray(payload.items) ? payload.items : [];
  }

  async function refreshList(root, codeMaps) {
    const recent = await fetchRecent().catch(() => []);
    G.qs("#feedback-list", root).innerHTML = renderList(recent, codeMaps);
  }

  function setReplyTarget(root, id) {
    G.qs("#feedback-parent-id", root).value = id || "";
    const banner = G.qs("#feedback-reply-banner", root);
    const cancel = G.qs("#feedback-cancel-reply", root);
    if (!id) {
      banner.hidden = true;
      banner.textContent = "";
      cancel.hidden = true;
      return;
    }
    banner.hidden = false;
    banner.textContent = `正在回复编号 ${id}`;
    cancel.hidden = false;
    G.qs("#feedback-content", root).focus();
  }

  async function deleteFeedback(root, id, codeMaps) {
    const secret = window.prompt("请输入删除密码；站长可输入站长口令。");
    if (!secret) return;
    const message = G.qs("#feedback-message", root);
    message.textContent = "正在删除...";
    try {
      const response = await fetch(apiPath(), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, deleteSecret: secret, adminToken: secret })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result.message || "删除失败，请稍后再试。");
      }
      message.textContent = "已删除。";
      await refreshList(root, codeMaps);
    } catch (error) {
      message.textContent = error.message || "删除失败。";
    }
  }

  function bindList(root, codeMaps) {
    const list = G.qs("#feedback-list", root);
    list.addEventListener("click", (event) => {
      const replyButton = event.target.closest(".reply-feedback");
      if (replyButton) {
        setReplyTarget(root, replyButton.dataset.feedbackId);
        return;
      }
      const deleteButton = event.target.closest(".delete-feedback");
      if (deleteButton) {
        deleteFeedback(root, deleteButton.dataset.feedbackId, codeMaps);
      }
    });
  }

  function bindForm(root, codeMaps) {
    const form = G.qs("#feedback-form", root);
    const message = G.qs("#feedback-message", root);
    const submit = G.qs("#feedback-submit", root);
    if (!form || !submit) return;

    G.qs("#feedback-cancel-reply", root).addEventListener("click", () => setReplyTarget(root, ""));

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
        parentId: G.qs("#feedback-parent-id", root).value,
        articleId: normalizeArticleCode(G.qs("#feedback-article", root).value, codeMaps),
        page: G.qs("#feedback-page-field", root).value.trim(),
        content: G.qs("#feedback-content", root).value.trim(),
        contact: G.qs("#feedback-contact", root).value.trim(),
        deleteSecret: G.qs("#feedback-delete-secret", root).value.trim(),
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
        message.textContent = `${result.message || "已收到反馈。"} 评论编号：${result.id}`;
        form.reset();
        setReplyTarget(root, "");
        G.qs("#feedback-page-field", root).value = currentPageValue(codeMaps);
        await refreshList(root, codeMaps);
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
    const codeMaps = buildCodeMaps(await G.fetchJSON("data/index.json").catch(() => ({})));
    if (!navigator.onLine) {
      renderForm(root, [], false, codeMaps);
      return;
    }
    try {
      const recent = await fetchRecent();
      renderForm(root, recent, true, codeMaps);
      bindForm(root, codeMaps);
      bindList(root, codeMaps);
    } catch (error) {
      renderForm(root, [], false, codeMaps);
    }
  }

  document.addEventListener("DOMContentLoaded", renderFeedbackPage);
})();
