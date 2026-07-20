const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const MAX_CONTENT_LENGTH = 1200;
const MAX_CONTACT_LENGTH = 120;
const MAX_PAGE_LENGTH = 200;
const MAX_SECRET_LENGTH = 120;
const MAX_PARENT_ID_LENGTH = 80;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const ADMIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const ADMIN_RATE_LIMIT_MAX = 10;
const VALID_TYPES = new Set(["original", "pinyin", "annotation", "quiz", "ui", "privacy", "other"]);
const VALID_STATUSES = new Set(["visible", "needs_review", "deleted"]);
const HASH_ITERATIONS = 120000;
const rateBuckets = new Map();
const adminRateBuckets = new Map();

function json(status, body) {
  return {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body
  };
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === "object") return body;
  try {
    return JSON.parse(body);
  } catch (error) {
    return {};
  }
}

function trimText(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function getClientIp(headers) {
  const forwarded = headers["x-forwarded-for"] || headers["X-Forwarded-For"] || "";
  return String(forwarded).split(",")[0].trim() || headers["x-client-ip"] || "unknown";
}

function hashIp(ip) {
  const salt = process.env.FEEDBACK_HASH_SALT || "guanzhi-feedback";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 16);
}

function tooManyRequests(ipHash) {
  const now = Date.now();
  const bucket = rateBuckets.get(ipHash) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  bucket.count += 1;
  rateBuckets.set(ipHash, bucket);
  return bucket.count > RATE_LIMIT_MAX;
}

function resetRateLimit() {
  rateBuckets.clear();
  adminRateBuckets.clear();
}

function publicBoardEnabled() {
  return process.env.FEEDBACK_PUBLIC_BOARD === "on";
}

function adminTokenFrom(headers = {}, body) {
  const parsed = body === undefined ? {} : parseBody(body);
  return headers["x-admin-token"] || headers["X-Admin-Token"] || parsed.adminToken || "";
}

function adminTooManyRequests(ipHash) {
  const now = Date.now();
  const bucket = adminRateBuckets.get(ipHash) || { count: 0, resetAt: now + ADMIN_RATE_LIMIT_WINDOW_MS };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + ADMIN_RATE_LIMIT_WINDOW_MS;
  }
  bucket.count += 1;
  adminRateBuckets.set(ipHash, bucket);
  return bucket.count > ADMIN_RATE_LIMIT_MAX;
}

function verifyAdminRequest(headers = {}, body) {
  const ipHash = hashIp(getClientIp(headers));
  if (adminTooManyRequests(ipHash)) {
    return { ok: false, response: json(429, { ok: false, message: "请求过于频繁，请稍后再试。" }) };
  }
  if (!verifyAdminToken(adminTokenFrom(headers, body))) {
    return { ok: false, response: json(401, { ok: false, message: "无权访问。" }) };
  }
  return { ok: true };
}

function verifyOptionalAdminRequest(headers = {}, body) {
  if (!adminTokenFrom(headers, body)) return { ok: false, absent: true };
  return verifyAdminRequest(headers, body);
}

function isAdminQuery(query = {}, url = "") {
  if (query.admin === "1" || query.admin === 1 || query.admin === true) return true;
  try {
    const parsed = new URL(url || "/", "http://localhost");
    return parsed.searchParams.get("admin") === "1";
  } catch (error) {
    return false;
  }
}

function hasSensitivePersonalData(text) {
  const value = String(text || "");
  return [
    /\d{17}[\dXx]/,
    /身份证/,
    /家庭住址/,
    /银行卡/,
    /密码/
  ].some((pattern) => pattern.test(value));
}

function loadModerationKeywords() {
  const filePath = path.resolve(__dirname, "../../data/moderation-keywords.json");
  try {
    const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(payload) ? payload : payload.keywords || [];
  } catch (error) {
    return [];
  }
}

function moderationFlagsFor(text) {
  const value = String(text || "").toLowerCase();
  return loadModerationKeywords()
    .map((keyword) => String(keyword || "").trim())
    .filter(Boolean)
    .filter((keyword) => value.includes(keyword.toLowerCase()))
    .slice(0, 8);
}

