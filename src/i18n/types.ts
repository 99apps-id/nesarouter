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
    save: string;
    saved: string;
    auto: string;
    on: string;
    off: string;
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
  shell: {
    dashboard: string;
    brandTagline: string;
    light: string;
    dark: string;
    switchToLight: string;
    switchToDark: string;
    clientKeys: string;
    provider: string;
    bridge: string;
    remoteAccess: string;
    compressionProxy: string;
    updateAvailable: string;
    youAreOn: string;
    viewReleaseNotes: string;
    checkGithub: string;
    dismissUpdate: string;
    changePasswordTitle: string;
    changePasswordBody: string;
    signOut: string;
    signingOut: string;
  };
  overview: {
    metricsAria: string;
    spendToday: string;
    budgetLeft: string;
    providersActive: string;
    requests: string;
    budgetGuardActive: string;
    savingsToday: string;
    savedAmount: string;
    noSavingsYet: string;
    viaCache: string;
    freeTierReq: string;
    cacheHits: string;
    systemStatus: string;
    sqlite: string;
    encryptedKeys: string;
    fallbackReady: string;
  };
  routerPanel: {
    title: string;
    laneAria: string;
    userApp: string;
    cache: string;
    budget: string;
    evaluator: string;
    provider: string;
    mode: string;
    strategy: string;
    fallback: string;
    active: string;
    connected: string;
    roundRobin: string;
    priority: string;
    unknown: string;
  };
  settings: {
    publicUrlSubtle: string;
    domain: string;
    publicUrlBody: string;
    publicBaseUrl: string;
    budgetSubtle: string;
    limits: string;
    dailyBudget: string;
    dailyBudgetAria: string;
    warningPct: string;
    criticalPct: string;
    mode: string;
    modeAuto: string;
    modeFree: string;
    modeCheap: string;
    modeBest: string;
    modeManual: string;
    manualProvider: string;
    selectProvider: string;
    noActiveProviders: string;
    choosingSetsManual: string;
    pickProviderManual: string;
    selectedNotActive: string;
    providerStrategy: string;
    priority: string;
    roundRobin: string;
    fallback: string;
    evaluator: string;
    onWarning: string;
    preferCheaper: string;
    notifyOnly: string;
    onCritical: string;
    freeTierOnly: string;
    onExceeded: string;
    blockPaid: string;
    allow: string;
    cache: string;
    freeTier: string;
    rtk: string;
    headroomCompress: string;
    headroomUrl: string;
    compressUserMessages: string;
    pxpipe: string;
    upstreamLoad: string;
    concurrencyQueue: string;
    concurrencyBody: string;
    maxConcurrentGlobal: string;
    maxConcurrentPerProvider: string;
    queueWaitMs: string;
    mediaApis: string;
    mediaRouting: string;
    mediaBody: string;
    images: string;
    speech: string;
    transcriptions: string;
    embeddings: string;
    webSearch: string;
    webSearchBuiltin: string;
    autoRouting: string;
    caveman: string;
    ponytail: string;
  };
  password: {
    admin: string;
    title: string;
    current: string;
    next: string;
    save: string;
    updated: string;
    failed: string;
  };
  aliases: {
    subtle: string;
    title: string;
    body: string;
    empty: string;
    alias: string;
    target: string;
    targetPlaceholder: string;
    add: string;
    delete: string;
    importLabel: string;
    importPlaceholder: string;
    importButton: string;
    importing: string;
    importPasteFirst: string;
    importInvalidJson: string;
    importFailed: string;
    importSummary: string;
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
    providers: "Providers",
    save: "Save",
    saved: "Saved",
    auto: "Auto",
    on: "On",
    off: "Off"
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
  shell: {
    dashboard: "Dashboard",
    brandTagline: "Smart AI gateway",
    light: "Light",
    dark: "Dark",
    switchToLight: "Switch to light theme",
    switchToDark: "Switch to dark theme",
    clientKeys: "Client Keys",
    provider: "Provider",
    bridge: "Bridge",
    remoteAccess: "Remote access",
    compressionProxy: "Compression proxy",
    updateAvailable: "Update available: v{version}",
    youAreOn: "You are on v{version}.",
    viewReleaseNotes: "View release notes",
    checkGithub: "Check GitHub for the latest release.",
    dismissUpdate: "Dismiss update banner",
    changePasswordTitle: "Change temporary default password",
    changePasswordBody: "Use Password below. Other menus unlock after you save a new password.",
    signOut: "Sign out",
    signingOut: "Signing out…"
  },
  overview: {
    metricsAria: "Overview metrics",
    spendToday: "Spend today",
    budgetLeft: "Budget left",
    providersActive: "Providers active",
    requests: "Requests today",
    budgetGuardActive: "Budget guard active",
    savingsToday: "Savings today",
    savedAmount: "{amount} saved",
    noSavingsYet: "No savings yet today",
    viaCache: "{amount} via cache",
    freeTierReq: "{count} free-tier req",
    cacheHits: "{count} cache hits",
    systemStatus: "System status",
    sqlite: "SQLite",
    encryptedKeys: "Encrypted keys",
    fallbackReady: "Fallback ready"
  },
  routerPanel: {
    title: "Router",
    laneAria: "Routing lane",
    userApp: "User/App",
    cache: "Cache",
    budget: "Budget",
    evaluator: "Evaluator",
    provider: "Provider",
    mode: "Mode",
    strategy: "Strategy",
    fallback: "Fallback",
    active: "Active",
    connected: "Connected",
    roundRobin: "Round robin",
    priority: "Priority",
    unknown: "unknown"
  },
  settings: {
    publicUrlSubtle: "Public URL",
    domain: "Domain",
    publicUrlBody:
      "Set this to the HTTPS URL you open in the browser (e.g. https://nesa.example.com). OAuth and post-login redirects use it so the app returns to your domain instead of localhost.",
    publicBaseUrl: "Public base URL",
    budgetSubtle: "Budget",
    limits: "Limits",
    dailyBudget: "Daily budget",
    dailyBudgetAria: "Daily budget in US dollars",
    warningPct: "Warning %",
    criticalPct: "Critical %",
    mode: "Mode",
    modeAuto: "Auto",
    modeFree: "Free",
    modeCheap: "Cheap",
    modeBest: "Best",
    modeManual: "Manual",
    manualProvider: "Manual provider",
    selectProvider: "Select provider…",
    noActiveProviders: "No active providers — enable one under Providers first.",
    choosingSetsManual: "Choosing a provider here sets Mode to Manual automatically. Then Save.",
    pickProviderManual: "Pick a provider above, then Save. Manual mode will not route until a provider is selected.",
    selectedNotActive: "Selected provider is not active — activate it under Providers or choose another one.",
    providerStrategy: "Provider strategy",
    priority: "Priority",
    roundRobin: "Round robin",
    fallback: "Fallback",
    evaluator: "Evaluator",
    onWarning: "On warning",
    preferCheaper: "Prefer cheaper",
    notifyOnly: "Notify only",
    onCritical: "On critical",
    freeTierOnly: "Free & free tier",
    onExceeded: "On exceeded",
    blockPaid: "Block paid",
    allow: "Allow",
    cache: "Cache",
    freeTier: "Free tier",
    rtk: "RTK (compress tool_result — git/grep/ls/logs)",
    headroomCompress: "Headroom compress (external proxy)",
    headroomUrl: "Headroom URL",
    compressUserMessages: "Also compress user messages",
    pxpipe: "pxpipe-lite (in-process tool compress)",
    upstreamLoad: "Upstream load",
    concurrencyQueue: "Concurrency queue",
    concurrencyBody:
      "Limit parallel upstream calls to protect rate limits. Set a value to 0 for unlimited (default).",
    maxConcurrentGlobal: "Max concurrent (global)",
    maxConcurrentPerProvider: "Max concurrent (per provider)",
    queueWaitMs: "Queue wait (ms)",
    mediaApis: "Media APIs",
    mediaRouting: "Media routing",
    mediaBody:
      "Pin images, speech, transcriptions, and embeddings to a specific OpenAI-compatible provider, or leave on Auto to use the main routing engine. Web search uses the built-in DuckDuckGo endpoint (no provider key).",
    images: "Images",
    speech: "Speech (TTS)",
    transcriptions: "Transcriptions (STT)",
    embeddings: "Embeddings",
    webSearch: "Web search",
    webSearchBuiltin: "Built-in (DuckDuckGo)",
    autoRouting: "Auto (routing engine)",
    caveman: "Caveman",
    ponytail: "Ponytail"
  },
  password: {
    admin: "Admin",
    title: "Password",
    current: "Current password",
    next: "New password",
    save: "Save password",
    updated: "Password updated. Reloading…",
    failed: "Failed to update password."
  },
  aliases: {
    subtle: "Short model names",
    title: "Aliases",
    body: 'Map model: "fast" to a provider model or combo. Call Codex with cx/gpt-… (e.g. cx/gpt-5.6-sol), Claude with cc/…, and other providers with their short prefixes.',
    empty: "No aliases yet.",
    alias: "Alias",
    target: "Target",
    targetPlaceholder: "provider model or combo name",
    add: "Add alias",
    delete: "Delete",
    importLabel: "Import 9router JSON",
    importPlaceholder: '{"aliases":{"fast":"or/meta-llama/..."}}',
    importButton: "Import 9router JSON",
    importing: "Importing…",
    importPasteFirst: "Paste JSON from 9router GET /api/models/alias first.",
    importInvalidJson: "Invalid JSON.",
    importFailed: "Import failed.",
    importSummary: "{added} added, {updated} updated, {skipped} skipped."
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

function mergeSection<T extends Record<string, unknown>>(base: T, patch?: DeepPartial<T>): T {
  return { ...base, ...(patch ?? {}) } as T;
}

export function mergeMessages(base: Messages, patch?: DeepPartial<Messages>): Messages {
  if (!patch) return base;
  return {
    language: patch.language ?? base.language,
    common: mergeSection(base.common, patch.common),
    nav: mergeSection(base.nav, patch.nav),
    shell: mergeSection(base.shell, patch.shell),
    overview: mergeSection(base.overview, patch.overview),
    routerPanel: mergeSection(base.routerPanel, patch.routerPanel),
    settings: mergeSection(base.settings, patch.settings),
    password: mergeSection(base.password, patch.password),
    aliases: mergeSection(base.aliases, patch.aliases),
    cli: mergeSection(base.cli, patch.cli)
  };
}

export function formatMessage(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}
