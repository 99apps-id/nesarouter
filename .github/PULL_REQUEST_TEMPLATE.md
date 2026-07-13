## Summary

Describe the user-visible change.

## Verification

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Documentation / CHANGELOG updated when setup, env, providers, or security behavior changes

## Security

- [ ] No credentials, OAuth tokens, `.env` values, or local database files are included
- [ ] New admin/provider APIs redact secrets (no live tokens in JSON/SSR)
