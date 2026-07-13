import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";
import { publicOrigin } from "@/core/publicUrl";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ToolId = "claude-code" | "codex" | "cursor" | "cline" | "openclaw" | "opencode" | "generic";

function originFrom(request: Request) {
  return publicOrigin(request);
}

function buildConfig(tool: ToolId, baseUrl: string, apiKey: string, model: string) {
  const v1 = `${baseUrl}/v1`;
  switch (tool) {
    case "claude-code":
      return {
        summary: "Claude Code — Anthropic Messages endpoint",
        files: [
          { path: "~/.claude/config.json", content: JSON.stringify({ anthropic_api_base: v1, anthropic_api_key: apiKey }, null, 2) }
        ],
        env: { ANTHROPIC_BASE_URL: v1, ANTHROPIC_API_KEY: apiKey }
      };
    case "codex":
      return {
        summary: "OpenAI Codex CLI — Responses endpoint",
        files: [
          { path: "~/.codex/config.toml", content: `model = "${model}"\n\n[model_providers.nesa]\nname = "NesaRouter"\nbase_url = "${baseUrl}"\nenv_key = "OPENAI_API_KEY"` }
        ],
        env: { OPENAI_BASE_URL: baseUrl, OPENAI_API_KEY: apiKey, OPENAI_MODEL: model }
      };
    case "cursor":
      return {
        summary: "Cursor — OpenAI base URL",
        files: [],
        env: {},
        instructions: `Settings → Models → Advanced Override → OpenAI API Base URL: ${v1}\nOpenAI API Key: ${apiKey}\nModel: ${model}`
      };
    case "cline":
    case "opencode":
      return {
        summary: `${tool} — OpenAI Compatible`,
        files: [],
        env: { OPENAI_BASE_URL: v1, OPENAI_API_KEY: apiKey, OPENAI_MODEL: model },
        instructions: `Add an OpenAI-compatible provider:\nBase URL: ${v1}\nAPI Key: ${apiKey}\nModel: ${model}`
      };
    case "openclaw":
      return {
        summary: "OpenClaw — openclaw.json",
        files: [
          {
            path: "~/.openclaw/openclaw.json",
            content: JSON.stringify({
              models: {
                providers: {
                  nesa: {
                    baseUrl: `${baseUrl.replace("http://localhost", "http://127.0.0.1")}/v1`,
                    apiKey,
                    api: "openai-completions",
                    models: [{ id: model, name: "NesaRouter" }]
                  }
                }
              }
            }, null, 2)
          }
        ],
        env: {}
      };
    case "generic":
    default:
      return {
        summary: "Generic OpenAI-compatible",
        files: [],
        env: { OPENAI_BASE_URL: v1, OPENAI_API_KEY: apiKey, OPENAI_MODEL: model }
      };
  }
}

export async function GET(request: Request, context: { params: Promise<{ tool: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { tool } = await context.params;
  const store = await readStore();
  const baseUrl = originFrom(request);
  // A config response is rendered in the browser. Never return a stored client
  // key here: the user pastes their key only on the machine that runs the CLI.
  const apiKey = "<YOUR_NESA_API_KEY>";
  const comboNames = store.combos.map((c) => c.name);
  const firstProviderModel = store.providers.find((p) => p.status === "active")?.model;
  const model = comboNames[0] ?? firstProviderModel ?? "auto";

  const config = buildConfig(tool as ToolId, baseUrl, apiKey, model);
  return NextResponse.json({ tool, model, ...config });
}
