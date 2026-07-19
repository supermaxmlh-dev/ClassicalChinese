# Phase 2 反馈后端说明

本阶段按 `docs/22-Roadmap-功能扩展执行计划.md` 的 Phase 2 实现首个后端：Azure Static Web Apps Functions `/api/feedback`。

## 功能

- `POST /api/feedback`：提交反馈。
- `GET /api/feedback`：读取最近公开反馈，不返回联系方式、IP 哈希、User-Agent 等私有字段。
- 前端页面：`pages/feedback.html`。
- 离线或 `/api` 不可用时：反馈表单禁用并提示，阅读、判分、进度、字典不受影响。

## 隐私与防滥用

- 联系方式可选，仅支持邮箱。
- 不要求真实姓名、年级、学校等身份信息。
- 拦截身份证、住址、密码等敏感信息。
- 简单内存限流：同一 IP 哈希 10 分钟最多 5 次。
- 蜜罐字段拦截机器提交。

## 存储与邮件配置

默认本地文件存储用于本地/预览自测。生产环境建议至少配置以下之一：

- `FEEDBACK_TABLE_SAS_URL`：Azure Table 表级 SAS URL，持久化留言板。
- `FEEDBACK_WEBHOOK_URL`：转发到邮件或自动化服务。
- `FEEDBACK_WEBHOOK_TOKEN`：webhook Bearer Token，可选。
- `FEEDBACK_HASH_SALT`：IP 哈希盐值，可选。

不在仓库中保存任何密钥、连接串或邮件服务 token。

## 验收

```bash
npm run test:feedback
npm run build
```
