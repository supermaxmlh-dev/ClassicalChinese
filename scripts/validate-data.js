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
const GENERIC_EXPLANATION_FRAGMENTS = [
  "符合原文语境",
  "其他选项不符合本句含义",
  "请结合原文语境和注释判断"
];
const BANNED_CHOICE_QUESTION_PATTERNS = [
  /本文题目是下列哪一项/,
  /阅读本文时，最应该先抓住什么/
];
const VAGUE_DEFINITION_PATTERN = /需.*上下文|结合.*上下文|联系.*上下文|视.*上下文|根据.*语境|结合.*语境|联系.*语境|视.*语境|依.*语境/;
const SECTION_TRANSLATION_REPAIRED_IDS = new Set([
  "001", "002", "006", "010", "013",
  "015", "016", "017", "018", "019", "020", "021",
  "023", "024", "025", "026", "027", "028", "029",
  "031", "032", "033", "034", "035", "036", "037",
  "039", "040", "041", "042", "043", "044", "045"
]);
const FULL_TRANSLATION_REPAIRED_IDS = new Set([
  "023", "024", "025", "026", "027", "028", "029",
  "031", "032", "033", "034", "035", "036", "037",
  "039", "040", "041", "042", "043", "044", "045"
]);
const TRANSLATION_PLACEHOLDER_PATTERNS = [
  /本文大意是/,
  /这一段承接/,
  /在全文中的作用/,
  /阅读时要.*分清/,
  /围绕.*展开/,
  /^(?:这一层|这一段|本段).*(?:围绕|大意)/
];

function hanCount(value = "") {
  return (String(value).match(/[\u3400-\u9fff]/g) || []).length;
}

function compactText(value = "") {
  return String(value || "").replace(/\s/g, "");
}

function hanText(value = "") {
  return (String(value).match(/[\u3400-\u9fff]/g) || []).join("");
}

function hasTranslationPlaceholder(value = "") {
  return TRANSLATION_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(String(value || "")));
}

function copiedHanFragment(original = "", translation = "", length = 12) {
  const source = hanText(original);
  const target = hanText(translation);
  if (source.length < length || target.length < length) return "";
  for (let index = 0; index <= source.length - length; index += 1) {
    const fragment = source.slice(index, index + length);
    if (target.includes(fragment)) return fragment;
  }
  return "";
}

function validateTranslations(article, id) {
  if (FULL_TRANSLATION_REPAIRED_IDS.has(id)) {
    const fullTranslation = String(article.fullTranslation || "").trim();
    if (hasTranslationPlaceholder(fullTranslation)) {
      errors.push(`${id}.json fullTranslation contains placeholder prose.`);
    }
    if (hanCount(fullTranslation) < hanCount(article.fullTextPlain) * 0.4) {
      errors.push(`${id}.json fullTranslation is shorter than 40% of the original Han-character count.`);
    }
    const fullCopy = copiedHanFragment(article.fullTextPlain, fullTranslation);
    if (fullCopy) {
      errors.push(`${id}.json fullTranslation copies at least 12 consecutive Han characters: ${fullCopy}`);
    }
  }
  if (!SECTION_TRANSLATION_REPAIRED_IDS.has(id)) return;
  (article.sections || []).forEach((section, sectionIndex) => {
    const translation = String(section.translation || "").trim();
    if (!translation) {
      errors.push(`${id}.json sections[${sectionIndex}] has empty translation.`);
      return;
    }
    if (hasTranslationPlaceholder(translation)) {
      errors.push(`${id}.json sections[${sectionIndex}] translation contains placeholder prose.`);
    }
    const copied = copiedHanFragment(section.original, translation);
    if (copied) {
      errors.push(`${id}.json sections[${sectionIndex}] translation copies at least 12 consecutive Han characters: ${copied}`);
    }
  });
}

