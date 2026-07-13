# Third Party Notices

NesaRouter is an independent project. Some deployment and routing ideas were
informed by reading 9router, which is distributed under the MIT License.

## 9router

- Repository: https://github.com/decolua/9router
- Copyright: 2024-2026 decolua and contributors
- License: MIT

No 9router source file is vendored directly in this repository.

## Public CLI OAuth client identifiers

NesaRouter includes OAuth presets that reuse **public** client IDs (and, where
applicable, public client secrets) published by official CLI / IDE tools so
operators can connect subscription accounts without registering a separate app.

These values are not NesaRouter credentials. Tokens obtained through these flows
are stored encrypted at rest under your `NESA_ENCRYPTION_KEY`. Do not treat the
embedded client IDs as private API keys.

| Provider preset | Upstream product | Notes |
| --- | --- | --- |
| Claude (Anthropic subscription) | Claude Code / Claude.ai OAuth | Public CLI client ID |
| ChatGPT (Codex) | OpenAI Codex / ChatGPT OAuth | Public CLI client ID |
| Gemini CLI | Google Gemini CLI | Public OAuth client |
| Antigravity | Google Cloud Code / Antigravity | Public OAuth client |
| GitHub Copilot | GitHub device flow | Public device-flow client |
| Kiro (AWS Builder ID) | AWS SSO OIDC dynamic registration | Client id/secret registered at connect time |
| Cursor IDE | Local Cursor `state.vscdb` import | No browser OAuth client; imports local IDE tokens |

Upstream trademarks and services remain the property of their respective owners.
NesaRouter is not affiliated with Anthropic, OpenAI, Google, GitHub, Amazon, or
Cursor except as an independent local gateway that can call their APIs.
