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
- Where `FEATURE_PROFILE_FIELDS` is on, two optional fields follow the names: **Country** and **Institution**. Emptying one and saving clears it.

## Logout
- Use **Logout** in the profile menu to end the session safely.

