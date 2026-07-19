const fs = require("fs");
const os = require("os");
const path = require("path");
const { handleFeedbackRequest, getFeedbackById, resetRateLimit } = require("../api/shared/feedback");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(method, body, ip = "127.0.0.1") {
  return handleFeedbackRequest({
    method,
    headers: {
      "x-forwarded-for": ip,
      "user-agent": "feedback-api-test"
    },
    body
  });
}

async function main() {
  const filePath = path.join(os.tmpdir(), `guanzhi-feedback-test-${Date.now()}.jsonl`);
  process.env.FEEDBACK_FILE_PATH = filePath;
  process.env.FEEDBACK_FILE_STORE = "always";
  process.env.FEEDBACK_ADMIN_TOKEN = "admin-secret-for-test";
  process.env.NODE_ENV = "test";
  resetRateLimit();

  const post = await request("POST", {
    type: "pinyin",
    articleId: "070",
    page: "pages/article.html?id=070",
    content: "这里测试反馈入口是否可以保存并读取。",
    contact: "",
    deleteSecret: "user-delete-secret",
    privacyConsent: true,
    website: ""
  });

  assert(post.status === 201 && post.body?.ok && post.body?.id, `POST failed: ${post.status} ${JSON.stringify(post.body)}`);
  assert(post.body.status === "visible", "Normal feedback should be visible.");

  const created = await getFeedbackById(post.body.id);
  assert(created.deleteSecretHash && created.deleteSecretSalt, "Delete secret must be stored as hash and salt.");
  assert(!created.deleteSecret, "Plain delete secret must not be stored.");

  const reply = await request("POST", {
    type: "other",
    parentId: post.body.id,
    page: "pages/feedback.html",
    content: "这是对上一条反馈的回复。",
    privacyConsent: true,
    website: ""
  }, "127.0.0.2");
  assert(reply.status === 201 && reply.body.item.parentId === post.body.id, "Reply should keep parentId.");

  const hidden = await request("POST", {
    type: "other",
    page: "pages/feedback.html",
    content: "这条包含诈骗关键词，应该进入审核。",
    privacyConsent: true,
    website: ""
  }, "127.0.0.3");
  assert(hidden.status === 201 && hidden.body.status === "needs_review", "Keyword hit should enter needs_review.");

  const get = await request("GET");
  assert(get.status === 200 && Array.isArray(get.body?.items), `GET failed: ${get.status} ${JSON.stringify(get.body)}`);
  assert(get.body.items.some((item) => item.id === post.body.id), "Visible feedback should be public.");
  assert(get.body.items.some((item) => item.parentId === post.body.id), "Visible reply should be public.");
  assert(!get.body.items.some((item) => item.id === hidden.body.id), "needs_review feedback must not be public.");
  assert(!get.body.items[0].contact && !get.body.items[0].ipHash && !get.body.items[0].deleteSecretHash, "GET leaked private fields.");

  const badDelete = await request("DELETE", {
    id: post.body.id,
    deleteSecret: "wrong-secret"
  });
  assert(badDelete.status === 403, "Wrong delete secret should be rejected.");

  const userDelete = await request("DELETE", {
    id: post.body.id,
    deleteSecret: "user-delete-secret"
  });
  assert(userDelete.status === 200 && userDelete.body.ok, "Correct delete secret should delete own feedback.");
  const deleted = await getFeedbackById(post.body.id);
  assert(deleted.status === "deleted", "Deleted feedback should be soft-deleted.");

  const adminDelete = await request("DELETE", {
    id: reply.body.id,
    adminToken: "admin-secret-for-test"
  });
  assert(adminDelete.status === 200 && adminDelete.body.ok, "Admin token should delete any feedback.");

  const afterDelete = await request("GET");
  assert(!afterDelete.body.items.some((item) => item.id === post.body.id), "Deleted feedback must not be public.");
  assert(!afterDelete.body.items.some((item) => item.id === reply.body.id), "Admin-deleted reply must not be public.");

  fs.rmSync(filePath, { force: true });
  console.log("Feedback API OK: create, reply, moderation, user delete, admin delete, and public privacy checks passed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
