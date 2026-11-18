# Settings

Flag `FEATURE_SETTINGS_PAGE`, default off. With it on, the user menu holds **Settings**, **About
us**, **Contact us**, **Privacy policy** and **Log out**, and Settings opens the page at
`/settings/profile`.

## Sections

The list at the left (a **Section** select on a phone) shows only the sections that are on in your
environment. A link to a section that is not listed opens Profile.

- **Profile**: your name, country and institution (country and institution with
  `FEATURE_PROFILE_FIELDS`). Your email comes from your sign-in and is read only. **Save changes**
  stays disabled, with "No changes to save.", until a field changes.
- **Appearance** (`FEATURE_THEME_SWITCH`): System, Light or Dark. The choice applies at once and is
  kept in this browser.
- **Models** (`FEATURE_CUSTOM_MODELS`) and **API keys** (`FEATURE_API_KEYS`): the headings are in
  place, the content follows.
- **Usage** (`FEATURE_SETTINGS_USAGE`, default off): the heading is in place, the content follows.
  With the flag off, CO2eq stays in the user menu.
- **Account**: **Log out**, with the usual confirmation, and the app version.

With the page off, the user menu and its dialogs are the ones you already know.
