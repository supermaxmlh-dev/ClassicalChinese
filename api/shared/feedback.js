const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const MAX_CONTENT_LENGTH = 1200;
const MAX_CONTACT_LENGTH = 120;
const MAX_PAGE_LENGTH = 200;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const VALID_TYPES = new Set(["original", "pinyin", "annotation", "quiz", "ui", "privacy", "other"]);
const rateBuckets = new Map();

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

function normalizeFeedback(body, headers) {
  const data = parseBody(body);
  const ipHash = hashIp(getClientIp(headers));
  const content = trimText(data.content, MAX_CONTENT_LENGTH);
  const contact = trimText(data.contact, MAX_CONTACT_LENGTH);
  const page = trimText(data.page, MAX_PAGE_LENGTH);
  const articleId = trimText(data.articleId, 3);
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
  if (content.length < 5) {
    return { error: "反馈内容至少需要 5 个字。" };
  }
  if (String(data.content || "").length > MAX_CONTENT_LENGTH) {
    return { error: `反馈内容不能超过 ${MAX_CONTENT_LENGTH} 个字符。` };
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

  const now = new Date().toISOString();
  const rowKey = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  return {
    item: {
      id: rowKey,
      PartitionKey: "feedback",
      RowKey: rowKey,
      createdAt: now,
      type,
      page,
      articleId,
      content,
      contact,
      ipHash,
      userAgent: trimText(headers["user-agent"] || headers["User-Agent"], 240),
      status: "new"
    }
  };
}

function publicItem(item) {
  return {
    id: item.id || item.RowKey,
    createdAt: item.createdAt || item.Timestamp,
    type: item.type || "other",
    page: item.page || "",
    articleId: item.articleId || "",
    content: item.content || "",
    status: item.status || "new"
  };
}

function feedbackFilePath() {
  return process.env.FEEDBACK_FILE_PATH || path.join(os.tmpdir(), "guanzhi-feedback.jsonl");
}

async function saveToFile(item) {
  const filePath = feedbackFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(item)}\n`, "utf8");
  return { ok: true, storage: "file" };
}

async function readFromFile(limit) {
  const filePath = feedbackFilePath();
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean);
  return lines
    .slice(-limit)
    .map((line) => {
      try {
        return publicItem(JSON.parse(line));
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean)
    .reverse();
}

function withTableQuery(baseUrl, query = "") {
  const joiner = baseUrl.includes("?") ? "&" : "?";
  return query ? `${baseUrl}${joiner}${query}` : baseUrl;
}

async function saveToTable(item) {
  const tableUrl = process.env.FEEDBACK_TABLE_SAS_URL;
  if (!tableUrl) return { ok: false, skipped: true };
  const entity = {
    PartitionKey: item.PartitionKey,
    RowKey: item.RowKey,
    createdAt: item.createdAt,
    type: item.type,
    page: item.page,
    articleId: item.articleId,
    content: item.content,
    contact: item.contact,
    ipHash: item.ipHash,
    userAgent: item.userAgent,
    status: item.status
  };
  const response = await fetch(tableUrl, {
    method: "POST",
    headers: {
      Accept: "application/json;odata=nometadata",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(entity)
  });
  if (!response.ok) {
    throw new Error(`Azure Table write failed: ${response.status}`);
  }
  return { ok: true, storage: "azure-table" };
}

async function readFromTable(limit) {
  const tableUrl = process.env.FEEDBACK_TABLE_SAS_URL;
  if (!tableUrl) return null;
  const response = await fetch(withTableQuery(tableUrl, `$top=${limit}`), {
    headers: { Accept: "application/json;odata=nometadata" }
  });
  if (!response.ok) {
    throw new Error(`Azure Table read failed: ${response.status}`);
  }
  const payload = await response.json();
  return (payload.value || [])
    .map(publicItem)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}

async function sendWebhook(item) {
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
      subject: "观止学堂新反馈",
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
  for (const writer of [saveToTable, sendWebhook]) {
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

async function listFeedback(limit = 20) {
  try {
    const tableItems = await readFromTable(limit);
    if (tableItems) return tableItems;
  } catch (error) {
    if (process.env.NODE_ENV === "test") throw error;
  }
  return readFromFile(limit);
}

async function handleFeedbackRequest({ method, headers, body }) {
  const normalizedMethod = String(method || "GET").toUpperCase();
  if (normalizedMethod === "GET") {
    const items = await listFeedback(20);
    return json(200, { ok: true, items });
  }
  if (normalizedMethod !== "POST") {
    return json(405, { ok: false, message: "Method not allowed." });
  }

  const normalized = normalizeFeedback(body, headers || {});
  if (normalized.error) {
    return json(normalized.status || 400, { ok: false, message: normalized.error });
  }

  try {
    const storage = await saveFeedback(normalized.item);
    return json(201, { ok: true, id: normalized.item.id, storage, item: publicItem(normalized.item) });
  } catch (error) {
    return json(503, { ok: false, message: "反馈暂时无法保存，请稍后再试。" });
  }
}

module.exports = {
  handleFeedbackRequest,
  normalizeFeedback,
  publicItem,
  listFeedback
};
