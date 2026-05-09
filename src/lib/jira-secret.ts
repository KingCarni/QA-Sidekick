import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function getJiraSecretMaterial() {
  const value =
    process.env.JIRA_SECRET_KEY ||
    process.env.TESTRAIL_SECRET_KEY ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET;

  if (!value) {
    throw new Error("JIRA_SECRET_KEY is required to save or read Jira API tokens.");
  }

  return createHash("sha256").update(value).digest();
}

export function encryptJiraSecret(plainText: string) {
  const value = plainText.trim();

  if (!value) {
    throw new Error("Jira API token is required.");
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getJiraSecretMaterial(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptJiraSecret(encryptedValue: string) {
  const [ivValue, tagValue, encryptedText] = encryptedValue.split(":");

  if (!ivValue || !tagValue || !encryptedText) {
    throw new Error("Saved Jira API token is not readable. Re-save your Jira API token.");
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, getJiraSecretMaterial(), Buffer.from(ivValue, "base64"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64"));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedText, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error(
      "Saved Jira API token could not be decrypted. Re-save your Jira API token and confirm JIRA_SECRET_KEY is stable across environments."
    );
  }
}

export function maskJiraSecret(value?: string | null) {
  if (!value) return "";
  return "********";
}
