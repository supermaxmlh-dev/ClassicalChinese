const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");
const articlesDir = path.join(dataDir, "articles");
const outputPath = path.join(dataDir, "dictionary.json");

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function isHan(char) {
  return /^[\u3400-\u9fff]$/.test(char);
}

function compact(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function splitPinyin(value = "") {
  return String(value || "")
    .split(/[,\s/、，]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function compactLength(value = "") {
  return String(value || "").replace(/\s/g, "").length;
}

function isClauseBoundary(char) {
  return "。！？；，、：:“”‘’\"'「」『』（）()《》\n\r".includes(char);
}

function trimBoundary(value = "") {
  return String(value || "")
    .replace(/^[。！？；，、：:“”‘’"'「」『』（）()《》\s]+/, "")
    .replace(/[。！？；，、：:“”‘’"'「」『』（）()《》\s]+$/, "")
    .trim();
}

function limitAroundNeedle(value, needle, maxLength = 24) {
  const chars = [...value];
  if (compactLength(value) <= maxLength) return trimBoundary(value);

  const needleChars = [...needle].filter(Boolean);
  let center = chars.findIndex((char) => needleChars.includes(char));
  if (center < 0) center = Math.floor(chars.length / 2);

  let start = center;
  let end = center + 1;
  let length = compactLength(chars.slice(start, end).join(""));

  while (length < maxLength && (start > 0 || end < chars.length)) {
    let changed = false;
    if (end < chars.length) {
      const next = chars[end];
      const nextLength = /\s/.test(next) ? 0 : 1;
      if (length + nextLength <= maxLength) {
        end += 1;
        length += nextLength;
        changed = true;
      }
    }
    if (length >= maxLength) break;
    if (start > 0) {
      const prev = chars[start - 1];
      const prevLength = /\s/.test(prev) ? 0 : 1;
      if (length + prevLength <= maxLength) {
        start -= 1;
        length += prevLength;
        changed = true;
      }
    }
    if (!changed) break;
  }

  return trimBoundary(chars.slice(start, end).join(""));
}

function shortExample(example, needle) {
  const source = compact(example);
  const focus = compact(needle);
  if (!source) return "";
  if (!focus) return limitAroundNeedle(source, "", 24);

  const directIndex = source.indexOf(focus);
  const charIndex = directIndex >= 0 ? directIndex : source.indexOf([...focus][0] || "");
  if (charIndex < 0) return limitAroundNeedle(source, focus, 24);

  let start = charIndex;
  while (start > 0 && !isClauseBoundary(source[start - 1])) start -= 1;

  let end = charIndex + 1;
  while (end < source.length && !isClauseBoundary(source[end])) end += 1;
  if (end < source.length && "。！？；，、：".includes(source[end])) end += 1;

  return limitAroundNeedle(trimBoundary(source.slice(start, end)), focus, 24);
}

function ensureEntry(map, char) {
  if (!map.has(char)) {
    map.set(char, {
      char,
      pinyin: new Set(),
      variants: new Set(),
      frequency: 0,
      senses: new Map()
    });
  }
  return map.get(char);
}

function addSense(entry, sense) {
  const def = compact(sense.def);
  if (!def) return;
  const normalized = {
    word: compact(sense.word || entry.char),
    def,
    example: shortExample(sense.example, sense.focus || sense.word || entry.char),
    articleId: sense.articleId,
    articleTitle: sense.articleTitle
  };
  const key = `${normalized.word}|${normalized.def}|${normalized.example}|${normalized.articleId}`;
  if (!entry.senses.has(key)) entry.senses.set(key, normalized);
}

function addWordSense(map, word, sense) {
  [...String(word || "")].filter(isHan).forEach((char) => {
    const entry = ensureEntry(map, char);
    addSense(entry, { ...sense, word, focus: char });
  });
}

function representativeSenses(senses) {
  const byDef = new Map();
  senses.forEach((sense) => {
    if (!byDef.has(sense.def)) byDef.set(sense.def, []);
    byDef.get(sense.def).push(sense);
  });

  return [...byDef.values()].flatMap((group) => {
    const kept = [];
    const sources = new Set();
    group.forEach((sense) => {
      if (kept.length >= 2) return;
      if (sources.has(sense.articleId)) return;
      kept.push(sense);
      sources.add(sense.articleId);
    });
    return kept.length ? kept : group.slice(0, 1);
  });
}

const entries = new Map();
const files = fs.readdirSync(articlesDir).filter((file) => /^\d{3}\.json$/.test(file)).sort();

files.forEach((file) => {
  const article = readJSON(path.join(articlesDir, file));
  (article.rubyAnnotations || []).forEach((item) => {
    if (!isHan(item.char)) return;
    const entry = ensureEntry(entries, item.char);
    entry.frequency += 1;
    splitPinyin(item.pinyin).forEach((py) => entry.pinyin.add(py));
  });

  (article.sections || []).forEach((section) => {
    (section.annotations || []).forEach((ann) => {
      addWordSense(entries, ann.word, {
        def: ann.meaning,
        example: section.original,
        articleId: article.id,
        articleTitle: article.title
      });
    });
  });

  (article.keyVocab || []).forEach((item) => {
    addWordSense(entries, item.word, {
      def: item.ancient || item.modern,
      example: item.example,
      articleId: article.id,
      articleTitle: article.title
    });
  });
});

const curatedEntries = [
  {
    char: "乘",
    pinyin: ["shèng", "chéng"],
    sense: {
      word: "乘",
      def: "作车辆量词时读 shèng；作乘坐、趁势时读 chéng。",
      example: "帅车二百乘以伐京。",
      articleId: "055",
      articleTitle: "郑伯克段于鄢"
    }
  },
  {
    char: "遗",
    pinyin: ["wèi", "yí"],
    sense: {
      word: "遗",
      def: "作赠送、馈赠时读 wèi；作遗留、遗漏时读 yí。",
      example: "请以遗之。",
      articleId: "055",
      articleTitle: "郑伯克段于鄢"
    }
  }
];

curatedEntries.forEach((item) => {
  const entry = ensureEntry(entries, item.char);
  item.pinyin.forEach((py) => entry.pinyin.add(py));
  addSense(entry, item.sense);
});

const dictionaryEntries = [...entries.values()]
  .filter((entry) => entry.senses.size > 0)
  .map((entry) => ({
    char: entry.char,
    pinyin: [...entry.pinyin].sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
    senses: representativeSenses([...entry.senses.values()]
      .sort((a, b) => `${a.def}-${a.articleId}-${a.word}`.localeCompare(`${b.def}-${b.articleId}-${b.word}`)))
      .slice(0, 12),
    variants: [...entry.variants],
    frequency: entry.frequency
  }))
  .sort((a, b) => b.frequency - a.frequency || a.char.localeCompare(b.char, "zh-Hans-CN"));

writeJSON(outputPath, {
  schemaVersion: 1,
  source: "Generated from data/articles/*.json section annotations and keyVocab.",
  entryCount: dictionaryEntries.length,
  entries: dictionaryEntries
});

console.log(`Generated dictionary with ${dictionaryEntries.length} entries.`);
