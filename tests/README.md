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

## Security / Cross-user Abuse Regression

`tests/e2e/security-cross-user-abuse.spec.ts` verifies that a limited-access user cannot read, update, or inject another user's project-bound data.

Required setup:

1. Create or seed a `standard-user` account with a project, project source, saved report, and bug collection item.
2. Create or seed a separate `limited-access-user` account.
3. Add these env vars with IDs owned by the standard user:

```bash
QATALYST_E2E_STANDARD_PROJECT_ID="..."
QATALYST_E2E_STANDARD_SOURCE_ID="..."
QATALYST_E2E_STANDARD_REPORT_ID="..."
QATALYST_E2E_STANDARD_BUG_ID="..."
QATALYST_E2E_SECRET_CANARY="QATALYST_PRIVATE_SOURCE_CANARY"
```

The tests intentionally call API routes by raw IDs as the limited-access user. Expected result is `401`, `403`, `404`, or safe validation failure depending on the route. Responses must not include the secret canary.

## Selector TODOs

Generated skeletons often include TODO selectors. Replace them with stable `data-testid` selectors or robust role/label locators before treating the test as final.
