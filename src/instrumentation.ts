/**
 * Intentionally empty. Node-only boot tasks (tunnel restore, DB auto-backup) live in
 * store.ts#bootstrapNodeOnlyServices, triggered on first getDb() call, not here.
 *
 * Next.js builds a separate Edge bundle for this file's register(), and that bundle
 * cannot include better-sqlite3 (native addon). The `webpackIgnore` pragma keeps such
 * an import out of the Edge bundle, but it also stops Node's runtime loader from
 * resolving the `@/` TS path alias, so a dynamic import from here silently no-ops in
 * the standalone production build. store.ts is never reachable from the Edge/middleware
 * graph, so triggering those tasks there resolves correctly in both dev and standalone.
 */
export async function register() {}
