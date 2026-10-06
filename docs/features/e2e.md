# End-to-end tests

The browser suite lives in `e2e/` and runs with Playwright against a deployed environment or the local compose stack. CI (`.github/workflows/e2e-dev.yml`) runs it against dev after every successful `deploy: dev`, against staging after every successful `promote: staging` (on the promoted commit), and on demand from the Actions tab with a `target` input.

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
| `staging` | every spec, after a staging promote |
| `prod-readonly` | specs tagged `@prod` only; none of them writes data |
| `local` | every spec, against the compose stack (Keycloak login) |

- `E2E_EMAIL`, `E2E_PASSWORD`: the test account of the target environment. In CI they are secrets of the `esa-eve-dev` environment for dev and of `esa-eve-staging-e2e` for staging (`esa-eve-staging` accepts `v*` tags only, and this workflow runs on `main`). A run without them stops before sign-in with an error naming both.
- `E2E_TARGET`: overrides the base URL of the chosen project, for example a preview host.
- `corepack yarn e2e --list` lists the tests without a browser or credentials.
- `corepack yarn e2e:report` opens the last HTML report (`e2e/report`). Failures keep a trace and a screenshot.
- `corepack yarn e2e:type-check` type-checks the suite.

The suite signs in once per worker through the hosted login and keeps the identity provider cookies in `e2e/.auth/` (gitignored). Every test then opens the app, which comes back from the provider already signed in.

## Layout

- `e2e/pages/`: one page object per screen or dialog. Methods return typed values (`sourcesCount(): Promise<number>`), never raw locators for a test to poke at.
- `e2e/fixtures/index.ts`: the `test` to import. It provides `authedPage`, the page objects, and `api`, `GET` and `PATCH /api/...` helpers that send the bearer the signed-in app holds. When the required profile dialog covers the chat after sign-in (`FEATURE_PROFILE_FIELDS` on, the test account lacking country or institution), the sign-in fills it with fixed values. Nothing writes to a production host (`eve-chat.chat`, `app.eve-chat.chat`, whatever the project or `E2E_TARGET`) or in the `prod-readonly` project: the sign-in and `api.patch` fail there instead.
- `e2e/specs/`: one file per behaviour. Each test checks the UI and then reads the persisted state through `api`.

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
