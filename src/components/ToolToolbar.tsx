"use client";

export type QatalystToolId = "tests" | "risk" | "bug" | "improve";
export type QatalystToolTone = "green" | "yellow" | "red" | "blue";

export type QatalystToolOption = {
  id: QatalystToolId;
  label: string;
  description: string;
  tone?: QatalystToolTone;
  status?: "ready" | "coming-soon";
  testId?: string;
};

type ToolToolbarProps = {
  tools: QatalystToolOption[];
  activeTool: QatalystToolId;
  onToolChange: (toolId: QatalystToolId) => void;
};

const FUTURE_TOOLS = [
  {
    id: "feature-builder",
    label: "Feature Builder",
    description: "Shape rough ideas into feature briefs",
    status: "coming-soon",
    tone: "blue",
  },
] as const;

export default function ToolToolbar({ tools, activeTool, onToolChange }: ToolToolbarProps) {
  return (
    <section className="tool-toolbar-panel" aria-label="QAtalyst tool selector">
      <div className="tool-toolbar-heading">
        <div>
          <p className="report-kicker">QAtalyst Toolbelt</p>
          <h2>Choose your workflow</h2>
        </div>
        <span>Feature Builder is staged here for the next pass.</span>
      </div>

      <div className="tool-toolbar-grid" role="tablist" aria-label="Available QAtalyst tools">
        {tools.map((tool) => {
          const isActive = activeTool === tool.id;

          return (
            <button
              key={tool.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={[
                "tool-toolbar-button",
                `tool-toolbar-button-${tool.tone ?? "red"}`,
                isActive ? "tool-toolbar-button-active" : "",
              ].filter(Boolean).join(" ")}
              data-testid={tool.testId}
              onClick={() => onToolChange(tool.id)}
            >
              <strong>{tool.label}</strong>
              <span>{tool.description}</span>
            </button>
          );
        })}

        {FUTURE_TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={[
              "tool-toolbar-button",
              "tool-toolbar-button-blue",
              "tool-toolbar-button-coming-soon",
            ].filter(Boolean).join(" ")}
            disabled
            aria-disabled="true"
            title="Coming soon in QAS-88"
          >
            <strong>{tool.label}</strong>
            <span>{tool.description}</span>
            <em>Coming soon</em>
          </button>
        ))}
      </div>
    </section>
  );
}
