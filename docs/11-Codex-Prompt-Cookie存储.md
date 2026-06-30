# Codex Prompt · 学习进度改用 Cookie 存储

> 目标：把学习进度的存储后端从 localStorage 改为**浏览器 Cookie**。进度 JSON 存进一个 cookie，任何更改（做题、标记完成、改名、词汇等）即时写回 cookie，导入/导出也以 cookie 为唯一真源，项目运行时只从 cookie 读取。
>
> 现状（先读懂，便于做最小改动）：存储已**完全封装在 `js/progress.js`** 的两个底层函数里——`getProgress()`（读）和 `saveProgress()`（写）。其余模块（`quiz.js`/`article.js`/`vocab.js`/`map.js`/`app.js`）一律通过 `Guanzhi.Progress.*` API 访问，**不直接碰存储**。因此本次只需替换 progress.js 里的存储原语 + 导入/导出，不要改其他模块的调用方式。

---

## 一、硬约束（务必处理，否则会出 bug）

1. **单 cookie 容量上限约 4KB**。本项目满进度时 `completedArticles`（最多 222 项）+ `quizScores`（最多 222 项）+ `completedWeeks` 等，按原始 JSON + URL 编码会**超过 4KB 导致写入静默失败**。→ 因此 **cookie 内必须存「紧凑编码」**（见第三节），导出文件仍存完整可读 JSON。
2. **必须 `encodeURIComponent`**：cookie 值不能含 `; , 空格 非ASCII`，而数据里有中文 `studentName`，写入前编码、读取后解码。
3. **过期时间**：设 `max-age` 为接近浏览器上限（约 400 天 = 34560000 秒），并在**每次保存时重设**（滚动续期），否则会变成会话 cookie、关浏览器即丢。
4. **作用域**：`path=/; SameSite=Lax`，保证 `index.html` 与 `pages/*.html` 都能读到同一个 cookie。
5. **协议限制**：`document.cookie` 在 `file://` 下多数浏览器不持久化。项目须经 `npm start`（http）或 Azure 访问；请在 README 注明不要用 file:// 直接打开。

---

## 二、任务

### Phase 1 · 用 Cookie 替换存储原语

在 `js/progress.js` 中：
- 新增 cookie 工具：`readCookie(name)`、`writeCookie(name, value)`（含 `encodeURIComponent`、`path=/`、`max-age`、`SameSite=Lax`）、`deleteCookie(name)`。
- 常量：`const COOKIE_NAME = "guanzhi_progress";`（保留旧 `STORAGE_KEY` 导出别名以防引用，但内部不再用 localStorage）。
- 改写 `getProgress()`：**每次都从 `document.cookie` 实时读取**（不缓存），解码 → `expand()`（解紧凑编码）→ `normalizeProgress()`；读不到或解析失败时返回 `createDefaultProgress()`。
- 改写 `saveProgress(progress)`：`normalizeProgress` → 更新 `lastVisit` → `compact()` → `encodeURIComponent(JSON.stringify(...))` → 写 cookie；写入前做**容量检查**（见下）；保留现有 `window.dispatchEvent("guanzhi:progress-change")`。
- **删除所有 localStorage 读写**。`updateProgress`、`markArticleComplete`、`saveQuizScore`、`passReview` 等上层逻辑保持不变（它们最终都调 `saveProgress`，做题/标记完成自然会即时写 cookie）。

### Phase 2 · 紧凑编码（控制在 4KB 内）

提供一对纯函数 `compact(progress)` / `expand(compactObj)`，cookie 只存紧凑形，导出文件存完整形：

| 完整字段 | 紧凑键 | 编码方式 |
|---|---|---|
| version | v | 原样 |
| studentName | n | 原样（字符串） |
| completedArticles `["001","014"]` | a | 整数数组 `[1,14]`（去前导零，读出时 `padStart(3,"0")`） |
| completedWeeks | w | 整数数组 |
| quizScores `{"001":85,"review-13":70}` | q | `{"1":85,"r13":70}`（文章键用整数，review 键用 `r+周数`） |
| reviewPassed | r | 整数数组 |
| badges | b | 原样（数量少，保留中文名即可） |
| vocabLearned | vl | 整数 |
| currentWeek | cw | 整数 |
| lastVisit/createdAt/exportedAt | lv/ca/ea | 原样（日期串） |

`expand` 为其逆运算，输出必须能直接喂给现有 `normalizeProgress()`。

### Phase 3 · 容量保护

- 写 cookie 前计算最终编码长度，若 `> 3800` 字节：
  - `console.warn` 并 `window.dispatchEvent(new CustomEvent("guanzhi:progress-too-large"))`；
  - **仍尝试写入**（不要丢数据），但在 `progress.html` 顶部显示一条提醒：「进度数据较大，建议导出备份」。
- 这样即便逼近上限也不会静默失败无感知。

### Phase 4 · 导入/导出以 Cookie 为真源

- `exportProgress()`：从 cookie 读当前进度（完整形）→ 下载为可读 JSON 文件（保留现有文件名 `{姓名}-观止学堂进度-{日期}.json` 与 `exportedAt` 写回逻辑）。文件用**完整字段**（非紧凑），便于人读与跨版本兼容。
- `importProgress(file)`：解析文件 → 校验 `version` 与 `completedArticles` 合法 → `saveProgress()` 写入 cookie（自动转紧凑形）。导入即生效，无需刷新。
- 二者都不再触碰 localStorage。

### Phase 5 · 一次性迁移 + 清理

- 在 `progress.js` 初始化时执行一次迁移：**若 cookie 为空且 `localStorage["guanzhi_progress"]` 存在**，将其解析后 `saveProgress` 到 cookie，然后 `localStorage.removeItem` 清掉，避免老测试数据丢失。
- 迁移只跑一次；之后运行时只读 cookie。

---

## 三、验收标准

1. 做一道选择题 / 标记完成 / 改学生姓名后，打开浏览器 DevTools → Application → Cookies，能看到 `guanzhi_progress` 值随之变化；刷新页面进度保留。
2. 关闭并重开浏览器，进度仍在（验证 max-age 生效，非会话 cookie）。
3. 跨页（首页 ↔ 文章页 ↔ 进度页）读到的是同一份进度（path=/ 生效）。
4. 全站 `grep -rn "localStorage" js/` 仅可能残留在「迁移」一处的 `getItem/removeItem`，无其他读写。
5. 导出得到可读 JSON 文件；清空 cookie 后导入该文件，进度完整恢复且 cookie 被重新写入。
6. 构造一份「满进度」假数据（222 篇全完成 + 222 条 quizScores）写入：cookie 编码后长度 < 4096 字节，且能正确读回（验证紧凑编码有效）。
7. 现有 `npm run build`（build:data + validate）不受影响、仍全绿（本次不动数据与构建脚本）。

完成后请输出：改了哪些文件、上述 7 条逐条的验证结果，以及满进度时 cookie 的实际字节数。
