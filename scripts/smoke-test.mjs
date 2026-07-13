import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import http from "node:http";

const appUrl = process.env.NESA_TEST_URL ?? "http://localhost:20129";
let apiKey = process.env.NESA_TEST_KEY ?? "";
let smokeKeyId = "";
const dataDir = process.env.DATA_DIR ?? "data";
mkdirSync(dataDir, { recursive: true });
let adminCookie = "";
const providerId = "tmp-smoke-provider";
const quotaProviderId = "tmp-smoke-quota-provider";
const quotaTokenProviderId = "tmp-smoke-quota-token-provider";
const geminiCliId = "tmp-smoke-gemini-cli";
const mcpServerId = "tmp-smoke-mcp";
const comboId = "tmp-smoke-combo";
const comboName = "tmp-smoke-combo";
const model = "tmp-smoke-model";
const quotaModel = "tmp-smoke-quota-model";
const quotaTokenModel = "tmp-smoke-quota-token-model";
const prompt = `smoke test ${Date.now()}`;

function startMockProvider({ port, mode }) {
  const server = http.createServer((request, response) => {
    if (request.method === "GET" && request.url === "/v1/models") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          object: "list",
          data: [
            { id: mode === "quota" ? quotaModel : model, object: "model" },
            { id: "tmp-smoke-model-alt", object: "model" }
          ]
        })
      );
      return;
    }

    if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "not found" }));
      return;
    }

    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const payload = JSON.parse(body || "{}");
      if (mode === "quota") {
        response.writeHead(429, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            error: {
              message: "You exceeded your current quota, please check your plan and billing details.",
              type: "insufficient_quota",
              code: "insufficient_quota"
            }
          })
        );
        return;
      }

      if (payload.stream) {
        response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
        const chunks = [
          { id: "smoke-stream", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: payload.model, choices: [{ index: 0, delta: { content: "smoke" }, finish_reason: null }] },
          { id: "smoke-stream", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: payload.model, choices: [{ index: 0, delta: { content: "-ok" }, finish_reason: null }] },
          { id: "smoke-stream", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: payload.model, choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 9, completion_tokens: 4, total_tokens: 13 } }
        ];
        for (const chunk of chunks) {
          response.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        response.write("data: [DONE]\n\n");
        response.end();
        return;
      }

      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          id: "smoke-completion",
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: payload.model,
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "smoke-ok" },
              finish_reason: "stop"
            }
          ],
          usage: {
            prompt_tokens: 9,
            completion_tokens: 4,
            total_tokens: 13
          }
        })
      );
    });
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function envValue(key) {
  if (process.env[key]) return process.env[key];
  if (!existsSync(".env")) return "";
  const line = readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith(`${key}=`));
  return line ? line.split("=").slice(1).join("=").trim() : "";
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  if (adminCookie && path.startsWith("/api/") && !path.startsWith("/api/auth/")) {
    headers.set("cookie", adminCookie);
  }
  const response = await fetch(`${appUrl}${path}`, { ...options, headers });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  return { response, json };
}

async function loginAdminIfNeeded() {
  const session = await request("/api/auth/session");
  if (!session.json?.authEnabled || session.json?.authenticated) return;

  const password = envValue("NESA_ADMIN_PASSWORD");
  const login = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password })
  });
  assert(login.response.ok, "admin login failed for smoke test");
  adminCookie = login.response.headers.get("set-cookie")?.split(";")[0] ?? "";
  assert(adminCookie, "admin login cookie missing");
}

async function provisionSmokeKey() {
  if (apiKey) return;
  const created = await request("/api/keys", { method: "POST" });
  assert(created.response.ok && created.json?.token && created.json?.id, "failed to create temporary smoke API key");
  apiKey = created.json.token;
  smokeKeyId = created.json.id;
}

