# Settings

Flag `FEATURE_SETTINGS_PAGE`, default off. With it on, the user menu holds **Settings**, **About
us**, **Contact us**, **Privacy policy** and **Log out**, and Settings opens the page at
`/settings/profile`. On a phone, opening Settings from the menu closes the sidebar behind you.

## Sections

The list at the left (a **Section** select on a phone) shows only the sections that are on in your
environment. A link to a section that is not listed opens Profile. There are six sections.

- **Profile**: your name, country and institution (country and institution with
  `FEATURE_PROFILE_FIELDS`). Your email comes from your sign-in and is read only. **Save changes**
  stays disabled, with "No changes to save.", until a field changes.
- **Appearance** (`FEATURE_THEME_SWITCH`): System, Light or Dark, each with a small preview. The
  choice applies at once and is kept in this browser only.
- **Models** (`FEATURE_CUSTOM_MODELS`): your own models. Add one with a provider and your API key,
  edit its name or key, or delete it after confirming its name. A saved key cannot be viewed again.
- **Usage** (`FEATURE_SETTINGS_USAGE`, default off): your token budget for the period, with what
  is used and what remains, and when it resets (in UTC). An unlimited account shows Unlimited.
  **Calculate** adds your activity since you joined: messages, characters and an estimated CO2eq,
  in grams below 1 kg. The estimate is not yet verified. With the flag off, CO2eq stays in the
  user menu.
- **API keys** (`FEATURE_API_KEYS`): create a key with an expiry, copy it from the one-time reveal
  (it is not shown again), and delete a key after confirming its name. A **Quickstart** shows how
  to call EVE with it. Requests made with a key count toward the same token budget as your chats.
- **Account**: **Log out**, with the usual confirmation, your email and the app version when the
  build carries one.

With the page off, the user menu and its dialogs are the ones you already know.
