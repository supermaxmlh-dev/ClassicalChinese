const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const docsDir = path.join(root, "docs");
const dataDir = path.join(root, "data");
const curriculumPath = path.join(dataDir, "curriculum.json");
const schedulePath = path.join(docsDir, "04-52周课程表.md");
const previous = fs.existsSync(curriculumPath)
  ? JSON.parse(fs.readFileSync(curriculumPath, "utf8"))
  : { targetArticleCount: 222, articles: [] };
const guanzhiByTitle = new Map((previous.articles || []).map((article) => [article.title, article.guanzhiNo ?? null]));
const markdown = fs.readFileSync(schedulePath, "utf8");
const lines = markdown.split("\n");
const weeks = [];
const articles = [];
let current = null;
let nextId = 1;

function difficultyFromStars(stars) {
  return (stars.match(/★/g) || []).length;
}

lines.forEach((line) => {
  const heading = line.match(/^### 第(\d+)周 — (.+)$/);
  if (heading) {
    current = {
      week: Number(heading[1]),
      title: heading[2].replace(/\s*🏆\s*/g, ""),
      isReview: /复习|测评/.test(heading[2]),
      theme: "",
      focus: "",
      tip: "",
      extension: "",
      thinking: "",
      reviewStandard: "",
      badge: ""
    };
    weeks.push(current);
    return;
  }
  if (!current) return;

  const articleRow = line.match(/^\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*(★+)\s*\|\s*(\d+)\s*\|$/);
  if (articleRow) {
    const title = articleRow[1].trim();
    articles.push({
      id: String(nextId).padStart(3, "0"),
      title,
      source: articleRow[2].trim(),
      week: current.week,
      difficulty: difficultyFromStars(articleRow[3]),
      wordCount: Number(articleRow[4]),
      guanzhiNo: guanzhiByTitle.get(title) ?? null
    });
    nextId += 1;
    return;
  }

  const theme = line.match(/^\*\*本周主题\*\*：(.+)$/);
  const focus = line.match(/^\*\*(重点词汇|重点虚词精讲|重点词汇积累)\*\*：(.+)$/);
  const tip = line.match(/^\*\*学习提示\*\*：(.+)$/);
  const extension = line.match(/^\*\*延伸主题\*\*：(.+)$/);
  const standard = line.match(/^\*\*通过标准\*\*：(.+)$/);
  const badge = line.match(/^\*\*达成称号\*\*：(.+)$/);
  if (theme) current.theme = theme[1].trim();
  if (focus) current.focus = focus[2].trim();
  if (tip) current.tip = tip[1].trim();
  if (extension) current.extension = extension[1].trim();
  if (standard) current.reviewStandard = standard[1].trim();
  if (badge) current.badge = badge[1].trim();
});

fs.writeFileSync(curriculumPath, `${JSON.stringify({
  project: "guanzhi-xuetang",
  targetArticleCount: previous.targetArticleCount || 222,
  plannedArticleCount: articles.length,
  articles,
  weeks
}, null, 2)}\n`, "utf8");

console.log(`Synced ${articles.length} planned articles from docs/04-52周课程表.md.`);
