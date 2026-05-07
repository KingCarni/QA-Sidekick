import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function getSecretMaterial() {
  const value = process.env.TESTRAIL_SECRET_KEY || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

  if (!value) {
    throw new Error("TESTRAIL_SECRET_KEY is required to save or read TestRail API keys.");
  }

  return createHash("sha256").update(value).digest();
}

export function encryptTestRailSecret(plainText: string) {
  const value = plainText.trim();

  if (!value) {
    throw new Error("TestRail API key is required.");
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getSecretMaterial(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptTestRailSecret(encryptedValue: string) {
  const [ivValue, tagValue, encryptedText] = encryptedValue.split(":");

  if (!ivValue || !tagValue || !encryptedText) {
    throw new Error("Saved TestRail secret is not readable.");
  }

  const decipher = createDecipheriv(ALGORITHM, getSecretMaterial(), Buffer.from(ivValue, "base64"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function maskSecret(value?: string | null) {
  if (!value) return "";
  return "••••••••";
}
