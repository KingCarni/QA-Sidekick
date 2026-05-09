// src/lib/credits-config.ts
// QAS-126 Pass 1e
// Single source of truth for credit packs, prices, and paid action costs.

export type CreditPackId =
  | "starter"
  | "pro"
  | "team"
  | "mini_boost"
  | "extra_fuel"
  | "power_boost"
  | "support_3"
  | "support_5"
  | "support_10";

export type CreditPackKind = "primary" | "addon" | "support";

export type CreditPack = {
  id: CreditPackId;
  kind: CreditPackKind;
  label: string;
  shortLabel: string;
  credits: number;
  amountCents: number;
  currency: "cad";
  displayPrice: string;
  priceCad: number;
  description: string;
  reason: string;
  cta: string;
  stripeMetadataType: "credit_purchase" | "donation";
};

export const SIGNUP_CREDITS = 25;
export const DAILY_REFRESH_CREDITS = 5;
export const CREDIT_CURRENCY = "cad";

export const CREDIT_PACKS: Record<CreditPackId, CreditPack> = {
  starter: {
    id: "starter",
    kind: "primary",
    label: "Starter",
    shortLabel: "Starter",
    credits: 100,
    amountCents: 900,
    currency: "cad",
    displayPrice: "CA$9",
    priceCad: 9,
    description: "A solid refill for individual QA work.",
    reason: "purchase_starter",
    cta: "Buy Starter",
    stripeMetadataType: "credit_purchase",
  },
  pro: {
    id: "pro",
    kind: "primary",
    label: "Pro",
    shortLabel: "Pro",
    credits: 250,
    amountCents: 1900,
    currency: "cad",
    displayPrice: "CA$19",
    priceCad: 19,
    description: "Best value for regular sprint planning.",
    reason: "purchase_pro",
    cta: "Buy Pro",
    stripeMetadataType: "credit_purchase",
  },
  team: {
    id: "team",
    kind: "primary",
    label: "Team",
    shortLabel: "Team",
    credits: 800,
    amountCents: 4900,
    currency: "cad",
    displayPrice: "CA$49",
    priceCad: 49,
    description: "A larger pool for heavier team workflows.",
    reason: "purchase_team",
    cta: "Buy Team",
    stripeMetadataType: "credit_purchase",
  },
  mini_boost: {
    id: "mini_boost",
    kind: "addon",
    label: "Mini Boost",
    shortLabel: "Mini",
    credits: 25,
    amountCents: 300,
    currency: "cad",
    displayPrice: "CA$3",
    priceCad: 3,
    description: "A small top-up when you only need one more push.",
    reason: "purchase_addon",
    cta: "Add Mini Boost",
    stripeMetadataType: "credit_purchase",
  },
  extra_fuel: {
    id: "extra_fuel",
    kind: "addon",
    label: "Extra Fuel",
    shortLabel: "Fuel",
    credits: 50,
    amountCents: 500,
    currency: "cad",
    displayPrice: "CA$5",
    priceCad: 5,
    description: "A practical refill for another short QA session.",
    reason: "purchase_addon",
    cta: "Add Extra Fuel",
    stripeMetadataType: "credit_purchase",
  },
  power_boost: {
    id: "power_boost",
    kind: "addon",
    label: "Power Boost",
    shortLabel: "Power",
    credits: 120,
    amountCents: 1000,
    currency: "cad",
    displayPrice: "CA$10",
    priceCad: 10,
    description: "A stronger add-on for several more AI runs.",
    reason: "purchase_addon",
    cta: "Add Power Boost",
    stripeMetadataType: "credit_purchase",
  },
  support_3: {
    id: "support_3",
    kind: "support",
    label: "Support QAtalyst — CA$3",
    shortLabel: "Support $3",
    credits: 0,
    amountCents: 300,
    currency: "cad",
    displayPrice: "CA$3",
    priceCad: 3,
    description: "Support development without adding credits.",
    reason: "donation",
    cta: "Support $3",
    stripeMetadataType: "donation",
  },
  support_5: {
    id: "support_5",
    kind: "support",
    label: "Support QAtalyst — CA$5",
    shortLabel: "Support $5",
    credits: 0,
    amountCents: 500,
    currency: "cad",
    displayPrice: "CA$5",
    priceCad: 5,
    description: "Support development without adding credits.",
    reason: "donation",
    cta: "Support $5",
    stripeMetadataType: "donation",
  },
  support_10: {
    id: "support_10",
    kind: "support",
    label: "Support QAtalyst — CA$10",
    shortLabel: "Support $10",
    credits: 0,
    amountCents: 1000,
    currency: "cad",
    displayPrice: "CA$10",
    priceCad: 10,
    description: "Support development without adding credits.",
    reason: "donation",
    cta: "Support $10",
    stripeMetadataType: "donation",
  },
};

