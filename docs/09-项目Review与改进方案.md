# 观止学堂 · 项目 Review 与改进方案

> 视角：项目经理 + 语文教育专家
> 范围：你提出的 7 个问题 + Review 中新发现的 3 个隐患
> 结论：问题大多不是「写错代码」，而是**数据与文档缺少单一可信源（single source of truth）+ 构建脚本静默兜底**导致的。建议按下方 P0→P2 优先级处理，文末附可直接粘贴给 Codex 的 prompt。

---

## 一、问题诊断（逐项，含代码/数据定位）

### 问题 1 ｜拼音与节奏不能同时显示　【P0｜体验缺陷】

**现象**：打开「节奏标注」后拼音消失，二者互斥。

**根因**（`js/article.js` `updateOriginal()`，第 134–138 行）：
- 节奏文本是另存的一段纯文本 `rhythmMarked`（如 `山川/之美…`），里面**没有拼音/位置信息**；
- 代码里写死了互斥：`original.classList.toggle("hide-ruby", !rubyToggle.checked || rhythmToggle.checked)`，且节奏模式下传入的 ruby 数组是 `[]`。

也就是说，节奏和拼音是「两份不同的原文」，结构上就无法叠加。

**建议**：把「原文」做成**一份底本 + 两个可独立开关的图层**。
- 数据层：删除 `rhythmMarked` 字符串，改成 `rhythmBreaks: [pos, …]`（停顿点在 `fullTextPlain` 中的字符下标数组）。拼音继续用 `rubyAnnotations:[{char,pinyin,pos}]`。
- 渲染层：永远基于 `fullTextPlain` 渲染一次；拼音 = 是否输出 `<ruby>`；节奏 = 是否在 `rhythmBreaks` 的位置插入 `<span class="pause">/</span>`（或加右侧间距）。两个 checkbox 互不干扰，可任意组合（无/仅拼音/仅节奏/两者皆有）。

---

### 问题 2 ｜要解释的字应「加点」，而非写在提示里　【P0｜教学法错误】

**现象**：填空题「晓雾将歇 → ___」，把考点字写进了提示「解释"歇"」，等于直接告诉学生考哪个字，且不符合语文卷面规范。

**根因**（`scripts/build-data.js` `parseFillBlanks()`，第 218–223 行）：脚本把 markdown 里的 `**加粗字**` 提取出来，塞进 `hint: 解释"X"`，题干 `question` 里反而没有标出考点字。

**建议**（回归卷面规范——给考点字加**着重号/加点**）：
- 数据层：填空题增加 `stem`（题干原句）+ `targetChar` + `targetIndex`（考点字及其在 stem 中的位置），`hint` 默认置空。
- 渲染层：题干按 `targetIndex` 把考点字包成 `<span class="dot-emphasis">歇</span>`，CSS 用 `text-emphasis: dot;`（或下方圆点）渲染传统「着重号」。提示不再泄题。

---

### 问题 3 ｜完成第 1 篇，却显示「第 2 周进行中」　【P0｜进度逻辑 bug】

**现象**：第 1 周共 4 篇，只完成第 1 篇，首页就把第 2 周点亮为「进行中」、第 1 周反而不再是当前周。

**根因**（`js/progress.js` `markArticleComplete()`，第 76 行）：`progress.currentWeek = Math.min(52, Math.max(currentWeek, week.week + 1))` **在每篇完成时都执行**，不论本周是否全部完成。完成 week1 任一篇 → currentWeek 直接变 2。而 `js/map.js` `weekStatus()` 只认 `week === currentWeek` 为「进行中」，于是 week1 掉出当前态、week2 被点亮。

**建议**：
- 仅当**整周完成**时才推进 currentWeek——把第 76 行那句移进上面的 `if (done)` 块内。
- 升级 `weekStatus()` 为四态：`completed`（在 completedWeeks）/ `in-progress`（本周已有篇目完成但未全完成）/ `current`（最早一个未完成周）/ `locked`。让「做了一半」的周有专属样式，更符合直觉。

---

### 问题 4 ｜部分填空答案是「略」　【P0｜数据缺陷】

