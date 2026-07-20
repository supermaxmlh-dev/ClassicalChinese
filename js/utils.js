(() => {
  const Guanzhi = window.Guanzhi || {};
  const isPage = window.location.pathname.includes("/pages/");
  const basePath = isPage ? "../" : "";
  const dataVersion = "20260720-codes";

  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const getParam = (name, fallback = "") => new URLSearchParams(window.location.search).get(name) || fallback;
  const asset = (path) => `${basePath}${path.replace(/^\/+/, "")}`;

  function escapeHTML(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function stripHTML(value = "") {
    const div = document.createElement("div");
    div.innerHTML = value;
    return div.textContent || div.innerText || "";
  }

  async function fetchJSON(path) {
    const url = asset(path);
    const separator = url.includes("?") ? "&" : "?";
    const response = await fetch(`${url}${separator}v=${dataVersion}`, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`无法加载 ${path}: ${response.status}`);
    }
    return response.json();
  }

  function renderStars(level = 1) {
    const safeLevel = Math.max(1, Math.min(5, Number(level) || 1));
    return "★".repeat(safeLevel) + "☆".repeat(5 - safeLevel);
  }

  function percent(part, total) {
    if (!total) return 0;
    return Math.round((part / total) * 100);
  }

  function setDocumentTitle(title) {
    if (title) document.title = `${title} - 观止学堂`;
  }

  function showError(container, error) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>加载失败</strong>
        <p>${escapeHTML(error.message || String(error))}</p>
      </div>
    `;
  }

  function uniqueBy(items, keyFn) {
    const seen = new Set();
    return items.filter((item) => {
      const key = keyFn(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  Guanzhi.qs = qs;
  Guanzhi.qsa = qsa;
  Guanzhi.getParam = getParam;
  Guanzhi.asset = asset;
  Guanzhi.escapeHTML = escapeHTML;
  Guanzhi.stripHTML = stripHTML;
  Guanzhi.fetchJSON = fetchJSON;
  Guanzhi.renderStars = renderStars;
  Guanzhi.percent = percent;
  Guanzhi.setDocumentTitle = setDocumentTitle;
  Guanzhi.showError = showError;
  Guanzhi.uniqueBy = uniqueBy;
  Guanzhi.today = today;

  window.Guanzhi = Guanzhi;
})();
