const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");
const indexPath = path.join(dataDir, "index.json");
const statusPath = path.join(dataDir, "content-status.json");

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const index = readJSON(indexPath);
const status = fs.existsSync(statusPath) ? readJSON(statusPath) : null;
const errors = [];

if (!Array.isArray(index.weeks) || index.weeks.length !== 52) {
  errors.push("data/index.json must contain 52 weeks.");
}

if (!status) {
  errors.push("Missing data/content-status.json.");
} else {
  if (status.targetArticleCount !== index.targetArticleCount) {
    errors.push("content-status targetArticleCount does not match index.");
  }
  if (status.plannedArticleCount !== index.plannedArticleCount) {
    errors.push("content-status plannedArticleCount does not match index.");
  }
  if (status.availableArticleCount !== (index.availableArticleIds || []).length) {
    errors.push("content-status availableArticleCount does not match index.");
  }
  if (Array.isArray(status.duplicateIds) && status.duplicateIds.length > 0) {
    errors.push(`Duplicate article ids: ${status.duplicateIds.join(", ")}`);
  }
}

const availableIds = index.availableArticleIds || [];
const uniqueAvailableIds = new Set(availableIds);
if (uniqueAvailableIds.size !== availableIds.length) {
  errors.push("index.availableArticleIds contains duplicates.");
}

availableIds.forEach((id) => {
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
  if (article.id !== id) errors.push(`${id}.json has mismatched id ${article.id}`);
  if (!Array.isArray(article.sections) || article.sections.length === 0) errors.push(`${id}.json has no sections`);
  if (!article.fullTranslation) errors.push(`${id}.json has no fullTranslation`);
  if (!article.quiz?.choices?.length) errors.push(`${id}.json has no choice questions`);
  if (!article.keyVocab?.length) errors.push(`${id}.json has no keyVocab`);
  if (article.fullTextPlain.includes("<") || article.fullTextPlain.includes(">")) {
    errors.push(`${id}.json fullTextPlain appears to contain unparsed HTML.`);
  }
  if ((article.fullText.match(/<ruby>/g) || []).length !== (article.fullText.match(/<\/ruby>/g) || []).length) {
    errors.push(`${id}.json has unbalanced ruby tags.`);
  }
});

const articleFiles = fs.readdirSync(path.join(dataDir, "articles")).filter((file) => /^\d{3}\.json$/.test(file));
articleFiles.forEach((file) => {
  const id = file.replace(".json", "");
  if (!uniqueAvailableIds.has(id)) {
    errors.push(`Article file exists but is not listed as available: ${file}`);
  }
});

[13, 26, 39, 52].forEach((week) => {
  const file = path.join(dataDir, "reviews", `review-${week}.json`);
  if (!fs.existsSync(file)) errors.push(`Missing review-${week}.json`);
});

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const missing = status?.missingPlannedCount ?? "unknown";
const targetGap = status?.targetUnplannedCount ?? "unknown";
console.log(`Data OK: ${index.weeks.length} weeks, ${availableIds.length} article files, ${missing} planned articles missing, ${targetGap} target slots not yet planned.`);
