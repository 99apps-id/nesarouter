import { ProviderConfig, RouterSettings } from "@/core/types";

export default function RoutingPolicyPanel({
  router,
  providers
}: {
  router: RouterSettings;
  providers: ProviderConfig[];
}) {
  const activeProviders = providers.filter((provider) => provider.status === "active");
  const connectedProviders = providers.filter((provider) => provider.connectionStatus === "connected");

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="subtle">Flow</p>
          <h2>Routing engine</h2>
        </div>
      </div>
      <div className="route-lane" aria-label="Routing lane">
        <span>User/App</span>
        <i />
        <span>Cache</span>
        <i />
        <span>Budget</span>
        <i />
        <span>Evaluator</span>
        <i />
        <span>Provider</span>
      </div>
      <div className="policy-grid">
        <div>
          <span>Mode</span>
          <strong>{router.routingMode}</strong>
        </div>
        <div>
          <span>Strategy</span>
          <strong>{router.providerStrategy === "round_robin" ? "Round robin" : "Priority"}</strong>
        </div>
        <div>
          <span>Fallback</span>
          <strong>{router.fallbackMode === "off" ? "Off" : "Auto"}</strong>
        </div>
        <div>
          <span>Evaluator</span>
          <strong>{router.evaluatorEnabled === false ? "Off" : "On"}</strong>
        </div>
        <div>
          <span>Active</span>
          <strong>{activeProviders.length}</strong>
        </div>
        <div>
          <span>Connected</span>
          <strong>{connectedProviders.length}</strong>
        </div>
      </div>
      <div className="policy-list">
        {providers.slice(0, 6).map((provider) => (
          <div key={provider.id}>
            <span>{provider.name}</span>
            <strong>{provider.status} / {provider.connectionStatus ?? "unknown"}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
