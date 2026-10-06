# End-to-end tests

The browser suite lives in `e2e/` and runs with Playwright against a deployed environment or the local compose stack. CI (`.github/workflows/e2e-dev.yml`) runs it against dev after every successful `deploy: dev`, and on demand with a `target` input. Staging runs from the promoted release tag, dispatched after the promote: `gh workflow run "e2e: dev" -R eve-esa/frontend --ref vX.Y.Z -f target=staging`; from any other ref the run stops with an error.

After a backend-only merge, dispatch the dev run by hand: `gh workflow run "e2e: dev" -R eve-esa/frontend --ref main -f target=dev`.

## Run it

Node and the browsers come from the Playwright image, so nothing is installed on the host:

```sh
docker run --rm -it -v "$PWD":/work -w /work \
  -e E2E_EMAIL -e E2E_PASSWORD \
  mcr.microsoft.com/playwright:v1.63.0-noble \
  sh -c "corepack enable && corepack yarn install --frozen-lockfile && corepack yarn e2e --project=dev"
```

| Project | What runs |
|---|---|
| `dev` (default in CI) | every spec |
| `staging` | every spec, from the promoted release tag |
| `prod-readonly` | specs tagged `@prod` only; none of them writes data |
| `local` | every browser spec, against the compose stack (Keycloak login); the API specs skip |

- `E2E_EMAIL`, `E2E_PASSWORD`: the test account of the target environment. In CI they are secrets of the `esa-eve-dev` environment for dev and of `esa-eve-staging` for staging (which accepts `v*` tags only, hence the tag ref). A run without them stops before sign-in with an error naming both.
- `E2E_TARGET`: overrides the base URL of the chosen project, for example a preview host.
- `E2E_API_URL`: where `api` sends its calls. Default `<base URL>/api`; for the `local` project `http://localhost:8000`, because the Vite dev server answers every path with `index.html` and the compose backend serves its routes without the `/api` prefix.
- `corepack yarn e2e --list` lists the tests without a browser or credentials.
- `corepack yarn e2e:report` opens the last HTML report (`e2e/report`). Failures keep a trace and a screenshot.
- `corepack yarn e2e:type-check` type-checks the suite.

The suite signs in once per worker through the hosted login and keeps the identity provider cookies in `e2e/.auth/` (gitignored). Every test then opens the app, which comes back from the provider already signed in.

## First-time user

`e2e/specs/signup.spec.ts` (`@local`) follows a brand-new account from sign-up to its first answer: registration, e-mail verification, first sign-in, the required profile dialog (`FEATURE_PROFILE_FIELDS`), `GET /users/me` (country, institution, `approval_status`), the account mail (welcome under `SIGNUP_AUTO_APPROVE_LIMIT`, on hold past it, with the on hold page instead of the chat), and one classic question read back from `GET /conversations/{id}` with no `metadata.error`. It does not use `E2E_EMAIL`.

### Local

The compose stack registers the account through Keycloak self-registration (realm `eve`, e-mail verification on) and reads every mail from Mailpit. Start the frontend the way prod runs it, then run the spec with host networking (Docker Desktop, "Enable host networking"):

```sh
VITE_FEATURE_PROFILE_FIELDS=true VITE_FEATURE_AGENTIC_CHAT=false docker compose up -d --no-deps frontend
docker run --rm --network host -v "$PWD":/work -w /work -e E2E_PROFILE_FIELDS=true \
  mcr.microsoft.com/playwright:v1.63.0-noble \
  sh -c "corepack enable && corepack yarn install --frozen-lockfile && corepack yarn e2e --project=local specs/signup.spec.ts"
```

- `E2E_PROFILE_FIELDS=true` tells the spec the dialog must appear: the dev server serves no `window.__EVE_CONFIG__` to read the flag from.
- Each run creates `e2e-signup-<timestamp>@eve-e2e.dev`. The cleanup deletes the conversation and the Keycloak user (admin API, `admin` / `admin`). The app user row and its `external_identities` row stay: no API deletes a user. Remove them with `docker compose exec mongo sh -c 'mongosh -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin eve-backend --eval "ids = db.users.find({email: /^e2e-signup-/}).toArray().map(u => u._id.toHexString()); db.external_identities.deleteMany({user_id: {\$in: ids}}); db.users.deleteMany({email: /^e2e-signup-/})"'`.
- Variables: `E2E_MAILPIT_URL` (default `http://localhost:6080`), `E2E_KEYCLOAK_URL` (default `http://localhost:8080`), `E2E_KEYCLOAK_REALM`, `E2E_KEYCLOAK_ADMIN_USER`, `E2E_KEYCLOAK_ADMIN_PASSWORD`, `E2E_SIGNUP_QUESTION`.

### Dev, staging and prod

Cognito sign-up needs a mailbox the suite cannot read, so the account is provisioned outside the suite, one per run:

