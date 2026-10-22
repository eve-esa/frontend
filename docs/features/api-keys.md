# API keys

An API key lets your own code call EVE through an OpenAI-compatible API, without signing in
through the browser. Keys start with `eve_`.

## Open the API keys dialog

In the sidebar, click **API keys**. The dialog lists your keys and shows how many are active
out of your limit (10 active keys).

For each key the list shows its name, when it was created, the last characters of the key,
when it was last used and when it expires. A key created with another key says
"via API key".

## Create a key

1. Click **Create key**. At the limit the button is disabled: delete a key first.
2. Optional: enter a name that helps you tell your keys apart.
3. Under **Expiration**, choose 30 days, 90 days, 365 days or **No expiration**. The default
   is 90 days.
4. Click **Create key**.
5. Copy the key from **Save your API key** and store it somewhere safe.

EVE shows the full key only once. Closing the dialog hides it for good. If you lose a key,
delete it and create a new one. Anyone with your key can call EVE as you and spend your token
budget.

## Call the API

The base URL is `https://eve-chat.chat/api/v1`. **Quickstart** in the dialog shows the same
commands with copy buttons.

```bash
export EVE_API_KEY="<your API key>"

# List the models you can use.
curl https://eve-chat.chat/api/v1/models \
  -H "Authorization: Bearer $EVE_API_KEY"

# Send a chat request. Use a model id from the list above.
curl https://eve-chat.chat/api/v1/chat/completions \
  -H "Authorization: Bearer $EVE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "<model id>", "messages": [{"role": "user", "content": "Hello, EVE"}]}'
```

Requests through the API use the same token budget as the chat.

## Delete a key

1. Click the trash icon next to the key.
2. Confirm with **Delete key**.

The key stops working at once: calls with it get a `401` error. Keys created with it are
deleted too, and the confirmation says how many.
