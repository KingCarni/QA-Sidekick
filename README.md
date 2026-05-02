# QA Sidekick Starter

Standalone Next.js webapp starter for QA Sidekick.

## Local setup

```bash
npm install
cp .env.example .env.local
npx prisma generate
npm run dev
```

## MVP flow

1. Paste a Jira-style ticket into the workspace.
2. Generate test cases.
3. Analyze risk and bottlenecks.
4. Improve bug reports or test cases.

## Reuse source

This starter was built from the QA Sidekick plan and references the Git-a-Job reuse bundle for patterns only. Resume-specific logic has intentionally not been carried over.