function makeSecretHash(secret) {
  const value = trimText(secret, MAX_SECRET_LENGTH);
  if (!value) return {};
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(value, salt, HASH_ITERATIONS, 32, "sha256").toString("hex");
  return {
    deleteSecretSalt: salt,
    deleteSecretHash: hash
  };
}

function verifySecret(secret, item) {
  if (!item?.deleteSecretHash || !item?.deleteSecretSalt) return false;
  const value = trimText(secret, MAX_SECRET_LENGTH);
  if (!value) return false;
  const hash = crypto.pbkdf2Sync(value, item.deleteSecretSalt, HASH_ITERATIONS, 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(item.deleteSecretHash, "hex"));
}

function verifyAdminToken(token) {
  const expected = process.env.FEEDBACK_ADMIN_TOKEN;
  if (!expected || !token) return false;
  const actual = Buffer.from(String(token));
  const target = Buffer.from(String(expected));
  return actual.length === target.length && crypto.timingSafeEqual(actual, target);
}

function isValidFeedbackId(value) {
  return /^[0-9]{10,}-[a-f0-9]{8}$/i.test(String(value || ""));
}

function normalizeFeedback(body, headers) {
  const data = parseBody(body);
  const ipHash = hashIp(getClientIp(headers));
  const content = trimText(data.content, MAX_CONTENT_LENGTH);
  const contact = trimText(data.contact, MAX_CONTACT_LENGTH);
  const page = trimText(data.page, MAX_PAGE_LENGTH);
  const articleId = trimText(data.articleId, 3);
  const parentId = trimText(data.parentId, MAX_PARENT_ID_LENGTH);
  const deleteSecret = trimText(data.deleteSecret, MAX_SECRET_LENGTH);
  const type = trimText(data.type || "other", 24);

  if (data.website) {
    return { error: "提交失败，请稍后再试。" };
  }
  if (tooManyRequests(ipHash)) {
    return { error: "提交过于频繁，请十分钟后再试。", status: 429 };
  }
  if (!VALID_TYPES.has(type)) {
    return { error: "请选择有效的问题类型。" };
  }
  if (articleId && !/^\d{3}$/.test(articleId)) {
    return { error: "文章编号格式不正确。" };
  }
  if (parentId && !isValidFeedbackId(parentId)) {
    return { error: "回复对象格式不正确。" };
  }
  if (content.length < 5) {
    return { error: "反馈内容至少需要 5 个字。" };
  }
  if (String(data.content || "").length > MAX_CONTENT_LENGTH) {
    return { error: `反馈内容不能超过 ${MAX_CONTENT_LENGTH} 个字符。` };
  }
  if (deleteSecret && deleteSecret.length < 4) {
    return { error: "删除密码至少需要 4 个字符；也可以不填。" };
  }
  if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
    return { error: "联系方式只支持可选邮箱；也可以不填。" };
  }
  if (hasSensitivePersonalData(`${content} ${contact}`)) {
    return { error: "请不要提交身份证、住址、密码等个人敏感信息。" };
  }
  if (data.privacyConsent !== true) {
    return { error: "请先确认隐私提示。" };
  }

  const moderationFlags = moderationFlagsFor(content);
  const now = new Date().toISOString();
  const rowKey = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  return {
    item: {
      id: rowKey,
      PartitionKey: "feedback",
      RowKey: rowKey,
      createdAt: now,
      updatedAt: now,
      type,
      page,
      articleId,
      parentId,
      content,
      contact,
      ipHash,
      userAgent: trimText(headers["user-agent"] || headers["User-Agent"], 240),
      moderationFlags: JSON.stringify(moderationFlags),
      status: "needs_review",
      ...makeSecretHash(deleteSecret)
    }
  };
}

function publicItem(item) {
  return {
    id: item.id || item.RowKey,
    createdAt: item.createdAt || item.Timestamp,
    updatedAt: item.updatedAt || "",
    type: item.type || "other",
    page: item.page || "",
    articleId: item.articleId || "",
    parentId: item.parentId || "",
    content: item.status === "deleted" ? "该留言已删除。" : item.content || "",
    status: item.status || "visible"
  };
}

