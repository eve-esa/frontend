# Getting started

Run the EVE web app on your computer. To use the hosted service instead, open
[https://eve-chat.chat](https://eve-chat.chat).

## Prerequisites

- Node.js 18 or later and Yarn.
- A running EVE backend and a local identity provider (Keycloak). The backend repository
  starts both with Docker Compose: follow its
  [local setup guide](https://github.com/eve-esa/backend/blob/main/docs/local_setup.md).

## Run the app

1. Clone this repository and install the dependencies:

    ```bash
    yarn install
    ```

2. Copy `.env.example` to `.env`, then set:

    - `VITE_API_URL` to the backend URL from the backend guide.
    - `VITE_AUTH_ISSUER=http://localhost:8080/realms/eve` and
      `VITE_AUTH_CLIENT_ID=eve-frontend` for the local Keycloak.

    The comments in `.env.example` explain the other settings. Leave them as they are to
    start. Never commit `.env`.

3. Start the dev server:

    ```bash
    yarn dev
    ```

4. Open [http://localhost:5173](http://localhost:5173) and sign in with the local account
   from the backend guide.

## Useful scripts

- `yarn build`: production build.
- `yarn preview`: serve the production build.
- `yarn type-check`, `yarn lint`, `yarn test`: the checks that CI runs.
