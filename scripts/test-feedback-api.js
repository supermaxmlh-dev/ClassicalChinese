const fs = require("fs");
const os = require("os");
const path = require("path");
const { handleFeedbackRequest } = require("../api/shared/feedback");

async function main() {
  const filePath = path.join(os.tmpdir(), `guanzhi-feedback-test-${Date.now()}.jsonl`);
  process.env.FEEDBACK_FILE_PATH = filePath;
  process.env.FEEDBACK_FILE_STORE = "always";
  process.env.NODE_ENV = "test";

  const post = await handleFeedbackRequest({
    method: "POST",
    headers: {
      "x-forwarded-for": "127.0.0.1",
      "user-agent": "feedback-api-test"
    },
    body: {
      type: "pinyin",
      articleId: "070",
      page: "pages/article.html?id=070",
      content: "这里测试反馈入口是否可以保存并读取。",
      contact: "",
      privacyConsent: true,
      website: ""
    }
  });

  if (post.status !== 201 || !post.body?.ok || !post.body?.id) {
    throw new Error(`POST /api/feedback failed: ${post.status} ${JSON.stringify(post.body)}`);
  }

  const get = await handleFeedbackRequest({
    method: "GET",
    headers: {},
    body: null
  });

  if (get.status !== 200 || !Array.isArray(get.body?.items) || !get.body.items.length) {
    throw new Error(`GET /api/feedback failed: ${get.status} ${JSON.stringify(get.body)}`);
  }
  if (get.body.items[0].contact || get.body.items[0].ipHash) {
    throw new Error("GET /api/feedback leaked private fields.");
  }

  fs.rmSync(filePath, { force: true });
  console.log("Feedback API OK: POST saved feedback and GET returned public fields.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