function adminItem(item) {
  let moderationFlags = [];
  try {
    moderationFlags = JSON.parse(item.moderationFlags || "[]");
  } catch (error) {
    moderationFlags = [];
  }
  return {
    ...publicItem(item),
    status: item.status || "visible",
    moderationFlags: Array.isArray(moderationFlags) ? moderationFlags : [],
    hasContact: Boolean(item.contact)
  };
}

function feedbackFilePath() {
  return process.env.FEEDBACK_FILE_PATH || path.join(os.tmpdir(), "guanzhi-feedback.jsonl");
}

function readRawFileItems() {
  const filePath = feedbackFilePath();
  if (!fs.existsSync(filePath)) return [];
  const map = new Map();
  fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean).forEach((line) => {
    try {
      const entry = JSON.parse(line);
      const id = entry.id || entry.RowKey;
      if (!id) return;
      if (entry.event === "update") {
        map.set(id, { ...(map.get(id) || { id, RowKey: id, PartitionKey: "feedback" }), ...entry.patch });
        return;
      }
      map.set(id, entry);
    } catch (error) {
      // Ignore malformed local development rows.
    }
  });
  return [...map.values()];
}

async function saveToFile(item) {
  const filePath = feedbackFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(item)}\n`, "utf8");
  return { ok: true, storage: "file" };
}

async function patchFileItem(id, patch) {
  const filePath = feedbackFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify({ event: "update", id, patch })}\n`, "utf8");
  return { ok: true, storage: "file" };
}

async function readFromFile(limit, includeHidden = false) {
  return readRawFileItems()
    .filter((item) => includeHidden || item.status === "visible")
    .map(includeHidden ? adminItem : publicItem)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}

async function getFromFile(id) {
  return readRawFileItems().find((item) => (item.id || item.RowKey) === id) || null;
}

function splitTableUrl() {
  const tableUrl = process.env.FEEDBACK_TABLE_SAS_URL;
  if (!tableUrl) return null;
  const [base, query = ""] = tableUrl.split("?");
  return { base, query };
}

function withTableQuery(baseUrl, query = "") {
  const joiner = baseUrl.includes("?") ? "&" : "?";
  return query ? `${baseUrl}${joiner}${query}` : baseUrl;
}

