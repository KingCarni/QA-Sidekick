import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required."),
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL.").optional().or(z.literal("")),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL.").optional().or(z.literal("")),
  GOOGLE_CLIENT_ID: z.string().optional().or(z.literal("")),
  GOOGLE_CLIENT_SECRET: z.string().optional().or(z.literal("")),
  STRIPE_SECRET_KEY: z.string().optional().or(z.literal("")),
  STRIPE_WEBHOOK_SECRET: z.string().optional().or(z.literal("")),
  STRIPE_EXPECT_LIVEMODE: z.enum(["true", "false"]).optional().or(z.literal("")),
  ADMIN_EMAIL: z.string().email("ADMIN_EMAIL must be a valid email.").optional().or(z.literal("")),
  OPENAI_API_KEY: z.string().optional().or(z.literal("")),
});

type ServerEnv = z.infer<typeof serverEnvSchema>;

type EnvArea = "core" | "auth" | "stripe" | "openai" | "admin";

type ConfigIssue = {
  area: EnvArea;
  key: keyof ServerEnv;
  message: string;
  severity: "error" | "warning";
};

function rawEnv(): Record<keyof ServerEnv, string | undefined> {
  return {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_EXPECT_LIVEMODE: process.env.STRIPE_EXPECT_LIVEMODE,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  };
}

function clean(value: string | undefined) {
  return String(value ?? "").trim();
}

function hasValue(value: string | undefined) {
  return clean(value).length > 0;
}

function redact(value: string | undefined) {
  const text = clean(value);
  if (!text) return null;
  if (text.length <= 8) return "set";
  return `${text.slice(0, 4)}…${text.slice(-4)}`;
}

function normalizeBaseUrl(value: string | undefined) {
  return clean(value).replace(/\/$/, "");
}

export function getServerEnv() {
  const parsed = serverEnvSchema.safeParse(rawEnv());

  if (parsed.success) {
    return {
      ok: true as const,
      env: parsed.data,
      errors: [] as string[],
    };
  }

  return {
    ok: false as const,
    env: rawEnv() as ServerEnv,
    errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
  };
}

export function getOptionalEnv(key: keyof ServerEnv) {
  return clean(process.env[key]);
}

export function requireEnv(key: keyof ServerEnv, area: EnvArea = "core") {
  const value = clean(process.env[key]);

  if (!value) {
    throw new Error(`Missing required ${area} environment variable: ${key}`);
  }

  return value;
}

export function requireStripeSecretKey() {
  const key = requireEnv("STRIPE_SECRET_KEY", "stripe");

  if (!key.startsWith("sk_test_") && !key.startsWith("sk_live_")) {
    throw new Error("STRIPE_SECRET_KEY must start with sk_test_ or sk_live_.");
  }

  return key;
}

export function requireStripeWebhookSecret() {
  const secret = requireEnv("STRIPE_WEBHOOK_SECRET", "stripe");

  if (!secret.startsWith("whsec_")) {
    throw new Error("STRIPE_WEBHOOK_SECRET must start with whsec_.");
  }

  return secret;
}

export function getExpectedStripeLiveMode() {
  const value = clean(process.env.STRIPE_EXPECT_LIVEMODE);

  if (value === "true") return true;
  if (value === "false") return false;

  return null;
}

