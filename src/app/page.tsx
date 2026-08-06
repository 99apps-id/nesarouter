import type { Metadata } from "next";
import SaasLanding, { type LandingModelCard } from "@/components/saas/SaasLanding";
import { listSaasCatalogForDisplay } from "@/core/saas/saasCatalog";
import { resolveOpsContact } from "@/core/saas/saasOpsContact";
import { isSaasEnabled } from "@/core/saas/saasConfig";
import "@/app/saas-landing.css";

export const metadata: Metadata = {
  title: "NesaRouter — API AI OpenAI-compatible",
  description:
    "Gateway API undangan saja. Model gratis dan premium tersedia melalui Base URL https://nesarouter.com/v1."
};

export const dynamic = "force-dynamic";

function formatContext(window: number | null): string {
  if (window == null || !Number.isFinite(window) || window <= 0) return "—";
  if (window >= 1000) return `~${Math.round(window / 1000)}k`;
  return String(window);
}

async function loadCatalogCards(): Promise<{ free: LandingModelCard[]; premium: LandingModelCard[] }> {
  if (!isSaasEnabled()) return { free: [], premium: [] };
  try {
    const rows = await listSaasCatalogForDisplay();
    const free = rows
      .filter((row) => row.isFree && row.enabled)
      .map((row) => ({
        id: row.publicId,
        title: row.displayName?.trim() || row.publicId,
        body: "",
        context: formatContext(row.contextWindow),
        status: "live" as const
      }));
    const premium = rows
      .filter((row) => !row.isFree && row.enabled && !row.publicId.endsWith("-free"))
      .map((row) => ({
        id: row.publicId,
        title: row.displayName?.trim() || row.publicId,
        body: "Model premium — saldo kredit atau Paket Unlimited",
        context: formatContext(row.contextWindow),
        status: "premium" as const
      }));
    return { free, premium };
  } catch {
    return { free: [], premium: [] };
  }
}

export default async function MarketingHomePage() {
  const contactId = resolveOpsContact("id");
  const contactEn = resolveOpsContact("en");
  const { free, premium } = await loadCatalogCards();
  return (
    <SaasLanding
      freeModels={free}
      premiumModels={premium}
      contact={{
        id: {
          email: contactId.email,
          mailtoHref: contactId.mailtoHref,
          whatsappHref: contactId.whatsappHref
        },
        en: {
          email: contactEn.email,
          mailtoHref: contactEn.mailtoHref,
          whatsappHref: contactEn.whatsappHref
        }
      }}
    />
  );
}
