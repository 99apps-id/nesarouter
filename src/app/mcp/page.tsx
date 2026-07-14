import AppShell from "@/components/AppShell";
import McpManager from "@/components/McpManager";
import { readMcpServers } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function McpPage() {
  const servers = await readMcpServers();
  const baseUrl = "http://localhost:20129";
  return (
    <AppShell active="mcp">
      <McpManager servers={servers} baseUrl={baseUrl} />
    </AppShell>
  );
}
