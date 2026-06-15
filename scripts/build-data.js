const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const docsDir = path.join(root, "docs");
const samplesDir = path.join(root, "content", "samples");
const dataDir = path.join(root, "data");
const articlesDir = path.join(dataDir, "articles");
const reviewsDir = path.join(dataDir, "reviews");

fs.mkdirSync(articlesDir, { recursive: true });
fs.mkdirSync(reviewsDir, { recursive: true });

fs.readdirSync(articlesDir)
  .filter((file) => /^\d{3}\.json$/.test(file))
  .forEach((file) => fs.unlinkSync(path.join(articlesDir, file)));

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function padId(value) {
  return String(value).padStart(3, "0");
}

function stripMarkdown(value = "") {
  return value
    .replace(/<ruby>(.*?)<rp>\(<\/rp><rt>.*?<\/rt><rp>\)<\/rp><\/ruby>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function stripRubyToPlainAndAnnotations(html = "") {
  const rubyAnnotations = [];
  let plain = "";
  let lastIndex = 0;
  const rubyPattern = /<ruby>(.*?)<rp>\(<\/rp><rt>(.*?)<\/rt><rp>\)<\/rp><\/ruby>/gs;
  let match;

  while ((match = rubyPattern.exec(html))) {
    const before = html.slice(lastIndex, match.index).replace(/<[^>]+>/g, "");
    plain += before;
    const chars = stripMarkdown(match[1]);
    const pinyins = match[2].split(/\s+/);
    [...chars].forEach((char, index) => {
      rubyAnnotations.push({
        char,
        pinyin: pinyins[index] || match[2],
        pos: plain.length
      });
      plain += char;
    });
    lastIndex = rubyPattern.lastIndex;
  }

  plain += html.slice(lastIndex).replace(/<[^>]+>/g, "");
  return { plain: plain.trim(), rubyAnnotations };
}

function sectionBetween(markdown, start, end) {
  const startIndex = markdown.indexOf(start);
  if (startIndex < 0) return "";
  const contentStart = startIndex + start.length;
  const endIndex = end ? markdown.indexOf(end, contentStart) : -1;
  return markdown.slice(contentStart, endIndex >= 0 ? endIndex : undefined).trim();
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^# .+?\n\n---\n([\s\S]*?)\n---/);
  if (!match) return {};
  return match[1].split("\n").reduce((meta, line) => {
    const index = line.indexOf(":");
    if (index < 0) return meta;
    const key = line.slice(0, index).trim();
    const raw = line.slice(index + 1).trim();
    if (/^\[.*\]$/.test(raw)) {
      meta[key] = JSON.parse(raw);
    } else if (/^\d+$/.test(raw)) {
      meta[key] = Number(raw);
    } else {
      meta[key] = raw.replace(/^"|"$/g, "");
    }
    return meta;
  }, {});
}

function parseAnnotations(block = "") {
  return block
    .split("\n")
    .filter((line) => line.trim().startsWith("- "))
    .map((line) => {
      const match = line.match(/\*\*(.*?)\*\*：(.+)/);
      if (!match) return null;
      const word = stripMarkdown(match[1]);
      const meaning = stripMarkdown(match[2]);
      const pinyinMatch = word.match(/（(.*?)）/);
      return {
        word: word.replace(/（.*?）/g, ""),
        meaning,
        pinyin: pinyinMatch ? pinyinMatch[1] : null
      };
    })
    .filter(Boolean);
}

function parseSections(markdown) {
  const block = sectionBetween(markdown, "## 逐句精读", "## 全文翻译");
  if (!block) return [];
  return block
    .split(/\n### /)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const lines = part.split("\n");
      const title = stripMarkdown(lines[0].replace(/^### /, ""));
      const quote = (part.match(/>\s*(.+)/) || [null, ""])[1].trim();
      const annotationsBlock = sectionBetween(part, "**注释**：", "**翻译**：");
      const translation = (part.match(/\*\*翻译\*\*：([\s\S]*?)(?:\n\n\*\*古今联系\*\*：|$)/) || [null, ""])[1].trim();
      const modernBlock = sectionBetween(part, "**古今联系**：", null);
      const modernLink = modernBlock
        .split("\n")
        .filter((line) => line.trim().startsWith("- "))
        .map((line) => stripMarkdown(line.replace(/^\s*-\s*/, "")))
        .join("；");
      return {
        title,
        original: stripMarkdown(quote),
        annotations: parseAnnotations(annotationsBlock),
        translation: stripMarkdown(translation),
        modernLink
      };
    });
}

function parseExtended(markdown) {
  const block = sectionBetween(markdown, "## 延伸阅读", "## 想一想");
  const getSub = (heading) => {
    const start = block.indexOf(`### ${heading}`);
    if (start < 0) return "";
    const contentStart = start + `### ${heading}`.length;
    const next = block.indexOf("\n### ", contentStart);
    return block.slice(contentStart, next >= 0 ? next : undefined).trim();
  };
  const funBlock = getSub("你知道吗？");
  return {
    author: stripMarkdown(getSub("关于作者")),
    background: stripMarkdown(getSub("历史背景")),
    funFacts: funBlock
      .split("\n")
      .filter((line) => line.trim().startsWith("- "))
      .map((line) => stripMarkdown(line.replace(/^\s*-\s*/, ""))),
    relatedStory: stripMarkdown(getSub("相关故事"))
  };
}

function parseThinking(markdown) {
  return sectionBetween(markdown, "## 想一想", "## 小试牛刀")
    .split("\n")
    .map((line) => line.match(/^\d+\.\s*(.+)$/)?.[1])
    .filter(Boolean)
    .map(stripMarkdown);
}

function parseAnswers(markdown) {
  const block = sectionBetween(markdown, "## 参考答案", null);
  const answers = {};
  block.split("\n").forEach((line) => {
    const match = line.match(/^(\d+)\.\s*(.+)$/);
    if (match) answers[Number(match[1])] = stripMarkdown(match[2]);
  });
  return answers;
}

function parseChoices(quizBlock, answers) {
  const choicesBlock = sectionBetween(quizBlock, "### 一、选择题", "### 二、填空题");
  const questionParts = choicesBlock.split(/\n(?=\d+\.\s)/).map((part) => part.trim()).filter(Boolean);
  return questionParts.map((part) => {
    const questionNumber = Number(part.match(/^(\d+)\./)?.[1]);
    const question = stripMarkdown(part.match(/^\d+\.\s*(.+)$/m)?.[1] || "");
    const options = part
      .split("\n")
      .map((line) => line.match(/^\s*-\s*([A-E])\.\s*(.+)$/))
      .filter(Boolean)
      .map((match) => stripMarkdown(match[2].replace(/\s*✓$/, "")));
    const answerLetter = (answers[questionNumber] || "").match(/^([A-E])/i)?.[1]?.toUpperCase();
    return {
      id: questionNumber,
      question,
      options,
      answerIndex: Math.max(0, "ABCDE".indexOf(answerLetter || "A")),
      explanation: answers[questionNumber] || ""
    };
  }).filter((item) => item.question && item.options.length);
}

function parseFillBlanks(quizBlock, answers) {
  const fillBlock = sectionBetween(quizBlock, "### 二、填空题", "### 三、简答题");
  const answerText = Object.entries(answers)
    .filter(([number]) => Number(number) >= 3)
    .map(([, value]) => value)
    .join("；");
  const answerMap = {};
  answerText.split(/[；;]/).forEach((part) => {
    const match = part.match(/([^：:，,]+)[：:](.+)/);
    if (match) answerMap[stripMarkdown(match[1]).trim()] = stripMarkdown(match[2]).trim();
  });
  return fillBlock
    .split("\n")
    .map((line) => line.match(/^\s*-\s*(.+)$/)?.[1])
    .filter(Boolean)
    .map((line, index) => {
      const clean = stripMarkdown(line);
      const word = (line.match(/\*\*(.*?)\*\*/) || [null, ""])[1];
      const answer = answerMap[stripMarkdown(word)] || answerMap[clean.split("→")[0].trim()] || "";
      return {
        id: 100 + index,
        question: clean.replace(/（.*?）/g, ""),
        blank: answer || "略",
        hint: word ? `解释“${stripMarkdown(word)}”` : ""
      };
    });
}

function parseShortAnswer(quizBlock, answers, heading, nextHeading) {
  const block = sectionBetween(quizBlock, heading, nextHeading);
  return block
    .split("\n")
    .map((line) => line.match(/^(\d+)\.\s*(.+)$/))
    .filter(Boolean)
    .map((match) => ({
      id: Number(match[1]),
      question: stripMarkdown(match[2]),
      sampleAnswer: answers[Number(match[1])] || "开放题，言之有物即可。"
    }));
}

function parseQuiz(markdown) {
  const quizBlock = sectionBetween(markdown, "## 小试牛刀", "## 词汇积累");
  const answers = parseAnswers(markdown);
  return {
    choices: parseChoices(quizBlock, answers),
    fillBlanks: parseFillBlanks(quizBlock, answers),
    shortAnswer: parseShortAnswer(quizBlock, answers, "### 三、简答题", "### 四、挑战题"),
    challenge: parseShortAnswer(quizBlock, answers, "### 四、挑战题（选做）", null)
  };
}

function parseVocab(markdown) {
  const block = sectionBetween(markdown, "## 词汇积累", "## 参考答案");
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && !line.includes("---") && !line.includes("古义"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => stripMarkdown(cell.trim())))
    .filter((cells) => cells.length >= 5)
    .map(([word, ancient, modern, example, idiom]) => ({ word, ancient, modern, example, idiom }));
}

function parseArticle(filePath) {
  const markdown = fs.readFileSync(filePath, "utf8");
  const meta = parseFrontmatter(markdown);
  const originalHtml = sectionBetween(markdown, "## 原文", "## 朗读指导");
  const { plain, rubyAnnotations } = stripRubyToPlainAndAnnotations(originalHtml);
  return {
    id: String(meta.id).padStart(3, "0"),
    sourceMarkdown: path.relative(root, filePath),
    title: meta.title,
    source: meta.source,
    author: meta.author,
    dynasty: meta.dynasty,
    difficulty: meta.difficulty,
    week: meta.week,
    wordCount: meta.word_count,
    tags: meta.tags || [],
    relatedIdioms: meta.related_idioms || [],
    mainImage: `${String(meta.id).padStart(3, "0")}-main.jpg`,
    storyIntro: stripMarkdown(sectionBetween(markdown, "## 故事导读", "## 原文")),
    fullText: originalHtml,
    fullTextPlain: plain,
    rubyAnnotations,
    rhythmMarked: stripMarkdown(sectionBetween(markdown, "## 朗读指导", "## 逐句精读")),
    sections: parseSections(markdown),
    fullTranslation: stripMarkdown(sectionBetween(markdown, "## 全文翻译", "## 延伸阅读")),
    extendedReading: parseExtended(markdown),
    thinkingQuestions: parseThinking(markdown),
    quiz: parseQuiz(markdown),
    keyVocab: parseVocab(markdown)
  };
}

function stageForWeek(week) {
  if (week <= 13) return 1;
  if (week <= 26) return 2;
  if (week <= 39) return 3;
  return 4;
}

function buildIndex(availableArticles) {
  const markdown = fs.readFileSync(path.join(docsDir, "04-52周课程表.md"), "utf8");
  const lines = markdown.split("\n");
  const weeks = [];
  const plannedArticles = [];
  let current = null;
  let nextId = 1;

  lines.forEach((line) => {
    const heading = line.match(/^### 第(\d+)周 — (.+)$/);
    if (heading) {
      current = {
        week: Number(heading[1]),
        title: heading[2].replace(/\s*🏆\s*/g, ""),
        stageId: stageForWeek(Number(heading[1])),
        isReview: /复习|测评/.test(heading[2]),
        articleIds: [],
        theme: "",
        focus: "",
        tip: "",
        extension: "",
        thinking: ""
      };
      weeks.push(current);
      return;
    }
    if (!current) return;

    const articleRow = line.match(/^\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*(★+)\s*\|\s*(\d+)\s*\|$/);
    if (articleRow) {
      const id = padId(nextId);
      const available = availableArticles.find((article) => article.id === id);
      plannedArticles.push({
        id,
        title: articleRow[1].trim(),
        source: articleRow[2].trim(),
        difficulty: articleRow[3].length,
        wordCount: Number(articleRow[4]),
        week: current.week,
        available: Boolean(available)
      });
      current.articleIds.push(id);
      nextId += 1;
      return;
    }

    const theme = line.match(/^\*\*本周主题\*\*：(.+)$/);
    const focus = line.match(/^\*\*(重点词汇|重点虚词精讲)\*\*：(.+)$/);
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

  const stages = [
    { id: 1, name: "第一阶段：启蒙期", startWeek: 1, endWeek: 13, goal: "建立文言文阅读兴趣，掌握50+常见实词" },
    { id: 2, name: "第二阶段：成长期", startWeek: 14, endWeek: 26, goal: "扩大词汇量，培养独立阅读能力" },
    { id: 3, name: "第三阶段：提升期", startWeek: 27, endWeek: 39, goal: "挑战赋、论、表等多种文体" },
    { id: 4, name: "第四阶段：突破期", startWeek: 40, endWeek: 52, goal: "完成高难度长篇与综合测评" }
  ];

  return {
    project: "guanzhi-xuetang",
    title: "观止学堂",
    targetArticleCount: 222,
    plannedArticleCount: plannedArticles.length,
    availableArticleIds: availableArticles.map((article) => article.id),
    stages,
    weeks,
    articles: plannedArticles
  };
}

function buildContentStatus(indexData, availableArticles) {
  const availableById = new Map(availableArticles.map((article) => [article.id, article]));
  const plannedIds = new Set(indexData.articles.map((article) => article.id));
  const duplicateIds = availableArticles
    .map((article) => article.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  const rows = indexData.articles.map((planned) => {
    const article = availableById.get(planned.id);
    return {
      id: planned.id,
      title: planned.title,
      week: planned.week,
      difficulty: planned.difficulty,
      wordCount: planned.wordCount,
      planned: true,
      hasMarkdown: Boolean(article),
      hasJson: Boolean(article),
      sourceMarkdown: article?.sourceMarkdown || null,
      status: article ? "complete" : "missing"
    };
  });
  const unplanned = availableArticles
    .filter((article) => !plannedIds.has(article.id))
    .map((article) => ({
      id: article.id,
      title: article.title,
      week: article.week,
      difficulty: article.difficulty,
      wordCount: article.wordCount,
      planned: false,
      hasMarkdown: true,
      hasJson: true,
      sourceMarkdown: article.sourceMarkdown,
      status: "unplanned"
    }));

  return {
    generatedAt: new Date().toISOString(),
    targetArticleCount: indexData.targetArticleCount,
    plannedArticleCount: indexData.plannedArticleCount,
    availableArticleCount: availableArticles.length,
    missingPlannedCount: rows.filter((row) => row.status === "missing").length,
    unplannedArticleCount: unplanned.length,
    targetUnplannedCount: Math.max(0, indexData.targetArticleCount - indexData.plannedArticleCount),
    duplicateIds: [...new Set(duplicateIds)],
    completionPercentOfPlanned: Math.round((availableArticles.filter((article) => plannedIds.has(article.id)).length / Math.max(1, indexData.plannedArticleCount)) * 100),
    completionPercentOfTarget: Math.round((availableArticles.length / Math.max(1, indexData.targetArticleCount)) * 100),
    articles: [...rows, ...unplanned]
  };
}

function buildVocabCategories() {
  return {
    categories: [
      { id: "speech", name: "说话类", keywords: ["曰", "谓", "云", "言", "告", "说"] },
      { id: "see", name: "看类", keywords: ["见", "观", "视", "望"] },
      { id: "time", name: "时间类", keywords: ["时", "日", "晓", "夕", "年"] },
      { id: "function", name: "虚词类", keywords: ["之", "以", "而", "者", "也", "焉", "耳"] },
      { id: "character", name: "品格类", keywords: ["德", "俭", "静", "君子", "淡泊", "馨"] },
      { id: "common", name: "常见实词", keywords: [] }
    ]
  };
}

function buildReviews() {
  const baseQuestions = [
    {
      id: 1,
      question: "“四时俱备”中的“四时”是什么意思？",
      options: ["四个小时", "四季", "四点钟", "四个时代"],
      answerIndex: 1,
      explanation: "“四时”在古文中常指春夏秋冬四季。"
    },
    {
      id: 2,
      question: "“月色入户”中的“户”是什么意思？",
      options: ["窗户", "门", "人家", "户口"],
      answerIndex: 1,
      explanation: "这里的“户”指门。"
    },
    {
      id: 3,
      question: "《爱莲说》中，作者把莲花比作什么？",
      options: ["隐士", "富贵者", "君子", "仙人"],
      answerIndex: 2,
      explanation: "作者说“莲，花之君子者也”。"
    }
  ];
  [13, 26, 39, 52].forEach((week) => {
    writeJSON(path.join(reviewsDir, `review-${week}.json`), {
      week,
      title: `第 ${week} 周阶段测评`,
      description: "当前为示例题库，后续可扩展到20-30题。",
      passScore: week === 13 ? 60 : 70,
      questions: baseQuestions
    });
  });
}

const articles = fs.readdirSync(samplesDir)
  .filter((file) => file.endsWith(".md"))
  .sort()
  .map((file) => parseArticle(path.join(samplesDir, file)));

articles.forEach((article) => {
  writeJSON(path.join(articlesDir, `${article.id}.json`), article);
});

const indexData = buildIndex(articles);

writeJSON(path.join(dataDir, "index.json"), indexData);
writeJSON(path.join(dataDir, "content-status.json"), buildContentStatus(indexData, articles));
writeJSON(path.join(dataDir, "vocab-categories.json"), buildVocabCategories());
buildReviews();

console.log(`Generated ${articles.length} article JSON files, course index, and content status.`);
