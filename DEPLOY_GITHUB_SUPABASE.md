# GitHub + Supabase 部署说明

## 1. 创建 Supabase 项目

1. 在 Supabase 创建新项目。
2. 打开 `SQL Editor`，执行本项目的 `supabase-schema.sql`。
3. 打开 `Authentication > Providers`，确认 `Email` 已启用。
4. 如果启用邮箱验证，进入 `Authentication > URL Configuration`，把线上访问地址加入 `Site URL` 和 `Redirect URLs`。

## 2. 配置前端连接信息

复制 `supabase-config.example.js` 为 `supabase-config.js`，填入项目设置里的 API 信息：

```js
window.SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY",
};
```

`anonKey` 是前端公开 key，数据安全依赖 `supabase-schema.sql` 里的 RLS 策略按 `user_id` 隔离。

## 3. 部署到 GitHub Pages

1. 把 `workflow-board.html`、`workflow-board.css`、`workflow-board.js`、`supabase-config.js`、`supabase-schema.sql` 推送到 GitHub 仓库。
2. 在仓库 `Settings > Pages` 选择部署分支。
3. 访问 GitHub Pages 地址，点击右上角 `登录 / 注册`。

## 4. 使用逻辑

- 未配置 Supabase 时：应用显示 `本地模式`，仍然使用浏览器本地数据。
- 登录后：会读取当前账号在 Supabase 的 `user_app_data` 数据。
- 第一次登录且云端为空：会把当前浏览器中的项目上传为该账号的初始数据。
- 后续新增、删除、编辑节点或项目时：先保存到本地，再自动同步到 Supabase。

## 5. 参考文档

- Supabase 密码登录与注册：https://supabase.com/docs/guides/auth/passwords
- Supabase RLS 行级安全：https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase JavaScript upsert：https://supabase.com/docs/reference/javascript/upsert
