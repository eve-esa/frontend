# Profile & Authentication

The app provides email-based authentication plus basic profile management.

## Log in
- **Log in** with email and password; a “Remember me” option stores your email locally.

## Password recovery
- **Forgot password**: request a reset link via email.
- **Reset password**: open the link, set a new password, and confirm it.

## Profile updates
- Open the profile menu from the sidebar and choose **Profile**.
- Update first and last name; email is displayed but not editable.
- Where `FEATURE_PROFILE_FIELDS` is on, **Country** and **Institution** follow the names and are required: neither can be emptied.

## Required profile fields
- Where `FEATURE_PROFILE_FIELDS` is on, a signed-in user whose profile lacks a country or an institution sees **Complete your profile** before the chat can be used, new and existing accounts alike.
- It opens after the onboarding tour and the welcome dialog, never on top of them.
- It cannot be closed: no close button, Escape and a click outside do nothing. **Save** stores both through the same profile update; **Logout** signs out.
- Off, the dialog never shows and nothing extra is requested.

## Logout
- Use **Logout** in the profile menu to end the session safely.