async function cleanup(server) {
  try {
    if (smokeKeyId) {
      await request("/api/keys", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: smokeKeyId })
      });
    }
    for (const id of [providerId, quotaProviderId, quotaTokenProviderId, geminiCliId]) {
      await request("/api/providers", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id })
      });
    }
    await request("/api/mcp", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: mcpServerId })
    }).catch(() => {});
    await request("/api/combos", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: comboId })
    }).catch(() => {});
  } catch {}

  try {
    const db = new Database(`${dataDir}/nesa-router.sqlite`);
    db.prepare("DELETE FROM usage_logs WHERE provider_id IN (?, ?, ?, ?)").run(providerId, quotaProviderId, quotaTokenProviderId, geminiCliId);
    db.prepare("DELETE FROM cache_entries WHERE provider_id IN (?, ?, ?, ?) OR model IN (?, ?, ?, ?)").run(providerId, quotaProviderId, quotaTokenProviderId, geminiCliId, model, quotaModel, quotaTokenModel, "gemini-3-pro-preview");
    db.prepare("DELETE FROM providers WHERE id IN (?, ?, ?, ?)").run(providerId, quotaProviderId, quotaTokenProviderId, geminiCliId);
    db.prepare("DELETE FROM combos WHERE id = ?").run(comboId);
    db.prepare("DELETE FROM mcp_servers WHERE id = ?").run(mcpServerId);
    db.prepare("DELETE FROM settings WHERE key = ?").run("loginLock");
    db.prepare("DELETE FROM settings WHERE key = ?").run("aliases");
    db.close();
  } catch {}

  await Promise.all(server.map((item) => new Promise((resolve) => item.close(resolve))));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const server = await Promise.all([
  startMockProvider({ port: 34567, mode: "success" }),
  startMockProvider({ port: 34568, mode: "quota" })
]);

