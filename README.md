# ClassicalChinese

小学生文言文学习和练习工具。当前站点名为“观止学堂”，面向小学四年级学生，用 52 周学习地图组织《古文观止》经典篇章。

项目使用纯静态 HTML、CSS 和原生 JavaScript 构建，内容从 `data/` 目录中的 JSON 文件加载，学习进度保存在浏览器 Cookie 中。

## 本地运行

```bash
npm run build:data
npm start
```

打开 `http://localhost:8080` 访问首页。

学习进度依赖浏览器 Cookie 持久化。请通过 `npm start` 启动的本地 HTTP 服务或线上 Azure 地址访问，不要用 `file://` 直接打开 HTML 文件，否则多数浏览器不会稳定保存 Cookie。

## 当前内容

- 52 周学习地图来自 `docs/04-52周课程表.md`
- 前 22 篇文章来自 `content/samples/`
- 主要页面包括学习地图、周学习页、文章详情页、词汇宝库、学习进度、阶段测评和关于页面
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
