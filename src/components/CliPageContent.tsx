"use client";

import CliConfigFetcher from "@/components/CliConfigFetcher";
import { useI18n } from "@/components/I18nProvider";
import { Combo, ProviderConfig, RouterSettings } from "@/core/types";
import { ModelAlias } from "@/core/aliases";
import type { KeyRow } from "@/lib/keyIdentity";

export default function CliPageContent({
  baseUrl,
  router,
  combos,
  aliases,
  providers,
  keys,
  comboCount,
  keyCount
}: {
  baseUrl: string;
  router: RouterSettings;
  combos: Combo[];
  aliases: ModelAlias[];
  providers: ProviderConfig[];
  keys: KeyRow[];
  comboCount: number;
  keyCount: number;
}) {
  const { t } = useI18n();
  const cli = t.cli;

  return (
    <>
      <section className="panel compact">
        <div className="panel-heading">
          <div>
            <p className="subtle">{cli.heroSubtle}</p>
            <h2>{cli.heroTitle}</h2>
          </div>
        </div>
        <p className="compact-copy">{cli.heroBody}</p>
        <div className="cli-grid">
          <div>
            <span>{t.common.endpoint}</span>
            <code>{baseUrl}/v1</code>
          </div>
          <div>
            <span>{cli.combos}</span>
            <code>{comboCount}</code>
          </div>
          <div>
            <span>{cli.clientKeys}</span>
            <code>{keyCount}</code>
          </div>
        </div>
      </section>

      <CliConfigFetcher
        baseUrl={baseUrl}
        router={router}
        combos={combos}
        aliases={aliases}
        providers={providers}
        keys={keys}
      />

      <section className="panel compact">
        <div className="panel-heading">
          <div>
            <p className="subtle">{cli.oauthSubtle}</p>
            <h2>{cli.oauthTitle}</h2>
          </div>
        </div>
        <p className="compact-copy">
          {cli.oauthBody}{" "}
          <a href="/providers">{t.common.providers}</a>
        </p>
      </section>

      <section className="panel compact">
        <div className="panel-heading">
          <div>
            <p className="subtle">{cli.logSubtle}</p>
            <h2>{cli.logTitle}</h2>
          </div>
        </div>
        <p className="compact-copy">{cli.logBody}</p>
        <a className="button" href="/usage">
          {cli.openUsage}
        </a>
      </section>
    </>
  );
}
