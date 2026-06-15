const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");
const indexPath = path.join(dataDir, "index.json");

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const index = readJSON(indexPath);
const errors = [];

if (!Array.isArray(index.weeks) || index.weeks.length !== 52) {
  errors.push("data/index.json must contain 52 weeks.");
}

(index.availableArticleIds || []).forEach((id) => {
  const file = path.join(dataDir, "articles", `${id}.json`);
  if (!fs.existsSync(file)) {
    errors.push(`Missing article file: ${id}.json`);
    return;
  }
  const article = readJSON(file);
  ["id", "title", "author", "week", "fullTextPlain", "sections", "quiz", "keyVocab"].forEach((key) => {
    if (article[key] === undefined || article[key] === null) {
      errors.push(`${id}.json missing ${key}`);
    }
  });
});

[13, 26, 39, 52].forEach((week) => {
  const file = path.join(dataDir, "reviews", `review-${week}.json`);
  if (!fs.existsSync(file)) errors.push(`Missing review-${week}.json`);
});

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Data OK: ${index.weeks.length} weeks, ${index.availableArticleIds.length} article files.`);
