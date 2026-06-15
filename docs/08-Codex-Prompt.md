# Codex 开发提示词

> 以下内容可直接复制粘贴到 VS Code 中的 Codex（Claude）作为初始 prompt 使用。
> 建议将本项目 `docs/` 目录下的文档作为上下文一同提供给 Codex。

---

## 使用方式

1. 在 VS Code 中打开项目根目录
2. 将下方 prompt 完整粘贴给 Codex
3. 后续按 Phase 分步推进，每完成一个 Phase 做一次 git commit

---

## Prompt 正文

```
你是一位资深前端工程师，现在需要从零开始构建一个叫做"观止学堂"的文言文学习网站。请严格按照以下要求进行开发。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
一、项目概述
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

项目名称：guanzhi-xuetang（观止学堂）
用途：面向小学四年级学生的《古文观止》文言文学习平台
学习周期：52周，每周3-4篇，覆盖222篇古文，从易到难排列
技术栈：纯静态 HTML + CSS + 原生 JavaScript（不使用任何框架）
代码管理：GitHub
部署目标：Azure Static Web Apps
内容来源：预构建的 JSON 数据文件（data/ 目录）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
二、项目目录结构
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

请严格按此结构创建文件：

guanzhi-xuetang/
├── index.html                     # 首页（52周学习地图）
├── css/
│   ├── variables.css              # CSS 变量（配色、字体、间距）
│   ├── main.css                   # 全局样式、组件样式
│   ├── article.css                # 文章详情页样式
│   ├── quiz.css                   # 练习题样式
│   └── responsive.css             # 响应式断点（手机/平板/桌面）
├── js/
│   ├── app.js                     # 入口：初始化、路由、全局事件
│   ├── progress.js                # 进度管理（LocalStorage + 导出/导入）
│   ├── article.js                 # 文章详情页渲染
│   ├── quiz.js                    # 练习题交互与评分
│   ├── vocab.js                   # 词汇宝库
│   ├── map.js                     # 首页学习地图渲染
│   └── utils.js                   # 工具函数（fetch封装、DOM操作、日期等）
├── data/
│   ├── index.json                 # 总目录（52周计划、4个阶段、文章ID映射）
│   ├── vocab-categories.json      # 词汇分类体系
│   ├── articles/
│   │   ├── 001.json ~ 222.json   # 每篇文章完整数据
│   └── reviews/
│       ├── review-13.json         # 4次阶段测评题库
│       ├── review-26.json
│       ├── review-39.json
│       └── review-52.json
├── pages/
│   ├── week.html                  # 每周学习页（?week=N）
│   ├── article.html               # 文章详情页（?id=NNN）
│   ├── vocab.html                 # 词汇宝库
│   ├── progress.html              # 学习进度 + 导出/导入
│   ├── review.html                # 阶段测评（?week=13/26/39/52）
│   └── about.html                 # 关于本站
├── images/
│   ├── articles/                  # 文章配图（NNN-main.jpg）
│   ├── badges/                    # 阶段称号图（badge-1~4.jpg）
│   └── bg/                        # 背景纹理
├── staticwebapp.config.json       # Azure Static Web Apps 路由配置
├── .github/
│   └── workflows/
│       └── azure-static-web-apps.yml  # GitHub Actions CI/CD
├── package.json                   # 项目元数据（无运行时依赖）
└── README.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
三、视觉设计规范
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3.1 CSS 变量（写入 variables.css）：

:root {
  /* 配色 */
  --primary: #8B4513;
  --primary-light: #D2B48C;
  --accent: #C41E3A;
  --bg-main: #FFF8F0;
  --bg-card: #FFFFFF;
  --bg-text: #F5F0E8;
  --text-primary: #2C1810;
  --text-secondary: #5C4033;
  --text-light: #8B7355;

  /* 难度色 */
  --diff-1: #4CAF50;
  --diff-2: #8BC34A;
  --diff-3: #FFC107;
  --diff-4: #FF9800;
  --diff-5: #F44336;

  /* 状态色 */
  --completed: #4CAF50;
  --current: #2196F3;
  --locked: #BDBDBD;
  --correct: #E8F5E9;
  --wrong: #FFEBEE;
}

/* 暗色模式 */
@media (prefers-color-scheme: dark) {
  :root { /* 覆盖上述变量 */ }
}

3.2 字体：
- 文章标题：STKaiti / 楷体 / KaiTi, serif
- 原文正文：STSong / 宋体 / SimSun, serif; font-size: 1.25rem; line-height: 2
- UI 正文：PingFang SC / Microsoft YaHei, sans-serif; font-size: 1rem; line-height: 1.8

3.3 整体风格：古风水墨基调，米黄纸张感背景，暖色调，卷轴感布局。
    面向小学生，界面要清晰简洁，字号偏大，交互区域充足。

3.4 响应式断点：
- 桌面 ≥1024px：双栏，侧边注释
- 平板 768-1023px：单栏，注释弹窗
- 手机 <768px：单栏，字号增大，注释底部抽屉

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
四、核心页面功能详述
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【首页 index.html — 学习地图】
- 顶部：网站名"观止学堂" + 导航链接（词汇宝库、学习进度）
- 进度条：已学 X/222 篇，百分比
- 四个阶段区块（启蒙期1-13周/成长期14-26周/提升期27-39周/突破期40-52周），每区块不同颜色
- 每周为一个可点击节点，显示状态：✅已完成 / 🔵进行中 / 🔒未解锁
- 点击节点跳转 pages/week.html?week=N
- 复习周（13/26/39/52）用特殊样式标注

【每周学习页 pages/week.html?week=N】
- 本周主题、学习提示
- 文章卡片网格（每篇显示：篇名、作者、难度星级、字数、完成状态勾选）
- 卡片点击跳转 pages/article.html?id=NNN
- 底部：本周延伸主题 + 本周思考题

【文章详情页 pages/article.html?id=NNN — 最核心页面】
按以下顺序从上到下排列模块：

1. 头部信息：标题（大字楷体）、作者·朝代·字数·难度星级、配图
2. 故事导读：浅色卡片，2-4句白话导读
3. 原文区：
   - 大字宋体显示原文
   - 生僻字用 <ruby> 标签内联拼音
   - 右上角两个开关按钮：[显示全部拼音] [显示节奏标注]
   - 节奏标注模式用 "/" 标记停顿
   - 点击任意带注释的词弹出注释 tooltip（词义、拼音、古今联系）
4. 翻译区：
   - 默认折叠，显示"点击查看翻译 ▼"按钮
   - 展开后逐段显示翻译，每段可独立折叠
5. 逐句精读：
   - 按文章自然段落分组，每组折叠面板
   - 展开后显示：原文段落 → 注释列表 → 翻译 → 古今联系
6. 延伸阅读：折叠区，含作者介绍、历史背景、趣味知识
7. 想一想：2-3个开放性思考题
8. 小试牛刀（练习区）：
   - 选择题：点击选项即时判对错（对→绿+✓，错→红+✗并高亮正确答案）
   - 填空题：输入框提交后对比答案
   - 简答题：显示参考答案按钮
   - 挑战题：折叠式选做
   - 全部完成后显示得分和鼓励语
9. 词汇积累：表格展示本篇重点词汇（古义/今义/例句/成语）
10. 底部导航：[← 上一篇] [标记完成 ✓] [下一篇 →]

【词汇宝库 pages/vocab.html】
- 分类标签页（说话类/看类/时间类/虚词类等）
- 每个词汇卡片：词、古义、今义、出处文章链接、相关成语
- 搜索框：支持按词或按意思搜索
- 统计：已学 X 个词汇

【学习进度 pages/progress.html】
- 总进度环形图
- 四阶段进度条
- 已获称号展示（文言新秀/古文达人/国学小将/观止学者）
- 词汇积累数、平均练习正确率
- 底部：[导出进度] [导入进度] 按钮
- 首次访问引导填写学生姓名

【阶段测评 pages/review.html?week=N】
- 20-30道综合题目
- 可选计时模式
- 提交后显示成绩、逐题解析、是否达标
- 达标解锁对应阶段称号

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
五、进度管理系统
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

存储：LocalStorage，key = "guanzhi_progress"

数据结构：
{
  "version": 1,
  "studentName": "",
  "completedArticles": [],     // ["001","002",...]
  "completedWeeks": [],        // [1, 2, ...]
  "quizScores": {},            // {"001": 85, "002": 90}
  "reviewPassed": [],          // [13, 26]
  "badges": [],                // ["文言新秀"]
  "vocabLearned": 0,
  "lastVisit": "2026-09-15",
  "currentWeek": 1,
  "createdAt": "2026-09-01",
  "exportedAt": null
}

导出功能：将进度序列化为 JSON 文件下载（文件名含姓名+日期）
导入功能：上传 JSON 文件，校验 version 和数据合法性后写入 LocalStorage
备份提醒：距上次导出超过14天且有学习记录时，页面顶部弹出提醒条

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
六、文章数据 JSON 格式（data/articles/NNN.json）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "id": "001",
  "title": "答谢中书书",
  "source": "陶弘景集",
  "author": "陶弘景",
  "dynasty": "南朝·梁",
  "difficulty": 1,
  "week": 1,
  "wordCount": 68,
  "tags": ["南朝", "写景", "书信"],
  "relatedIdioms": ["山高水长"],
  "mainImage": "001-main.jpg",
  "storyIntro": "南朝时期有一位叫陶弘景的隐士……",
  "fullText": "山川之美，古来共谈……",
  "rubyAnnotations": [
    {"char": "辉", "pinyin": "huī", "pos": 25}
  ],
  "rhythmMarked": "山川/之美，古来/共谈……",
  "sections": [
    {
      "title": "总写山川之美",
      "original": "山川之美，古来共谈。",
      "annotations": [
        {"word": "共谈", "meaning": "共同赞叹", "pinyin": null}
      ],
      "translation": "山川的秀美，自古以来就是人们共同赞叹的话题。",
      "modernLink": ""四时"即四季……"
    }
  ],
  "fullTranslation": "山川的秀美……",
  "extendedReading": {
    "author": "陶弘景（456-536年）……",
    "background": "这封信是……",
    "funFacts": ["这封信只有68个字……"],
    "relatedStory": ""山中宰相"的故事……"
  },
  "thinkingQuestions": [
    "陶弘景住在深山里，却被称为"山中宰相"……"
  ],
  "quiz": {
    "choices": [
      {
        "id": 1,
        "question": ""四时俱备"中的"四时"是什么意思？",
        "options": ["四个小时", "四季", "四点钟", "四个时代"],
        "answer": 1,
        "explanation": "四时就是四季的意思。"
      }
    ],
    "fillBlanks": [
      {"id": 3, "question": "晓雾将__", "blank": "歇", "hint": "消散"}
    ],
    "shortAnswer": [
      {"id": 4, "question": "文中用了哪些对比手法？", "sampleAnswer": "高与低……"}
    ],
    "challenge": [
      {"id": 5, "question": "模仿句式写两句……", "sampleAnswer": "大漠连天……"}
    ]
  },
  "keyVocab": [
    {"word": "歇", "ancient": "消散", "modern": "休息", "example": "晓雾将歇", "idiom": "歇斯底里"}
  ]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
七、Azure Static Web Apps 部署配置
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7.1 创建 staticwebapp.config.json（放在项目根目录）：

{
  "navigationFallback": {
    "rewrite": "/index.html"
  },
  "routes": [
    { "route": "/pages/*", "allowedRoles": ["anonymous"] },
    { "route": "/data/*", "allowedRoles": ["anonymous"] },
    { "route": "/images/*", "allowedRoles": ["anonymous"] }
  ],
  "responseOverrides": {
    "404": {
      "rewrite": "/index.html"
    }
  },
  "globalHeaders": {
    "Cache-Control": "public, max-age=3600",
    "X-Content-Type-Options": "nosniff"
  },
  "mimeTypes": {
    ".json": "application/json; charset=utf-8"
  }
}

7.2 创建 .github/workflows/azure-static-web-apps.yml：

name: Deploy to Azure Static Web Apps

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [main]

jobs:
  build_and_deploy:
    if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'closed')
    runs-on: ubuntu-latest
    name: Build and Deploy
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/"
          output_location: ""
          skip_app_build: true

  close_pull_request:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    name: Close PR
    steps:
      - name: Close
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: "close"

7.3 创建 package.json（仅元数据，无运行时依赖）：

{
  "name": "guanzhi-xuetang",
  "version": "1.0.0",
  "description": "观止学堂 - 小学生古文观止学习平台",
  "private": true,
  "scripts": {
    "start": "npx http-server -p 8080 -c-1",
    "validate": "node scripts/validate-data.js"
  }
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
八、开发顺序（按 Phase 逐步交付）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

请按以下顺序开发，每完成一个 Phase 告诉我，我会 review 后再推进下一个。

Phase 1 — 项目骨架
  创建完整目录结构、所有 HTML 页面骨架、CSS 变量和全局样式、
  Azure 部署配置文件、GitHub Actions workflow。
  用 npx http-server 能跑起来看到所有页面。

Phase 2 — 数据层
  创建 data/index.json（52周完整目录）。
  创建前5篇文章的 data/articles/001-005.json（我会提供内容）。
  实现 js/progress.js（LocalStorage CRUD + 导出/导入）。
  实现 js/utils.js（fetch封装、DOM工具）。

Phase 3 — 文章详情页（核心）
  实现 pages/article.html + js/article.js。
  包含全部10个模块的完整渲染。
  用001-005的数据测试。
  确保拼音开关、节奏标注开关、翻译折叠、字词注释tooltip全部正常。

Phase 4 — 练习系统
  实现 js/quiz.js。
  选择题即时反馈、填空题提交对比、简答题显示参考答案。
  得分计算与保存。

Phase 5 — 首页学习地图
  实现 index.html + js/map.js。
  52周节点渲染、进度状态同步、阶段分区。

Phase 6 — 周学习页
  实现 pages/week.html 的文章卡片列表和完成状态。

Phase 7 — 词汇宝库 + 进度页
  实现 pages/vocab.html + js/vocab.js。
  实现 pages/progress.html（含导出/导入按钮）。

Phase 8 — 阶段测评 + 暗色模式
  实现 pages/review.html。
  实现暗色模式切换。

Phase 9 — 优化
  图片懒加载、移动端触控优化、备份提醒条、404页面。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
九、编码规范
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- 不使用任何前端框架（React/Vue/Angular），纯原生 JS
- 全部文件使用 UTF-8 编码
- JS 使用 ES6+ 语法（const/let、箭头函数、async/await、模板字符串）
- CSS 用 CSS 变量管理主题，不使用预处理器
- HTML 语义化标签（header/main/section/article/nav/footer）
- 关键函数加中文注释
- 所有 JSON 文件 UTF-8 编码，确保中文正确
- 图片统一 JPG 格式
- 路由使用 URL query 参数（article.html?id=001）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
十、首次启动
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

请先完成 Phase 1，创建完整的项目骨架。让我能用 npx http-server 在本地浏览所有页面，看到基本布局和古风视觉效果（即使内容为占位符）。完成后告诉我。
```

---

## 后续 Phase 推进示例

完成每个 Phase 后，用如下格式推进：

```
Phase 1 已完成，效果确认无误。请继续 Phase 2。

补充说明：
- data/articles/ 下先创建 001-005 的 JSON，内容参考 docs/07-技术开发计划.md 中的完整示例
- index.json 中 52 周计划参考 docs/04-52周课程表.md
```

## Azure 部署步骤备忘

1. 在 Azure Portal 创建 Static Web App 资源，关联 GitHub 仓库
2. Azure 会自动在 GitHub 仓库的 Settings → Secrets 中写入 `AZURE_STATIC_WEB_APPS_API_TOKEN`
3. push 到 main 分支后 GitHub Actions 自动部署
4. 自定义域名在 Azure Portal → Static Web App → Custom domains 中配置
