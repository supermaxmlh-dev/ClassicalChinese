# Codex Prompt · 篇名用字校正：U+44E8 → 罃（024）

> 问题：024 篇名和正文曾误用 U+44E8（艹字头）。通行本《古文观止》《左传》作「**罃**」(U+7F43，yīng)——荀罃/知罃。请把项目里的误字统一改为「**罃**」。
>
> 注意：目标字是 **罃**（缶字底，U+7F43），不是 U+44E8（艹字头）也不是「罂/罌」。请精确使用 U+7F43。人物读音仍是 **yīng**。

---

## 一、要改的源头（改这些，生成文件靠重建）

1. **重命名 + 改内容**：
   - 旧 `content/raw/024-楚归晋知[U+44E8].txt` → 重命名为 `content/raw/024-楚归晋知罃.txt`，并把文件内原文中的误字改为「罃」（知罃在原文里多次出现）。
   - 旧 `content/samples/week06-024-楚归晋知[U+44E8].md` → 重命名为 `content/samples/week06-024-楚归晋知罃.md`，并把文件**全文**误字改为「罃」（含 frontmatter `title`、故事导读、`## 原文`、朗读指导、逐句精读、全文翻译、题目与答案等）。
2. **排课真源**：`data/curriculum.json` 中 024 的 `title` 改为「楚归晋知罃」。
3. **构建脚本内硬编码的测评题**：`scripts/build-data.js` 里 `review13Questions` 数组（约 551 行起）中出现的误字改为「罃」（review-26 复用 review-13，一并生效）。
4. **文档**：`docs/03-文章难度分级表.md`、`docs/04-52周课程表.md` 中的篇名改为「楚归晋知罃」。
5. （可选）历史归档文档 `docs/12`、`docs/13`、`docs/pinyin-校正报告.md` 里的误字也一并改为「罃」以保持一致。

**不要手改生成文件**：`data/articles/024.json`、`data/content-status.json`、`data/index.json`、`data/reviews/*.json` 由构建重新生成，改完源头后跑构建即可。

---

## 二、一致性要求（否则构建会报错）

- raw 文件名、samples 文件名、samples frontmatter `title`、`data/curriculum.json` 的 title **必须四处完全一致**（都作「楚归晋知罃」）。否则 `build-data.js` 会因 `Missing raw original text` 或 frontmatter 不匹配而报错。
- 只改 U+44E8 到「罃」这一个字，不动其它任何字与标点；id（024）、周次、难度、拼音（yīng）均不变。

---

## 三、流程与验收

1. 改完第一节后运行 `npm run build`（build:data + validate-data + validate-curriculum），必须**全绿**。
2. 全库不应再有旧误字 U+44E8：
   ```bash
   rg -n $'\u44E8' . -g '*.json' -g '*.md' -g '*.txt' -g '*.js'
   ```
   期望**无输出**。
3. 确认标题为「楚归晋知罃」：
   ```bash
   node -e 'console.log(JSON.parse(require("fs").readFileSync("data/articles/024.json","utf8")).title)'
   ```
   应输出 `楚归晋知罃`。
4. `git commit`（如 `fix: 篇名用字校正为知罃 (024)`）。

完成后请输出：重命名与改动了哪些文件、第 2 步 grep 结果、`npm run build` 结果。
