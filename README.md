# Edge AI Gateway

A clean, streamlined chat interface that demonstrates Edge Function forwarding and SSE streaming.

## What this project demonstrates

This project shows **how to forward AI model requests through Edge Functions** and return responses via server-sent events. The core logic lives in `functions/v1/chat/completions/index.ts`, which:

- validates the incoming `messages` payload
- forwards the request to `${BASE_URL}/chat/completions` with `MODEL`
- streams the response back to the client
- adds CORS headers for browser access

### Required environment variables

Set these variables in your EdgeOne Pages project settings:

- `BASE_URL`: the upstream model endpoint (e.g., your OpenAI-compatible server)
- `API_KEY`: the bearer token used to call the upstream model
- `MODEL`: the model name passed to the upstream API

## Deploy

[![Deploy with EdgeOne Pages](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://pages.edgeone.ai/templates)

More Templates: [EdgeOne Pages](https://pages.edgeone.ai/templates)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!
