"use client";

type JiraCredentialFieldsProps = {
  jiraEmail: string;
  jiraApiToken: string;
  hasSavedJiraApiToken?: boolean;
  onJiraEmailChange: (value: string) => void;
  onJiraApiTokenChange: (value: string) => void;
};

export default function JiraCredentialFields({
  jiraEmail,
  jiraApiToken,
  hasSavedJiraApiToken = false,
  onJiraEmailChange,
  onJiraApiTokenChange,
}: JiraCredentialFieldsProps) {
  return (
    <div className="jira-credential-grid">
      <label>
        <span>Jira username / email</span>
        <input
          type="email"
          value={jiraEmail}
          onChange={(event) => onJiraEmailChange(event.target.value)}
          placeholder="qa@example.com"
          autoComplete="username"
        />
      </label>

      <label>
        <span>Jira API token</span>
        <input
          type="password"
          value={jiraApiToken}
          onChange={(event) => onJiraApiTokenChange(event.target.value)}
          placeholder={hasSavedJiraApiToken ? "•••••••• saved - paste new token to replace" : "Paste Jira API token"}
          autoComplete="current-password"
        />
        <small>
          {hasSavedJiraApiToken
            ? "A Jira token is already saved. Paste a new token only if you want to replace it."
            : "Create a Jira API token from your Atlassian account security page."}
        </small>
      </label>
    </div>
  );
}
