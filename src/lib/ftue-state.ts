export const FTUE_KEYS = {
  welcome: "welcome",
  brainIntro: "brain-intro",
  integrationsIntro: "integrations-intro",
  testsIntro: "tests-intro",
  bugIntro: "bug-intro",
  riskIntro: "risk-intro",
  improveIntro: "improve-intro",
  featureIntro: "feature-intro",
} as const;

export type FtueKey = (typeof FTUE_KEYS)[keyof typeof FTUE_KEYS];

// Compatibility alias for any code that expects FtueStepKey.
export type FtueStepKey = FtueKey;

const FTUE_STORAGE_PREFIX = "qatalyst.ftue.";

function getStorageKey(key: FtueKey) {
  return `${FTUE_STORAGE_PREFIX}${key}`;
}

export function isFtueStepComplete(key: FtueKey): boolean {
  if (typeof window === "undefined") return true;

  try {
    return window.localStorage.getItem(getStorageKey(key)) === "true";
  } catch {
    return true;
  }
}

export function completeFtueStep(key: FtueKey): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(getStorageKey(key), "true");
  } catch {
    // localStorage can fail in privacy/restricted modes. Ignore safely.
  }
}

export function resetFtueStep(key: FtueKey): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(getStorageKey(key));
  } catch {
    // localStorage can fail in privacy/restricted modes. Ignore safely.
  }
}

export function resetAllFtueSteps(): void {
  if (typeof window === "undefined") return;

  Object.values(FTUE_KEYS).forEach((key) => resetFtueStep(key));
}