export function getAppBaseUrl(req?: Request) {
  const explicit = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL);

  if (explicit) return explicit;

  if (req) {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "http";

    if (host) return `${proto}://${host}`.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

export function isGoogleAuthConfigured() {
  return hasValue(process.env.GOOGLE_CLIENT_ID) && hasValue(process.env.GOOGLE_CLIENT_SECRET);
}

export function isStripeConfigured() {
  return hasValue(process.env.STRIPE_SECRET_KEY);
}

export function isStripeWebhookConfigured() {
  return hasValue(process.env.STRIPE_WEBHOOK_SECRET);
}

export function getConfigIssues() {
  const issues: ConfigIssue[] = [];
  const env = rawEnv();

  if (!hasValue(env.DATABASE_URL)) {
    issues.push({
      area: "core",
      key: "DATABASE_URL",
      severity: "error",
      message: "Database connection is missing.",
    });
  }

  if (!hasValue(env.NEXTAUTH_SECRET)) {
    issues.push({
      area: "auth",
      key: "NEXTAUTH_SECRET",
      severity: "error",
      message: "NextAuth secret is missing.",
    });
  }

  if (!hasValue(env.NEXTAUTH_URL)) {
    issues.push({
      area: "auth",
      key: "NEXTAUTH_URL",
      severity: "warning",
      message: "NEXTAUTH_URL is not set. Local/dev may work, but production auth callbacks can fail.",
    });
  }

  if (!hasValue(env.NEXT_PUBLIC_APP_URL)) {
    issues.push({
      area: "core",
      key: "NEXT_PUBLIC_APP_URL",
      severity: "warning",
      message: "NEXT_PUBLIC_APP_URL is not set. Checkout redirects will fall back to request host or NEXTAUTH_URL.",
    });
  }

  if (hasValue(env.GOOGLE_CLIENT_ID) !== hasValue(env.GOOGLE_CLIENT_SECRET)) {
    issues.push({
      area: "auth",
      key: hasValue(env.GOOGLE_CLIENT_ID) ? "GOOGLE_CLIENT_SECRET" : "GOOGLE_CLIENT_ID",
      severity: "error",
      message: "Google OAuth config is incomplete. Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    });
  }

  if (hasValue(env.STRIPE_SECRET_KEY) && !clean(env.STRIPE_SECRET_KEY).startsWith("sk_")) {
    issues.push({
      area: "stripe",
      key: "STRIPE_SECRET_KEY",
      severity: "error",
      message: "STRIPE_SECRET_KEY should start with sk_test_ or sk_live_.",
    });
  }

  if (hasValue(env.STRIPE_WEBHOOK_SECRET) && !clean(env.STRIPE_WEBHOOK_SECRET).startsWith("whsec_")) {
    issues.push({
      area: "stripe",
      key: "STRIPE_WEBHOOK_SECRET",
      severity: "error",
      message: "STRIPE_WEBHOOK_SECRET should start with whsec_.",
    });
  }

  if (hasValue(env.STRIPE_SECRET_KEY) && !hasValue(env.STRIPE_EXPECT_LIVEMODE)) {
    issues.push({
      area: "stripe",
      key: "STRIPE_EXPECT_LIVEMODE",
      severity: "warning",
      message: "STRIPE_EXPECT_LIVEMODE is not set. Use false locally/test mode and true for live production.",
    });
  }

  if (hasValue(env.STRIPE_EXPECT_LIVEMODE)) {
    const expectedLive = clean(env.STRIPE_EXPECT_LIVEMODE);
    const key = clean(env.STRIPE_SECRET_KEY);

    if (expectedLive === "true" && key.startsWith("sk_test_")) {
      issues.push({
        area: "stripe",
        key: "STRIPE_EXPECT_LIVEMODE",
        severity: "error",
        message: "STRIPE_EXPECT_LIVEMODE=true but STRIPE_SECRET_KEY is a test key.",
      });
    }

    if (expectedLive === "false" && key.startsWith("sk_live_")) {
      issues.push({
        area: "stripe",
        key: "STRIPE_EXPECT_LIVEMODE",
        severity: "error",
        message: "STRIPE_EXPECT_LIVEMODE=false but STRIPE_SECRET_KEY is a live key.",
      });
    }
  }

  if (!hasValue(env.OPENAI_API_KEY)) {
    issues.push({
      area: "openai",
      key: "OPENAI_API_KEY",
      severity: "warning",
      message: "OPENAI_API_KEY is not set. AI generation routes will fail until configured.",
    });
  }

  return issues;
}

export function getSafeConfigStatus() {
  const env = rawEnv();
  const issues = getConfigIssues();

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    app: "QAtalyst",
    mode: process.env.NODE_ENV ?? "unknown",
    urls: {
      NEXTAUTH_URL: normalizeBaseUrl(env.NEXTAUTH_URL) || null,
      NEXT_PUBLIC_APP_URL: normalizeBaseUrl(env.NEXT_PUBLIC_APP_URL) || null,
    },
    configured: {
      DATABASE_URL: hasValue(env.DATABASE_URL),
      NEXTAUTH_SECRET: hasValue(env.NEXTAUTH_SECRET),
      GOOGLE_OAUTH: isGoogleAuthConfigured(),
      STRIPE_SECRET_KEY: hasValue(env.STRIPE_SECRET_KEY),
      STRIPE_WEBHOOK_SECRET: hasValue(env.STRIPE_WEBHOOK_SECRET),
      STRIPE_EXPECT_LIVEMODE: clean(env.STRIPE_EXPECT_LIVEMODE) || null,
      OPENAI_API_KEY: hasValue(env.OPENAI_API_KEY),
      ADMIN_EMAIL: hasValue(env.ADMIN_EMAIL),
    },
    redacted: {
      STRIPE_SECRET_KEY: redact(env.STRIPE_SECRET_KEY),
      STRIPE_WEBHOOK_SECRET: redact(env.STRIPE_WEBHOOK_SECRET),
      GOOGLE_CLIENT_ID: redact(env.GOOGLE_CLIENT_ID),
    },
    issues,
  };
}

export function envErrorResponse(error: unknown, fallback = "Server configuration error.") {
  const message = error instanceof Error ? error.message : fallback;

  return {
    ok: false as const,
    error: message,
  };
}
