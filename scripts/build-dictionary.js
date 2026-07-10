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

function ensureEntry(map, char) {
  if (!map.has(char)) {
    map.set(char, {
      char,
      pinyin: new Set(),
      radical: "",
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
    example: compact(sense.example),
    articleId: sense.articleId,
    articleTitle: sense.articleTitle
  };
  const key = `${normalized.word}|${normalized.def}|${normalized.example}|${normalized.articleId}`;
  if (!entry.senses.has(key)) entry.senses.set(key, normalized);
}

function addWordSense(map, word, sense) {
  [...String(word || "")].filter(isHan).forEach((char) => {
    const entry = ensureEntry(map, char);
    addSense(entry, { ...sense, word });
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
    radical: entry.radical,
    senses: [...entry.senses.values()]
      .sort((a, b) => `${a.articleId}-${a.word}`.localeCompare(`${b.articleId}-${b.word}`))
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
