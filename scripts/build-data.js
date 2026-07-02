const fs = require("fs");
const path = require("path");
const { pinyin } = require("pinyin-pro");

const root = path.resolve(__dirname, "..");
const docsDir = path.join(root, "docs");
const samplesDir = path.join(root, "content", "samples");
const rawDir = path.join(root, "content", "raw");
const dataDir = path.join(root, "data");
const curriculumPath = path.join(dataDir, "curriculum.json");
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

function hanCount(value = "") {
  return (String(value).match(/[\u3400-\u9fff]/g) || []).length;
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

function buildFullRubyAnnotations(plain = "", manualAnnotations = []) {
  const manualByPos = new Map((manualAnnotations || []).map((item) => [Number(item.pos), item]));
  const hanChars = [...plain].filter((char) => /[\u3400-\u9fff]/.test(char));
  const pinyins = pinyin(hanChars.join(""), {
    toneType: "symbol",
    type: "array",
    nonZh: "removed"
  });
  let hanIndex = 0;

  return [...plain].flatMap((char, pos) => {
    if (!/[\u3400-\u9fff]/.test(char)) return [];
    const manual = manualByPos.get(pos);
    const generated = pinyins[hanIndex] || "";
    hanIndex += 1;
    return [{
      char,
      pinyin: manual?.pinyin || generated,
      pos
    }];
  });
}

function assertSameOriginal(samplePlain = "", rawPlain = "", title = "unknown") {
  if (samplePlain === rawPlain) return;
  const max = Math.max(samplePlain.length, rawPlain.length);
  let pos = 0;
  while (pos < max && samplePlain[pos] === rawPlain[pos]) pos += 1;
  throw new Error(
    `Original text mismatch in ${title} at char ${pos + 1}: sample="${samplePlain[pos] || "EOF"}", raw="${rawPlain[pos] || "EOF"}".`
  );
}

function parseRhythmBreaks(markedText = "", plainText = "", title = "unknown") {
  const breaks = [];
  let cursor = 0;

  [...markedText].forEach((char) => {
    if (char === "/") {
      if (cursor > 0 && cursor < plainText.length) breaks.push(cursor);
      return;
    }
    if (plainText[cursor] === char) {
      cursor += 1;
      return;
    }
    if (/\s/.test(char)) {
      while (/\s/.test(plainText[cursor] || "")) cursor += 1;
      return;
    }
    while (/\s/.test(plainText[cursor] || "")) cursor += 1;
    if (plainText[cursor] !== char) {
      throw new Error(`Rhythm text mismatch in ${title}: expected "${plainText[cursor] || "EOF"}", got "${char}".`);
    }
    cursor += 1;
  });

  while (/\s/.test(plainText[cursor] || "")) cursor += 1;
  if (cursor !== plainText.length) {
    throw new Error(`Rhythm text in ${title} does not cover the full original text.`);
  }

  return [...new Set(breaks)].sort((a, b) => a - b);
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
    if (!answerLetter || !"ABCDE".includes(answerLetter)) {
      throw new Error(`Choice question ${questionNumber} is missing a valid answer letter.`);
    }
    const answerIndex = "ABCDE".indexOf(answerLetter);
    if (answerIndex < 0 || answerIndex >= options.length) {
      throw new Error(`Choice question ${questionNumber} answer ${answerLetter} is out of range.`);
    }
    const explanation = answers[questionNumber] || "";
    const isBareAnswer = new RegExp(`^${answerLetter}[（(][^）)]+[）)]$`).test(stripMarkdown(explanation));
    if (!explanation || isBareAnswer) {
      throw new Error(`Choice question ${questionNumber} needs a concrete explanation in 参考答案, not only ${answerLetter}.`);
    }
    return {
      id: questionNumber,
      question,
      options,
      answerIndex,
      explanation
    };
  }).filter((item) => item.question && item.options.length);
}

