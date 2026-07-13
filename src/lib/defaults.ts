import { NesaStore } from "@/core/types";
import { defaultTokenSaver } from "@/core/tokenSaver";
import { providerPresets } from "@/lib/providerPresets";

export const defaultStore: NesaStore = {
  providers: providerPresets,
  budget: {
    dailyBudgetUsd: 5,
    warningThresholdPercent: 80,
    criticalThresholdPercent: 95,
    hardLimitPercent: 100,
    onWarning: "prefer_cheaper",
    onCritical: "free_tier_only",
    onExceeded: "block_paid"
  },
  router: {
    routingMode: "auto",
    providerStrategy: "priority",
    fallbackMode: "auto",
    evaluatorEnabled: true,
    preferFreeTier: true,
    cacheEnabled: true,
    rtkEnabled: true,
    tokenSaver: { ...defaultTokenSaver },
    headroomEnabled: false,
    headroomUrl: "http://localhost:8787",
    headroomCompressUserMessages: false,
    pxpipeEnabled: false,
    mediaRouting: {
      searchMode: "builtin"
    }
  },
  usage: [],
  cache: [],
  // Client access starts locked. A key is created explicitly in the Keys menu.
  localApiKeys: [],
  combos: [],
  aliases: []
};