function validateSections(article, id) {
  const full = compactText(article.fullTextPlain);
  const sections = Array.isArray(article.sections) ? article.sections : [];
  if (!full || !sections.length) return;

  let covered = 0;
  let lastEnd = -1;
  sections.forEach((section, index) => {
    const original = compactText(section.original);
    if (!original) {
      errors.push(`${id}.json sections[${index}] has empty original.`);
      return;
    }
    const start = full.indexOf(original, lastEnd < 0 ? 0 : lastEnd);
    if (start < 0) {
      errors.push(`${id}.json sections[${index}] original is not found in order in fullTextPlain.`);
      return;
    }
    if (start < lastEnd) {
      errors.push(`${id}.json sections[${index}] overlaps a previous section.`);
      return;
    }
    covered += original.length;
    lastEnd = start + original.length;
  });

  const coverage = covered / full.length;
  if (coverage < 0.9) {
    errors.push(`${id}.json sections coverage is ${Math.round(coverage * 100)}%, expected >= 90%.`);
  }
  if (full.length > 200 && sections.length < 2) {
    errors.push(`${id}.json sections must split long articles into at least 2 sections.`);
  }
}

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
const displayCodes = new Set();

availableIds.forEach((id) => {
  const file = path.join(dataDir, "articles", `${id}.json`);
  if (!fs.existsSync(file)) {
    errors.push(`Missing article file: ${id}.json`);
    return;
  }
  const article = readJSON(file);
  ["id", "title", "author", "fullTextPlain", "sections", "quiz", "keyVocab"].forEach((key) => {
    if (article[key] === undefined || article[key] === null) {
      errors.push(`${id}.json missing ${key}`);
    }
  });
  if (article.collection === "拓展阅读") {
    if (article.week !== null) errors.push(`${id}.json extended reading must have null week.`);
  } else if (article.week === undefined || article.week === null) {
    errors.push(`${id}.json missing week`);
  }
  if (article.id !== id) errors.push(`${id}.json has mismatched id ${article.id}`);
  if (!article.catalogCode || !article.displayCode) {
    errors.push(`${id}.json missing catalogCode/displayCode.`);
  } else {
    if (displayCodes.has(article.displayCode)) errors.push(`Duplicate displayCode: ${article.displayCode}.`);
    displayCodes.add(article.displayCode);
    if (article.collection === "拓展阅读" && !/^拓展-\d{3}$/.test(article.displayCode)) {
      errors.push(`${id}.json extended reading displayCode must use 拓展-###.`);
    }
    if (article.collection !== "拓展阅读" && !/^观止-\d{3}$/.test(article.displayCode)) {
      errors.push(`${id}.json main reading displayCode must use 观止-###.`);
    }
  }
  if (!Array.isArray(article.sections) || article.sections.length === 0) errors.push(`${id}.json has no sections`);
  (article.sections || []).forEach((section, sectionIndex) => {
    (section.annotations || []).forEach((annotation, annotationIndex) => {
      if (VAGUE_DEFINITION_PATTERN.test(String(annotation.meaning || ""))) {
        errors.push(`${id}.json sections[${sectionIndex}].annotations[${annotationIndex}] has a vague context-dependent meaning.`);
      }
    });
  });
  validateSections(article, id);
  validateTranslations(article, id);
  if (!article.fullTranslation) errors.push(`${id}.json has no fullTranslation`);
  if (!article.quiz?.choices?.length) errors.push(`${id}.json has no choice questions`);
  if (!article.keyVocab?.length) errors.push(`${id}.json has no keyVocab`);
  if (article.fullTextPlain.includes("<") || article.fullTextPlain.includes(">")) {
    errors.push(`${id}.json fullTextPlain appears to contain unparsed HTML.`);
  }
  if ((article.fullText.match(/<ruby>/g) || []).length !== (article.fullText.match(/<\/ruby>/g) || []).length) {
    errors.push(`${id}.json has unbalanced ruby tags.`);
  }
  if ((article.rubyAnnotations || []).length !== hanCount(article.fullTextPlain)) {
    errors.push(`${id}.json rubyAnnotations must cover every Han character for the full-pinyin toggle.`);
  }
  (article.rubyAnnotations || []).forEach((ruby, index) => {
    const pos = Number(ruby.pos);
    if (!Number.isInteger(pos) || pos < 0 || pos >= article.fullTextPlain.length) {
      errors.push(`${id}.json rubyAnnotations[${index}].pos is out of range.`);
      return;
    }
    if (article.fullTextPlain[pos] !== ruby.char) {
      errors.push(`${id}.json rubyAnnotations[${index}] char mismatch: expected ${article.fullTextPlain[pos]}, got ${ruby.char}.`);
    }
  });
  if (!Array.isArray(article.rhythmBreaks)) {
    errors.push(`${id}.json missing rhythmBreaks array.`);
  } else {
    article.rhythmBreaks.forEach((pos, index) => {
      if (!Number.isInteger(pos) || pos <= 0 || pos >= article.fullTextPlain.length) {
        errors.push(`${id}.json rhythmBreaks[${index}] is out of range.`);
      }
    });
  }
  (article.quiz?.choices || []).forEach((choice, index) => {
    if (BANNED_CHOICE_QUESTION_PATTERNS.some((pattern) => pattern.test(String(choice.question || "")))) {
      errors.push(`${id}.json choices[${index}] is a boilerplate/water question: ${choice.question}`);
    }
    if (!Array.isArray(choice.options) || choice.options.length < 2) {
      errors.push(`${id}.json choices[${index}] has too few options.`);
    }
    if (!Number.isInteger(choice.answerIndex) || choice.answerIndex < 0 || choice.answerIndex >= (choice.options || []).length) {
      errors.push(`${id}.json choices[${index}].answerIndex is out of range.`);
    }
    if (hanCount(choice.explanation) < 10) {
      errors.push(`${id}.json choices[${index}].explanation is too thin.`);
    }
    if (GENERIC_EXPLANATION_FRAGMENTS.some((fragment) => String(choice.explanation || "").includes(fragment))) {
      errors.push(`${id}.json choices[${index}].explanation is generic boilerplate.`);
    }
  });
  (article.quiz?.fillBlanks || []).forEach((fill, index) => {
    if (!Array.isArray(fill.answers) || !fill.answers.length) {
      errors.push(`${id}.json fillBlanks[${index}] must have a non-empty answers array.`);
    } else {
      const seenAnswers = new Set();
      fill.answers.forEach((answer, answerIndex) => {
        const clean = String(answer || "").trim();
        if (!clean || clean === "略") {
          errors.push(`${id}.json fillBlanks[${index}].answers[${answerIndex}] is empty or placeholder.`);
        }
        if (seenAnswers.has(clean)) {
          errors.push(`${id}.json fillBlanks[${index}].answers has duplicate answer "${clean}".`);
        }
        seenAnswers.add(clean);
      });
      if (fill.blank && fill.blank !== fill.answers[0]) {
        errors.push(`${id}.json fillBlanks[${index}].blank must match answers[0].`);
      }
    }
    if (!fill.stem || !fill.targetChar) {
      errors.push(`${id}.json fillBlanks[${index}] missing stem or targetChar.`);
      return;
    }
    if (!Number.isInteger(fill.targetIndex) || fill.targetIndex < 0 || fill.targetIndex + fill.targetChar.length > fill.stem.length) {
      errors.push(`${id}.json fillBlanks[${index}].targetIndex is out of range.`);
      return;
    }
    if (fill.stem.slice(fill.targetIndex, fill.targetIndex + fill.targetChar.length) !== fill.targetChar) {
      errors.push(`${id}.json fillBlanks[${index}] targetChar does not match stem.`);
    }
    if (fill.stem.length <= fill.targetChar.length) {
      errors.push(`${id}.json fillBlanks[${index}] must include the source sentence, not only the target word.`);
    }
    if (!article.fullTextPlain.includes(fill.stem.replace(/\s+/g, ""))) {
      errors.push(`${id}.json fillBlanks[${index}].stem is not found in fullTextPlain.`);
    }
  });
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
