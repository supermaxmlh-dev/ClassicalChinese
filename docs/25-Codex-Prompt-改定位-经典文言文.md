# Codex Prompt · 把非《古文观止》篇目移入「拓展阅读」+ 定位表述校正

> 决策：**保留全部内容不删**，但把已核实**不属《古文观止》的篇目移出 52 周主线，归入独立的「拓展阅读」板块**；主线 52 周只保留《古文观止》篇目，定位表述相应改准确。本轮**不改任何原文/教学内容**，只调整分类归属（周次/板块）、新增拓展阅读页与出处标签、改定位文案。

## 一、要移入「拓展阅读」的篇目（已核实，直接采用，勿再自行判定）

**13 篇确认不属《古文观止》→ 移入拓展阅读：**
`003 记承天寺夜游、004 诫子书、005 爱莲说、009 湖心亭看雪、011 小石潭记、012 与朱元思书、030 右溪记、038 寒花葬志、046 柳敬亭说书、050 西湖七月半、053 袁家渴记、061 项脊轩志、084 陶庵梦忆序`

**2 篇存疑，本轮先不动、留在主线并标待核**（人工终审后再决定是否移入）：`002 答谢中书书、072 始得西山宴游记`。

> **id 保持不变（001–095），不要重编号**（避免破坏链接、cookie 进度）。只改它们的归属，不动 id、原文、教学内容。

## 二、数据层（单一真源 = `data/curriculum.json`）

1. 给每篇加字段 `collection`：`"古文观止"`（默认）或 `"拓展阅读"`。上面 13 篇设为 `"拓展阅读"`。
2. 拓展阅读的 13 篇**退出 52 周排课**：其 `week` 置为 `null`（或移入约定的 `week: 0` 拓展桶），使其不再出现在任何主线周。
3. 002、072 保持 `collection:"古文观止"` 且加 `guanzhi:"pending"` 标记（仅用于展示"出处待核"，仍留在原周）。
4. `scripts/build-data.js`：
   - 主线 `index.json.weeks` 只含 `collection==="古文观止"` 且有 `week` 的篇目；
   - 新增 `index.json.extendedReading = [ids...]` 汇总拓展阅读篇目；
   - `collection`/`guanzhi` 透传进 `data/articles/*.json`；
   - `content-status.json` 分别统计"主线《古文观止》"与"拓展阅读"两组数量。
5. `scripts/validate-curriculum.js`：`collection==="拓展阅读"` 的篇免除"week 必须属于 52 周"校验；`plannedArticleCount` 只计主线《古文观止》篇；新增校验：拓展阅读篇 `week` 为空、主线篇 `week∈1..52`。

## 三、前端

- 新增 `pages/extend.html` + 对应 JS：列出 `index.json.extendedReading` 的篇目卡片（篇名/作者/难度/字数），点击进 `article.html?id=`。导航各页加「拓展阅读」入口。
- 文章页头部标签：
  - 主线 → 「选自《古文观止》」；`pending` → 「出处待核」；
  - 拓展阅读篇 → 「拓展阅读 · 课内名篇（非《古文观止》）」。
- 首页 52 周地图/周学习页：这 13 篇不再出现在原周（相关周篇目自然变少，见第五节）。
- 进度：拓展阅读篇仍可标记完成（cookie），但**不计入** 52 周主线进度与阶段称号的达成分母（称号只看主线《古文观止》）。

## 四、定位文案（改准确，品牌名「观止学堂」保留）

`index.html`、`pages/about.html`、`README.md`、`package.json`、`docs/01-项目总体规划.md` 中，把口径改为：
**"中小学经典文言文学习平台——52 周主线精学《古文观止》名篇，另设『拓展阅读』收录课内文言名篇。"**
不再声称全部篇目出自《古文观止》。

## 五、主线周次再均衡（移出 13 篇后，把剩余篇目摊平到各周）

移出 13 篇后主线剩 **82 篇**（含 002/072 待核）。目标：让各"教学周"篇目**尽量平均，每周 3–4 篇**（复习周 13、26 不排篇）。**用现有篇目重排即可，不新增内容。**

**规则（保持难度递增、阶段范围不变）：**
- **只在各阶段内部重排，不跨阶段搬篇**：
  - 第一阶段：现第 1–12 周的 **40 篇** → 仍分配到第 1–12 周（约 4 周×4 篇 + 8 周×3 篇）；
  - 第二阶段：现第 14–25 周的 **42 篇** → 仍分配到第 14–25 周（约 6 周×4 篇 + 6 周×3 篇）。
- **保序**：把每阶段的篇目按"现周次→现 id"的既有教学顺序排成一列，再顺次等分到各周，使难度**由易到难**不被打乱；每周内也按难度、再按原顺序排列。
- 复习周 **13、26 保持 0 篇**。
- **不动 id、原文、教学内容**；只改周次归属。

**落地：**
- 更新 `data/curriculum.json` 的 `week` 与各 sample 的 frontmatter `week`（两处必须一致）；
- 把 sample 文件名的 `weekNN` 前缀改为新周次（构建以 frontmatter 为准，文件名仅需与之保持一致）；
- 002、072 仍留主线、随其所在阶段一起参与均衡（仅额外带 `guanzhi:"pending"` 标签）。

## 六、约束与验收

- **不删除、不改写任何原文与教学内容**；不重编号；只改 `collection`/`week` 归属、加拓展页与标签、改定位文案。
- `npm run build`（build:data + build:dictionary + validate-*）**全绿**。
- 自查：
  ```bash
  node -e '
  const fs=require("fs");
  const idx=JSON.parse(fs.readFileSync("data/index.json","utf8"));
  const ext=idx.extendedReading||[];
  const inWeeks=(idx.weeks||[]).flatMap(w=>w.articleIds);
  console.log("拓展阅读篇数:",ext.length,"| 主线周内篇数:",inWeeks.length);
  const bad=ext.filter(id=>inWeeks.includes(id));
  console.log("既在拓展又在主线(应为空):",bad);'
  ```
  期望：**拓展阅读篇数 = 13**；这 13 篇**不再出现在任何主线周**（bad 为空）。
- **均衡自查**（每个教学周 3–4 篇、复习周 0 篇、主线合计 82）：
  ```bash
  node -e '
  const fs=require("fs");
  const idx=JSON.parse(fs.readFileSync("data/index.json","utf8"));
  let total=0, bad=[];
  for(const w of idx.weeks){const n=(w.articleIds||[]).length; total+=n;
    const review=[13,26].includes(w.week);
    if(review){ if(n!==0) bad.push("第"+w.week+"周应为复习(0篇) 实"+n); }
    else if(n<3||n>4) bad.push("第"+w.week+"周="+n+"篇");}
  console.log("主线合计:",total,"| 不达标周:",bad.length?bad:"无");'
  ```
  期望：**主线合计 = 82**；除第 13、26 周（0 篇）外，其余排了篇的教学周均为 **3–4 篇**，不达标周为「无」。
- 抽查文章页：003 记承天寺夜游 显示「拓展阅读 · 课内名篇」且首页/周页不再列出它；001 曹刿论战 显示「选自《古文观止》」且落在某个 3–4 篇的周里。
- `git commit`（如 `feat: 非古文观止篇目移入拓展阅读 + 主线周次均衡 + 定位校正`）。

完成后请输出：改了哪些文件、自查脚本数字、变薄的周清单、以及文章页三种标签的确认。
