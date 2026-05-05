export type SourceFileExtractionResult = {
  ok: boolean;
  filename: string;
  title: string;
  body: string;
  sourceType: string;
  tags: string[];
  error?: string;
};

const MAX_SOURCE_FILE_BYTES = 512 * 1024;
const MAX_EXTRACTED_CHARS = 24000;

const SUPPORTED_EXTENSIONS = new Set(["txt", "md", "markdown", "json", "csv", "log"]);

function extensionFromName(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function titleFromFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^/.]+$/, "");
  return withoutExt
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .slice(0, 120);
}

function inferSourceType(filename: string, text: string): string {
  const lowerName = filename.toLowerCase();
  const lowerText = text.toLowerCase().slice(0, 3000);

  if (lowerName.includes("glossary") || lowerText.includes("glossary")) return "glossary";
  if (lowerName.includes("api") || lowerText.includes("endpoint") || lowerText.includes("request")) return "api-doc";
  if (lowerName.includes("risk") || lowerName.includes("qa") || lowerText.includes("test strategy")) return "test-strategy";
  if (lowerName.includes("jira") || lowerText.includes("acceptance criteria")) return "jira-epic";
  if (lowerName.includes("requirement") || lowerText.includes("requirements")) return "requirements";
  if (lowerName.includes("design") || lowerText.includes("design")) return "design-doc";
  if (lowerName.includes("platform") || lowerText.includes("browser") || lowerText.includes("ios") || lowerText.includes("android")) return "platform-rules";
  if (lowerName.includes("overview") || lowerText.includes("overview")) return "product-overview";

  return "other";
}

function inferTags(filename: string, text: string): string[] {
  const haystack = `${filename} ${text}`.toLowerCase();
  const tagCandidates = [
    "qa",
    "requirements",
    "jira",
    "automation",
    "playwright",
    "cypress",
    "risk",
    "bug",
    "regression",
    "accessibility",
    "auth",
    "permissions",
    "api",
    "mobile",
    "web",
    "game",
    "platform",
    "glossary",
    "test-strategy",
  ];

  return tagCandidates.filter((tag) => haystack.includes(tag)).slice(0, 10);
}

function normalizeExtractedText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
    .slice(0, MAX_EXTRACTED_CHARS);
}

function jsonToReadableText(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

function csvToReadableText(raw: string): string {
  const rows = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean)
    .slice(0, 200);

  return rows.join("\n");
}

export async function extractProjectSourceFile(file: File): Promise<SourceFileExtractionResult> {
  const filename = file.name;
  const extension = extensionFromName(filename);

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      filename,
      title: titleFromFilename(filename),
      body: "",
      sourceType: "other",
      tags: [],
      error: "Unsupported file type. Use .txt, .md, .markdown, .json, .csv, or .log for this pass.",
    };
  }

  if (file.size > MAX_SOURCE_FILE_BYTES) {
    return {
      ok: false,
      filename,
      title: titleFromFilename(filename),
      body: "",
      sourceType: "other",
      tags: [],
      error: "File is too large. Keep source files under 512 KB for this pass.",
    };
  }

  const rawText = await file.text();
  const readableText =
    extension === "json"
      ? jsonToReadableText(rawText)
      : extension === "csv"
        ? csvToReadableText(rawText)
        : rawText;

  const body = normalizeExtractedText(readableText);

  if (body.length < 20) {
    return {
      ok: false,
      filename,
      title: titleFromFilename(filename),
      body,
      sourceType: "other",
      tags: [],
      error: "The extracted text is too short to save as useful project context.",
    };
  }

  return {
    ok: true,
    filename,
    title: titleFromFilename(filename),
    body,
    sourceType: inferSourceType(filename, body),
    tags: inferTags(filename, body),
  };
}

export async function extractProjectSourceFiles(files: FileList | File[]): Promise<SourceFileExtractionResult[]> {
  const fileArray = Array.from(files).slice(0, 5);
  const results: SourceFileExtractionResult[] = [];

  for (const file of fileArray) {
    results.push(await extractProjectSourceFile(file));
  }

  return results;
}