function parseFillAnswerList(answer, label) {
  const parts = String(answer || "").split(/[\/／]/).map((part) => stripMarkdown(part).trim());
  if (!parts.length || parts.some((part) => !part || part === "略")) {
    throw new Error(`Fill blank answer for "${label}" must be non-empty and cannot be "略".`);
  }
  return [...new Set(parts)];
}

function parseFillBlanks(quizBlock, answers, fullTextPlain, title) {
  const fillBlock = sectionBetween(quizBlock, "### 二、填空题", "### 三、简答题");
  const answerText = Object.entries(answers)
    .filter(([number]) => Number(number) >= 3)
    .map(([, value]) => value)
    .join("；");
  const answerMap = {};
  answerText.split(/[；;]/).forEach((part) => {
    const match = part.match(/([^：:，,]+)[：:](.+)/);
    if (match) {
      const key = stripMarkdown(match[1]).trim();
      answerMap[key] = parseFillAnswerList(match[2], key);
    }
  });
  return fillBlock
    .split("\n")
    .map((line) => line.match(/^\s*-\s*(.+)$/)?.[1])
    .filter(Boolean)
    .map((line, index) => {
      const clean = stripMarkdown(line);
      const word = (line.match(/\*\*(.*?)\*\*/) || [null, ""])[1];
      const targetChar = stripMarkdown(word).trim();
      if (!targetChar) {
        throw new Error(`Fill blank "${clean}" must mark the target word with **bold**.`);
      }
      const stem = stripMarkdown(line.split("→")[0]).replace(/_+/g, "").trim();
      if (stem.length <= targetChar.length) {
        throw new Error(`Fill blank "${clean}" in ${title} must include the source sentence, not only the target word.`);
      }
      const targetIndex = stem.indexOf(targetChar);
      if (targetIndex < 0) {
        throw new Error(`Fill blank target "${targetChar}" was not found in stem "${stem}".`);
      }
      if (!fullTextPlain.includes(stem.replace(/\s+/g, ""))) {
        throw new Error(`Fill blank stem "${stem}" in ${title} is not found in the original text.`);
      }
      const answerList = answerMap[targetChar] || answerMap[stem] || [];
      if (!answerList.length) {
        throw new Error(`Fill blank "${stem}" is missing an answer for "${targetChar}".`);
      }
      return {
        id: 100 + index,
        stem,
        targetChar,
        targetIndex,
        blank: answerList[0],
        answers: answerList,
        hint: ""
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

function parseQuiz(markdown, fullTextPlain, title) {
  const quizBlock = sectionBetween(markdown, "## 小试牛刀", "## 词汇积累");
  const answers = parseAnswers(markdown);
  return {
    choices: parseChoices(quizBlock, answers),
    fillBlanks: parseFillBlanks(quizBlock, answers, fullTextPlain, title),
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
  const id = String(meta.id).padStart(3, "0");
  const rawPath = path.join(rawDir, `${id}-${meta.title}.txt`);
  if (!fs.existsSync(rawPath)) {
    throw new Error(`Missing raw original text: ${path.relative(root, rawPath)}`);
  }
  const sampleOriginalHtml = sectionBetween(markdown, "## 原文", "## 朗读指导");
  const { plain: samplePlain } = stripRubyToPlainAndAnnotations(sampleOriginalHtml);
  const originalHtml = fs.readFileSync(rawPath, "utf8").trim();
  const { plain, rubyAnnotations } = stripRubyToPlainAndAnnotations(originalHtml);
  const fullRubyAnnotations = buildFullRubyAnnotations(plain, rubyAnnotations);
  assertSameOriginal(samplePlain, plain, meta.title);
  const rhythmText = stripMarkdown(sectionBetween(markdown, "## 朗读指导", "## 逐句精读"));
  return {
    id,
    sourceMarkdown: path.relative(root, filePath),
    sourceRaw: path.relative(root, rawPath),
    title: meta.title,
    source: meta.source,
    author: meta.author,
    dynasty: meta.dynasty,
    difficulty: meta.difficulty,
    week: meta.week,
    wordCount: meta.word_count,
    tags: meta.tags || [],
    relatedIdioms: meta.related_idioms || [],
    mainImage: `${id}-main.jpg`,
    storyIntro: stripMarkdown(sectionBetween(markdown, "## 故事导读", "## 原文")),
    fullText: originalHtml,
    fullTextPlain: plain,
    rubyAnnotations: fullRubyAnnotations,
    rhythmBreaks: parseRhythmBreaks(rhythmText, plain, meta.title),
    sections: parseSections(markdown),
    fullTranslation: stripMarkdown(sectionBetween(markdown, "## 全文翻译", "## 延伸阅读")),
    extendedReading: parseExtended(markdown),
    thinkingQuestions: parseThinking(markdown),
    quiz: parseQuiz(markdown, plain, meta.title),
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
  if (!fs.existsSync(curriculumPath)) {
    throw new Error("Missing data/curriculum.json. Run node scripts/sync-curriculum.js first.");
  }
  const curriculum = JSON.parse(fs.readFileSync(curriculumPath, "utf8"));
  const availableById = new Map(availableArticles.map((article) => [article.id, article]));
  const weeks = curriculum.weeks.map((week) => ({
    ...week,
    stageId: stageForWeek(week.week),
    articleIds: curriculum.articles
      .filter((article) => article.week === week.week)
      .map((article) => article.id)
  }));
  const plannedArticles = curriculum.articles.map((article) => ({
    ...article,
    available: availableById.has(article.id)
  }));

  const stages = [
    { id: 1, name: "第一阶段：启蒙期", startWeek: 1, endWeek: 13, goal: "建立文言文阅读兴趣，掌握50+常见实词" },
    { id: 2, name: "第二阶段：成长期", startWeek: 14, endWeek: 26, goal: "扩大词汇量，培养独立阅读能力" },
    { id: 3, name: "第三阶段：提升期", startWeek: 27, endWeek: 39, goal: "挑战赋、论、表等多种文体" },
    { id: 4, name: "第四阶段：突破期", startWeek: 40, endWeek: 52, goal: "完成高难度长篇与综合测评" }
  ];

  return {
    project: "guanzhi-xuetang",
    title: "观止学堂",
    targetArticleCount: curriculum.targetArticleCount,
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
      explanation: "“户”在这里不是窗户，而是门，写月光照进门内。"
    },
    {
      id: 3,
      question: "《爱莲说》中，作者把莲花比作什么？",
      options: ["隐士", "富贵者", "君子", "仙人"],
      answerIndex: 2,
      explanation: "作者明说“莲，花之君子者也”，用莲象征品德高洁的人。"
    }
  ];
  const review13Questions = [
    ...baseQuestions,
    {
      id: 4,
      question: "《曹刿论战》中，“小大之狱”里的“狱”指什么？",
      options: ["监狱", "案件", "争吵", "礼物"],
      answerIndex: 1,
      explanation: "这里的“狱”指诉讼案件，曹刿看重鲁庄公能否公正处理民事。"
    },
    {
      id: 5,
      question: "《邹忌讽齐王纳谏》中，邹忌用什么方式劝齐王？",
      options: ["直接责骂", "用自己的生活经历作比", "写战书", "沉默不语"],
      answerIndex: 1,
      explanation: "邹忌先讲自己被妻妾客夸美的经历，再引出君王容易受蒙蔽。"
    },
    {
      id: 6,
      question: "《陋室铭》中，“斯是陋室，惟吾德馨”强调什么？",
      options: ["房子越大越好", "品德能让陋室不陋", "朋友越少越清净", "山水一定有仙人"],
      answerIndex: 1,
      explanation: "刘禹锡把重点放在“德馨”，说明人的品格比居室外表更重要。"
    },
    {
      id: 7,
      question: "《杂说四（马说）》中，“千里马常有，而伯乐不常有”主要感叹什么？",
      options: ["好马太少", "识才者难得", "骑马很危险", "马都喜欢吃草"],
      answerIndex: 1,
      explanation: "韩愈借马说人，真正感叹的是人才常被埋没，缺少识才的人。"
    },
    {
      id: 8,
      question: "《烛之武退秦师》中，“东道主”原来的意思是？",
      options: ["请客的人", "东方道路上的主人", "东边的国君", "管理驿站的人"],
      answerIndex: 1,
      explanation: "烛之武说郑国可做秦国东方路上的主人，后来才引申为接待客人的主人。"
    },
    {
      id: 9,
      question: "《岳阳楼记》中，“先天下之忧而忧，后天下之乐而乐”表现了什么胸怀？",
      options: ["只关心自己", "忧乐以天下为先", "喜欢登楼看景", "害怕风浪"],
      answerIndex: 1,
      explanation: "范仲淹把个人情绪放在天下之后，表达士大夫关心百姓和国家的责任。"
    },
    {
      id: 10,
      question: "《醉翁亭记》中，“醉翁之意不在酒”后来常用来表示什么？",
      options: ["真正目的在别处", "只能少喝酒", "老人喜欢山水", "亭子里没有酒"],
      answerIndex: 0,
      explanation: "欧阳修借饮酒写山水和百姓同乐，成语后来指表面行为背后另有用意。"
    },
    {
      id: 11,
      question: "《曾子易箦》中，曾子临终仍要求换席，体现了什么？",
      options: ["讲究饮食", "重视礼法和自我要求", "害怕学生", "喜欢新席子"],
      answerIndex: 1,
      explanation: "曾子认为身份不合的席子不能用，即使病重也要守礼，表现自律。"
    },
    {
      id: 12,
      question: "《公子重耳对秦客》中，重耳回答秦客时主要表现出什么？",
      options: ["贪图享乐", "谨慎守礼、懂得进退", "不愿说话", "轻视秦国"],
      answerIndex: 1,
      explanation: "重耳处在寄人篱下的境地，回答时既表达感谢，也避免失礼冒进。"
    },
    {
      id: 13,
      question: "《齐桓下拜受胙》中，齐桓公坚持下拜，主要是因为他重视什么？",
      options: ["礼节和天子威严", "多得祭肉", "显示年老", "避免走路"],
      answerIndex: 0,
      explanation: "齐桓公不敢贪“无下拜”的特别待遇，说明他在诸侯面前维护天子礼制。"
    },
    {
      id: 14,
      question: "《楚归晋知罃》中，知罃面对楚王追问时的特点是？",
      options: ["粗鲁争吵", "回答谨慎而有分寸", "一味求赏", "完全沉默"],
      answerIndex: 1,
      explanation: "知罃既不说怨，也不说德，始终把两国关系和臣子身份摆清楚。"
    },
    {
      id: 15,
      question: "《召公谏厉王止谤》中，“防民之口，甚于防川”说明什么？",
      options: ["百姓不能说话", "堵住舆论比堵河水更危险", "河水不会泛滥", "巫师最可靠"],
      answerIndex: 1,
      explanation: "召公用治水作比，提醒厉王压制百姓言论会积累更大的危险。"
    },
    {
      id: 16,
      question: "《右溪记》中，作者整治右溪并刻铭，体现了什么心情？",
      options: ["只想捕鱼", "怜惜美景无人赏识", "厌恶山水", "准备出征"],
      answerIndex: 1,
      explanation: "元结看到清溪怪石无人赏爱，于是疏凿修治，表现发现和珍惜美的心情。"
    },
    {
      id: 17,
      question: "《王孙满对楚子》中，“在德不在鼎”强调国家强弱取决于什么？",
      options: ["鼎的重量", "德行和天命", "士兵衣服", "车马数量"],
      answerIndex: 1,
      explanation: "王孙满没有回答鼎的大小轻重，而指出真正重要的是统治者的德。"
    },
    {
      id: 18,
      question: "《周郑交质》中，君子认为“质无益”的前提是什么？",
      options: ["缺少真诚信义", "礼物太少", "天气不好", "道路太远"],
      answerIndex: 0,
      explanation: "文章说信不由中，即内心没有诚信时，交换人质也不能真正维系关系。"
    },
    {
      id: 19,
      question: "《项羽本纪赞》中，司马迁批评项羽最终失败的重要原因是？",
      options: ["不懂音乐", "自矜功伐、不师古", "没有战马", "不会写字"],
      answerIndex: 1,
      explanation: "司马迁认为项羽夸耀功劳、凭个人私智行事，失败后还不自责。"
    },
    {
      id: 20,
      question: "《卖柑者言》中，“金玉其外，败絮其中”比喻什么？",
      options: ["外表华美而内里破败", "柑橘很甜", "金子和玉很多", "棉絮很贵"],
      answerIndex: 0,
      explanation: "卖柑外表漂亮，剖开却干坏，作者借此讽刺表面威风而没有实才的人。"
    },
    {
      id: 21,
      question: "《臧僖伯谏观鱼》中，臧僖伯反对鲁隐公观鱼的核心理由是？",
      options: ["鱼太少", "国君行为应合礼制", "路太近", "天气太冷"],
      answerIndex: 1,
      explanation: "臧僖伯从礼制和君职责出发，认为无关大事的游观不该由国君亲自做。"
    },
    {
      id: 22,
      question: "《柳敬亭说书》中，张岱重点写柳敬亭说书的什么特点？",
      options: ["价钱最低", "声音和描写极有感染力", "从不挑听众", "只会唱曲"],
      answerIndex: 1,
      explanation: "文中写他说武松打虎时声如巨钟、细节逼真，突出说书技艺高超。"
    },
    {
      id: 23,
      question: "《齐桓公伐楚盟屈完》中，屈完应对齐侯时最突出的是？",
      options: ["退让无言", "不卑不亢地维护楚国", "请求逃跑", "责备百姓"],
      answerIndex: 1,
      explanation: "屈完承认贡包茅问题，却把昭王不复推给水滨，既回应质问又守住尊严。"
    },
    {
      id: 24,
      question: "《西湖七月半》中，张岱真正想看的是什么？",
      options: ["只看月亮", "看七月半看月的人", "只看船只", "看官府告示"],
      answerIndex: 1,
      explanation: "开篇说“止可看看七月半之人”，全文按五类人写出节日风俗。"
    }
  ];
  const stage2ReviewQuestions = [
    {
      question: "《宫之奇谏假道》中，“唇亡齿寒”用来说明什么关系？",
      options: ["虞、虢相互依存", "晋国只爱珠玉", "道路越借越宽", "车马彼此竞速"],
      answerIndex: 0,
      explanation: "宫之奇用辅车、唇齿作比，说明虞国和虢国一亡一危，不能只看眼前小利。"
    },
    {
      question: "《郑伯克段于鄢》中，郑庄公对共叔段的态度主要表现为？",
      options: ["纵其发展再一举解决", "立即主动让位", "完全不知情", "只讨论山水游赏"],
      answerIndex: 0,
      explanation: "庄公多次不制止段的扩张，等其行动暴露后再出兵，体现政治谋算。"
    },
    {
      question: "《种树郭橐驼传》中，郭橐驼的种树方法强调什么？",
      options: ["顺应树木本性", "频繁搬动根土", "每天严厉看守", "只追求枝叶整齐"],
      answerIndex: 0,
      explanation: "郭橐驼说要顺木之天，使其性得以发展，柳宗元借此讽刺扰民之政。"
    },
    {
      question: "《冯谖客孟尝君》中，“狡兔三窟”相关情节体现冯谖怎样的眼光？",
      options: ["为孟尝君预留多重退路", "只会索取鱼车", "劝孟尝君放弃宾客", "专门管理园林"],
      answerIndex: 0,
      explanation: "冯谖经营薛地、恢复声望并联结齐王，为孟尝君安排不止一条安全退路。"
    },
    {
      question: "《触龙说赵太后》中，触龙成功劝说太后的关键策略是？",
      options: ["先缓和情绪，再以爱子之道说理", "一开口就责骂太后", "完全回避长安君", "只谈自己的官位"],
      answerIndex: 0,
      explanation: "触龙先问饮食起居，使太后色少解，再转入父母为子计深远的道理。"
    },
    {
      question: "《师说》中，“师者，所以传道受业解惑也”说明老师的职责是？",
      options: ["传道、授业、解惑", "只排列座次", "只管理饮食", "只教授骑射"],
      answerIndex: 0,
      explanation: "韩愈开篇界定教师职责，后文批评耻学于师都围绕这个判断展开。"
    },
    {
      question: "《游褒禅山记》中，王安石借游洞经历重点说明什么？",
      options: ["志、力、物三者相配才能深入", "山洞里不能点火", "碑文一定都可靠", "游客越少越无趣"],
      answerIndex: 0,
      explanation: "作者从半途而返生发议论，认为有志、有力且借助外物，才能达到深处。"
    },
    {
      question: "《前赤壁赋》中，苏轼最终用什么化解客人的悲哀？",
      options: ["从变与不变看天地人生", "责令客人停止说话", "离开江边不再游玩", "改写历史年号"],
      answerIndex: 0,
      explanation: "苏轼指出从变化看万物无穷，从不变看物我皆无尽，以此转悲为旷达。"
    },
    {
      question: "《谏太宗十思疏》中，“十思”的核心目的是？",
      options: ["提醒君主居安思危、修德纳谏", "安排宫殿装饰", "记录十次宴会", "统计树木河流"],
      answerIndex: 0,
      explanation: "魏征以求木、欲流设喻，劝太宗在安定时保持警惕、节欲修德。"
    },
    {
      question: "《归去来兮辞》中，陶渊明“归去来兮”的情感指向是？",
      options: ["辞官归田、回归本心", "准备远征边塞", "追求朝廷显达", "参加商业贸易"],
      answerIndex: 0,
      explanation: "全文写归家、田园、亲友和自然之乐，核心是摆脱仕途束缚，回到本心。"
    },
    {
      question: "《秋声赋》中，欧阳修借秋声主要引出什么感慨？",
      options: ["万物盛衰与人生衰老", "春天花事繁盛", "战争阵法变化", "儿童读书方法"],
      answerIndex: 0,
      explanation: "秋声由自然声响转为肃杀之气，作者进一步联想到草木凋零和人生易老。"
    },
    {
      question: "《送徐无党南归序》中，欧阳修谈“三不朽”时更看重什么根本？",
      options: ["修身立德是长久之本", "辞藻越华丽越不朽", "著书数量越多越好", "远行一定能成名"],
      answerIndex: 0,
      explanation: "文章把修身、施事、见言并举，又反复提醒言不可恃，重心落在德行和自警。"
    }
  ];
  const review26Questions = [
    ...review13Questions.slice(0, 18),
    ...stage2ReviewQuestions
  ].map((question, index) => ({ ...question, id: index + 1 }));
  [13, 26, 39, 52].forEach((week) => {
    const questions = week === 13 ? review13Questions : week === 26 ? review26Questions : baseQuestions;
    writeJSON(path.join(reviewsDir, `review-${week}.json`), {
      week,
      title: `第 ${week} 周阶段测评`,
      description: week === 13 ? "覆盖第 1-12 周的第一阶段综合测评。" : week === 26 ? "覆盖第 1-25 周的第二阶段综合测评。" : "当前为示例题库，后续可扩展到20-30题。",
      passScore: week === 13 ? 60 : week === 26 ? 65 : 70,
      questions
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
