# Product

## Register

product

## Users

NesaRouter is for developers, builders, and small teams who use AI coding tools or internal apps and need one local gateway for many LLM providers. They are often working from a laptop or a small VPS, watching token cost, provider limits, free tiers, and API key sprawl while trying to keep their workflow uninterrupted.

## Product Purpose

NesaRouter, the Next Smart Adaptive Router, provides one OpenAI-compatible endpoint that manages provider credentials, routes requests intelligently, prefers free or cheaper capable providers, falls back when a provider fails, and tracks usage, cost, cache savings, and budget status. Success means the user can point CLI tools and apps at one endpoint, spend less, and understand exactly why a provider was chosen.

## Capabilities (current)

- **Unified `/v1` gateway** for chat, responses, messages, embeddings, media, search, and guarded web fetch.
- **Smart routing** with budget guard, cache, combos, aliases, and per-request audit trail.
- **Dual credential model**: usage-billed API keys vs subscription OAuth / IDE import (Claude, ChatGPT/Codex, Gemini CLI, Copilot, Kiro, Antigravity, Cursor).
- **Token savers**: Caveman (default lite) + RTK tool-result compression; optional Headroom / pxpipe hooks.
- **Local operator console**: providers, keys, routing, usage, MCP, tunnel, CLI helpers.
- **Security defaults for self-host**: encrypted secrets at rest, must-change bootstrap password, revocable admin sessions, redacted admin APIs, empty client keys = locked `/v1`.

## Brand Personality

Calm, technical, and trustworthy. The product should feel like a precise control room for AI spend: quiet enough for repeated daily use, but alive enough that users can see routing, budget guard, and usage telemetry working.

## Anti-references

Avoid generic SaaS landing-page visuals, oversized hero marketing pages, decorative gradients, glass-heavy dashboards, and playful UI that makes cost/security controls feel unserious. Avoid cloning 9Router visually; it is a reference for capability, not the NesaRouter identity.

## Design Principles

- Default to local-first clarity: the app should be usable on localhost or a small VPS without external infrastructure.
- Make savings visible: cache hits, free-tier routing, downgrades, RTK/Caveman savings, and skipped expensive providers should be understandable at a glance.
- Put budget guard in the core path: provider choice must respect remaining budget before a request is sent.
- Prefer earned familiarity: standard dashboard patterns, clear tables, predictable controls, and no decorative surprises.
- Design for operator confidence: every request should leave an audit trail with provider, model, tier, cost source, and routing reason.
- Fail closed on auth: no client keys means no `/v1`; bootstrap password must be changed before the full dashboard unlocks.

## Accessibility & Inclusion

Target WCAG AA contrast, keyboard-accessible controls, readable dense data, and reduced-motion alternatives for dashboard animations. Color must never be the only signal for provider health, budget warnings, or request status.