**现象**：`data/articles/003.json`、`004.json`、`005.json` 中多处填空 `"blank": "略"`（如爱莲说的「菊/牡丹/莲 → 略」）。

**根因**（两层）：
1. `scripts/build-data.js` 第 220 行：匹配不到答案时**静默兜底** `blank: answer || "略"`，错误被掩盖、照常上线。
2. 源头 markdown 的「参考答案」没有覆盖全部填空；且爱莲说那几道题本就不是「解释加点字」型（菊/牡丹/莲是象征意义题），被当成解释题误解析。

**建议**：
- 构建脚本**禁止兜底**：取不到答案就 `throw`，让构建失败而不是写「略」。
- `scripts/validate-data.js` 增加门禁：任何 `blank` 为空/"略"、`answerIndex` 越界、`rubyAnnotations.pos` 越界、题干引用的字不在原文中 → 直接报错退出（CI 即 `npm run build` 会拦住）。
- 修订源头 markdown：把缺失答案补全；把象征类题目从「填空(解释字)」改成「简答/选择」。

---

### 问题 5 ｜难度分级表 与 52 周课程表 冲突　【P0｜双数据源打架】

**现象**：`曹刿论战`（难度表第 8 篇，标注「第 1 周·最佳起步篇」）和 `邹忌讽齐王纳谏`（标注「第 1 周」）**在 52 周课程表和 content-status 里根本不存在**（已用 grep 确认计数为 0）。难度表里大量「推荐学习周」与课程表实际排布也对不上。

**根因**：存在**两个互相独立的排课来源**——
- `docs/03-文章难度分级表.md` 有一列「推荐学习周」（人工填），
- `docs/04-52周课程表.md` 是另一份人工编排，
- 而 `build-data.js`（第 301 行起）**只读 04** 生成 `index.json`。两份文档从未交叉校验，必然漂移。
- 附带：难度表用《古文观止》卷次序号（答谢中书书=#96），content-status 用排课序号（答谢中书书=001）。**两套编号并存**，易混淆。

**建议**（确立单一可信源）：
- 指定 **`data/curriculum.json`（机器可读）为排课唯一真源**：每篇含 `id, title, week, difficulty, guanzhiNo(卷次序号)`。`03` 和 `04` 都从它生成或与它对账，「推荐学习周」一列不再手填。
- 增加 `scripts/validate-curriculum.js`：校验①每篇恰好排进一周；②难度表与课程表 week 一致；③无重复/无缺漏；④篇数自洽。
- 业务决策：把 `曹刿论战`、`邹忌讽齐王纳谏` 这两篇★级招牌起步篇**补进第 1–2 周**（它们正是课内已学、最该打头阵的）。

---

### 问题 6 ｜原文建议单独成文件夹　【P1｜可维护性，合理】

**现状**：原文 `fullText/fullTextPlain` 和教学内容、练习、答案全部混在一篇大 markdown / 一个 JSON 里。原文是**最不能出错**的部分（一个错字毁所有），却最难单独校对。

**建议**：建立 `content/raw/{id}-{篇名}.txt` 作为**原文唯一底本**（只含原文，可内嵌 `<ruby>` 拼音和 `/` 节奏标记），与教学内容分离；构建时原文从这里读。好处：可单独逐字校对、可与权威版本 diff、改原文不动教学稿。

---

### 问题 7 ｜文章页改左右分栏　【P1｜阅读体验，推荐】

**现状**（`js/article.js` 第 204–256 行）：虽有 `article-layout`，但右侧 `article-aside` 只放了「学习提示/练习记录」，原文、翻译、精读、练习全堆在左边一长列，需要反复上下滚动对照。

**建议**（经典「对照阅读」布局）：
- 桌面 ≥1024px：**左栏 = 原文 + 功能按键（拼音/节奏/朗读/字号），`position: sticky` 固定**；**右栏 = 导读/翻译/逐句精读/想一想/练习/词汇**，可独立滚动。读者左看原文、右看讲解，无需来回跳。
- 平板/手机 <1024px：回退为单栏堆叠，原文置顶、工具条吸顶或可折叠。

