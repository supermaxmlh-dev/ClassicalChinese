const fs = require("fs");
const os = require("os");
const path = require("path");
const { handleFeedbackRequest, resetRateLimit } = require("../api/shared/feedback");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const WEBHOOK_ENV_NAMES = [
  "FEEDBACK_WEBHOOK_FORMAT",
  "FEEDBACK_WEBHOOK_URL",
  "FEEDBACK_WEBHOOK_TOKEN",
  "FEEDBACK_EMAIL_TO",
  "FEEDBACK_EMAIL_FROM",
  "FEEDBACK_EMAIL_SUBJECT_PREFIX"
];

function clearWebhookEnv() {
  WEBHOOK_ENV_NAMES.forEach((name) => delete process.env[name]);
}

async function submit(ip, overrides = {}) {
  return handleFeedbackRequest({
    method: "POST",
    headers: {
      "x-forwarded-for": ip,
      origin: "https://example.test",
      "user-agent": "feedback-webhook-test"
    },
    body: {
      type: "pinyin",
      articleId: "070",
      page: "pages/article.html?id=070",
      content: "这里是一条邮件通知测试反馈。",
      contact: "student-private@example.com",
      privacyConsent: true,
      website: "",
      ...overrides
    }
  });
}

async function main() {
  const filePath = path.join(os.tmpdir(), `guanzhi-webhook-test-${Date.now()}.jsonl`);
  const originalFetch = global.fetch;
  const originalWarn = console.warn;
  const calls = [];
  const warnings = [];
  process.env.FEEDBACK_FILE_PATH = filePath;
  process.env.FEEDBACK_FILE_STORE = "always";
  process.env.NODE_ENV = "test";
  resetRateLimit();
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return { ok: true, status: 200 };
  };
  console.warn = (message) => warnings.push(String(message));

  try {
    clearWebhookEnv();
    let result = await submit("10.1.0.1");
    assert(result.status === 201 && result.body.ok, "Submission without webhook configuration should succeed.");
    assert(calls.length === 0, "No webhook request should be sent without configuration.");

    process.env.FEEDBACK_WEBHOOK_URL = "https://hooks.example.test/feedback";
    process.env.FEEDBACK_WEBHOOK_TOKEN = "generic-token";
    result = await submit("10.1.0.2");
    assert(result.status === 201, "Generic webhook submission should succeed.");
    assert(calls.length === 1, "Generic webhook should send one request.");
    const generic = JSON.parse(calls[0].options.body);
    assert(generic.subject === "观止学堂新反馈", "Generic subject changed unexpectedly.");
    assert(generic.action === "created", "Generic action changed unexpectedly.");
    assert(generic.feedback?.articleId === "070", "Generic feedback payload changed unexpectedly.");
    assert(generic.contact === "student-private@example.com", "Generic contact field changed unexpectedly.");

    calls.length = 0;
    process.env.FEEDBACK_WEBHOOK_FORMAT = "EMAIL";
    process.env.FEEDBACK_WEBHOOK_URL = "https://api.resend.com/emails";
    process.env.FEEDBACK_WEBHOOK_TOKEN = "re_test_key";
    process.env.FEEDBACK_EMAIL_TO = "owner-one@example.com, owner-two@example.com";
    process.env.FEEDBACK_EMAIL_FROM = "观止学堂 <onboarding@resend.dev>";
    process.env.FEEDBACK_EMAIL_SUBJECT_PREFIX = "[课程反馈]";
    result = await submit("10.1.0.3", {
      content: `<script>alert("x")</script>${"摘要内容".repeat(80)}`
    });
    assert(result.status === 201, "Email webhook submission should succeed.");
    assert(calls.length === 1, "Email webhook should send one request.");
    const emailCall = calls[0];
    const email = JSON.parse(emailCall.options.body);
    assert(emailCall.options.headers.Authorization === "Bearer re_test_key", "Email bearer token is missing.");
    assert(email.from === "观止学堂 <onboarding@resend.dev>", "Email from is incorrect.");
    assert(JSON.stringify(email.to) === JSON.stringify(["owner-one@example.com", "owner-two@example.com"]), "Email recipients were not split correctly.");
    assert(email.subject === "[课程反馈] 新反馈：拼音", "Email subject is incorrect.");
    assert(email.html.includes("https://example.test/pages/admin.html"), "Email admin link is incorrect.");
    assert(email.html.includes("&lt;script&gt;"), "Email summary was not HTML escaped.");
    assert(!email.html.includes("<script>"), "Email contains unescaped HTML.");
    assert(!email.html.includes("student-private@example.com"), "Email leaked the submitter contact.");
    assert((email.html.match(/摘要内容/g) || []).length < 80, "Email summary was not truncated.");

    calls.length = 0;
    warnings.length = 0;
    delete process.env.FEEDBACK_EMAIL_TO;
    result = await submit("10.1.0.4");
    assert(result.status === 201, "Missing email recipient must not fail submission.");
    assert(calls.length === 0, "Missing email recipient should skip the webhook call.");
    assert(warnings.some((message) => message.includes("FEEDBACK_EMAIL_TO")), "Missing email recipient should emit a warning.");

    calls.length = 0;
    warnings.length = 0;
    process.env.FEEDBACK_EMAIL_TO = "owner@example.com";
    global.fetch = async (url, options = {}) => {
      calls.push({ url, options });
      return { ok: false, status: 401 };
    };
    result = await submit("10.1.0.5");
    assert(result.status === 201 && result.body.ok, "Webhook failure must not fail feedback submission.");
    assert(warnings.some((message) => message.includes("notification failed")), "Webhook failure should emit a server warning.");

    console.log("Feedback webhook OK: no config, generic, email, missing config, failure isolation, escaping, and contact privacy passed.");
  } finally {
    clearWebhookEnv();
    delete process.env.FEEDBACK_FILE_PATH;
    delete process.env.FEEDBACK_FILE_STORE;
    delete process.env.NODE_ENV;
    global.fetch = originalFetch;
    console.warn = originalWarn;
    fs.rmSync(filePath, { force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
