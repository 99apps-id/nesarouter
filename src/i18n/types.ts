export type LocaleCode =
  | "en"
  | "id"
  | "ms"
  | "zh-CN"
  | "zh-TW"
  | "ja"
  | "ko"
  | "ar"
  | "ru"
  | "es"
  | "fr"
  | "de"
  | "pt"
  | "hi"
  | "th"
  | "vi"
  | "tr"
  | "it"
  | "nl"
  | "pl";

export type Messages = {
  language: string;
  common: {
    endpoint: string;
    status: string;
    current: string;
    checking: string;
    copied: string;
    copy: string;
    apply: string;
    applying: string;
    reset: string;
    resetting: string;
    providers: string;
  };
  nav: {
    overview: string;
    providers: string;
    combos: string;
    keys: string;
    usage: string;
    routing: string;
    mcp: string;
    tunnel: string;
    headroom: string;
    cli: string;
    endpointHint: string;
    mainNav: string;
  };
  cli: {
    pageEyebrow: string;
    pageTitle: string;
    heroSubtle: string;
    heroTitle: string;
    heroBody: string;
    clientKeys: string;
    combos: string;
    oauthSubtle: string;
    oauthTitle: string;
    oauthBody: string;
    logSubtle: string;
    logTitle: string;
    logBody: string;
    openUsage: string;
    panelSubtle: string;
    panelTitle: string;
    panelBodyBefore: string;
    panelBodyAfter: string;
    targetRouting: string;
    clientKey: string;
    createKeyOnApply: string;
    newKeySuffix: string;
    endpointOverride: string;
    activeEndpoint: string;
    applyPatch: string;
    generateConfig: string;
    hideScript: string;
    showScript: string;
    nonPatchableHint: string;
    patchedOk: string;
    noLocalFile: string;
    applyFailed: string;
    resetFailed: string;
    copyNewKey: string;
    patchedFiles: string;
    testConnection: string;
    testing: string;
    testNeedsNewKey: string;
    testFailed: string;
    remoteScriptHint: string;
    applyFirstForScript: string;
    connected: string;
    otherEndpoint: string;
    manualOnly: string;
    notConfigured: string;
  };
};

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export const en: Messages = {
  language: "Language",
  common: {
    endpoint: "Endpoint",
    status: "Status",
    current: "Current",
    checking: "Checking…",
    copied: "Copied",
    copy: "Copy",
    apply: "Apply",
    applying: "Applying…",
    reset: "Reset",
    resetting: "Resetting…",
    providers: "Providers"
  },
  nav: {
    overview: "Overview",
    providers: "Providers",
    combos: "Combos",
    keys: "Keys",
    usage: "Usage",
    routing: "Routing",
    mcp: "MCP",
    tunnel: "Tunnel",
    headroom: "Headroom",
    cli: "CLI",
    endpointHint: "Manage client keys in Keys.",
    mainNav: "Main navigation"
  },
  cli: {
    pageEyebrow: "CLI",
    pageTitle: "CLI Tools",
    heroSubtle: "Local apply",
    heroTitle: "Connect CLIs with Apply / Patch",
    heroBody:
      "Same idea as 9router: pick a tool → pick a client key → Apply. Config is merged into local CLI settings on this machine. No manual .env / JSON edits.",
    clientKeys: "Client keys",
    combos: "Combos",
    oauthSubtle: "Subscription OAuth",
    oauthTitle: "Claude / Codex via subscription",
    oauthBody:
      "Add an OAuth preset under Providers, click Connect — tokens stay encrypted in NesaRouter. The CLI still uses the NesaRouter endpoint; subscription routing happens on the server.",
    logSubtle: "Log",
    logTitle: "Request log",
    logBody: "Every CLI request is recorded in Usage — provider, cost, cache, fallback.",
    openUsage: "Open Usage",
    panelSubtle: "Like 9router",
    panelTitle: "Apply / Patch CLI",
    panelBodyBefore: "Pick a tool, key, and routing target, then",
    panelBodyAfter:
      ". NesaRouter merges overrides into local settings on this machine (without wiping other settings). Reset removes the NesaRouter patch.",
    targetRouting: "Routing target",
    clientKey: "Client key",
    createKeyOnApply: "Create a new key on Apply",
    newKeySuffix: "(new)",
    endpointOverride: "Endpoint override (optional)",
    activeEndpoint: "Active endpoint",
    applyPatch: "Apply / Patch",
    generateConfig: "Generate config",
    hideScript: "Hide remote script",
    showScript: "Remote script (optional)",
    nonPatchableHint:
      "This tool has no automatic local file patch — Apply prepares instructions / env. Claude Code, Gemini CLI, Qwen, OpenClaw, and Continue patch local settings directly.",
    patchedOk: "Settings patched. The CLI is ready to use NesaRouter.",
    noLocalFile: "No local file for this tool.",
    applyFailed: "Apply / patch failed.",
    resetFailed: "Reset failed.",
    copyNewKey: "Copy new key",
    patchedFiles: "Patched:",
    testConnection: "Test connection",
    testing: "Testing…",
    testNeedsNewKey: "Testing needs a newly created key from Apply (existing keys are not shown again).",
    testFailed: "Test failed.",
    remoteScriptHint: "If the CLI runs on another machine (not the NesaRouter host), run this merge script there.",
    applyFirstForScript: "Click Apply first so the remote script uses the same key.",
    connected: "Connected",
    otherEndpoint: "Other endpoint",
    manualOnly: "Manual only",
    notConfigured: "Not configured"
  }
};

export function mergeMessages(base: Messages, patch?: DeepPartial<Messages>): Messages {
  if (!patch) return base;
  return {
    language: patch.language ?? base.language,
    common: { ...base.common, ...patch.common },
    nav: { ...base.nav, ...patch.nav },
    cli: { ...base.cli, ...patch.cli }
  };
}
