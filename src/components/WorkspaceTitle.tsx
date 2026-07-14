"use client";

import { useI18n } from "@/components/I18nProvider";

export type ShellPageId =
  | "overview"
  | "providers"
  | "combos"
  | "keys"
  | "usage"
  | "routing"
  | "mcp"
  | "tunnel"
  | "headroom"
  | "cli";

export default function WorkspaceTitle({
  active,
  titleOverride
}: {
  active: ShellPageId;
  titleOverride?: string;
}) {
  const { t } = useI18n();

  const map: Record<ShellPageId, { eyebrow: string; title: string }> = {
    overview: { eyebrow: t.nav.overview, title: t.shell.dashboard },
    providers: { eyebrow: t.nav.providers, title: t.nav.providers },
    combos: { eyebrow: t.nav.routing, title: t.nav.combos },
    keys: { eyebrow: t.nav.keys, title: t.shell.clientKeys },
    usage: { eyebrow: t.nav.usage, title: t.nav.usage },
    routing: { eyebrow: t.nav.routing, title: t.nav.routing },
    mcp: { eyebrow: t.shell.bridge, title: t.nav.mcp },
    tunnel: { eyebrow: t.shell.remoteAccess, title: t.nav.tunnel },
    headroom: { eyebrow: t.shell.compressionProxy, title: t.nav.headroom },
    cli: { eyebrow: t.cli.pageEyebrow, title: t.cli.pageTitle }
  };

  const page = map[active];
  return (
    <div>
      <p className="subtle">{active === "providers" && titleOverride ? t.shell.provider : page.eyebrow}</p>
      <h1>{titleOverride ?? page.title}</h1>
    </div>
  );
}
