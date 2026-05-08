"use client";

export type QatalystToolId = "tests" | "risk" | "bug" | "improve";

export type QatalystToolOption = {
  id: QatalystToolId;
  label: string;
  description: string;
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
  },
];

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
              className={isActive ? "tool-toolbar-button tool-toolbar-button-active" : "tool-toolbar-button"}
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
            className="tool-toolbar-button tool-toolbar-button-coming-soon"
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