---

## 二、Review 新发现（你清单外，建议一并处理）

| # | 发现 | 影响 | 建议 |
|---|------|------|------|
| 8 | **篇数三处对不上**：规划/README 说 222、课程表说「约 210+」、实际 planned 仅 177（content-status 显示缺口 45 篇） | 进度百分比失真、目标不清 | 在 curriculum.json 里锁定**唯一总数**，三处文档引用同一数字 |
| 9 | **选择题解析太薄**：`explanation` 多为「B（四季）」式同义重复，没讲「为什么」 | 学生答错得不到讲解 | 解析改为「为什么对/为什么错」的一句话教学，构建时校验长度 |
| 10 | **配图占位为空**：`article-visual` 是空 `div`，模板要求的 `{id}-main.jpg` 未接入 | 页面观感、儿童吸引力打折 | 接入图片（缺图回退到水墨占位纹理），并把 alt 文本补全 |

---

## 三、实施优先级建议（PM 视角）

- **P0（先做，影响正确性/体验）**：问题 3（进度 bug）→ 1（拼音节奏）→ 2（加点）→ 4（略，含校验门禁）→ 5（单一真源 + 补两篇）。
- **P1（紧跟，结构性收益）**：问题 7（分栏）→ 6（原文独立）→ 发现 8（篇数对齐）。
- **P2（打磨）**：发现 9（解析质量）、10（配图）。

一句话原则贯穿全部：**让数据有唯一真源，让构建在出错时「响亮失败」而不是静默兜底。** 这能根除 4、5 类问题反复出现。

---

## 四、给 Codex 的 Prompt（可直接粘贴）

> 用法：在 VS Code 打开本仓库根目录，把下面整段粘给 Codex，并把 `docs/` 作为上下文一起提供。按 Phase 推进，每个 Phase 完成后做一次 git commit 与人工 review。

