const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");
const docsDir = path.join(root, "docs");
const curriculumPath = path.join(dataDir, "curriculum.json");
const statusPath = path.join(dataDir, "content-status.json");
const indexPath = path.join(dataDir, "index.json");
const errors = [];

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

if (!fs.existsSync(curriculumPath)) {
  errors.push("Missing data/curriculum.json.");
} else {
  const curriculum = readJSON(curriculumPath);
  const index = fs.existsSync(indexPath) ? readJSON(indexPath) : null;
  const status = fs.existsSync(statusPath) ? readJSON(statusPath) : null;
  const articles = Array.isArray(curriculum.articles) ? curriculum.articles : [];
  const weeks = Array.isArray(curriculum.weeks) ? curriculum.weeks : [];
  const weekNumbers = new Set(weeks.map((week) => week.week));
  const mainArticles = articles.filter((article) => (article.collection || "古文观止") !== "拓展阅读");
  const extendedArticles = articles.filter((article) => article.collection === "拓展阅读");
  const ids = articles.map((article) => article.id);
  const duplicateIds = ids.filter((id, pos) => ids.indexOf(id) !== pos);
  const titles = new Map();

  if (!Number.isInteger(curriculum.targetArticleCount) || curriculum.targetArticleCount < articles.length) {
    errors.push("curriculum.targetArticleCount must be greater than or equal to planned articles.");
  }
  if (curriculum.plannedArticleCount !== undefined && curriculum.plannedArticleCount !== mainArticles.length) {
    errors.push("curriculum.plannedArticleCount does not match main curriculum articles length.");
  }
  if (weeks.length !== 52) {
    errors.push("curriculum.weeks must contain exactly 52 weeks.");
  }
  if (new Set(ids).size !== ids.length) {
    errors.push(`curriculum contains duplicate ids: ${[...new Set(duplicateIds)].join(", ")}`);
  }
  articles.forEach((article) => {
    const collection = article.collection || "古文观止";
    if (!/^\d{3}$/.test(article.id || "")) errors.push(`${article.title || "unknown"} has invalid id ${article.id}.`);
    if (!article.title) errors.push(`${article.id} is missing title.`);
    if (!["古文观止", "拓展阅读"].includes(collection)) {
      errors.push(`${article.id} ${article.title} has invalid collection ${collection}.`);
    }
    if (collection === "拓展阅读") {
      if (article.week !== null) errors.push(`${article.id} ${article.title} extended reading must have null week.`);
    } else if (!weekNumbers.has(article.week)) {
      errors.push(`${article.id} ${article.title} has invalid week ${article.week}.`);
    }
    if (article.guanzhi !== undefined && article.guanzhi !== null && article.guanzhi !== "pending") {
      errors.push(`${article.id} ${article.title} has invalid guanzhi ${article.guanzhi}.`);
    }
    if (!Number.isInteger(article.difficulty) || article.difficulty < 1 || article.difficulty > 5) {
      errors.push(`${article.id} ${article.title} has invalid difficulty.`);
    }
    if (titles.has(article.title)) errors.push(`Duplicate title in curriculum: ${article.title}.`);
    titles.set(article.title, article);
  });

  [
    ["曹刿论战", 1],
    ["邹忌讽齐王纳谏", 2]
  ].forEach(([title, maxWeek]) => {
    const article = titles.get(title);
    if (!article) {
      errors.push(`Curriculum is missing required starter article: ${title}.`);
    } else if (article.week > maxWeek) {
      errors.push(`${title} should be scheduled no later than week ${maxWeek}.`);
    }
  });

  if (index) {
    const mainScheduledIds = new Set((index.weeks || []).flatMap((week) => week.articleIds || []));
    const extendedIds = new Set(index.extendedReading || []);
    const displayCodes = new Set();
    extendedArticles.forEach((article) => {
      if (!extendedIds.has(article.id)) errors.push(`${article.id} ${article.title} missing from index.extendedReading.`);
      if (mainScheduledIds.has(article.id)) errors.push(`${article.id} ${article.title} is both extended and main week.`);
    });
    (index.articles || []).forEach((article) => {
      if (!article.catalogCode || !article.displayCode) {
        errors.push(`${article.id} ${article.title} missing catalogCode/displayCode.`);
        return;
      }
      if (displayCodes.has(article.displayCode)) errors.push(`Duplicate displayCode in index: ${article.displayCode}.`);
      displayCodes.add(article.displayCode);
      if (article.collection === "拓展阅读" && !/^拓展-\d{3}$/.test(article.displayCode)) {
        errors.push(`${article.id} ${article.title} extended reading displayCode must use 拓展-###.`);
      }
      if ((article.collection || "古文观止") !== "拓展阅读" && !/^观止-\d{3}$/.test(article.displayCode)) {
        errors.push(`${article.id} ${article.title} main reading displayCode must use 观止-###.`);
      }
    });
    if (index.plannedArticleCount !== mainScheduledIds.size) {
      errors.push("index.plannedArticleCount does not match scheduled main articles.");
    }
    if ((index.extendedReading || []).length !== extendedArticles.length) {
      errors.push("index.extendedReading length does not match curriculum extended reading.");
    }
  }
  if (index && index.targetArticleCount !== curriculum.targetArticleCount) {
    errors.push("index.targetArticleCount does not match curriculum.");
  }
  if (status && index && status.plannedArticleCount !== index.plannedArticleCount) {
    errors.push("content-status plannedArticleCount does not match index.");
  }
  if (status && status.targetArticleCount !== curriculum.targetArticleCount) {
    errors.push("content-status targetArticleCount does not match curriculum.");
  }

  const scheduleDoc = fs.readFileSync(path.join(docsDir, "04-52周课程表.md"), "utf8");
  ["曹刿论战", "邹忌讽齐王纳谏"].forEach((title) => {
    if (!scheduleDoc.includes(title)) errors.push(`docs/04-52周课程表.md does not mention ${title}.`);
  });
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Curriculum OK: data/curriculum.json is the schedule source of truth.");
