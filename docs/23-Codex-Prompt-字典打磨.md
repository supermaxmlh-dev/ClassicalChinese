# Codex Prompt · 古文字典打磨（Phase 1 收尾）

> Phase 1 已生成 `data/dictionary.json`（427 条，pinyin 正确、检索与文章页接入均正常）。本次只做**数据质量打磨**，全部在 `scripts/build-dictionary.js` 里改生成逻辑，再 `npm run build` 重建；**不手改 `data/dictionary.json`**（生成物）。

## 一、要修的两个问题

1. **例句过长（约 34% 义项的 example 是整段原文）**
   - 现状：如「间」的例句直接搬了《袁家渴记》一整段（77 字）。
   - 改法：`build-dictionary.js` 生成 example 时，**只取"含该字的那一小句"**——以该字在原文中的位置为中心，向前后扩到最近的句读标点（。！？；，、：以及引号）为界，截出一个短句；若仍超长，限制在 **约 24 个汉字**以内（保留完整语义、不从词中间断）。目标：绝大多数 example ≤ 24 字。
   - 保留 `articleId/articleTitle` 出处不变，方便"查看出处"跳原文看完整语境。

2. **部首字段全空（427 条 radical 均为 ""）**
   - 二选一（推荐 A）：
     - **A．去掉该字段**：`build-dictionary.js` 不再输出 `radical`，前端/校验也不引用它，避免展示空字段。
     - **B．填充部首**：接入一份"字→部首"映射（如内置一个常用字部首表或依赖库）为每字填 `radical`；拿不准的留空但**不得全空**。
   - 若选 A，同时确认 `pages/dict.html`/`js/dict.js` 未展示 radical（无残留空行）。

## 二、顺带优化（低成本，可一并做）

- **同字义项去重**：常见字（之、以、而、其…）在多篇出现，会产生多条 `def` 相同的义项。对**同一字下 `def` 完全相同**的义项去重，只保留 1–2 条**不同出处**的代表（每条仍带各自 example/出处），避免长列表重复刷屏。
- 不改变 schema 其它字段与 `entries` 顺序规则。

## 三、可选加固校验（`scripts/validate-dictionary.js`）

- 增加：任一义项 `example` 去空白后长度 **> 40** 即报错（防止再次退化为整段）。
- 若选方案 A（去 radical），删除任何对 radical 的校验/引用；若选 B，可校验 radical 非全空。

## 四、流程与验收

1. 改 `scripts/build-dictionary.js`（+ 视情况 `validate-dictionary.js`、`js/dict.js`），运行 `npm run build`（build:data + build:dictionary + validate-*）**全绿**。
2. 自查：
   ```bash
   node -e '
   const d=JSON.parse(require("fs").readFileSync("data/dictionary.json","utf8"));
   let long=0,tot=0,emptyRad=0;
   for(const e of d.entries){ if(!e.radical)emptyRad++;
     for(const s of e.senses){ tot++; if((s.example||"").replace(/\s/g,"").length>24) long++; } }
   console.log("义项总数",tot,"| 例句>24字",long,"| 空radical条目",emptyRad);'
   ```
   期望：**例句>24字 的数量大幅下降到接近 0**；若选方案 A，`radical` 字段已不存在（脚本读到 undefined 视为 0 或改判断）。
3. 打开 `pages/dict.html` 抽查几个常见字（之、以、间、食），例句是短句、无重复刷屏、无空部首行。
4. `git commit`（如 `refactor(dict): 例句截短 + 去除空部首字段`）。

完成后请输出：改了哪些文件、上面自查脚本的数字、`npm run build` 结果。
