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
npm run test:e2e:security
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

`tests/e2e/security-cross-user-abuse.spec.ts` verifies that a limited-access user cannot read, update, delete, or inject another user's project-bound data.

The security suite currently covers:

- Unauthenticated users cannot access private/security-sensitive routes.
- Cross-user project source context, source listing, and source update attempts are blocked.
- Cross-user saved report view, update, and delete attempts are blocked.
- Cross-user bug collection update and delete attempts are blocked.
- Cross-user TestRail sync by saved report ID is blocked.
- Client-supplied `projectContextBlock` text is not trusted as authorized Project Brain/Source Vault context.
- Jira/TestRail config endpoints do not return plaintext token fields.
- Prompt-injection attempts do not expose prompt scaffolding, hidden/developer messages, unrelated memory, or secret canaries.

### Fast setup

Run the seed helper from the project root to create/find the two E2E users and print the required PowerShell env vars:

```bash
npm run seed:e2e-security
```

Paste the printed env vars into PowerShell, then run:

```bash
npm run test:e2e:security
```

### Manual setup

If you do not use the seed helper:

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
