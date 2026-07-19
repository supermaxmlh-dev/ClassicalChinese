# Phase 2.1 反馈留言增强说明

本阶段在 Phase 2 的反馈入口基础上，补齐“类留言板”的核心权限与审核能力，但仍不引入账户系统，保持 local-first。

## 新增功能

- 回复：反馈支持 `parentId`，前端按父子关系展示。
- 用户删除：提交时可选“删除密码”，删除时用评论编号 + 删除密码删除自己的留言。
- 站长删除：配置 `FEEDBACK_ADMIN_TOKEN` 后，站长可用该口令删除任意留言。
- 软删除：删除只把 `status` 改为 `deleted`，公开列表不再展示。
- 敏感词审核：命中 `data/moderation-keywords.json` 的留言进入 `needs_review`，默认不公开展示。
- 站长审核接口：`PATCH /api/feedback` 可把状态改为 `visible`、`needs_review`、`deleted`。

## 密码与隐私

- 删除密码不保存明文。
- 后端保存 `deleteSecretSalt` 与 `deleteSecretHash`，使用 PBKDF2-SHA256。
- `GET /api/feedback` 不返回联系方式、IP 哈希、User-Agent、删除密码哈希或盐。
- 联系方式仍可不填，不要求真实姓名、学校、年级等身份信息。

## 接口

### 提交

`POST /api/feedback`

可选字段：

- `parentId`：回复某条留言。
- `deleteSecret`：用户自删密码，至少 4 个字符。

返回：

- `status: "visible"`：公开展示。
- `status: "needs_review"`：已收到，但待站长查看后展示。

### 删除

`DELETE /api/feedback`

```json
{
  "id": "评论编号",
  "deleteSecret": "用户删除密码"
}
```

或：

```json
{
  "id": "评论编号",
  "adminToken": "站长口令"
}
```

### 审核

`PATCH /api/feedback`

```json
{
  "id": "评论编号",
  "status": "visible",
  "adminToken": "站长口令"
}
```

## 验收

```bash
npm run test:feedback
npm run build:site
```
