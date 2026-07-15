import AppShell from "@/components/AppShell";
import McpManager from "@/components/McpManager";
import { publicOrigin } from "@/core/publicUrl";
import { readMcpServers, readStore, redactMcpServer } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function McpPage() {
  const store = await readStore();
  const servers = (await readMcpServers()).map(redactMcpServer);
  const baseUrl = publicOrigin(undefined, store.router.publicBaseUrl);
  return (
    <AppShell active="mcp">
      <McpManager servers={servers} baseUrl={baseUrl} />
    </AppShell>
  );
}
