# ClassicalChinese

中小学生文言文学习和练习工具。当前站点名为“观止学堂”，定位为中小学经典文言文学习平台：52 周主线精学《古文观止》名篇，另设“拓展阅读”收录课内文言名篇。

项目使用纯静态 HTML、CSS 和原生 JavaScript 构建，内容从 `data/` 目录中的 JSON 文件加载，学习进度保存在浏览器 Cookie 中。

## 本地运行

```bash
npm run build:data
npm start
```

打开 `http://localhost:8080` 访问首页。

`npm start` 会同时启动静态页面和本地 `/api/feedback`，用于本地验证反馈留言功能。学习进度依赖浏览器 Cookie 持久化。请通过 `npm start` 启动的本地 HTTP 服务或线上 Azure 地址访问，不要用 `file://` 直接打开 HTML 文件，否则多数浏览器不会稳定保存 Cookie。

## 当前内容

- 52 周主线学习地图来自 `data/curriculum.json`
- 当前已完成 95 篇文章内容，其中 82 篇计入《古文观止》主线，13 篇移入拓展阅读
- 主要页面包括学习地图、拓展阅读、周学习页、文章详情页、词汇宝库、学习进度、反馈留言、阶段测评和关于页面
- 内容覆盖台账生成到 `data/content-status.json`

## 数据构建

运行 `npm run build:data` 会重新生成：

- `data/index.json`
- `data/articles/001.json` 至当前已补充文章 JSON
- `data/content-status.json`
- `data/vocab-categories.json`
- `data/reviews/review-13.json` 等阶段测评示例数据

## 部署

项目使用 Azure Static Web Apps 部署。推送到 `main` 后，workflow 会先运行：

```bash
npm run build
```

通过数据构建和校验后，再发布整个静态站点。

## 反馈后端

Phase 2 新增 Azure Static Web Apps Functions：`POST /api/feedback` 提交反馈，`GET /api/feedback` 按公开板开关读取已审核反馈，`DELETE /api/feedback` 用删除密码或站长口令软删除反馈，`PATCH /api/feedback` 供站长审核状态。学习功能仍本地优先；`/api` 不可用时，反馈页会提示暂不可用，不影响阅读、判分、进度和字典。

生产环境可选配置：

- `FEEDBACK_TABLE_SAS_URL`：Azure Table 的表级 SAS URL，用于持久化留言。
- `FEEDBACK_PUBLIC_BOARD`：公开留言板开关，默认不公开；设为 `on` 后只展示站长审核为 `visible` 的留言。
- `FEEDBACK_WEBHOOK_FORMAT`：通知格式，默认 `generic`；设为 `email` 时使用 Resend 邮件格式。
- `FEEDBACK_WEBHOOK_URL`：通用 webhook 地址；Resend 使用 `https://api.resend.com/emails`。
- `FEEDBACK_WEBHOOK_TOKEN`：webhook bearer token；邮件模式下填写 Resend API Key（`re_xxx`）。
- `FEEDBACK_EMAIL_TO`：邮件模式必填，站长收件邮箱；多个地址用英文逗号分隔。
- `FEEDBACK_EMAIL_FROM`：邮件发件人，默认 `观止学堂 <onboarding@resend.dev>`。
- `FEEDBACK_EMAIL_SUBJECT_PREFIX`：邮件主题前缀，默认 `[观止学堂]`。
- `FEEDBACK_HASH_SALT`：IP 哈希盐值，可选。
- `FEEDBACK_ADMIN_TOKEN`：站长删除/审核口令，可选。
- `FEEDBACK_RATE_LIMIT_MAX`：同一 IP 在窗口内最多提交次数，默认 `5`。
- `FEEDBACK_RATE_LIMIT_WINDOW_MS`：普通反馈限流窗口，默认 `600000`（10 分钟）。
- `ADMIN_RATE_LIMIT_MAX`：同一 IP 在窗口内最多输错站长口令次数，默认 `10`。
- `ADMIN_RATE_LIMIT_WINDOW_MS`：站长口令失败及管理操作限流窗口，默认 `600000`（10 分钟）。
- `ADMIN_OPS_RATE_LIMIT_MAX`：正确口令在窗口内最多管理操作次数，默认 `300`。

以上限流变量只接受正数；未设置、`NaN`、`0` 或负数都会回落到默认值。

### Resend 邮件通知

1. 在 Resend 的 **API Keys** 新建密钥并保存只显示一次的 `re_xxx`。
2. 未验证自有域名时使用 `onboarding@resend.dev`；验证域名后再修改 `FEEDBACK_EMAIL_FROM`。
3. 在 Azure Static Web App 的环境变量中设置：

```text
FEEDBACK_WEBHOOK_FORMAT=email
FEEDBACK_WEBHOOK_URL=https://api.resend.com/emails
FEEDBACK_WEBHOOK_TOKEN=re_xxx
FEEDBACK_EMAIL_TO=站长邮箱
FEEDBACK_EMAIL_FROM=观止学堂 <onboarding@resend.dev>
FEEDBACK_EMAIL_SUBJECT_PREFIX=[观止学堂]
```

4. 保存后重新部署或重启。Resend 免费额度通常约为每月 3000 封、每天 100 封，具体以 Resend 当前规则为准。

邮件只含反馈类型、页面、内容摘要、提交时间和后台链接，不包含提交者联系方式。通知配置缺失或发送失败只记录服务端警告，不影响留言入库。

本地后端自测：

```bash
npm run test:feedback
```
