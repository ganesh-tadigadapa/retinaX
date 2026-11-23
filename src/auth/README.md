# `src/auth/` — The door

**Plain job:** decide who is allowed into the building. It has no opinion about what
happens inside.

This folder is completely separate from the medical pipeline. It does not import the
grader, the quality gate, the lesion detector or the rule engine, and none of them import
it. You could delete the whole folder and the screening science would still run.

## The files

| File | Plain job |
|---|---|
| `config.py` | Reads the settings, and refuses to start if they are dangerous |
| `models.py` | What an account is; tidying up the optional WhatsApp number |
| `google.py` | Checks the "Sign in with Google" token really came from Google, for this app |
| `security.py` | Sign-in tickets, and the guards on each door |
| `service.py` | The actual actions: sign in, save a WhatsApp number, sign out, approve a doctor |
| `storage.py` | Remembers accounts. In its own files, never mixed with scans |
| `routes.py` | The web addresses: `/v1/auth/...` |

## No passwords

There is no password box, and no place to put one. You sign in with your Google account:
Google confirms who you are and hands the browser a signed token, and the server checks
that signature itself before letting you in. This service never sees your Google
password.

A phone number is no longer part of signing in. You can save a WhatsApp number on your
account so reports can be sent to you, but it is only an address, not a key.

## Choosing "Doctor" does not make you a doctor

Anyone can tick "Doctor Account" at signup. What that does is create an account marked
**not verified** and file a request. Only two things can mark an account verified — an
administrator using the admin address, or someone with access to the server running
`scripts/approve_doctor.py`. Neither is reachable by filling in a form.

Until then the person can sign in and screen images, but the reports area says
**"Doctor verification pending."**

## The role is never taken from the browser

The sign-in ticket says *which account you are*, not *what you are allowed to do*. Every
time you knock on a protected door, the server looks your account up and reads your role
off its own records. Editing anything in the browser changes what you see drawn on the
screen; it changes nothing about what the server will hand over.

## The first administrator

Someone has to approve the first doctor. The Google emails listed in `ADMIN_EMAILS` (in
the server's environment, not in any form) become administrators the first time they
sign in. See `docs/AUTH.md`.
