# Phase 2 反馈后端说明

本阶段按 `docs/22-Roadmap-功能扩展执行计划.md` 的 Phase 2 实现首个后端：Azure Static Web Apps Functions `/api/feedback`。

## 功能

- `POST /api/feedback`：提交反馈。
- `GET /api/feedback`：默认公开板关闭时返回空；开启公开板后只读取站长审核为 `visible` 的反馈，不返回联系方式、IP 哈希、User-Agent 等私有字段。
- `GET /api/feedback?admin=1`：站长带 `X-Admin-Token` 读取待审核与已公开反馈。
- `DELETE /api/feedback`：用删除密码或站长口令软删除反馈。
- `PATCH /api/feedback`：站长调整状态，支持 `visible`、`needs_review`、`deleted`。
- 前端页面：`pages/feedback.html`。
- 离线或 `/api` 不可用时：反馈表单禁用并提示，阅读、判分、进度、字典不受影响。

## 隐私与防滥用

- 联系方式可选，仅支持邮箱。
- 不要求真实姓名、年级、学校等身份信息。
- 拦截身份证、住址、密码等敏感信息。
- 提交时可选删除密码；后端只保存 PBKDF2 哈希和盐，不保存明文。
- 所有新提交内容均进入 `needs_review`，默认不公开展示。
- 命中 `data/moderation-keywords.json` 的内容额外记录审核标记。
- 支持 `parentId` 回复，公开列表按父子关系展示。
- 简单内存限流：同一 IP 哈希 10 分钟最多 5 次。
- 蜜罐字段拦截机器提交。

## 存储与邮件配置

默认本地文件存储用于本地/预览自测。生产环境建议至少配置以下之一：

- `FEEDBACK_TABLE_SAS_URL`：Azure Table 表级 SAS URL，持久化留言板。
- `FEEDBACK_PUBLIC_BOARD`：公开留言板开关，默认关闭；设为 `on` 时仍只展示站长审核通过的留言。
- `FEEDBACK_WEBHOOK_FORMAT`：通知格式，默认 `generic`；`email` 使用 Resend 邮件格式。
- `FEEDBACK_WEBHOOK_URL`：通用通知地址；Resend 为 `https://api.resend.com/emails`。
- `FEEDBACK_WEBHOOK_TOKEN`：通用 Bearer Token；邮件模式下为 Resend API Key。
- `FEEDBACK_EMAIL_TO`：邮件模式必填的站长收件邮箱，多个地址用英文逗号分隔。
- `FEEDBACK_EMAIL_FROM`：邮件发件人，默认 `观止学堂 <onboarding@resend.dev>`。
- `FEEDBACK_EMAIL_SUBJECT_PREFIX`：邮件主题前缀，默认 `[观止学堂]`。
- `FEEDBACK_HASH_SALT`：IP 哈希盐值，可选。
- `FEEDBACK_ADMIN_TOKEN`：站长删除/审核口令。只放 Azure Functions 环境变量，不写进仓库。
- `FEEDBACK_RATE_LIMIT_MAX`：普通反馈提交上限，默认每个窗口 `5` 次。
- `FEEDBACK_RATE_LIMIT_WINDOW_MS`：普通反馈限流窗口，默认 `600000` 毫秒。
- `ADMIN_RATE_LIMIT_MAX`：站长口令失败上限，默认每个窗口 `10` 次。
- `ADMIN_RATE_LIMIT_WINDOW_MS`：站长管理限流窗口，默认 `600000` 毫秒。
- `ADMIN_OPS_RATE_LIMIT_MAX`：正确口令的管理操作宽松上限，默认每个窗口 `300` 次。

限流变量只接受正数；非法值自动使用默认值。

不在仓库中保存任何密钥、连接串或邮件服务 token。

## 验收

```bash
npm run test:feedback
npm run build
```
