# Codex 修订 Prompt · 第二轮（Review 后）

> 第一轮 7 个 Phase 已验收通过：`npm run build` + `validate-data` + `validate-curriculum` 全绿，`data/articles` 无 `"略"`，拼音/节奏可同时显示，填空考点字加着重号、提示不再泄题，进度推进 bug 已修，`curriculum.json` 成为唯一排课源并补回曹刿论战/邹忌讽齐王纳谏。
>
> 本轮只解决 Review 复查发现的 3 个**未真正闭环**的问题。仍遵守：数据唯一真源、构建出错必须 throw、不静默兜底。

---

## 复查结论（先看这里）

| 项 | 状态 | 说明 |
|---|---|---|
| Phase 1 进度逻辑 | ✅ 通过 | `findCurrentWeek` 仅在整周完成时推进，地图四态（含「学习中 N/M」）正确 |
| Phase 2 拼音+节奏 | ✅ 通过 | 改为 `rhythmBreaks` 图层，两开关独立可组合，均作用于 `fullTextPlain` |
| Phase 3 加点 | ✅ 通过 | `dot-emphasis`（`text-emphasis: dot under`）渲染着重号，hint 留空 |
| Phase 4 校验门禁 | ✅ 通过 | ruby/rhythm 越界、答案为空或"略"、targetChar 与题干一致 等均拦截 |
| Phase 5 单一排课源 | ✅ 通过 | `curriculum.json` 驱动 index，曹刿(第1周)/邹忌(第2周)已补 |
| Phase 7 左右分栏 | ✅ 通过 | 左栏原文+功能键 sticky，右栏其余内容，<1024px 塌叠 |
| **A. 原文双源** | ⚠️ 未根除 | `content/raw/*.txt` 是构建真源，但 14 个 `samples/*.md` 仍保留整段 `## 原文`，且**未做一致性校验**——在 samples 改原文会被静默忽略 |
| **B. 选择题解析** | ⚠️ 形式过关 | 缺解析时自动套用模板「该选项符合原文语境，其他选项不符合本句含义」，凑满 10 字过门禁，但无实际讲解价值 |
| **C. 目标 222 vs 已排 179** | ⚠️ 待拍板 | 进度分母=222，但只排了 179 篇且校验把 222 写死 → 进度条永远到不了 100%、「观止学者」无法达成 |

---

## 修订任务

### Phase A · 根除原文双源（P1）

**问题**：`scripts/build-data.js parseArticle` 的原文取自 `content/raw/{id}-{title}.txt`，但 `content/samples/*.md` 仍各自保留完整的 `## 原文` 段落（因为 `storyIntro` 用 `## 原文` 作为「## 故事导读」的结束分隔符）。两份原文并存且无人对账——在 samples 里校对原文会被构建静默忽略，正是 Phase 6 想消除的隐患。注：`朗读指导` 已由 `parseRhythmBreaks` 校验与原文逐字一致，但 samples 的 `## 原文` 正文本身没有任何一致性检查。

**要求（二选一，推荐 1）：**

1. **保留 samples 的 `## 原文` 作为人类可读副本，但加构建期断言**：在 `parseArticle` 中，把 samples 的 `## 原文` 段也 `stripRubyToPlainAndAnnotations` 成纯文本，与 raw 的 `fullTextPlain` 比对，**不一致即 throw**（提示哪一篇、第几个字不符）。这样两处永远同步，改任一处都会被发现。
2. 或**让 samples 不再承载原文**：把 `## 原文` 正文删空（仅保留标题作分隔符），并把 `storyIntro` 的结束分隔符改为下一个稳定标题；原文只存在于 `content/raw`。

**验收**：故意改坏某篇 samples 的 `## 原文` 一个字 → `npm run build` 报错指出该篇；改回后通过。

### Phase B · 让选择题解析真正有料（P2）

**问题**：`build-data.js`（约 245 行）在源 md 未提供解析时，套用通用模板凑字数，`validate-data.js` 的 `hanCount(explanation) < 10` 门禁因此形同虚设。

**要求：**
- `validate-data.js`：把「自动模板解析」视为不合格——可维护一个 `GENERIC_EXPLANATION_FRAGMENTS` 列表（如「符合原文语境，其他选项不符合本句含义」），命中即报错，要求改用真实解析。
- `build-data.js`：源 md 缺真实解析时**不要套模板兜底，直接 throw**，提示补写。
- 在 `content/samples/*.md` 的「## 参考答案」为每道选择题补一句**具体**解析（讲清为什么对、易错项错在哪），重建至全绿。

**验收**：`grep -r "其他选项不符合本句含义" data/articles` 无结果；`validate-data` 全绿。

### Phase C · 明确目标篇数与进度口径（P1，需先定方向）

**问题**：`validate-curriculum.js` 把 `targetArticleCount` 写死为 222，但 `curriculum.json` 实际只排了 179 篇，`progress.js getStats` 以 222 为分母。结果：完成上限 179/222≈81%，第 52 周「观止学者（满分/全部完成）」在数学上不可达。

**先定方向（请在两者中选一，默认建议 B）：**
- **方案 A：凑满 222**。把剩余 43 个目标篇排进 52 周课表（可作为各周「选学/延伸」），使 planned=222。
- **方案 B（推荐）：以「已排课程」为完成口径**。保留 222 作为「全书总量」展示，但**进度与称号按 `plannedArticleCount`（当前 179）计算**，让 100% 与「观止学者」可达成。

**按方案 B 的改法：**
- `js/progress.js getStats`：完成百分比、阶段进度、「观止学者」达成判定改用 `index.plannedArticleCount` 为分母；首页可同时展示「已学 X / 已排 179（全书 222）」。
- `validate-curriculum.js`：放开「必须等于 222」的硬断言，改为校验 `targetArticleCount >= plannedArticleCount` 且 `plannedArticleCount === articles.length`；保留三处文档（index/status/curriculum）数字自洽的校验。
- 文档 `01/03/04` 中「222 / 约210+ / 179」三个口径统一为一处定义、其余引用它。

**验收**：把 179 篇全部标记完成后，进度=100% 且解锁「观止学者」；`validate-curriculum` 全绿。

---

每个 Phase 完成后输出：改了哪些文件、`npm run build` 结果、如何手动验收，等我确认再进入下一个。Phase C 请先告诉我你选 A 还是 B，再动手。
