# Agent / installer notes for NesaRouter

## Admin password on VPS installs

Production **cannot** start with the development bootstrap password `nesa123456` (or `change-me`). You must set `NESA_ADMIN_PASSWORD` in `.env`.

Do **not** silently pick a random password and leave the operator guessing why the login page no longer shows `nesa123456`.

Preferred options:

1. **Ask the operator** what bootstrap password to put in `.env`, then write that value.
2. If you generate a password, **print it once clearly** in the install summary and tell them to change it under **Routing → Password** after first login.
3. Never claim the app “auto-changed” the password — only `.env` / dashboard password change does.

Local development (`npm run dev`) may omit `NESA_ADMIN_PASSWORD` and use `nesa123456` with an on-screen hint.