try {
  const wrong1 = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "wrong-password-1" })
  });
  const wrong2 = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "wrong-password-2" })
  });
  const wrong3 = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "wrong-password-3" })
  });
  assert(wrong1.response.status === 401, "first wrong login should be 401");
  assert(wrong2.response.status === 401, "second wrong login should be 401");
  assert(wrong3.response.status === 423, "third wrong login should lock login");

  {
    const db = new Database(`${dataDir}/nesa-router.sqlite`);
    db.prepare("DELETE FROM settings WHERE key = ?").run("loginLock");
    db.close();
  }

  await loginAdminIfNeeded();
  await provisionSmokeKey();

  await request("/api/providers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: quotaProviderId,
      name: "Tmp Smoke Quota Provider",
      type: "openai_compatible",
      tier: "free",
      status: "active",
      baseUrl: "http://127.0.0.1:34568/v1",
      apiKey: "test-key",
      model: quotaModel,
      priority: 0,
      inputCostPerMTok: 0,
      outputCostPerMTok: 0
    })
  });

  await request("/api/providers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: providerId,
      name: "Tmp Smoke Provider",
      type: "openai_compatible",
      tier: "free",
      status: "active",
      baseUrl: "http://127.0.0.1:34567/v1",
      apiKey: "test-key",
      model,
      priority: 1,
      inputCostPerMTok: 0,
      outputCostPerMTok: 0
    })
  });

  const models = await request("/v1/models", {
    headers: { authorization: `Bearer ${apiKey}` }
  });
  assert(models.response.ok, "/v1/models failed");
  assert(models.json.data.some((item) => item.id === "auto"), "/v1/models missing auto");
  assert(models.json.data.some((item) => item.id === model), "/v1/models missing smoke model");

  const providerModels = await request("/api/providers/models", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ providerId })
  });
  assert(providerModels.response.ok, "/api/providers/models failed");
  assert(providerModels.json.models.includes(model), "/api/providers/models missing smoke model");

  const body = JSON.stringify({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  const first = await request("/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body
  });
  assert(first.response.ok, "/v1/chat/completions failed");
  assert(first.response.headers.get("x-nesa-provider") === providerId, "provider header mismatch");
  assert(first.json.choices?.[0]?.message?.content === "smoke-ok", "unexpected completion body");

  const second = await request("/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body
  });
  assert(second.response.ok, "cached /v1/chat/completions failed");
  assert(second.response.headers.get("x-nesa-cache") === "hit", "cache hit header missing");

  const fallbackBody = JSON.stringify({
    model: "auto",
    messages: [{ role: "user", content: `${prompt} fallback` }],
    temperature: 0
  });

  const fallback = await request("/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: fallbackBody
  });
  assert(fallback.response.ok, "quota fallback request failed");
  assert(fallback.response.headers.get("x-nesa-provider") === providerId, "quota fallback did not use healthy provider");

  {
    let row;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const db = new Database(`${dataDir}/nesa-router.sqlite`);
      row = db
        .prepare("SELECT skipped_providers FROM usage_logs WHERE provider_id = ? AND status = 'success' ORDER BY created_at DESC LIMIT 1")
        .get(providerId);
      db.close();
      if (row) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert(row, "fallback success log missing");
    let skipped = [];
    try {
      skipped = row.skipped_providers ? JSON.parse(row.skipped_providers) : [];
    } catch {}
    assert(Array.isArray(skipped) && skipped.some((item) => item.providerId === quotaProviderId), "fallback log missing skipped quota provider");
  }

  const streamBody = JSON.stringify({
    model,
    messages: [{ role: "user", content: `${prompt} stream` }],
    temperature: 0,
    stream: true
  });

  const streamResponse = await fetch(`${appUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: streamBody
  });
  assert(streamResponse.ok, "stream /v1/chat/completions failed");
  assert(streamResponse.headers.get("content-type") === "text/event-stream", "stream content-type header mismatch");
  assert(streamResponse.headers.get("x-nesa-provider") === providerId, "stream provider header mismatch");

  const streamText = await streamResponse.text();
  assert(streamText.includes('"delta":{"content":"smoke"'), "stream missing first delta");
  assert(streamText.includes('"delta":{"content":"-ok"'), "stream missing second delta");
  assert(streamText.includes('"finish_reason":"stop"'), "stream missing finish_reason");
  assert(streamText.includes("data: [DONE]"), "stream missing [DONE] sentinel");
  assert(streamText.includes('"usage":{"prompt_tokens":9'), "stream missing usage chunk");

  await new Promise((resolve) => setTimeout(resolve, 250));
  {
    let streamLog;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const db = new Database(`${dataDir}/nesa-router.sqlite`);
      streamLog = db
        .prepare("SELECT input_tokens, output_tokens, cost_source, cache_status FROM usage_logs WHERE provider_id = ? ORDER BY created_at DESC LIMIT 1")
        .get(providerId);
      db.close();
      if (streamLog) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert(streamLog, "stream usage log not written");
    assert(streamLog.cache_status === "skipped", `stream cache_status should be skipped, got ${streamLog?.cache_status}`);
    assert(streamLog.input_tokens === 9, `stream usage input_tokens should be 9, got ${streamLog?.input_tokens}`);
    assert(streamLog.output_tokens === 4, `stream usage output_tokens should be 4, got ${streamLog?.output_tokens}`);
    assert(streamLog.cost_source === "free", `stream cost_source should be free for free tier, got ${streamLog?.cost_source}`);
  }

  const comboCreate = await request("/api/combos", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: comboId, name: comboName, providerIds: [providerId], strategy: "fallback" })
  });
  assert(comboCreate.response.ok, "combo create failed");

  const unsupportedCombo = await request("/api/combos", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: "tmp-smoke-unsupported", name: "Unsupported", providerIds: [providerId], strategy: "fusion" })
  });
  assert(unsupportedCombo.response.status === 400, "unsupported combo strategy should be rejected");

  const comboModels = await request("/v1/models", {
    headers: { authorization: `Bearer ${apiKey}` }
  });
  assert(comboModels.json.data.some((item) => item.id === comboName && item.nesa_tier === "combo"), "/v1/models missing combo");

  const comboReq = await request("/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: comboName, messages: [{ role: "user", content: `${prompt} combo` }], temperature: 0 })
  });
  assert(comboReq.response.ok, "combo chat request failed");
  assert(comboReq.response.headers.get("x-nesa-provider") === providerId, "combo did not route to its provider");
  assert(comboReq.json.choices?.[0]?.message?.content === "smoke-ok", "combo unexpected body");

  const messagesReq = await request("/v1/messages", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 64, messages: [{ role: "user", content: `${prompt} claude` }] })
  });
  assert(messagesReq.response.ok, "/v1/messages failed");
  assert(messagesReq.json.type === "message", "/v1/messages missing message type");
  assert(messagesReq.json.content?.[0]?.type === "text", "/v1/messages missing text content block");
  assert(messagesReq.json.content?.[0]?.text === "smoke-ok", "/v1/messages unexpected text");
  assert(messagesReq.json.usage?.input_tokens === 9, "/v1/messages usage input_tokens mismatch");

  const responsesReq = await request("/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model, input: `${prompt} responses`, max_output_tokens: 64 })
  });
  assert(responsesReq.response.ok, "/v1/responses failed");
  assert(responsesReq.json.object === "response", "/v1/responses missing response object");
  assert(responsesReq.json.output?.[0]?.content?.[0]?.type === "output_text", "/v1/responses missing output_text");
  assert(responsesReq.json.output?.[0]?.content?.[0]?.text === "smoke-ok", "/v1/responses unexpected text");

  // --- Quota-aware routing: per-provider daily token cap ---
  await request("/api/providers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: quotaTokenProviderId,
      name: "Tmp Smoke Quota Token Provider",
      type: "openai_compatible",
      tier: "free",
      status: "active",
      baseUrl: "http://127.0.0.1:34567/v1",
      apiKey: "test-key",
      model: quotaTokenModel,
      priority: 50,
      inputCostPerMTok: 0,
      outputCostPerMTok: 0,
      quotaLimitTokens: 5
    })
  });

  const quotaFirst = await request("/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: quotaTokenModel, messages: [{ role: "user", content: `${prompt} quota-a` }], temperature: 0 })
  });
  assert(quotaFirst.response.ok, "quota token first request should succeed");
  assert(quotaFirst.response.headers.get("x-nesa-provider") === quotaTokenProviderId, "quota token first request should route to quota provider");

  const quotaSecond = await request("/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: quotaTokenModel, messages: [{ role: "user", content: `${prompt} quota-b` }], temperature: 0 })
  });
  assert(quotaSecond.response.status === 502 || quotaSecond.response.status === 503, `quota token second request should be blocked, got ${quotaSecond.response.status}`);
  assert(/quota/i.test(quotaSecond.json?.error?.message ?? ""), `quota token block message should mention quota, got: ${quotaSecond.json?.error?.message}`);

  // --- MCP stdio<->SSE bridge ---
  const mcpCreate = await request("/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: mcpServerId,
      name: "Tmp Smoke MCP",
      command: "node",
      args: [
        "-e",
        "let b='';process.stdin.on('data',d=>{b+=d.toString();let i;while((i=b.indexOf('\\n'))>=0){const l=b.slice(0,i).trim();b=b.slice(i+1);if(!l)continue;let m;try{m=JSON.parse(l)}catch{continue}process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result:{ok:true,echo:m.method}})+'\\n')}});"
      ],
      env: {}
    })
  });
  assert(mcpCreate.response.ok, "MCP server create failed");

  const mcpSseUnauth = await fetch(`${appUrl}/v1/mcp/${mcpServerId}/sse`);
  assert(mcpSseUnauth.status === 401, "MCP SSE without key should 401");

  const mcpSse = await fetch(`${appUrl}/v1/mcp/${mcpServerId}/sse`, {
    headers: { authorization: `Bearer ${apiKey}` }
  });
  assert(mcpSse.ok, "MCP SSE connect failed");
  assert(mcpSse.headers.get("content-type") === "text/event-stream", "MCP SSE content-type mismatch");

  const reader = mcpSse.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = "";
  let sawReady = false;
  let sawMessage = false;
  const initialize = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });

  // Read SSE until the ready event arrives (also confirms the child spawned).
  const readyDeadline = Date.now() + 5000;
  while (Date.now() < readyDeadline && !sseBuffer.includes("event: ready")) {
    const { value, done } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });
  }
  sawReady = sseBuffer.includes("event: ready");
  assert(sawReady, "MCP SSE missing ready event");

  const rpcResponse = await fetch(`${appUrl}/v1/mcp/${mcpServerId}/rpc`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: initialize
  });
  assert(rpcResponse.ok, `MCP rpc POST failed: ${rpcResponse.status}`);

  const messageDeadline = Date.now() + 5000;
  while (Date.now() < messageDeadline && !sawMessage) {
    const { value, done } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });
    const match = sseBuffer.match(/event: message\ndata: (.+)/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.result?.echo === "initialize") sawMessage = true;
      } catch {}
    }
  }
  try { reader.cancel(); } catch {}
  assert(sawMessage, "MCP SSE missing initialize echo from child process");

  // --- P4: count_tokens + responses/compact ---
  const countTokens = await request("/v1/messages/count_tokens", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: "hello world from smoke test" }] })
  });
  assert(countTokens.response.ok, "/v1/messages/count_tokens failed");
  assert(typeof countTokens.json?.input_tokens === "number" && countTokens.json.input_tokens > 0, "count_tokens input_tokens missing");

  const compactReq = await request("/v1/responses/compact", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model, input: `${prompt} compact`, max_output_tokens: 64 })
  });
  assert(compactReq.response.ok, "/v1/responses/compact failed");
  assert(compactReq.response.headers.get("x-nesa-compact") === "1", "responses/compact missing compact header");
  assert(compactReq.json.object === "response", "/v1/responses/compact missing response object");

  // --- P4: usage analytics + request details ---
  const stats = await request("/api/usage/stats");
  assert(stats.response.ok, "/api/usage/stats failed");
  assert(typeof stats.json?.totalRequests === "number" && stats.json.totalRequests > 0, "usage stats totalRequests missing");

  const chart = await request("/api/usage/chart?days=7");
  assert(chart.response.ok, "/api/usage/chart failed");
  assert(Array.isArray(chart.json?.points) && chart.json.points.length === 7, "usage chart points length mismatch");

  {
    let latestId;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const db = new Database(`${dataDir}/nesa-router.sqlite`);
      const row = db.prepare("SELECT id FROM usage_logs WHERE provider_id = ? ORDER BY created_at DESC LIMIT 1").get(providerId);
      db.close();
      if (row?.id) { latestId = row.id; break; }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert(latestId, "no usage log id found for request-details");
    const details = await request(`/api/usage/request-details/${latestId}`);
    assert(details.response.ok, "/api/usage/request-details failed");
    assert(details.json?.id === latestId, "request-details id mismatch");
  }

  // --- P4: CLI auto-config ---
  const codexConfig = await request("/api/cli-tools/codex/config");
  assert(codexConfig.response.ok, "/api/cli-tools/codex/config failed");
  assert(codexConfig.json?.env?.OPENAI_BASE_URL, "codex config missing OPENAI_BASE_URL");
  assert(!JSON.stringify(codexConfig.json).includes(apiKey), "CLI config must not return a stored API key");

  const blockedFetch = await request("/v1/web/fetch", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ url: "http://127.0.0.1:34567/private" })
  });
  assert(blockedFetch.response.status === 400, "web fetch must reject local URLs");

  // --- P5: import-token rejects non-OAuth provider ---
  const importReject = await request(`/api/providers/${providerId}/oauth/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accessToken: "fake-token" })
  });
  assert(importReject.response.status === 400, `import-token on non-OAuth provider should 400, got ${importReject.response.status}`);

  // --- P5: Gemini-CLI provider + device-flow guard + proxyUrl round-trip ---
  await request("/api/providers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: geminiCliId,
      name: "Tmp Smoke Gemini CLI",
      type: "gemini_cli",
      tier: "premium",
      status: "active",
      baseUrl: "https://cloudcode-pa.googleapis.com/v1internal",
      apiKey: "",
      model: "gemini-3-pro-preview",
      priority: 200,
      inputCostPerMTok: 0,
      outputCostPerMTok: 0,
      oauthProfile: "gemini_cli",
      models: ["gemini-3-pro-preview"],
      proxyUrl: "http://127.0.0.1:39999"
    })
  });

  const geminiModels = await request("/v1/models", { headers: { authorization: `Bearer ${apiKey}` } });
  assert(geminiModels.json.data.some((item) => item.id === "gemini-3-pro-preview"), "/v1/models missing gemini-cli model");

  {
    const state = await request("/api/state");
    const found = state.json?.providers?.find((p) => p.id === geminiCliId);
    assert(found, "gemini-cli provider missing from /api/state");
    assert(found.proxyUrl === "http://127.0.0.1:39999", "proxyUrl not round-tripped");
    assert(found.oauthCopilotToken === undefined || found.oauthCopilotToken === "********", "copilot token should be redacted");
  }

  // device/start on a non-device-flow provider must 400
  const badDevice = await request(`/api/providers/${providerId}/oauth/device/start`, { method: "POST" });
  assert(badDevice.response.status === 400, `device/start on non-device provider should 400, got ${badDevice.response.status}`);

  // device/start on gemini-cli (also not device flow) must 400
  const badDevice2 = await request(`/api/providers/${geminiCliId}/oauth/device/start`, { method: "POST" });
  assert(badDevice2.response.status === 400, `device/start on gemini-cli should 400, got ${badDevice2.response.status}`);

  // --- Release polish: aliases, tags, search, state harden, unauthenticated /v1 ---
  const aliasSave = await request("/api/state", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      aliases: [{ id: "tmp-smoke-alias", alias: "tmp-smoke-alias", target: model }]
    })
  });
  assert(aliasSave.response.ok, "alias save via /api/state failed");

  const aliasModels = await request("/v1/models", { headers: { authorization: `Bearer ${apiKey}` } });
  assert(aliasModels.json.data.some((item) => item.id === "tmp-smoke-alias" && item.nesa_tier === "alias"), "/v1/models missing alias");

  const aliasChat = await request("/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: "tmp-smoke-alias", messages: [{ role: "user", content: `${prompt} alias` }], temperature: 0 })
  });
  assert(aliasChat.response.ok, "alias chat failed");
  assert(aliasChat.response.headers.get("x-nesa-provider") === providerId, "alias did not resolve to smoke provider");

  const tags = await request("/api/tags", { headers: { authorization: `Bearer ${apiKey}` } });
  assert(tags.response.ok, "/api/tags failed");
  assert(Array.isArray(tags.json?.models) && tags.json.models.some((m) => m.name === "auto"), "/api/tags missing auto");

  const searchValidation = await request("/v1/search", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({})
  });
  assert(searchValidation.response.status === 400, "/v1/search must reject an empty query");

  const noKey = await request("/v1/models");
  assert(noKey.response.status === 401, "unauthenticated /v1/models should 401");

  const stateProvidersBlocked = await request("/api/state", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ providers: [{ id: "evil", apiKey: "********" }] })
  });
  assert(stateProvidersBlocked.response.status === 400, "bulk providers rewrite via /api/state should 400");

  // clear smoke alias
  await request("/api/state", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ aliases: [] })
  });

  await request("/api/providers", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: geminiCliId })
  }).catch(() => {});

  console.log("Smoke test passed.");
} finally {
  await cleanup(server);
}
