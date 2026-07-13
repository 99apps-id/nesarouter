# Design

## Product

NesaRouter is a local-first AI gateway dashboard for routing, budget guard, provider management, OAuth/account connect, token savers, and usage visibility.

## Visual Direction

Dark network operations console: near-black shell, layered graphite panels, measured teal identity, copper warning accents, and compact surfaces built for scanning. The feeling should be closer to an AI routing gateway/control room than a blank admin template.

## Color Tokens

Use OKLCH color tokens only.

```css
:root {
  --bg: oklch(0.13 0.018 245);
  --shell: oklch(0.1 0.016 245);
  --surface: oklch(0.18 0.022 245);
  --surface-strong: oklch(0.235 0.03 240);
  --surface-soft: oklch(0.155 0.018 245);
  --ink: oklch(0.935 0.01 220);
  --muted: oklch(0.68 0.025 225);
  --border: oklch(0.31 0.035 235);
  --primary: oklch(0.72 0.11 188);
  --primary-strong: oklch(0.8 0.13 188);
  --accent: oklch(0.73 0.14 54);
  --success: oklch(0.72 0.13 154);
  --warning: oklch(0.78 0.14 72);
  --danger: oklch(0.68 0.17 28);
}
```

## Typography

Use a system sans stack. Product UI uses a tight fixed rem scale: 12px metadata, 14px labels/body, 16px emphasized values, 20-28px page headings.

## Components

- App shell: left navigation, top status strip, dense dashboard content.
- Cards: only for individual repeated or summarized objects; radius 8px.
- Buttons: compact, icon-capable, consistent states.
- Tables and logs: readable first, decorative never.
- Status pills: text plus color, never color alone.
- Alert banner: used for must-change-password and similar blocking operator tasks — clear, not decorative.
- Login: temporary default-password hint only while still on bootstrap; disappear after password change.
- Provider groups: separate OAuth / account sign-in from API-key / free / paid pools.
- Provider detail OAuth account list: status text plus color (never color alone); Add account / Use / Remove without echoing tokens.
- Usage live map: hub-centered provider topology; nodes spaced so labels remain readable; animate only a recent, logged route and keep idle links still; respect `prefers-reduced-motion`.

## Motion

Use short 150-220ms transitions for state changes, counters, and live routing events. Respect `prefers-reduced-motion`.

## Security UX

- Until the admin password is changed, navigation is limited to **Routing** and a persistent banner explains why.
- Secrets in forms and lists show masks (`********`) or previews — never full tokens after create.
- OAuth connect flows should show clear success / error states without echoing tokens back into the browser.
- Multi-account OAuth status probes must not print access tokens, refresh tokens, or device client secrets into the UI or logs.