function tableEntityUrl(id) {
  const table = splitTableUrl();
  if (!table) return null;
  const escapedId = String(id).replace(/'/g, "''");
  const entityPath = `${table.base}(PartitionKey='feedback',RowKey='${escapedId}')`;
  return table.query ? `${entityPath}?${table.query}` : entityPath;
}

function toTableEntity(item) {
  return {
    PartitionKey: item.PartitionKey,
    RowKey: item.RowKey,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    type: item.type,
    page: item.page,
    articleId: item.articleId,
    parentId: item.parentId,
    content: item.content,
    contact: item.contact,
    ipHash: item.ipHash,
    userAgent: item.userAgent,
    moderationFlags: item.moderationFlags,
    status: item.status,
    deleteSecretSalt: item.deleteSecretSalt || "",
    deleteSecretHash: item.deleteSecretHash || ""
  };
}

async function saveToTable(item) {
  const tableUrl = process.env.FEEDBACK_TABLE_SAS_URL;
  if (!tableUrl) return { ok: false, skipped: true };
  const response = await fetch(tableUrl, {
    method: "POST",
    headers: {
      Accept: "application/json;odata=nometadata",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(toTableEntity(item))
  });
  if (!response.ok) {
    throw new Error(`Azure Table write failed: ${response.status}`);
  }
  return { ok: true, storage: "azure-table" };
}

async function readFromTable(limit, includeHidden = false) {
  const tableUrl = process.env.FEEDBACK_TABLE_SAS_URL;
  if (!tableUrl) return null;
  const statusFilter = includeHidden ? "" : "status eq 'visible'";
  const query = [`$top=${limit * 3}`, statusFilter ? `$filter=${encodeURIComponent(statusFilter)}` : ""].filter(Boolean).join("&");
  const response = await fetch(withTableQuery(tableUrl, query), {
    headers: { Accept: "application/json;odata=nometadata" }
  });
  if (!response.ok) {
    throw new Error(`Azure Table read failed: ${response.status}`);
  }
  const payload = await response.json();
  return (payload.value || [])
    .map(includeHidden ? adminItem : publicItem)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}

async function getFromTable(id) {
  const url = tableEntityUrl(id);
  if (!url) return null;
  const response = await fetch(url, {
    headers: { Accept: "application/json;odata=nometadata" }
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Azure Table read entity failed: ${response.status}`);
  }
  return response.json();
}

async function patchTableItem(id, patch) {
  const url = tableEntityUrl(id);
  if (!url) return { ok: false, skipped: true };
  const response = await fetch(url, {
    method: "MERGE",
    headers: {
      Accept: "application/json;odata=nometadata",
      "Content-Type": "application/json",
      "If-Match": "*"
    },
    body: JSON.stringify(patch)
  });
  if (!response.ok) {
    throw new Error(`Azure Table update failed: ${response.status}`);
  }
  return { ok: true, storage: "azure-table" };
}

async function sendWebhook(item, action = "created") {
  const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL;
  if (!webhookUrl) return { ok: false, skipped: true };
  const headers = {
    "Content-Type": "application/json"
  };
  if (process.env.FEEDBACK_WEBHOOK_TOKEN) {
    headers.Authorization = `Bearer ${process.env.FEEDBACK_WEBHOOK_TOKEN}`;
  }
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      subject: action === "created" ? "观止学堂新反馈" : "观止学堂反馈更新",
      action,
      feedback: publicItem(item),
      contact: item.contact || ""
    })
  });
  if (!response.ok) {
    throw new Error(`Feedback webhook failed: ${response.status}`);
  }
  return { ok: true, storage: "webhook" };
}

async function saveFeedback(item) {
  const results = [];
  const errors = [];
  const hasConfiguredStore = Boolean(process.env.FEEDBACK_TABLE_SAS_URL || process.env.FEEDBACK_WEBHOOK_URL);
  for (const writer of [saveToTable, (entry) => sendWebhook(entry, "created")]) {
    try {
      const result = await writer(item);
      if (result.ok) results.push(result.storage);
    } catch (error) {
      errors.push(error.message);
    }
  }

  if ((!results.length && !hasConfiguredStore) || process.env.FEEDBACK_FILE_STORE === "always") {
    try {
      const result = await saveToFile(item);
      if (result.ok) results.push(result.storage);
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (!results.length) {
    throw new Error(errors.join("; ") || "No feedback storage configured.");
  }
  return results;
}

async function getFeedbackById(id) {
  try {
    const tableItem = await getFromTable(id);
    if (tableItem) return tableItem;
  } catch (error) {
    if (process.env.NODE_ENV === "test") throw error;
  }
  return getFromFile(id);
}

async function patchFeedback(id, patch) {
  const results = [];
  const errors = [];
  const hasConfiguredStore = Boolean(process.env.FEEDBACK_TABLE_SAS_URL);
  const normalizedPatch = {
    ...patch,
    updatedAt: new Date().toISOString()
  };
  try {
    const result = await patchTableItem(id, normalizedPatch);
    if (result.ok) results.push(result.storage);
  } catch (error) {
    errors.push(error.message);
  }
  if ((!results.length && !hasConfiguredStore) || process.env.FEEDBACK_FILE_STORE === "always") {
    try {
      const result = await patchFileItem(id, normalizedPatch);
      if (result.ok) results.push(result.storage);
    } catch (error) {
      errors.push(error.message);
    }
  }
  if (!results.length) {
    throw new Error(errors.join("; ") || "No feedback storage configured.");
  }
  return { storage: results, patch: normalizedPatch };
}

async function listFeedback(limit = 20, includeHidden = false) {
  if (!includeHidden && !publicBoardEnabled()) return [];
  try {
    const tableItems = await readFromTable(limit, includeHidden);
    if (tableItems) return tableItems;
  } catch (error) {
    if (process.env.NODE_ENV === "test") throw error;
  }
  return readFromFile(limit, includeHidden);
}

async function handleGet(headers = {}, query = {}, url = "") {
  if (isAdminQuery(query, url)) {
    const admin = verifyAdminRequest(headers);
    if (!admin.ok) return admin.response;
    const items = await listFeedback(100, true);
    return json(200, { ok: true, mode: "admin", publicBoard: publicBoardEnabled(), items });
  }
  const items = await listFeedback(50, false);
  return json(200, { ok: true, items });
}

async function handlePost(headers, body) {
  const normalized = normalizeFeedback(body, headers || {});
  if (normalized.error) {
    return json(normalized.status || 400, { ok: false, message: normalized.error });
  }
  try {
    const storage = await saveFeedback(normalized.item);
    return json(201, {
      ok: true,
      id: normalized.item.id,
      status: normalized.item.status,
      message: "已收到，将在审核后显示。",
      storage,
      item: publicItem(normalized.item)
    });
  } catch (error) {
    return json(503, { ok: false, message: "反馈暂时无法保存，请稍后再试。" });
  }
}

async function handleDelete(headers, body) {
  const data = parseBody(body);
  const id = trimText(data.id, MAX_PARENT_ID_LENGTH);
  if (!isValidFeedbackId(id)) {
    return json(400, { ok: false, message: "评论编号格式不正确。" });
  }
  const item = await getFeedbackById(id);
  if (!item) {
    return json(404, { ok: false, message: "没有找到这条评论。" });
  }
  if (item.status === "deleted") {
    return json(200, { ok: true, message: "这条评论已经删除。" });
  }
  const admin = verifyOptionalAdminRequest(headers, body);
  if (!admin.absent && !admin.ok) return admin.response;
  const authorized = admin.ok || verifySecret(data.deleteSecret, item);
  if (!authorized) {
    return json(403, { ok: false, message: "删除密码或站长口令不正确。" });
  }
  try {
    const { storage, patch } = await patchFeedback(id, {
      status: "deleted",
      deletedAt: new Date().toISOString()
    });
    await sendWebhook({ ...item, ...patch }, "deleted").catch(() => null);
    return json(200, { ok: true, message: "已删除。", storage });
  } catch (error) {
    return json(503, { ok: false, message: "评论暂时无法删除，请稍后再试。" });
  }
}

async function handlePatch(headers, body) {
  const data = parseBody(body);
  const admin = verifyAdminRequest(headers, body);
  if (!admin.ok) return admin.response;
  const id = trimText(data.id, MAX_PARENT_ID_LENGTH);
  const status = trimText(data.status, 24);
  if (!isValidFeedbackId(id)) {
    return json(400, { ok: false, message: "评论编号格式不正确。" });
  }
  if (!VALID_STATUSES.has(status)) {
    return json(400, { ok: false, message: "状态不正确。" });
  }
  const item = await getFeedbackById(id);
  if (!item) {
    return json(404, { ok: false, message: "没有找到这条评论。" });
  }
  try {
    const { storage } = await patchFeedback(id, { status });
    return json(200, { ok: true, message: "已更新。", storage });
  } catch (error) {
    return json(503, { ok: false, message: "评论暂时无法更新，请稍后再试。" });
  }
}

async function handleFeedbackRequest({ method, headers, query, url, body }) {
  const normalizedMethod = String(method || "GET").toUpperCase();
  if (normalizedMethod === "GET") return handleGet(headers || {}, query || {}, url || "");
  if (normalizedMethod === "POST") return handlePost(headers, body);
  if (normalizedMethod === "DELETE") return handleDelete(headers || {}, body);
  if (normalizedMethod === "PATCH") return handlePatch(headers || {}, body);
  return json(405, { ok: false, message: "Method not allowed." });
}

module.exports = {
  handleFeedbackRequest,
  normalizeFeedback,
  publicItem,
  listFeedback,
  getFeedbackById,
  resetRateLimit,
  verifySecret,
  moderationFlagsFor
};
