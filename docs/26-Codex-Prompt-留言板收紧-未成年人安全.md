# Codex Prompt · 反馈留言板收紧（未成年人安全 · 先审后显）

> 背景：Phase 2 反馈功能已上线。当前公开留言板是"**自动过滤未命中即立即公开**"（clean 内容默认 `visible`，仅命中敏感词才 `needs_review` 隐藏）。本站面向中小学生，公开板可能在人工审核前即时显示不当内容。请收紧为**默认先审后显**，并保留一条"纯后台模式"开关以便随时彻底关闭公开展示。

## 一、目标（方案 A 为默认，务必实现）

**方案 A · 先审后显（默认，必做）**：所有新提交的反馈**一律以 `needs_review` 入库**（不再有"clean 即 visible"的分支）；公开列表 `GET /api/feedback` **只返回 `visible`** 的项；只有站长通过 `PATCH`（带 `FEEDBACK_ADMIN_TOKEN`）把某条置为 `visible` 后，才在留言板出现。敏感词命中仍可**额外**标记/优先拦截，但"未命中"**不再**自动公开。

**方案 B · 纯后台模式（加开关，随时可切）**：新增环境变量 `FEEDBACK_PUBLIC_BOARD`（默认 `"off"`）。当为 `"off"` 时：
- `GET /api/feedback` 一律返回空列表（不对外展示任何留言）；
- 前端反馈页**不渲染"最近留言"列表**，只保留"提交反馈"表单（提交仍照常入库、发站长）；
- 当设为 `"on"` 时，才启用方案 A 的"先审后显"公开板。

> 即：默认 `FEEDBACK_PUBLIC_BOARD=off` → 根本不公开；若站长开启，也必须先审后显。两层保护。

## 二、后端改动（`api/shared/feedback.js`）

- `handlePost`：新建项 `status` 恒为 `"needs_review"`（去掉 `moderationFlags.length ? "needs_review" : "visible"` 的自动公开分支；敏感词命中可另存 `flags` 字段供站长参考）。
- 列表读取（file / Azure Table 两条路径都要改）：
  - 若 `process.env.FEEDBACK_PUBLIC_BOARD !== "on"` → 返回空数组；
  - 否则只返回 `status === "visible"`。
- 保留站长 `PATCH` 审核（`visible` / `needs_review` / `deleted`）与 `DELETE`，均需 `FEEDBACK_ADMIN_TOKEN`。
- 提交成功回执文案改为："已收到，将在审核后显示"（不要暗示已公开）。

## 三、前端改动（`js/feedback.js` / `pages/feedback.html`）

- 读 `GET /api/feedback`：为空时（含后台模式）**不渲染"最近留言"区块**，或显示"留言经审核后展示"。
- 提交成功提示改为"感谢反馈，将在审核后显示"。
- **公开反馈页只保留"删除我自己的留言（用本人删除密码）"**；把原来 `window.prompt` 里"站长可输入站长口令"的**管理员删除入口移除**，改到第五节的站长后台。
- 其余（离线/后端不可用时表单禁用+提示的本地优先逻辑）保持不变。

## 四、隐私与文案（顺带确认）

- 反馈页明示：面向未成年人，**请勿填写真实姓名/学校/住址等个人信息**；联系方式可不填；内容仅用于改进课程。
- 同意勾选文案点明"由监护人知情同意后提交"。

## 五、站长审核后台（管理员界面，本次新增）

**目标**：站长凭已有口令（`FEEDBACK_ADMIN_TOKEN`）进入一个后台页，集中完成审核（通过/退回/删除），并把管理员删除也收到这里。

### 5.1 入口与页面
- 站点页眉**右上角**加一个不显眼的「管理」小链接，指向新页 `pages/admin.html`（`js/admin.js`）。此链接不影响普通学习流程。
- 页面本身是静态的、公开可加载；**真正的权限由后端接口按口令校验**（页面本身不含任何密钥）。未输入正确口令时，页面只显示登录框，拉不到任何数据。

### 5.2 登录与口令处理
- 进入后先输入管理员口令；**口令只存在页面内存中**（不写 cookie、不写 localStorage），刷新需重输；每次调后端接口时在**请求头**（如 `X-Admin-Token: <口令>`）携带，**绝不放进 URL**（避免被日志记录）。
- 后端对口令做**服务端比对**（与 `FEEDBACK_ADMIN_TOKEN`，用 `crypto.timingSafeEqual` 等常量时间比较）；错误返回 401 + 通用文案；对管理接口加登录尝试**限流**，防暴力猜测。

### 5.3 审核功能（后端 `api/shared/feedback.js` 增/改）
- 新增管理员读取：`GET /api/feedback?admin=1`（须带正确 `X-Admin-Token`）→ 返回**含 `needs_review` 的全部**待审列表（普通 `GET` 仍只返回 `visible` 或按后台模式返回空）。
- 复用现有站长写操作，均要求管理员口令：
  - `PATCH`：将某条置为 `visible`（通过）/ `needs_review`（退回）/ `deleted`（删除）；
  - `DELETE`：删除某条。
- 前端后台页 `js/admin.js`：登录后拉取待审队列，逐条显示（内容、类型、页面、时间），每条提供「通过 / 退回 / 删除」按钮，调用上面接口；操作后刷新列表并提示结果。

### 5.4 安全边界（说明，务必遵守）
- 认证 = 单一站长口令（共享密钥模型），适合当前"单站长"场景；**口令仅经 HTTPS 传输、服务端比对、不入前端代码/URL/localStorage**。建议站长定期更换口令。
- 该口令与"用户删除自己留言的密码"是**两套东西**：普通用户用自设密码删自己的；站长用管理员口令在后台删任意条。
- 预留升级位（Phase 4）：将来接入 Azure SWA 内置登录后，可把口令校验换成校验 `x-ms-client-principal` 的 `admin` 角色，无需共享密码——接口形态保持不变，便于平滑切换。

## 六、验收

- **默认（未设 `FEEDBACK_PUBLIC_BOARD`）**：提交一条反馈后，`GET /api/feedback` 返回空、前端不显示任何留言；后端已入库（file/Table）。
- **开启公开板**（`FEEDBACK_PUBLIC_BOARD=on`）：新提交为 `needs_review`、公开列表看不到；站长在后台点「通过」置 `visible` 后才出现。
- 敏感词命中项即使在公开板开启时，未经站长通过也不显示。
- **站长后台**：
  - 打开 `pages/admin.html`，不输口令时拉不到任何待审数据；输错口令返回 401。
  - 输入正确口令后，`GET /api/feedback?admin=1` 能看到 `needs_review` 待审队列；点「通过/退回/删除」后状态正确变化并刷新。
  - 口令不出现在 URL、不写入 localStorage/cookie（刷新需重输）。
  - 公开反馈页已无"站长口令删除"入口，只能删自己的留言。
- 离线/后端不可用时反馈页优雅禁用，其余页面（阅读/判分/字典/进度）完全正常。
- `npm run build` 前端仍全绿（本次只动 `api/` 与 `js/feedback.js`、`pages/feedback.html`，新增 `pages/admin.html`、`js/admin.js`，不碰内容与数据）。
- `git commit`（如 `feat(feedback): 站长审核后台 + 默认先审后显，未成年人安全`）。

完成后请输出：改了哪些文件、默认关/开启公开板/站长后台三种情形的实测行为、`npm run build` 结果。
