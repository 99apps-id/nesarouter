import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { CacheEntry, Combo, McpServer, NesaStore, ProviderConfig, UsageLog } from "@/core/types";
import { defaultStore } from "@/lib/defaults";
import { decryptSecret, encryptSecret, isRedactedSecret } from "@/lib/crypto";

const projectDataRoot = process.env.INIT_CWD || process.cwd();
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(projectDataRoot, "data");
const dbPath = path.join(dataDir, "nesa-router.sqlite");
const legacyStorePath = path.join(dataDir, "nesa-store.json");

let db: Database.Database | undefined;

function getDb() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (!db) {
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    seedIfEmpty(db);
  }
  // Always re-check: new presets (e.g. Runware.ai) must appear without requiring
  // a full process restart after hot-reload / code update.
  ensureDefaultProviders(db);
  return db;
}

/** Insert any catalog presets missing from the DB. Returns newly added ids. */
export function seedMissingProviders(): string[] {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (!db) {
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    seedIfEmpty(db);
  }
  return ensureDefaultProviders(db);
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      tier TEXT NOT NULL,
      status TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key_encrypted TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL,
      priority INTEGER NOT NULL,
      input_cost_per_mtok REAL NOT NULL,
      output_cost_per_mtok REAL NOT NULL,
      rate_limited_until TEXT,
      last_error TEXT
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      model TEXT NOT NULL,
      tier TEXT NOT NULL,
      task_type TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      total_cost_usd REAL NOT NULL,
      cost_source TEXT NOT NULL,
      cache_status TEXT NOT NULL,
      budget_status TEXT NOT NULL,
      routing_reason TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT
    );
    CREATE TABLE IF NOT EXISTS cache_entries (
      key TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      model TEXT NOT NULL,
      response_json TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      saved_cost_usd REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_api_keys (
      token TEXT PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS combos (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      provider_ids TEXT NOT NULL,
      strategy TEXT NOT NULL DEFAULT 'fallback'
    );

    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      command TEXT NOT NULL,
      args TEXT NOT NULL DEFAULT '[]',
      env TEXT NOT NULL DEFAULT '{}'
    );
  `);

  ensureColumn(database, "providers", "connection_status", "TEXT NOT NULL DEFAULT 'unknown'");
  ensureColumn(database, "providers", "last_checked_at", "TEXT");
  ensureColumn(database, "providers", "api_keys", "TEXT");
  ensureColumn(database, "providers", "quota_limit_tokens", "INTEGER");
  ensureColumn(database, "providers", "models", "TEXT");
  ensureColumn(database, "providers", "oauth_profile", "TEXT");
  ensureColumn(database, "providers", "oauth_access_token_encrypted", "TEXT");
  ensureColumn(database, "providers", "oauth_refresh_token_encrypted", "TEXT");
  ensureColumn(database, "providers", "oauth_token_expires_at", "TEXT");
  ensureColumn(database, "providers", "oauth_last_refresh_at", "TEXT");
  ensureColumn(database, "providers", "oauth_copilot_token_encrypted", "TEXT");
  ensureColumn(database, "providers", "oauth_copilot_token_expires_at", "TEXT");
  ensureColumn(database, "providers", "oauth_project_id", "TEXT");
  ensureColumn(database, "providers", "oauth_device_client_id", "TEXT");
  ensureColumn(database, "providers", "oauth_device_client_secret_encrypted", "TEXT");
  ensureColumn(database, "providers", "oauth_machine_id", "TEXT");
  ensureColumn(database, "providers", "proxy_url", "TEXT");
  ensureColumn(database, "usage_logs", "skipped_providers", "TEXT");
  ensureColumn(database, "combos", "judge_provider_id", "TEXT");
  migrateLocalApiKeysEncryption(database);
}

/** Encrypt any leftover plaintext client API keys at rest (idempotent). */
function migrateLocalApiKeysEncryption(database: Database.Database) {
  const rows = database.prepare("SELECT token FROM local_api_keys").all() as Array<{ token: string }>;
  for (const { token } of rows) {
    if (!token || token.startsWith("nesa:v1:")) continue;
    const encrypted = encryptSecret(token);
    database.prepare("DELETE FROM local_api_keys WHERE token = ?").run(token);
    database.prepare("INSERT OR IGNORE INTO local_api_keys (token) VALUES (?)").run(encrypted);
  }
}

function ensureColumn(database: Database.Database, table: string, column: string, definition: string) {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    database.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function seedIfEmpty(database: Database.Database) {
  const providerCount = database.prepare("SELECT COUNT(*) as count FROM providers").get() as { count: number };
  if (providerCount.count > 0) return;

  let seed = defaultStore;
  if (existsSync(legacyStorePath)) {
    try {
      seed = { ...defaultStore, ...(JSON.parse(readFileSync(legacyStorePath, "utf8")) as Partial<NesaStore>) };
    } catch {
      seed = defaultStore;
    }
  }
  writeStoreToDb(database, seed);
}

function ensureDefaultProviders(database: Database.Database): string[] {
  const added: string[] = [];
  const transaction = database.transaction(() => {
    // Kiro moved from the old token/API-key preset to oauth-kiro. Remove only
    // the untouched seeded card; preserve a configured legacy credential.
    const legacyKiro = database.prepare(
      "SELECT api_key_encrypted, api_keys, oauth_access_token_encrypted FROM providers WHERE id = 'kiro'"
    ).get() as { api_key_encrypted?: string; api_keys?: string | null; oauth_access_token_encrypted?: string } | undefined;
    if (legacyKiro) {
      const hasCredential = Boolean(
        legacyKiro.api_key_encrypted ||
        (legacyKiro.api_keys && legacyKiro.api_keys !== "[]") ||
        legacyKiro.oauth_access_token_encrypted
      );
      if (hasCredential) {
        database.prepare("UPDATE providers SET name = 'Kiro legacy token' WHERE id = 'kiro' AND name = 'Kiro AI'").run();
      } else {
        database.prepare("DELETE FROM providers WHERE id = 'kiro'").run();
      }
    }

    const renamedApiPresets = [
      ["gemini-flash", "Gemini Flash", "Gemini API (Flash)"],
      ["gemini-pro", "Gemini Pro", "Gemini API (Pro)"],
      ["openai-compatible", "OpenAI Compatible", "OpenAI API (usage billing)"],
      ["openai-gpt-4o", "OpenAI GPT-4o", "OpenAI API (GPT-4o)"]
    ] as const;
    for (const [id, previousName, nextName] of renamedApiPresets) {
      database.prepare("UPDATE providers SET name = ? WHERE id = ? AND name = ?").run(nextName, id, previousName);
    }

    for (const provider of defaultStore.providers) {
      const exists = database.prepare("SELECT id FROM providers WHERE id = ?").get(provider.id) as
        | { id: string }
        | undefined;
      if (exists) {
        if (provider.oauthProfile) {
          database
            .prepare(
              `UPDATE providers
               SET name = ?, type = ?, oauth_profile = COALESCE(NULLIF(oauth_profile, ''), ?)
               WHERE id = ?`
            )
            .run(provider.name, provider.type, provider.oauthProfile, provider.id);
        }
        continue;
      }
      try {
        writeProviderToDb(database, provider);
        added.push(provider.id);
      } catch (error) {
        console.error(`[nesa] failed to seed provider ${provider.id}:`, error);
      }
    }

    database
      .prepare("UPDATE providers SET model = ? WHERE id = ? AND model = ?")
      .run("openrouter/free", "openrouter-free", "meta-llama/llama-3.1-8b-instruct:free");
  });
  transaction();
  return added;
}

function writeSetting(database: Database.Database, key: string, value: unknown) {
  database
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, JSON.stringify(value));
}

function readSetting<T>(database: Database.Database, key: string, fallback: T): T {
  const row = database.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

function parseApiKeys(raw: any): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const decoded = parsed.map((k: unknown) => decryptSecret(String(k))).filter(Boolean);
      return decoded.length ? decoded : undefined;
    }
  } catch {}
  return undefined;
}

function parseStringArray(raw: any): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const items = parsed.map((v: unknown) => String(v)).filter(Boolean);
      return items.length ? items : undefined;
    }
  } catch {}
  return undefined;
}

function providerFromRow(row: any): ProviderConfig {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    tier: row.tier,
    status: row.status,
    baseUrl: row.base_url,
    apiKey: decryptSecret(row.api_key_encrypted || ""),
    apiKeys: parseApiKeys(row.api_keys),
    model: row.model,
    priority: row.priority,
    inputCostPerMTok: row.input_cost_per_mtok,
    outputCostPerMTok: row.output_cost_per_mtok,
    rateLimitedUntil: row.rate_limited_until ?? undefined,
    lastError: row.last_error ?? undefined,
    connectionStatus: row.connection_status ?? "unknown",
    lastCheckedAt: row.last_checked_at ?? undefined,
    quotaLimitTokens: row.quota_limit_tokens ?? undefined,
    models: parseStringArray(row.models),
    oauthProfile: row.oauth_profile ?? undefined,
    oauthAccessToken: row.oauth_access_token_encrypted ? decryptSecret(row.oauth_access_token_encrypted) : undefined,
    oauthRefreshToken: row.oauth_refresh_token_encrypted ? decryptSecret(row.oauth_refresh_token_encrypted) : undefined,
    oauthTokenExpiresAt: row.oauth_token_expires_at ?? undefined,
    oauthLastRefreshAt: row.oauth_last_refresh_at ?? undefined,
    oauthCopilotToken: row.oauth_copilot_token_encrypted ? decryptSecret(row.oauth_copilot_token_encrypted) : undefined,
    oauthCopilotTokenExpiresAt: row.oauth_copilot_token_expires_at ?? undefined,
    oauthProjectId: row.oauth_project_id ?? undefined,
    oauthDeviceClientId: row.oauth_device_client_id ?? undefined,
    oauthDeviceClientSecret: row.oauth_device_client_secret_encrypted ? decryptSecret(row.oauth_device_client_secret_encrypted) : undefined,
    oauthMachineId: row.oauth_machine_id ?? undefined,
    proxyUrl: row.proxy_url ?? undefined
  };
}

function writeProviderToDb(database: Database.Database, provider: ProviderConfig, existingEncryptedKey = "") {
  const normalizedApiKey = String(provider.apiKey ?? "").trim().replace(/^Bearer\s+/i, "").trim();
  const usableApiKey = normalizedApiKey && !isRedactedSecret(normalizedApiKey) ? normalizedApiKey : "";
  const apiKeyEncrypted = usableApiKey ? encryptSecret(usableApiKey) : existingEncryptedKey;
  const extraKeys = Array.isArray(provider.apiKeys)
    ? provider.apiKeys.map((k) => k.trim()).filter((k) => Boolean(k) && !isRedactedSecret(k))
    : [];
  const apiKeysEncrypted = extraKeys.length ? JSON.stringify(extraKeys.map((k) => encryptSecret(k))) : null;
  const oauthAccessEncrypted =
    provider.oauthAccessToken && !isRedactedSecret(provider.oauthAccessToken)
      ? encryptSecret(provider.oauthAccessToken.trim())
      : null;
  const oauthRefreshEncrypted =
    provider.oauthRefreshToken && !isRedactedSecret(provider.oauthRefreshToken)
      ? encryptSecret(provider.oauthRefreshToken.trim())
      : null;
  const oauthCopilotEncrypted =
    provider.oauthCopilotToken && !isRedactedSecret(provider.oauthCopilotToken)
      ? encryptSecret(provider.oauthCopilotToken.trim())
      : null;
  const oauthDeviceSecretEncrypted =
    provider.oauthDeviceClientSecret && !isRedactedSecret(provider.oauthDeviceClientSecret)
      ? encryptSecret(provider.oauthDeviceClientSecret.trim())
      : null;
  database
    .prepare(`
      INSERT INTO providers (
        id, name, type, tier, status, base_url, api_key_encrypted, api_keys, model, priority,
        input_cost_per_mtok, output_cost_per_mtok, rate_limited_until, last_error,
        connection_status, last_checked_at, quota_limit_tokens, models,
        oauth_profile, oauth_access_token_encrypted, oauth_refresh_token_encrypted,
        oauth_token_expires_at, oauth_last_refresh_at,
        oauth_copilot_token_encrypted, oauth_copilot_token_expires_at,
        oauth_project_id, oauth_device_client_id, oauth_device_client_secret_encrypted, oauth_machine_id, proxy_url
      ) VALUES (
        @id, @name, @type, @tier, @status, @baseUrl, @apiKeyEncrypted, @apiKeys, @model, @priority,
        @inputCostPerMTok, @outputCostPerMTok, @rateLimitedUntil, @lastError,
        @connectionStatus, @lastCheckedAt, @quotaLimitTokens, @models,
        @oauthProfile, @oauthAccessEncrypted, @oauthRefreshEncrypted,
        @oauthTokenExpiresAt, @oauthLastRefreshAt,
        @oauthCopilotEncrypted, @oauthCopilotTokenExpiresAt,
        @oauthProjectId, @oauthDeviceClientId, @oauthDeviceSecretEncrypted, @oauthMachineId, @proxyUrl
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        tier = excluded.tier,
        status = excluded.status,
        base_url = excluded.base_url,
        api_key_encrypted = excluded.api_key_encrypted,
        api_keys = excluded.api_keys,
        model = excluded.model,
        priority = excluded.priority,
        input_cost_per_mtok = excluded.input_cost_per_mtok,
        output_cost_per_mtok = excluded.output_cost_per_mtok,
        rate_limited_until = excluded.rate_limited_until,
        last_error = excluded.last_error,
        connection_status = excluded.connection_status,
        last_checked_at = excluded.last_checked_at,
        quota_limit_tokens = excluded.quota_limit_tokens,
        models = excluded.models,
        oauth_profile = excluded.oauth_profile,
        oauth_access_token_encrypted = excluded.oauth_access_token_encrypted,
        oauth_refresh_token_encrypted = excluded.oauth_refresh_token_encrypted,
        oauth_token_expires_at = excluded.oauth_token_expires_at,
        oauth_last_refresh_at = excluded.oauth_last_refresh_at,
        oauth_copilot_token_encrypted = excluded.oauth_copilot_token_encrypted,
        oauth_copilot_token_expires_at = excluded.oauth_copilot_token_expires_at,
        oauth_project_id = excluded.oauth_project_id,
        oauth_device_client_id = excluded.oauth_device_client_id,
        oauth_device_client_secret_encrypted = excluded.oauth_device_client_secret_encrypted,
        oauth_machine_id = excluded.oauth_machine_id,
        proxy_url = excluded.proxy_url
    `)
    .run({
      ...provider,
      apiKeyEncrypted,
      apiKeys: apiKeysEncrypted,
      rateLimitedUntil: provider.rateLimitedUntil ?? null,
      lastError: provider.lastError ?? null,
      connectionStatus: provider.connectionStatus ?? "unknown",
      lastCheckedAt: provider.lastCheckedAt ?? null,
      quotaLimitTokens: provider.quotaLimitTokens ?? null,
      models: Array.isArray(provider.models) ? JSON.stringify(provider.models) : null,
      oauthProfile: provider.oauthProfile ?? null,
      oauthAccessEncrypted,
      oauthRefreshEncrypted,
      oauthTokenExpiresAt: provider.oauthTokenExpiresAt ?? null,
      oauthLastRefreshAt: provider.oauthLastRefreshAt ?? null,
      oauthCopilotEncrypted,
      oauthCopilotTokenExpiresAt: provider.oauthCopilotTokenExpiresAt ?? null,
      oauthProjectId: provider.oauthProjectId ?? null,
      oauthDeviceClientId: provider.oauthDeviceClientId ?? null,
      oauthDeviceSecretEncrypted,
      oauthMachineId: provider.oauthMachineId ?? null,
      proxyUrl: provider.proxyUrl ?? null
    });
}

function writeStoreToDb(database: Database.Database, store: NesaStore) {
  const transaction = database.transaction(() => {
    writeSetting(database, "budget", store.budget);
    writeSetting(database, "router", store.router);
    writeSetting(database, "aliases", store.aliases ?? []);

    database.prepare("DELETE FROM providers").run();
    for (const provider of store.providers) writeProviderToDb(database, provider);

    // Catalog presets (OAuth + new API-key seeds) must survive full store rewrites.
    for (const provider of defaultStore.providers) {
      const exists = database.prepare("SELECT id FROM providers WHERE id = ?").get(provider.id);
      if (!exists) writeProviderToDb(database, provider);
    }

    database.prepare("DELETE FROM local_api_keys").run();
    for (const token of store.localApiKeys) {
      const stored = token.startsWith("nesa:v1:") ? token : encryptSecret(token);
      database.prepare("INSERT OR IGNORE INTO local_api_keys (token) VALUES (?)").run(stored);
    }

    database.prepare("DELETE FROM usage_logs").run();
    for (const log of store.usage) writeUsageToDb(database, log);

    database.prepare("DELETE FROM cache_entries").run();
    for (const entry of store.cache) writeCacheToDb(database, entry);

    database.prepare("DELETE FROM combos").run();
    for (const combo of store.combos) writeComboToDb(database, combo);
  });
  transaction();
}

function writeUsageToDb(database: Database.Database, log: UsageLog) {
  database
    .prepare(`
      INSERT INTO usage_logs (
        id, created_at, provider_id, provider_name, model, tier, task_type, input_tokens, output_tokens,
        total_cost_usd, cost_source, cache_status, budget_status, routing_reason, status, error, skipped_providers
      ) VALUES (
        @id, @createdAt, @providerId, @providerName, @model, @tier, @taskType, @inputTokens, @outputTokens,
        @totalCostUsd, @costSource, @cacheStatus, @budgetStatus, @routingReason, @status, @error, @skippedProviders
      )
    `)
    .run({
      ...log,
      error: log.error ?? null,
      skippedProviders: log.skippedProviders ? JSON.stringify(log.skippedProviders) : null
    });
}

function usageFromRow(row: any): UsageLog {
  let skippedProviders: UsageLog["skippedProviders"];
  if (row.skipped_providers) {
    try {
      const parsed = JSON.parse(row.skipped_providers);
      if (Array.isArray(parsed)) skippedProviders = parsed;
    } catch {}
  }
  return {
    id: row.id,
    createdAt: row.created_at,
    providerId: row.provider_id,
    providerName: row.provider_name,
    model: row.model,
    tier: row.tier,
    taskType: row.task_type,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalCostUsd: row.total_cost_usd,
    costSource: row.cost_source,
    cacheStatus: row.cache_status,
    budgetStatus: row.budget_status,
    routingReason: row.routing_reason,
    status: row.status,
    error: row.error ?? undefined,
    skippedProviders
  };
}

function writeCacheToDb(database: Database.Database, entry: CacheEntry) {
  database
    .prepare(`
      INSERT INTO cache_entries (
        key, created_at, provider_id, model, response_json, input_tokens, output_tokens, saved_cost_usd
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        created_at = excluded.created_at,
        provider_id = excluded.provider_id,
        model = excluded.model,
        response_json = excluded.response_json,
        input_tokens = excluded.input_tokens,
        output_tokens = excluded.output_tokens,
        saved_cost_usd = excluded.saved_cost_usd
    `)
    .run(
      entry.key,
      entry.createdAt,
      entry.providerId,
      entry.model,
      JSON.stringify(entry.response),
      entry.inputTokens,
      entry.outputTokens,
      entry.savedCostUsd
    );
}

function cacheFromRow(row: any): CacheEntry {
  return {
    key: row.key,
    createdAt: row.created_at,
    providerId: row.provider_id,
    model: row.model,
    response: JSON.parse(row.response_json),
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    savedCostUsd: row.saved_cost_usd
  };
}

function comboFromRow(row: any): Combo {
  let providerIds: string[] = [];
  try {
    const parsed = JSON.parse(row.provider_ids);
    if (Array.isArray(parsed)) providerIds = parsed.map((id: unknown) => String(id)).filter(Boolean);
  } catch {}
  const strategy = row.strategy === "round_robin" ? "round_robin" : "fallback";
  return {
    id: row.id,
    name: row.name,
    providerIds,
    strategy
  };
}

function mcpFromRow(row: any): McpServer {
  let args: string[] = [];
  let env: Record<string, string> = {};
  try { const p = JSON.parse(row.args); if (Array.isArray(p)) args = p.map((a: unknown) => String(a)); } catch {}
  try {
    const p = JSON.parse(row.env);
    if (p && typeof p === "object") {
      for (const [key, value] of Object.entries(p as Record<string, unknown>)) {
        env[key] = decryptSecret(String(value ?? ""));
      }
    }
  } catch {}
  return { id: row.id, name: row.name, command: row.command, args, env };
}

function writeMcpToDb(database: Database.Database, server: McpServer) {
  const encryptedEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(server.env ?? {})) {
    encryptedEnv[key] = encryptSecret(String(value ?? ""));
  }
  database
    .prepare(`
      INSERT INTO mcp_servers (id, name, command, args, env) VALUES (@id, @name, @command, @args, @env)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        command = excluded.command,
        args = excluded.args,
        env = excluded.env
    `)
    .run({
      id: server.id,
      name: server.name,
      command: server.command,
      args: JSON.stringify(server.args ?? []),
      env: JSON.stringify(encryptedEnv)
    });
}

function writeComboToDb(database: Database.Database, combo: Combo) {
  database
    .prepare(`
      INSERT INTO combos (id, name, provider_ids, strategy, judge_provider_id) VALUES (@id, @name, @providerIds, @strategy, @judgeProviderId)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        provider_ids = excluded.provider_ids,
        strategy = excluded.strategy,
        judge_provider_id = excluded.judge_provider_id
    `)
    .run({
      id: combo.id,
      name: combo.name,
      providerIds: JSON.stringify(combo.providerIds),
      strategy: combo.strategy,
      judgeProviderId: null
    });
}

export async function readStore(): Promise<NesaStore> {
  const database = getDb();
  const providers = database
    .prepare("SELECT * FROM providers ORDER BY priority ASC, id ASC")
    .all()
    .map(providerFromRow);
  const usage = database
    .prepare("SELECT * FROM usage_logs ORDER BY created_at DESC LIMIT 500")
    .all()
    .map(usageFromRow);
  const cache = database
    .prepare("SELECT * FROM cache_entries ORDER BY created_at DESC LIMIT 100")
    .all()
    .map(cacheFromRow);
  const localApiKeys = (database.prepare("SELECT token FROM local_api_keys").all() as Array<{ token: string }>)
    .map((row) => decryptSecret(row.token))
    .filter(Boolean);
  const combos = (database.prepare("SELECT * FROM combos ORDER BY name ASC").all() as any[]).map(comboFromRow);

  return {
    providers,
    budget: readSetting(database, "budget", defaultStore.budget),
    router: readRouterSettings(database),
    usage,
    cache,
    // Do not restore a predictable development key when the user removes all keys.
    localApiKeys,
    combos,
    aliases: readSetting(database, "aliases", defaultStore.aliases ?? [])
  };
}

/** Soft-upgrade installs still on factory saver defaults to RTK + Caveman lite. */
function readRouterSettings(database: Database.Database) {
  const saved = readSetting<NesaStore["router"] | null>(database, "router", null);
  if (!saved) return { ...defaultStore.router, tokenSaver: { ...defaultStore.router.tokenSaver! } };

  const migrated = readSetting<boolean>(database, "tokenSaverDefaultsV1", false);
  if (!migrated) {
    const caveman = saved.tokenSaver?.caveman ?? "off";
    const ponytail = saved.tokenSaver?.ponytail ?? "off";
    const looksFactory = saved.rtkEnabled === false && caveman === "off" && ponytail === "off";
    if (looksFactory) {
      saved.rtkEnabled = true;
      saved.tokenSaver = { caveman: "lite", ponytail: "off" };
      writeSetting(database, "router", saved);
    }
    writeSetting(database, "tokenSaverDefaultsV1", true);
  }

  return {
    ...defaultStore.router,
    ...saved,
    tokenSaver: {
      ...defaultStore.router.tokenSaver!,
      ...(saved.tokenSaver ?? {})
    }
  };
}

export async function writeStore(store: NesaStore) {
  writeStoreToDb(getDb(), store);
}

export async function readAdminPasswordHash() {
  return readSetting<string | null>(getDb(), "adminPasswordHash", null);
}

/** Sync read of dashboard public base URL (used by OAuth redirect helpers). */
export function readPublicBaseUrlSync(): string | undefined {
  try {
    const router = readRouterSettings(getDb());
    const value = router.publicBaseUrl?.trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

export async function writeAdminPasswordHash(hash: string) {
  writeSetting(getDb(), "adminPasswordHash", hash);
}

export async function createAdminSessionRecord(session: {
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
}) {
  const database = getDb();
  database
    .prepare(
      "INSERT INTO admin_sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?) ON CONFLICT(token_hash) DO UPDATE SET created_at = excluded.created_at, expires_at = excluded.expires_at"
    )
    .run(session.tokenHash, session.createdAt, session.expiresAt);
  database.prepare("DELETE FROM admin_sessions WHERE expires_at < ?").run(new Date().toISOString());
}

export async function findAdminSessionByHash(tokenHash: string) {
  return (
    (getDb()
      .prepare("SELECT token_hash as tokenHash, created_at as createdAt, expires_at as expiresAt FROM admin_sessions WHERE token_hash = ?")
      .get(tokenHash) as { tokenHash: string; createdAt: string; expiresAt: string } | undefined) ?? null
  );
}

export async function deleteAdminSessionByHash(tokenHash: string) {
  getDb().prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(tokenHash);
}

export async function deleteAllAdminSessions() {
  getDb().prepare("DELETE FROM admin_sessions").run();
}

export interface LoginLockState {
  failedAttempts: number;
  lockedUntil?: string;
}

export async function readLoginLockState(): Promise<LoginLockState> {
  return readSetting<LoginLockState>(getDb(), "loginLock", { failedAttempts: 0 });
}

export async function writeLoginLockState(state: LoginLockState) {
  writeSetting(getDb(), "loginLock", state);
}

export async function clearLoginLockState() {
  writeSetting(getDb(), "loginLock", { failedAttempts: 0 });
}

function preserveOptionalSecret(
  incoming: string | undefined,
  existingEncrypted: string | null | undefined
): string | undefined {
  if (incoming === undefined || isRedactedSecret(incoming)) {
    return existingEncrypted ? decryptSecret(existingEncrypted) : undefined;
  }
  return incoming;
}

export async function updateProvider(provider: ProviderConfig) {
  const database = getDb();
  const existing = database.prepare("SELECT api_key_encrypted, api_keys, models, connection_status, last_checked_at, last_error, oauth_access_token_encrypted, oauth_refresh_token_encrypted, oauth_copilot_token_encrypted, oauth_copilot_token_expires_at, oauth_project_id, oauth_device_client_id, oauth_device_client_secret_encrypted, oauth_machine_id, proxy_url FROM providers WHERE id = ?").get(provider.id) as
    | { api_key_encrypted: string; api_keys?: string; models?: string; connection_status?: string; last_checked_at?: string; last_error?: string; oauth_access_token_encrypted?: string; oauth_refresh_token_encrypted?: string; oauth_copilot_token_encrypted?: string; oauth_copilot_token_expires_at?: string; oauth_project_id?: string; oauth_device_client_id?: string; oauth_device_client_secret_encrypted?: string; oauth_machine_id?: string; proxy_url?: string }
    | undefined;
  const incomingApiKeys =
    provider.apiKeys === undefined
      ? undefined
      : provider.apiKeys.every((key) => isRedactedSecret(key))
        ? undefined
        : provider.apiKeys.filter((key) => !isRedactedSecret(key));
  const preserveApiKeys = incomingApiKeys === undefined ? parseApiKeys(existing?.api_keys) : incomingApiKeys;
  const preserveModels = provider.models === undefined ? parseStringArray((existing as any)?.models) : provider.models;
  const preserveOauthAccess = preserveOptionalSecret(provider.oauthAccessToken, existing?.oauth_access_token_encrypted);
  const preserveOauthRefresh = preserveOptionalSecret(provider.oauthRefreshToken, existing?.oauth_refresh_token_encrypted);
  const preserveCopilotToken = preserveOptionalSecret(provider.oauthCopilotToken, existing?.oauth_copilot_token_encrypted);
  const preserveCopilotExpiry = provider.oauthCopilotTokenExpiresAt === undefined ? existing?.oauth_copilot_token_expires_at ?? undefined : provider.oauthCopilotTokenExpiresAt;
  const preserveOauthProjectId = provider.oauthProjectId === undefined ? existing?.oauth_project_id ?? undefined : provider.oauthProjectId;
  const preserveDeviceClientId = provider.oauthDeviceClientId === undefined ? existing?.oauth_device_client_id ?? undefined : provider.oauthDeviceClientId;
  const preserveDeviceClientSecret = preserveOptionalSecret(
    provider.oauthDeviceClientSecret,
    existing?.oauth_device_client_secret_encrypted
  );
  const preserveOauthMachineId =
    provider.oauthMachineId === undefined || isRedactedSecret(provider.oauthMachineId)
      ? existing?.oauth_machine_id ?? undefined
      : provider.oauthMachineId;
  const preserveProxyUrl = provider.proxyUrl === undefined ? existing?.proxy_url ?? undefined : provider.proxyUrl;
  const incomingApiKey =
    provider.apiKey === undefined || isRedactedSecret(provider.apiKey) ? undefined : provider.apiKey;
  const incomingStatus = provider.connectionStatus;
  const preserveConnection =
    !incomingStatus || incomingStatus === "unknown"
      ? {
          connectionStatus: (existing?.connection_status as ProviderConfig["connectionStatus"]) ?? "unknown",
          lastCheckedAt: existing?.last_checked_at ?? undefined,
          lastError: existing?.last_error ?? undefined
        }
      : {
          connectionStatus: incomingStatus,
          lastCheckedAt: provider.lastCheckedAt ?? existing?.last_checked_at ?? undefined,
          lastError: provider.lastError ?? existing?.last_error ?? undefined
        };
  const merged: ProviderConfig = {
    ...provider,
    apiKey: incomingApiKey ?? (existing?.api_key_encrypted ? decryptSecret(existing.api_key_encrypted) : provider.apiKey ?? ""),
    apiKeys: preserveApiKeys,
    models: preserveModels,
    oauthAccessToken: preserveOauthAccess,
    oauthRefreshToken: preserveOauthRefresh,
    oauthCopilotToken: preserveCopilotToken,
    oauthCopilotTokenExpiresAt: preserveCopilotExpiry,
    oauthProjectId: preserveOauthProjectId,
    oauthDeviceClientId: preserveDeviceClientId,
    oauthDeviceClientSecret: preserveDeviceClientSecret,
    oauthMachineId: preserveOauthMachineId,
    proxyUrl: preserveProxyUrl,
    ...preserveConnection
  };
  writeProviderToDb(database, merged, existing?.api_key_encrypted ?? "");
  return merged;
}

/** Remove the final primary credential without relying on UI-redacted values. */
export async function clearProviderApiKeys(providerId: string) {
  const database = getDb();
  database
    .prepare("UPDATE providers SET api_key_encrypted = '', api_keys = NULL WHERE id = ?")
    .run(providerId);
}

export async function deleteProvider(providerId: string) {
  const database = getDb();
  database.prepare("DELETE FROM providers WHERE id = ?").run(providerId);
}

export async function markProviderFailure(providerId: string, error: string, cooldownMs: number) {
  const database = getDb();
  const until = new Date(Date.now() + cooldownMs).toISOString();
  database
    .prepare("UPDATE providers SET status = 'cooldown', rate_limited_until = ?, last_error = ?, connection_status = 'error', last_checked_at = ? WHERE id = ?")
    .run(until, error.slice(0, 500), new Date().toISOString(), providerId);
}

export async function clearProviderCooldown(providerId: string) {
  const database = getDb();
  database
    .prepare("UPDATE providers SET status = 'active', rate_limited_until = NULL, last_error = NULL, connection_status = 'connected', last_checked_at = ? WHERE id = ?")
    .run(new Date().toISOString(), providerId);
}

export async function markProviderConnection(providerId: string, ok: boolean, message?: string) {
  const database = getDb();
  database
    .prepare("UPDATE providers SET connection_status = ?, last_checked_at = ?, last_error = ? WHERE id = ?")
    .run(ok ? "connected" : "error", new Date().toISOString(), ok ? null : (message ?? "Provider test failed.").slice(0, 500), providerId);
}

export async function addLocalApiKey(token: string) {
  getDb().prepare("INSERT OR IGNORE INTO local_api_keys (token) VALUES (?)").run(encryptSecret(token));
}

export async function deleteLocalApiKey(token: string) {
  const database = getDb();
  const rows = database.prepare("SELECT token FROM local_api_keys").all() as Array<{ token: string }>;
  for (const row of rows) {
    if (decryptSecret(row.token) === token) {
      database.prepare("DELETE FROM local_api_keys WHERE token = ?").run(row.token);
      return;
    }
  }
}

export async function appendUsage(log: UsageLog) {
  const database = getDb();
  writeUsageToDb(database, log);
  database
    .prepare(
      "DELETE FROM usage_logs WHERE id NOT IN (SELECT id FROM usage_logs ORDER BY created_at DESC LIMIT 500)"
    )
    .run();
}

export async function saveCacheEntry(entry: CacheEntry) {
  const database = getDb();
  writeCacheToDb(database, entry);
  database
    .prepare(
      "DELETE FROM cache_entries WHERE key NOT IN (SELECT key FROM cache_entries ORDER BY created_at DESC LIMIT 100)"
    )
    .run();
}

export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function getTodaySpend(store: NesaStore) {
  const today = todayKey();
  return store.usage
    .filter((item) => item.createdAt.startsWith(today) && item.status === "success")
    .reduce((sum, item) => sum + item.totalCostUsd, 0);
}

export async function upsertCombo(combo: Combo) {
  const database = getDb();
  writeComboToDb(database, combo);
  return combo;
}

export async function deleteCombo(comboId: string) {
  getDb().prepare("DELETE FROM combos WHERE id = ?").run(comboId);
}

export async function readMcpServers(): Promise<McpServer[]> {
  return (getDb().prepare("SELECT * FROM mcp_servers ORDER BY name ASC").all() as any[]).map(mcpFromRow);
}

export async function upsertMcpServer(server: McpServer) {
  writeMcpToDb(getDb(), server);
  return server;
}

export async function deleteMcpServer(serverId: string) {
  getDb().prepare("DELETE FROM mcp_servers WHERE id = ?").run(serverId);
}

export async function getMcpServer(serverId: string): Promise<McpServer | undefined> {
  const row = getDb().prepare("SELECT * FROM mcp_servers WHERE id = ?").get(serverId) as any | undefined;
  return row ? mcpFromRow(row) : undefined;
}

export async function saveProviderOAuthTokens(providerId: string, tokens: {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  copilotToken?: string;
  copilotTokenExpiresAt?: string;
  projectId?: string;
  deviceClientId?: string;
  deviceClientSecret?: string;
  machineId?: string;
}) {
  const database = getDb();
  const accessEncrypted = tokens.accessToken ? encryptSecret(tokens.accessToken) : null;
  const refreshEncrypted = tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null;
  const copilotEncrypted = tokens.copilotToken ? encryptSecret(tokens.copilotToken) : null;
  const deviceSecretEncrypted = tokens.deviceClientSecret ? encryptSecret(tokens.deviceClientSecret) : null;
  database
    .prepare(`UPDATE providers SET
      oauth_access_token_encrypted = ?,
      oauth_refresh_token_encrypted = ?,
      oauth_token_expires_at = ?,
      oauth_last_refresh_at = ?,
      oauth_copilot_token_encrypted = COALESCE(?, oauth_copilot_token_encrypted),
      oauth_copilot_token_expires_at = COALESCE(?, oauth_copilot_token_expires_at),
      oauth_project_id = COALESCE(?, oauth_project_id),
      oauth_device_client_id = COALESCE(?, oauth_device_client_id),
      oauth_device_client_secret_encrypted = COALESCE(?, oauth_device_client_secret_encrypted),
      oauth_machine_id = COALESCE(?, oauth_machine_id),
      connection_status = 'connected',
      last_checked_at = ?
      WHERE id = ?`)
    .run(
      accessEncrypted,
      refreshEncrypted,
      tokens.expiresAt ?? null,
      new Date().toISOString(),
      copilotEncrypted,
      tokens.copilotTokenExpiresAt ?? null,
      tokens.projectId ?? null,
      tokens.deviceClientId ?? null,
      deviceSecretEncrypted,
      tokens.machineId ?? null,
      new Date().toISOString(),
      providerId
    );
}

export async function clearProviderOAuthTokens(providerId: string) {
  const database = getDb();
  database
    .prepare(`UPDATE providers SET oauth_access_token_encrypted = NULL, oauth_refresh_token_encrypted = NULL, oauth_token_expires_at = NULL, oauth_last_refresh_at = NULL, oauth_copilot_token_encrypted = NULL, oauth_copilot_token_expires_at = NULL, oauth_project_id = NULL, oauth_device_client_id = NULL, oauth_device_client_secret_encrypted = NULL, oauth_machine_id = NULL WHERE id = ?`)
    .run(providerId);
}

export async function readProviderById(providerId: string): Promise<ProviderConfig | undefined> {
  const row = getDb().prepare("SELECT * FROM providers WHERE id = ?").get(providerId) as any | undefined;
  return row ? providerFromRow(row) : undefined;
}

export async function saveOAuthPending(state: string, data: { providerId: string; codeVerifier: string; redirectUri: string; createdAt: string }) {
  writeSetting(getDb(), `oauthPending:${state}`, {
    ...data,
    codeVerifier: encryptSecret(data.codeVerifier)
  });
}

export async function readOAuthPending(state: string) {
  const pending = readSetting<{ providerId: string; codeVerifier: string; redirectUri: string; createdAt: string } | null>(
    getDb(),
    `oauthPending:${state}`,
    null
  );
  if (!pending) return null;
  return {
    ...pending,
    codeVerifier: decryptSecret(pending.codeVerifier)
  };
}

export async function deleteOAuthPending(state: string) {
  getDb().prepare("DELETE FROM settings WHERE key = ?").run(`oauthPending:${state}`);
}

export type DevicePendingState = {
  deviceCode: string;
  createdAt: string;
  clientId?: string;
  clientSecret?: string;
  region?: string;
};

export async function saveDevicePending(providerId: string, data: DevicePendingState) {
  writeSetting(getDb(), `devicePending:${providerId}`, {
    ...data,
    deviceCode: encryptSecret(data.deviceCode),
    clientSecret: data.clientSecret ? encryptSecret(data.clientSecret) : undefined
  });
}

export async function readDevicePending(providerId: string) {
  const pending = readSetting<DevicePendingState | null>(getDb(), `devicePending:${providerId}`, null);
  if (!pending) return null;
  return {
    ...pending,
    deviceCode: decryptSecret(pending.deviceCode),
    clientSecret: pending.clientSecret ? decryptSecret(pending.clientSecret) : undefined
  };
}

export async function deleteDevicePending(providerId: string) {
  getDb().prepare("DELETE FROM settings WHERE key = ?").run(`devicePending:${providerId}`);
}

export function getDataDir() {
  return dataDir;
}

export interface TunnelSettings {
  enabled: boolean;
  tunnelUrl: string;
  tailscaleEnabled: boolean;
  tailscaleUrl: string;
  localPort: number;
}

export async function readTunnelSettings(): Promise<TunnelSettings> {
  return readSetting<TunnelSettings>(getDb(), "tunnel", {
    enabled: false,
    tunnelUrl: "",
    tailscaleEnabled: false,
    tailscaleUrl: "",
    localPort: Number(process.env.PORT) || 20129
  });
}

export async function writeTunnelSettings(settings: Partial<TunnelSettings>) {
  const current = await readTunnelSettings();
  writeSetting(getDb(), "tunnel", { ...current, ...settings });
}

export function getTodaySavings(store: NesaStore) {
  const today = todayKey();
  const cacheSavings = store.cache
    .filter((entry) => entry.createdAt.startsWith(today))
    .reduce((sum, entry) => sum + entry.savedCostUsd, 0);
  const freeTierRequests = store.usage.filter(
    (item) => item.createdAt.startsWith(today) && item.tier === "free" && item.status === "success"
  ).length;
  const cacheHits = store.usage.filter(
    (item) => item.createdAt.startsWith(today) && item.cacheStatus === "hit"
  ).length;
  return { cacheSavings, freeTierRequests, cacheHits };
}
