/**
 * Curated catalog of MCP servers that pair well with NesaRouter.
 *
 * The MCP manager ("Quick add from catalog") lets operators add these with one
 * click — npx fetches the package on first use, so there is no manual search or
 * install step. The manual "Add MCP server" form remains available for any
 * server not in this catalog.
 *
 * Command strings are `npx -y <package>` so the bridge child auto-installs on
 * first session. Args may be overridden by the operator through fields.
 */

export interface McpPresetField {
  kind: "arg" | "env";
  /** arg → index into `args`; env → env key to set. */
  target: string;
  label: string;
  default?: string;
  placeholder?: string;
  secret?: boolean;
  optional?: boolean;
}

export interface McpPreset {
  id: string;
  name: string;
  description: string;
  category: "files" | "web" | "dev" | "ai" | "system";
  /** npm package that gets installed on first use. */
  package: string;
  command: string;
  args: string[];
  fields: McpPresetField[];
}

export const MCP_PRESETS: McpPreset[] = [
  {
    id: "filesystem",
    name: "Filesystem",
    description: "Read, write, and search files/directories on this machine.",
    category: "files",
    package: "@modelcontextprotocol/server-filesystem",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
    fields: [
      {
        kind: "arg",
        target: "2",
        label: "Root directory",
        default: "/tmp",
        placeholder: "/absolute/path/to/dir"
      }
    ]
  },
  {
    id: "fetch",
    name: "Fetch / Web",
    description: "Fetch a URL and convert it to Markdown for the model.",
    category: "web",
    package: "@modelcontextprotocol/server-fetch",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-fetch"],
    fields: []
  },
  {
    id: "memory",
    name: "Memory",
    description: "Knowledge-graph memory that persists across sessions.",
    category: "ai",
    package: "@modelcontextprotocol/server-memory",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    fields: []
  },
  {
    id: "git",
    name: "Git",
    description: "Read, search, and analyze a local Git repository.",
    category: "dev",
    package: "@modelcontextprotocol/server-git",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-git", "."],
    fields: [
      {
        kind: "arg",
        target: "2",
        label: "Repository path",
        default: ".",
        placeholder: "/path/to/repo"
      }
    ]
  },
  {
    id: "github",
    name: "GitHub",
    description: "Issues, pull requests, code search, and repos via the GitHub API.",
    category: "dev",
    package: "@modelcontextprotocol/server-github",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    fields: [
      {
        kind: "env",
        target: "GITHUB_PERSONAL_ACCESS_TOKEN",
        label: "GitHub Personal Access Token",
        secret: true,
        placeholder: "ghp_..."
      }
    ]
  },
  {
    id: "sequential-thinking",
    name: "Sequential Thinking",
    description: "Structured multi-step reasoning for complex problems.",
    category: "ai",
    package: "@modelcontextprotocol/server-sequential-thinking",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    fields: []
  },
  {
    id: "time",
    name: "Time",
    description: "Current time, timezone, and date tools for the model.",
    category: "system",
    package: "@modelcontextprotocol/server-time",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-time"],
    fields: []
  },
  {
    id: "everything",
    name: "Everything (test)",
    description: "Reference server that exercises every MCP tool type.",
    category: "system",
    package: "@modelcontextprotocol/server-everything",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-everything"],
    fields: []
  },
  {
    id: "brave-search",
    name: "Brave Search",
    description: "Web search through the Brave Search API.",
    category: "web",
    package: "@modelcontextprotocol/server-brave-search",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    fields: [
      {
        kind: "env",
        target: "BRAVE_API_KEY",
        label: "Brave Search API key",
        secret: true,
        placeholder: "BSA..."
      }
    ]
  },
  {
    id: "context7",
    name: "Context7",
    description: "Latest library documentation injected on demand.",
    category: "dev",
    package: "@upstash/context7-mcp",
    command: "npx",
    args: ["-y", "@upstash/context7-mcp"],
    fields: [
      {
        kind: "env",
        target: "CONTEXT7_API_KEY",
        label: "Context7 API key",
        secret: true,
        optional: true,
        placeholder: "optional"
      }
    ]
  },
  {
    id: "playwright",
    name: "Playwright",
    description: "Browser automation: navigate, click, screenshot, extract.",
    category: "web",
    package: "@playwright/mcp",
    command: "npx",
    args: ["-y", "@playwright/mcp@latest"],
    fields: []
  },
  {
    id: "sqlite",
    name: "SQLite",
    description: "Query and analyze a local SQLite database.",
    category: "system",
    package: "mcp-server-sqlite",
    command: "npx",
    args: ["-y", "mcp-server-sqlite", "--db-path", "/tmp/nesa.db"],
    fields: [
      {
        kind: "arg",
        target: "3",
        label: "Database path",
        default: "/tmp/nesa.db",
        placeholder: "/path/to/db.sqlite"
      }
    ]
  },
  {
    id: "postgres",
    name: "Postgres",
    description: "Query and analyze a PostgreSQL database.",
    category: "system",
    package: "@modelcontextprotocol/server-postgres",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://user:pass@host:5432/db"],
    fields: [
      {
        kind: "arg",
        target: "2",
        label: "Connection string",
        placeholder: "postgresql://user:pass@host:5432/db"
      }
    ]
  },
  {
    id: "puppeteer",
    name: "Puppeteer",
    description: "Headless Chrome: browse, screenshot, and extract pages.",
    category: "web",
    package: "@modelcontextprotocol/server-puppeteer",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    fields: []
  },
  {
    id: "chrome-devtools",
    name: "Chrome DevTools",
    description: "Full Chrome DevTools Protocol: DOM, network, performance.",
    category: "web",
    package: "chrome-devtools-mcp",
    command: "npx",
    args: ["-y", "chrome-devtools-mcp@latest"],
    fields: []
  },
  {
    id: "tavily",
    name: "Tavily Search",
    description: "AI-optimized web and news search API.",
    category: "web",
    package: "tavily-mcp",
    command: "npx",
    args: ["-y", "tavily-mcp@latest"],
    fields: [
      {
        kind: "env",
        target: "TAVILY_API_KEY",
        label: "Tavily API key",
        secret: true,
        placeholder: "tvly-..."
      }
    ]
  },
  {
    id: "exa",
    name: "Exa",
    description: "Web search and content discovery built for AI agents.",
    category: "web",
    package: "exa-mcp-server",
    command: "npx",
    args: ["-y", "exa-mcp-server"],
    fields: [
      {
        kind: "env",
        target: "EXA_API_KEY",
        label: "Exa API key",
        secret: true,
        placeholder: "your-exa-key"
      }
    ]
  },
  {
    id: "firecrawl",
    name: "Firecrawl",
    description: "Crawl, scrape, and extract structured data from websites.",
    category: "web",
    package: "firecrawl-mcp",
    command: "npx",
    args: ["-y", "firecrawl-mcp"],
    fields: [
      {
        kind: "env",
        target: "FIRECRAWL_API_KEY",
        label: "Firecrawl API key",
        secret: true,
        placeholder: "fc-..."
      }
    ]
  },
  {
    id: "redis",
    name: "Redis",
    description: "Read and write Redis keys and data structures.",
    category: "system",
    package: "@redis/mcp",
    command: "npx",
    args: ["-y", "@redis/mcp"],
    fields: [
      {
        kind: "env",
        target: "REDIS_URI",
        label: "Redis connection URI",
        secret: true,
        placeholder: "redis://host:6379"
      }
    ]
  },
  {
    id: "arxiv",
    name: "arXiv",
    description: "Search and fetch academic papers from arXiv.",
    category: "ai",
    package: "arxiv-mcp-server",
    command: "npx",
    args: ["-y", "arxiv-mcp-server"],
    fields: []
  }
];

/** Build a POST /api/mcp payload from a preset + operator values. */
export function buildMcpPresetPayload(
  preset: McpPreset,
  values: Record<string, string>
): { id: string; name: string; command: string; args: string[]; env: Record<string, string> } {
  const args = preset.args.map((arg, index) => {
    const field = preset.fields.find((item) => item.kind === "arg" && Number(item.target) === index);
    if (!field) return arg;
    const entered = (values[field.target] ?? "").trim();
    if (entered) return entered;
    return field.default ?? arg;
  });
  const env: Record<string, string> = {};
  for (const field of preset.fields) {
    if (field.kind !== "env") continue;
    const entered = (values[field.target] ?? "").trim();
    if (entered) env[field.target] = entered;
    else if (field.default) env[field.target] = field.default;
  }
  return { id: preset.id, name: preset.name, command: preset.command, args, env };
}

/** Fields that must be filled before the preset can be added. */
export function missingMcpPresetFields(
  preset: McpPreset,
  values: Record<string, string>
): McpPresetField[] {
  return preset.fields.filter((field) => {
    if (field.optional || field.default) return false;
    return !(values[field.target] ?? "").trim();
  });
}