1. Create a confirmed user on an SES simulator address (an AWS write, run by the orchestrator with the owner's go):
   `aws cognito-idp admin-create-user --user-pool-id <pool> --username success+eve-<env>-signup-<timestamp>@simulator.amazonses.com --user-attributes Name=email,Value=<same address> Name=email_verified,Value=true --message-action SUPPRESS`, then `aws cognito-idp admin-set-user-password --user-pool-id <pool> --username <address> --password <generated> --permanent`. The password is generated for the run and passed only as an environment variable.
2. Run the spec with `E2E_SIGNUP_EMAIL` and `E2E_SIGNUP_PASSWORD` on `--project=dev` or `--project=staging`: it signs in through the managed login, meets the profile dialog, reads `/users/me`, asks the question and deletes the conversation. The mail steps run only when `E2E_MAILPIT_URL` is set.
3. Prove the welcome mail from the backend log in ClickHouse (`ops/scripts/o11y-sql.sh logs` or the `clickstack` MCP): `account_mail_sent kind=approved user_id=<id from /users/me>` and `mail sent via ses subject='Your EVE account is ready' recipient_domain=simulator.amazonses.com` (`kind=pending` and the on hold subject past the approval limit).
4. Delete the user: `aws cognito-idp admin-delete-user --user-pool-id <pool> --username <address>` (same go). The app user row stays, as locally.

Prod: the suite never writes to a production host, so the spec skips there. The same four steps run on prod with the Playwright MCP driving step 2 by hand, each AWS write and the run itself under the owner's go.

The mail content (subject, recipient, body) is verifiable only locally. On AWS the log lines prove that the backend sent a mail with that subject to that domain, not what arrived: reading the mail would need an SES receiving mailbox (a receipt rule on a subdomain storing to S3), an infra option that is not built.

## Layout

- `e2e/pages/`: one page object per screen or dialog. Methods return typed values (`sourcesCount(): Promise<number>`), never raw locators for a test to poke at.
- `e2e/fixtures/index.ts`: the `test` to import. It provides `authedPage`, the page objects, and `api`, `GET` and `PATCH /api/...` helpers that send the bearer the signed-in app holds. When the required profile dialog covers the chat after sign-in (`FEATURE_PROFILE_FIELDS` on, the test account lacking country or institution), the sign-in fills it with fixed values. Nothing writes to a production host (`eve-chat.chat`, `app.eve-chat.chat`, whatever the project or `E2E_TARGET`) or in the `prod-readonly` project: the sign-in and `api.patch` fail there instead.
- `e2e/specs/`: one file per behaviour. Each test checks the UI and then reads the persisted state through `api`.
- `e2e/api/`: API specs with no browser (below).

## API suites

`e2e/api/` holds Playwright API tests (`APIRequestContext`, no browser) for API keys, the OpenAI-compatible `/v1` gateway, the token budget and the request rate limiter. Every project runs them next to the browser specs, so `corepack yarn e2e --project=dev` covers both; `corepack yarn e2e --project=dev api/` runs them alone.

- `session.ts` signs in without a browser: it reads `AUTH_ISSUER` and `AUTH_CLIENT_ID` from the `window.__EVE_CONFIG__` the target serves, then calls Cognito `InitiateAuth` with `USER_PASSWORD_AUTH` and `E2E_EMAIL`, `E2E_PASSWORD`. Those tokens carry no `openid` scope, so the account must have signed in once through the hosted page (the browser specs do). A target that signs in through Keycloak (`local`) skips the API specs.
- Each spec signs in on its own, creates its own 1 day key and revokes it in a `finally`. All three write, so they are `@dev` and never run on a production host or in `prod-readonly`.
- Traces are off in these files: a trace would hold the bearer, the plaintext key and the Cognito password.

| Spec | Proves |
|---|---|
| `api-keys.spec.ts` | a new key lists the `jsc/` model on `/v1/models`, answers a completion with `usage` and a stream ending in `data: [DONE]`, is listed active with its suffix and no plaintext, and gets 401 `Invalid or revoked API key` after the delete; malformed keys get 401 `Invalid API key format`. The `eve/` (RunPod) test is `@slow` and runs only with `E2E_SLOW=1` (cold start up to 4 minutes). |
| `budget.spec.ts` | one completion raises `used_tokens` of `GET /api/users/me/token-usage` by exactly `usage.total_tokens` (reserve, then settle the difference). Skipped for an unlimited group. The exhaustion test (429, `error.code` `token_budget_exceeded`, `x-should-retry: false`) runs only with `E2E_BUDGET_EXHAUSTED_EMAIL` and `E2E_BUDGET_EXHAUSTED_PASSWORD`: an account with a few hundred tokens left, which the operator prepares (the back office cannot lower a cap). |
| `rate-limit-shadow.spec.ts` | 40 concurrent `POST /api/log-error` (errlog burst 30) all answer 200 and none says `rate_limited`. The backend does not expose its limiter mode: under `REQUEST_RATE_LIMIT_MODE=enforce` this spec fails by design. A pass cannot tell shadow from the limiter being off; the run window's `rate_limit.limited ... mode=shadow` log line and the `eve.rate_limit.decisions` metric prove the refusals were counted. Each run leaves 40 `error_log` rows of type `RateLimitShadowTest`. |

## Add a page object

1. Create `e2e/pages/<Name>.ts` with a class that takes the `Page` in its constructor and exposes locators as `readonly` fields.
2. Export it from `e2e/pages/index.ts` and, if a spec needs it ready to use, add a fixture in `e2e/fixtures/index.ts`.

## Add a spec

1. Create `e2e/specs/<behaviour>.spec.ts` and import `test` and `expect` from `../fixtures`.
2. Tag the `describe` title: `@prod` when the test only reads, `@dev` when it writes (a conversation, a profile change). Only `@prod` tests run against production.
3. When the behaviour sits behind a flag, read the served config with `chat.servedConfig()` and `flagOn()`, and skip or branch on it instead of assuming an environment.

## The test id rule

- Specs and page objects select app elements with `getByTestId` only. The hosted login page is the one exception, because it is not ours.
- A missing test id is added in the component in the same pull request, named `<area>-<thing>` in kebab case (`composer-send`, `message-sources-button`).
- An existing test id is never renamed or removed: other suites and the smoke harness depend on it.
