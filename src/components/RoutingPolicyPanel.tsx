"use client";

import { ProviderConfig, RouterSettings } from "@/core/types";
import { useI18n } from "@/components/I18nProvider";

export default function RoutingPolicyPanel({
  router,
  providers
}: {
  router: RouterSettings;
  providers: ProviderConfig[];
}) {
  const { t } = useI18n();
  const activeProviders = providers.filter((provider) => provider.status === "active");
  const connectedProviders = providers.filter((provider) => provider.connectionStatus === "connected");

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{t.routerPanel.title}</h2>
        </div>
      </div>
      <div className="route-lane" aria-label={t.routerPanel.laneAria}>
        <span>{t.routerPanel.userApp}</span>
        <i />
        <span>{t.routerPanel.cache}</span>
        <i />
        <span>{t.routerPanel.budget}</span>
        <i />
        <span>{t.routerPanel.evaluator}</span>
        <i />
        <span>{t.routerPanel.provider}</span>
      </div>
      <div className="policy-grid">
        <div>
          <span>{t.routerPanel.mode}</span>
          <strong>{router.routingMode}</strong>
        </div>
        <div>
          <span>{t.routerPanel.strategy}</span>
          <strong>
            {router.providerStrategy === "round_robin" ? t.routerPanel.roundRobin : t.routerPanel.priority}
          </strong>
        </div>
        <div>
          <span>{t.routerPanel.fallback}</span>
          <strong>{router.fallbackMode === "off" ? t.common.off : t.common.auto}</strong>
        </div>
        <div>
          <span>{t.routerPanel.evaluator}</span>
          <strong>{router.evaluatorEnabled === false ? t.common.off : t.common.on}</strong>
        </div>
        <div>
          <span>{t.routerPanel.active}</span>
          <strong>{activeProviders.length}</strong>
        </div>
        <div>
          <span>{t.routerPanel.connected}</span>
          <strong>{connectedProviders.length}</strong>
        </div>
      </div>
      <div className="policy-list">
        {providers.slice(0, 6).map((provider) => (
          <div key={provider.id}>
            <span>{provider.name}</span>
            <strong>
              {provider.status} / {provider.connectionStatus ?? t.routerPanel.unknown}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}
