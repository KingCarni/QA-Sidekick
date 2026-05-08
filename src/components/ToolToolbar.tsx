"use client";

export type QatalystToolId = "tests" | "bug" | "risk" | "improve" | "feature";
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

export default function ToolToolbar({ tools, activeTool, onToolChange }: ToolToolbarProps) {
  return (
    <section className="tool-toolbar-panel" aria-label="QAtalyst tool selector">
      <div className="tool-toolbar-heading">
        <div>
          <p className="report-kicker">QAtalyst Toolbelt</p>
          <h2>Choose your workflow</h2>
        </div>
        <span>Feature Builder is now available for rough feature shaping.</span>
      </div>

      <div className="tool-toolbar-grid" role="tablist" aria-label="Available QAtalyst tools">
        {tools.map((tool) => {
          const isActive = activeTool === tool.id;
          const isDisabled = tool.status === "coming-soon";

          return (
            <button
              key={tool.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-disabled={isDisabled}
              className={[
                "tool-toolbar-button",
                `tool-toolbar-button-${tool.tone ?? "red"}`,
                isActive ? "tool-toolbar-button-active" : "",
                isDisabled ? "tool-toolbar-button-coming-soon" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-testid={tool.testId}
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) onToolChange(tool.id);
              }}
            >
              <strong>{tool.label}</strong>
              <span>{tool.description}</span>
              {isDisabled ? <em>Coming soon</em> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
