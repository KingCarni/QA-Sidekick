export function getRawErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (typeof error === "object" && error !== null) {
    const value = error as Record<string, unknown>;
    const direct = value.message || value.error || value.errorMessage || value.errorMessages;

    if (Array.isArray(direct)) return direct.join(" ");
    if (typeof direct === "string") return direct;

    try {
      return JSON.stringify(error);
    } catch {
      return "";
    }
  }

  return "";
}

export function normalizeJiraErrorMessage(error: unknown, fallback = "Jira request failed.") {
  const message = getRawErrorMessage(error).trim();

  if (!message) return fallback;

  const lower = message.toLowerCase();

  const projectMissingOrHidden =
    message.includes("没有找到有密钥") ||
    message.includes("找不到有密钥") ||
    message.includes("æ²¡æœ‰æ‰¾åˆ°æœ‰å¯†é’¥") ||
    message.includes("æ‰¾ä¸åˆ°æœ‰å¯†é’¥") ||
    lower.includes("no project could be found") ||
    lower.includes("project could not be found") ||
    lower.includes("project not found") ||
    lower.includes("no project with key") ||
    lower.includes("project with key") ||
    lower.includes("browse projects") ||
    lower.includes("project does not exist") ||
    lower.includes("permission to browse");

  if (projectMissingOrHidden) {
    return (
      "Jira could not find the selected project, or your connected Jira account does not have permission to browse it. " +
      "Check the Jira site URL, project key, connected email, API token, and project permissions."
    );
  }

  const issueMissingOrHidden =
    message.includes("事务不存在") ||
    message.includes("没有查看的权限") ||
    message.includes("äº‹åŠ¡ä¸å­˜åœ¨") ||
    message.includes("æ²¡æœ‰æŸ¥çœ‹çš„æƒé™") ||
    lower.includes("issue does not exist") ||
    lower.includes("permission to view") ||
    lower.includes("does not exist or you do not have permission") ||
    lower.includes("issue not found");

  if (issueMissingOrHidden) {
    return (
      "Jira could not find this issue, or your connected Jira account does not have permission to view it. " +
      "Check the issue key, project access, Jira site URL, and API credentials."
    );
  }

  const createPermissionDenied =
    message.includes("æ‚¨æ— æƒåœ¨æ­¤é¡¹ç›®ä¸­åˆ›å»ºäº‹åŠ¡") ||
    message.includes("æ— æƒåœ¨æ­¤é¡¹ç›®ä¸­åˆ›å»ºäº‹åŠ¡") ||
    message.includes("æ²¡æœ‰æƒé™åœ¨æ­¤é¡¹ç›®ä¸­åˆ›å»ºäº‹åŠ¡") ||
    message.includes("ä¸èƒ½åœ¨æ­¤é¡¹ç›®ä¸­åˆ›å»ºäº‹åŠ¡") ||
    message.includes("Ã¦â€”Â Ã¦ÂÆ’Ã¥Å“Â¨Ã¦Â­Â¤Ã©Â¡Â¹Ã§â€ºÂ®Ã¤Â¸Â­Ã¥Ë†â€ºÃ¥Â»ÂºÃ¤Âºâ€¹Ã¥Å Â¡") ||
    message.includes("Ã¦Â²Â¡Ã¦Å“â€°Ã¦ÂÆ’Ã©â„¢ÂÃ¥Å“Â¨Ã¦Â­Â¤Ã©Â¡Â¹Ã§â€ºÂ®Ã¤Â¸Â­Ã¥Ë†â€ºÃ¥Â»ÂºÃ¤Âºâ€¹Ã¥Å Â¡") ||
    lower.includes("do not have permission to create issues") ||
    lower.includes("you don't have permission to create issues") ||
    lower.includes("cannot create issue") ||
    lower.includes("create issues permission");

  if (createPermissionDenied) {
    return (
      "Jira is connected, but this account does not have permission to create issues in the selected project. " +
      "Grant the connected Jira user Create Issues permission for this project, or use a Jira API token from an account that already has access."
    );
  }

  const authFailed =
    lower.includes("unauthorized") ||
    lower.includes("401") ||
    lower.includes("forbidden") ||
    lower.includes("403") ||
    lower.includes("authentication") ||
    lower.includes("basic auth") ||
    lower.includes("api token") ||
    lower.includes("invalid credentials");

  if (authFailed) {
    return "Jira authentication failed. Recheck the connected Jira email, API token, site URL, and project permissions.";
  }

  const rateLimited = lower.includes("rate limit") || lower.includes("too many requests") || lower.includes("429");

  if (rateLimited) {
    return "Jira rate limited this request. Wait a moment and try again.";
  }

  return message;
}
