# QAtalyst Playwright Tests

## Setup

```bash
npm install
npm run playwright:install
```

## Run

```bash
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:ui
npm run test:e2e:debug
```

Playwright starts the Next.js dev server with `npm run dev` and uses `http://localhost:3000` as `baseURL`.

## Generated Skeletons

Put generated specs under `tests/e2e/`. Shared helpers live in `tests/support/`.

Generated Playwright specs that need auth should use:

```ts
import { loginAs } from "../support/auth";

await loginAs(page, "standard-user");
```

## Credentials

Use `.env.e2e.example` as the template for local or CI values. Only commit env var names, never real passwords.

Supported profiles:

- `standard-user`
- `admin-user`
- `limited-access-user`

## Selector TODOs

Generated skeletons often include TODO selectors. Replace them with stable `data-testid` selectors or robust role/label locators before treating the test as final.
