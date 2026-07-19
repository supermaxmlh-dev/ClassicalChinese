# ClassicalChinese

中小学生文言文学习和练习工具。当前站点名为“观止学堂”，定位为中小学经典文言文学习平台：52 周主线精学《古文观止》名篇，另设“拓展阅读”收录课内文言名篇。

项目使用纯静态 HTML、CSS 和原生 JavaScript 构建，内容从 `data/` 目录中的 JSON 文件加载，学习进度保存在浏览器 Cookie 中。

## 本地运行

```bash
npm run build:data
npm start
```

打开 `http://localhost:8080` 访问首页。

学习进度依赖浏览器 Cookie 持久化。请通过 `npm start` 启动的本地 HTTP 服务或线上 Azure 地址访问，不要用 `file://` 直接打开 HTML 文件，否则多数浏览器不会稳定保存 Cookie。

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

Phase 2 新增 Azure Static Web Apps Functions：`POST /api/feedback` 提交反馈，`GET /api/feedback` 读取公开反馈列表，`DELETE /api/feedback` 用删除密码或站长口令软删除反馈。学习功能仍本地优先；`/api` 不可用时，反馈页会提示暂不可用，不影响阅读、判分、进度和字典。

生产环境可选配置：

- `FEEDBACK_TABLE_SAS_URL`：Azure Table 的表级 SAS URL，用于持久化留言。
- `FEEDBACK_WEBHOOK_URL`：可转发到邮件/自动化服务的 webhook。
- `FEEDBACK_WEBHOOK_TOKEN`：webhook bearer token，可选。
- `FEEDBACK_HASH_SALT`：IP 哈希盐值，可选。
- `FEEDBACK_ADMIN_TOKEN`：站长删除/审核口令，可选。

本地后端自测：

```bash
npm run test:feedback
```
