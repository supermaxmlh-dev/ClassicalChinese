# Codex Prompt · 新反馈邮件通知（Resend）

> 目标：有人提交反馈时，站长收到一封**邮件提醒**，不用天天去后台刷。
>
> 现状：`api/shared/feedback.js` 里的 `sendWebhook()` 只会 POST 一段**固定 JSON**（`{subject, action, feedback, contact}`），而邮件服务（Resend）要求的是 `{from, to, subject, html}`——**格式对不上，直接配环境变量会失败**。本次给它加一个「输出格式」分支。

## 一、新增/使用的环境变量（务必在代码中读取并写进部署说明）

| 变量 | 是否必填 | 默认 | 说明 |
|---|---|---|---|
| `FEEDBACK_WEBHOOK_FORMAT` | 否 | `generic` | 输出格式：`email` = 按邮件服务格式发；`generic` = 保持现状的通用 JSON（**默认，向后兼容**） |
| `FEEDBACK_WEBHOOK_URL` | 是（用邮件时） | — | 邮件接口地址，Resend 为 `https://api.resend.com/emails` |
| `FEEDBACK_WEBHOOK_TOKEN` | 是（用邮件时） | — | Resend API Key（`re_xxx`），已有逻辑会作为 `Authorization: Bearer` 发送，复用即可 |
| `FEEDBACK_EMAIL_TO` | 是（`format=email` 时） | — | 收件人（站长邮箱），支持逗号分隔多个 |
| `FEEDBACK_EMAIL_FROM` | 否 | `观止学堂 <onboarding@resend.dev>` | 发件人；未验证自有域名时用 Resend 提供的测试发件地址 |
| `FEEDBACK_EMAIL_SUBJECT_PREFIX` | 否 | `[观止学堂]` | 邮件主题前缀，便于收件箱过滤 |

**校验要求**：`format=email` 但缺 `FEEDBACK_WEBHOOK_URL`/`FEEDBACK_WEBHOOK_TOKEN`/`FEEDBACK_EMAIL_TO` 时，**跳过发送并记一条 warn 日志**，绝不可抛错影响用户提交。

## 二、代码改动（`api/shared/feedback.js` 的 `sendWebhook`）

1. 读 `FEEDBACK_WEBHOOK_FORMAT`（不区分大小写，默认 `generic`）。
2. `generic` → 保持现有请求体不变（不要破坏已有用法）。
3. `email` → 请求体改为邮件服务格式：
   ```json
   {
     "from": "<FEEDBACK_EMAIL_FROM>",
     "to": ["<FEEDBACK_EMAIL_TO 拆分后的数组>"],
     "subject": "<前缀> 新反馈：<类型中文名>",
     "html": "<正文，见第三节>"
   }
   ```
   请求头沿用现有 `Content-Type: application/json` + `Authorization: Bearer <FEEDBACK_WEBHOOK_TOKEN>`。
4. 失败处理沿用现状：`sendWebhook` 抛出的错误由上层 `try/catch` 收集进 `errors`，**用户提交仍返回成功**，不因通知失败而失败。

## 三、邮件正文（隐私优先，务必照做）

**不要在邮件里带提交者的联系方式**——那可能是未成年人的邮箱，不该落在邮件与收件箱中。正文只包含：

- 反馈类型（把 `original/pinyin/annotation/quiz/ui/privacy/other` 映射成中文，如"原文错误/拼音/注释/练习题/界面/隐私/其他"）
- 相关页面或篇目（`page` / `articleId`）
- **内容摘要**（截断到约 200 字，HTML 转义，防注入）
- 提交时间
- 一句「详情与联系方式请到站长后台查看」+ 后台地址（如站点域名 + `/pages/admin.html`）

> `contact` 字段**只存库、只在后台可见**，不进邮件。

## 四、配置步骤（写进 `README.md` 或 `docs/22` 的 Phase 2 小节）

1. resend.com 注册 → **API Keys** → 新建，复制 `re_xxx`（只显示一次）。
2. 发件人：未验证域名时用 `onboarding@resend.dev`；有自有域名后到 **Domains** 验证再替换 `FEEDBACK_EMAIL_FROM`。
3. Azure 门户 → 该 Static Web App → 环境变量，添加第一节中的变量；保存后**重新部署/重启**生效。
4. 免费额度约 3000 封/月、100 封/天，本站反馈量足够。

## 五、验收

- **未配置任何 webhook 变量**：提交反馈一切正常，不发邮件、不报错（回归验证，别破坏现状）。
- **`FEEDBACK_WEBHOOK_FORMAT=generic`**（或不设）：请求体与改动前**完全一致**。
- **`FEEDBACK_WEBHOOK_FORMAT=email` 且变量齐全**：提交一条反馈 → 站长邮箱收到邮件；主题含前缀与类型；正文含类型/页面/摘要/时间与后台链接，**不含提交者联系方式**。
- **`format=email` 但缺 `FEEDBACK_EMAIL_TO`**：跳过发送 + warn 日志，用户提交仍成功。
- **发送失败（如 token 错误）**：用户端仍显示提交成功，错误只进服务端日志。
- `npm run build` 前端仍全绿（本次只动 `api/`）。
- `git commit`（如 `feat(feedback): 新反馈邮件通知（Resend），正文脱敏`）。

完成后请输出：改了哪些文件、新增环境变量清单、上述五种情形的实测结果、以及一封示例邮件的正文文本（确认无联系方式泄漏）。