```
你是本仓库「观止学堂」（guanzhi-xuetang，纯静态 HTML+CSS+原生 JS，无框架）的维护工程师。
不要重写项目，只按下列 Phase 做最小必要修改；每个 Phase 自成一次 commit，并在 scripts/validate-data.js 全绿后才算完成。
现有关键文件：js/article.js、js/quiz.js、js/progress.js、js/map.js、scripts/build-data.js、scripts/validate-data.js、data/index.json、data/articles/*.json、docs/03~05。

总原则：
- 数据只有唯一真源；构建脚本遇到取不到的内容必须 throw 报错，禁止用 "略"/占位静默兜底。
- 所有改动保持 UTF-8、ES6+、语义化标签、关键函数加中文注释。

━━ Phase 1 · 修复进度推进 bug（对应问题3）
- js/progress.js markArticleComplete()：把推进 currentWeek 的那行
  (progress.currentWeek = Math.min(52, Math.max(progress.currentWeek, week.week + 1)))
  移入「整周已完成」的 if (done) 分支内——只有本周所有 articleIds 都完成才推进当前周。
- js/map.js weekStatus()：扩展为四态 completed / in-progress(本周有篇目完成但未全完成) / current(最早一个未完成的非复习周) / locked，并在 statusText() 和 CSS 增加 in-progress 文案与样式（如「学习中 N/M」）。
- 验收：完成第1周第1篇后，第1周显示「学习中 1/4」，第2周仍为 locked。

━━ Phase 2 · 拼音与节奏可同时显示（对应问题1）
- 数据模型：在 data/articles/*.json 去掉 rhythmMarked 字符串，改为 rhythmBreaks:[number]（停顿点在 fullTextPlain 中的字符下标）。
- scripts/build-data.js：解析「## 朗读指导」里的 "/" 标记，映射成相对 fullTextPlain 的下标数组写入 rhythmBreaks（不要再输出整段 rhythmMarked）。
- js/article.js：renderText 永远基于 fullTextPlain 渲染一次；新增两个独立图层——拼音(是否输出 <ruby>)、节奏(在 rhythmBreaks 位置插入 <span class="pause">/</span>)。两个 checkbox 互不影响，可任意组合。删除原 updateOriginal 中「节奏开则强制关拼音、传 [] 给 ruby」的互斥逻辑。
- CSS：.pause 给出停顿视觉（如左右间距或淡色"/"）。
- 验收：四种组合（无 / 仅拼音 / 仅节奏 / 拼音+节奏）都能正确渲染同一篇原文。

━━ Phase 3 · 填空题考点字「加点」，提示不泄题（对应问题2）
- 数据模型：fillBlanks 每题改为 { id, stem(题干原句), targetChar, targetIndex, blank(答案), hint(可空) }。
- scripts/build-data.js parseFillBlanks：从 markdown 的 **加粗字** 解析 targetChar 及其在 stem 中的下标；hint 默认空；答案取不到则 throw（不要写 "略"）。
- js/quiz.js renderFillBlanks：题干按 targetIndex 把考点字渲染成 <span class="dot-emphasis">X</span>；CSS .dot-emphasis 用 text-emphasis: dot（着重号）。输入框 placeholder 不再显示考点字。
- 验收：题面是「晓雾将[歇·] → ___」（歇字带着重号），提示栏不再出现"解释歇"。

━━ Phase 4 · 数据校验门禁 + 清除"略"（对应问题4）
- scripts/validate-data.js 增加硬校验，任一不通过即 process.exit(1)：
  (a) 任何 fillBlanks.blank 为空或等于"略"；
  (b) choices.answerIndex 越界，或 explanation 少于10个汉字（解析过薄，对应发现9）；
  (c) rubyAnnotations[].pos 越界或该位置字符与 char 不符；
  (d) rhythmBreaks 下标越界。
- 修订 content/samples 下相关 md：补全所有填空参考答案；把爱莲说「菊/牡丹/莲」这类象征题从填空改为选择或简答。重新 build 后这三个 JSON 不得再含"略"。
- 验收：npm run build（含 validate）全绿，grep -r '"略"' data/articles 无结果。

━━ Phase 5 · 单一排课真源 + 补招牌篇（对应问题5 与发现8）
- 新建 data/curriculum.json 作为排课唯一真源：数组每项 { id, title, week, difficulty, guanzhiNo }。它取代「人工在 docs/03 填推荐学习周」「docs/04 手编周表」两套来源。
- 把 曹刿论战、邹忌讽齐王纳谏 两篇★级课内起步篇补进第1–2周（它们目前完全缺失），并相应调整该周其余篇目数量。
- build-data.js 改为从 curriculum.json 生成 index.json；docs/03、docs/04 改为由脚本生成或与 curriculum 对账。
- 新增 scripts/validate-curriculum.js：校验每篇恰好排一周、难度表与周表 week 一致、无重复无缺漏、总篇数三处文档一致（锁定唯一总数，修正 222/210+/177 不一致）。
- 验收：node scripts/validate-curriculum.js 通过；首页进度分母与 curriculum 总数一致。

━━ Phase 6 · 原文独立成底本（对应问题6）
- 新建 content/raw/{id}-{篇名}.txt，只存原文（可含 <ruby> 拼音与 / 节奏标记），作为原文唯一底本。
- build-data.js 原文改从 content/raw 读取；教学内容仍来自 content/samples。保证迁移后 fullTextPlain 与现网逐字一致（迁移前后做 diff 验收）。

━━ Phase 7 · 文章页左右分栏（对应问题7）
- js/article.js + css/article.css：桌面 ≥1024px 改为两栏——
  左栏：原文 + 功能按键(拼音/节奏/朗读/字号)，position: sticky 固定；
  右栏：故事导读/翻译/逐句精读/想一想/练习/词汇，可独立滚动。
  <1024px 回退单栏堆叠，原文置顶、工具条可折叠/吸顶。
- 不改变现有数据结构，仅调整 DOM 结构与 CSS。
- 验收：桌面端滚动右栏时左侧原文保持可见；移动端单栏正常。

每个 Phase 完成后，请输出：改了哪些文件、validate 结果、如何手动验收，等我确认后再进入下一个 Phase。
```
