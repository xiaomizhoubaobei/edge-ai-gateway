# Edge AI Gateway

提供简洁流畅的聊天体验，并演示 Edge Functions 转发与 SSE 流式返回。

## 项目说明

本项目用于演示**如何在 Edge Functions 中转发 AI 模型请求**并通过 SSE 流式返回结果。核心逻辑在 `functions/v1/chat/completions/index.ts`，主要流程包括：

- 校验 `messages` 请求体
- 将请求转发到 `${BASE_URL}/chat/completions`，并携带 `MODEL`
- 将上游响应以流式方式返回给前端
- 为浏览器请求添加 CORS 头

### 必要环境变量

请在 EdgeOne Pages 的项目设置中配置：

- `BASE_URL`：上游模型服务地址（兼容 OpenAI 的接口）
- `API_KEY`：调用上游模型所需的 Token
- `MODEL`：上游模型名称

## 部署

[![使用 EdgeOne Pages 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://pages.edgeone.ai/templates)

## 入门

首先，运行开发服务器：

```bash
npm run dev
# 或
yarn dev
# 或
pnpm dev
# 或
bun dev
```

使用浏览器打开 [http://localhost:3000](http://localhost:3000) 查看结果。

您可以通过修改 `app/page.tsx` 开始编辑页面。随着您编辑文件，页面会自动更新。

该项目使用 [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) 自动优化和加载 Inter，这是一个自定义的 Google 字体。

## 了解更多

要了解有关 Next.js 的更多信息，请查看以下资源：

- [Next.js 文档](https://nextjs.org/docs) - 了解 Next.js 的特性和 API。
- [学习 Next.js](https://nextjs.org/learn) - 互动式 Next.js 教程。

您可以查看 [Next.js GitHub 仓库](https://github.com/vercel/next.js/) - 欢迎您的反馈和贡献！