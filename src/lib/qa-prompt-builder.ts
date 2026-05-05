import { buildQAS73PromptBlock, type QAToolPromptType } from "@/lib/qas73-generator-quality-rules";

type PromptBuildInput = {
  tool: QAToolPromptType;
  baseInstructions: string;
  sourceText: string;
  projectContextBlock?: string;
  selectedSourceContextBlock?: string;
  followUpContextBlock?: string;
  additionalContext?: string;
};

function section(title: string, body?: string) {
  const trimmed = body?.trim();
  if (!trimmed) return "";

  return `\n\n## ${title}\n${trimmed}`;
}

export function buildQAToolPrompt({
  tool,
  baseInstructions,
  sourceText,
  projectContextBlock,
  selectedSourceContextBlock,
  followUpContextBlock,
  additionalContext,
}: PromptBuildInput): string {
  return [
    baseInstructions.trim(),
    buildQAS73PromptBlock(tool),
    section("Project Context", projectContextBlock),
    section("Selected Project Sources", selectedSourceContextBlock),
    section("Answered Follow-up Context", followUpContextBlock),
    section("Additional Tester Context", additionalContext),
    section("Source Input", sourceText),
  ]
    .filter(Boolean)
    .join("\n");
}
