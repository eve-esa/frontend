# EVE web app

EVE is an assistant for Earth Observation (EO). The hosted service runs at
[https://eve-chat.chat](https://eve-chat.chat). This guide describes the web app as it works
there today.

## Account

- Sign in and sign up on the EVE sign-in page, not inside the app. See
  [Account and profile](features/profile.md).
- Before the first chat, add your country and institution to your profile.

## Chat

- Streamed answers with Markdown, formulas and links to their sources. Stop an answer at any
  time.
- EVE searches its knowledge base while it answers, and the **Trace** of each answer shows
  the steps it took.
- Pick the model that answers, and choose which toolkits EVE can use.
- Report a bug from any answer.

See [Chat](features/chat.md).

## Knowledge base

- [Shared collections](features/shared_collection.md): curated EO document sets.
- [My collections](features/private_collection.md): your own PDF and TXT files.
- [Control Panel](features/control_panel.md): retrieval and generation settings.

## API access

Create [API keys](features/api-keys.md) to call EVE from your own code through an
OpenAI-compatible API.

## Run the app locally

See [Getting started](getting_started.md).