export const CREDIT_PACK_LIST = Object.values(CREDIT_PACKS);
export const PRIMARY_CREDIT_PACKS = CREDIT_PACK_LIST.filter((pack) => pack.kind === "primary");
export const ADDON_CREDIT_PACKS = CREDIT_PACK_LIST.filter((pack) => pack.kind === "addon");
export const SUPPORT_PACKS = CREDIT_PACK_LIST.filter((pack) => pack.kind === "support");

export function normalizeCreditPackId(value: unknown): CreditPackId {
  const raw = String(value ?? "").trim().toLowerCase().replace(/-/g, "_");
  if (raw in CREDIT_PACKS) return raw as CreditPackId;
  return "starter";
}

export function getCreditPack(value: unknown): CreditPack {
  return CREDIT_PACKS[normalizeCreditPackId(value)];
}

export type CreditActionId =
  | "test_cases_generate"
  | "risk_review_generate"
  | "bug_writer_generate"
  | "test_improver_generate"
  | "feature_builder_generate"
  | "feature_builder_refine"
  | "feature_builder_jira_create"
  | "feature_builder_prompt_suggestions";

export type PaidCreditAction = CreditActionId;

export type CreditAction = {
  id: CreditActionId;
  label: string;
  shortLabel: string;
  cost: number;
  reason: string;
  description: string;
};

export const CREDIT_ACTIONS: Record<CreditActionId, CreditAction> = {
  test_cases_generate: {
    id: "test_cases_generate",
    label: "Generate Test Cases",
    shortLabel: "Test Cases",
    cost: 5,
    reason: "usage_test_cases",
    description: "Generate structured QA test cases from ticket or feature context.",
  },
  risk_review_generate: {
    id: "risk_review_generate",
    label: "Run Risk Review",
    shortLabel: "Risk Review",
    cost: 3,
    reason: "usage_risk_review",
    description: "Identify QA risks, release blockers, missing details, and edge cases.",
  },
  bug_writer_generate: {
    id: "bug_writer_generate",
    label: "Write Bug Report",
    shortLabel: "Bug Writer",
    cost: 2,
    reason: "usage_bug_writer",
    description: "Turn rough defect notes into a clean, actionable bug report.",
  },
  test_improver_generate: {
    id: "test_improver_generate",
    label: "Improve Test Case",
    shortLabel: "Test Improver",
    cost: 2,
    reason: "usage_test_improver",
    description: "Improve rough test cases for clarity, coverage, and execution quality.",
  },
  feature_builder_generate: {
    id: "feature_builder_generate",
    label: "Generate Feature Brief",
    shortLabel: "Feature Builder",
    cost: 5,
    reason: "usage_feature_builder",
    description: "Turn a rough feature idea into a release-ready product and QA brief.",
  },
  feature_builder_refine: {
    id: "feature_builder_refine",
    label: "Refine Feature Brief",
    shortLabel: "AI Refinement",
    cost: 1,
    reason: "usage_feature_builder_refine",
    description: "Run one focused refinement pass on the current feature brief.",
  },
  feature_builder_jira_create: {
    id: "feature_builder_jira_create",
    label: "Create Jira Work",
    shortLabel: "Jira Creation",
    cost: 1,
    reason: "usage_feature_builder_jira_create",
    description: "Create Jira-ready work items from the generated feature plan.",
  },
  feature_builder_prompt_suggestions: {
    id: "feature_builder_prompt_suggestions",
    label: "Ask AI for Prompts",
    shortLabel: "AI Prompts",
    cost: 1,
    reason: "usage_feature_builder_prompt_suggestions",
    description: "Generate targeted prompt suggestions for a rough feature idea.",
  },
};

export const PAID_CREDIT_ACTIONS = CREDIT_ACTIONS;

export const CREDIT_ACTION_LIST = Object.values(CREDIT_ACTIONS);

export function getCreditAction(actionId: CreditActionId): CreditAction {
  return CREDIT_ACTIONS[actionId];
}

export function getPaidActionConfig(action: PaidCreditAction): CreditAction {
  return getCreditAction(action);
}

export function getCreditCost(actionId: CreditActionId): number {
  return CREDIT_ACTIONS[actionId].cost;
}

export function formatCreditCost(actionId: CreditActionId): string {
  const cost = getCreditCost(actionId);
  return `${cost} credit${cost === 1 ? "" : "s"}`;
}

export function formatCredits(value: number) {
  return new Intl.NumberFormat("en-CA").format(value);
}

export function formatCad(value: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}
