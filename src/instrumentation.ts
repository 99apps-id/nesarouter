export async function register() {
  // Node only — never import store/sqlite on the Edge instrumentation graph.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    // webpackIgnore: prevent static analysis of the Node restore chain.
    await import(/* webpackIgnore: true */ "@/lib/tunnel/bootRestore").then((mod) =>
      mod.restoreRemoteAccess()
    );
  } catch {
    // Boot restore is best-effort; /api/tunnel/status will retry once.
  }
}
