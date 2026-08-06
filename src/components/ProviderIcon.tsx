"use client";

import { ProviderIdentityInput, providerIdentity } from "@/lib/providerIdentity";

export default function ProviderIcon({
  provider,
  size = "md",
  active = false,
  className = ""
}: {
  provider: ProviderIdentityInput;
  size?: "sm" | "md" | "lg";
  active?: boolean;
  className?: string;
}) {
  const identity = providerIdentity(provider);
  return (
    <span
      className={`provider-icon provider-icon-${identity.key} ${identity.iconPath ? "has-logo" : ""} ${size} ${active ? "active" : ""} ${className}`}
      aria-label={`${identity.title} icon`}
      title={identity.title}
    >
      {identity.iconPath ? (
        <img
          src={identity.iconPath}
          alt=""
          aria-hidden="true"
          onError={(event) => {
            event.currentTarget.parentElement?.classList.remove("has-logo");
            event.currentTarget.remove();
          }}
        />
      ) : null}
      <span className="provider-icon-fallback">{identity.label}</span>
    </span>
  );
}
