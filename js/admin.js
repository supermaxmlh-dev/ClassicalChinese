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
  const STATUS_LABELS = {
    visible: "已公开",
    needs_review: "待审核",
    deleted: "已删除"
  };
  let adminToken = "";

  function apiPath() {
    return "/api/feedback";
  }

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      "X-Admin-Token": adminToken
    };
  }

  function renderLogin(root, message = "") {
    root.innerHTML = `
      <section class="content-card admin-login">
        <form id="admin-login-form" class="feedback-form">
          <label>
            <span>站长口令</span>
            <input id="admin-token" class="form-input" type="password" autocomplete="current-password" required>
          </label>
          <div class="button-row">
            <button class="btn primary" type="submit">进入后台</button>
            <span id="admin-message" class="form-message">${G.escapeHTML(message)}</span>
          </div>
        </form>
      </section>
    `;
    G.qs("#admin-login-form", root).addEventListener("submit", async (event) => {
      event.preventDefault();
      adminToken = G.qs("#admin-token", root).value;
      await loadQueue(root);
    });
  }

  function renderItem(item) {
    const flags = Array.isArray(item.moderationFlags) ? item.moderationFlags : [];
    return `
      <article class="feedback-item admin-feedback-item" data-feedback-id="${G.escapeHTML(item.id)}">
        <div class="card-meta">
          <span>${G.escapeHTML(TYPE_LABELS[item.type] || TYPE_LABELS.other)}</span>
          <span>${G.escapeHTML(STATUS_LABELS[item.status] || item.status)}</span>
          ${item.articleId ? `<span>文章 ${G.escapeHTML(item.articleId)}</span>` : ""}
          <span>${G.escapeHTML((item.createdAt || "").slice(0, 19).replace("T", " "))}</span>
          <span>编号 ${G.escapeHTML(item.id)}</span>
          ${item.hasContact ? "<span>有联系方式</span>" : ""}
        </div>
        ${item.page ? `<p class="muted">页面：${G.escapeHTML(item.page)}</p>` : ""}
        <p>${G.escapeHTML(item.content || "")}</p>
        ${flags.length ? `<div class="article-tags">${flags.map((flag) => `<span class="tag">命中：${G.escapeHTML(flag)}</span>`).join("")}</div>` : ""}
        <div class="feedback-actions">
          <button class="btn primary admin-action" type="button" data-status="visible">通过</button>
          <button class="btn admin-action" type="button" data-status="needs_review">退回</button>
          <button class="btn danger admin-delete" type="button">删除</button>
        </div>
      </article>
    `;
  }

  function renderQueue(root, payload) {
    const items = Array.isArray(payload.items) ? payload.items : [];
    const pending = items.filter((item) => item.status !== "deleted");
    root.innerHTML = `
      <section class="notice">
        公开板：${payload.publicBoard ? "开启" : "关闭"}。新留言默认待审核；只有通过后才会公开展示。
      </section>
      <section class="content-card admin-toolbar">
        <div>
          <strong>待处理留言</strong>
          <p class="muted">${pending.length ? `共 ${pending.length} 条` : "当前没有待处理留言。"}</p>
        </div>
        <div class="button-row">
          <button id="admin-refresh" class="btn" type="button">刷新</button>
          <button id="admin-logout" class="btn" type="button">退出</button>
          <span id="admin-message" class="form-message"></span>
        </div>
      </section>
      <section id="admin-list" class="feedback-list admin-list">
        ${pending.length ? pending.map(renderItem).join("") : `<div class="empty-state">没有待审核或已公开留言。</div>`}
      </section>
    `;
    bindAdminActions(root);
  }

  async function loadQueue(root) {
    const message = G.qs("#admin-message", root);
    if (message) message.textContent = "正在加载...";
    try {
      const response = await fetch(`${apiPath()}?admin=1`, {
        headers: { "X-Admin-Token": adminToken },
        cache: "no-store"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        adminToken = "";
        renderLogin(root, payload.message || "无权访问。");
        return;
      }
      renderQueue(root, payload);
    } catch (error) {
      renderLogin(root, "管理接口当前不可用。");
    }
  }

  async function patchStatus(root, id, status) {
    const message = G.qs("#admin-message", root);
    if (message) message.textContent = "正在更新...";
    const response = await fetch(apiPath(), {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ id, status })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.message || "更新失败。");
    if (message) message.textContent = payload.message || "已更新。";
    await loadQueue(root);
  }

  async function deleteItem(root, id) {
    const message = G.qs("#admin-message", root);
    if (message) message.textContent = "正在删除...";
    const response = await fetch(apiPath(), {
      method: "DELETE",
      headers: authHeaders(),
      body: JSON.stringify({ id })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.message || "删除失败。");
    if (message) message.textContent = payload.message || "已删除。";
    await loadQueue(root);
  }

  function bindAdminActions(root) {
    G.qs("#admin-refresh", root).addEventListener("click", () => loadQueue(root));
    G.qs("#admin-logout", root).addEventListener("click", () => {
      adminToken = "";
      renderLogin(root);
    });
    G.qs("#admin-list", root).addEventListener("click", async (event) => {
      const item = event.target.closest(".feedback-item");
      if (!item) return;
      const id = item.dataset.feedbackId;
      try {
        const statusButton = event.target.closest(".admin-action");
        if (statusButton) {
          await patchStatus(root, id, statusButton.dataset.status);
          return;
        }
        if (event.target.closest(".admin-delete")) {
          await deleteItem(root, id);
        }
      } catch (error) {
        const message = G.qs("#admin-message", root);
        if (message) message.textContent = error.message || "操作失败。";
      }
    });
  }

  function renderAdminPage() {
    const root = G.qs("#admin-page");
    if (!root) return;
    G.setDocumentTitle("留言管理");
    renderLogin(root);
  }

  document.addEventListener("DOMContentLoaded", renderAdminPage);
})();
