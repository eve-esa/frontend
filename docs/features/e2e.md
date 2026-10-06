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
- `corepack yarn e2e --list` lists the tests without a browser or credentials.
- `corepack yarn e2e:report` opens the last HTML report (`e2e/report`). Failures keep a trace and a screenshot.
- `corepack yarn e2e:type-check` type-checks the suite.

The suite signs in once per worker through the hosted login and keeps the identity provider cookies in `e2e/.auth/` (gitignored). Every test then opens the app, which comes back from the provider already signed in.

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
