"use client";

import { useRef, useState } from "react";
import { extractProjectSourceFiles, type SourceFileExtractionResult } from "@/lib/source-file-extract";

type ProjectSourceFileUploaderProps = {
  onUseExtractedSource: (result: SourceFileExtractionResult) => void;
  onUseAllExtractedSources?: (results: SourceFileExtractionResult[]) => void;
};

export default function ProjectSourceFileUploader({
  onUseExtractedSource,
  onUseAllExtractedSources,
}: ProjectSourceFileUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [results, setResults] = useState<SourceFileExtractionResult[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  async function handleFiles(files: FileList | File[]) {
    setIsReading(true);

    try {
      const extracted = await extractProjectSourceFiles(files);
      setResults(extracted);
    } finally {
      setIsReading(false);
      setDragActive(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer.files.length > 0) {
      void handleFiles(event.dataTransfer.files);
    }
  }

  const successfulResults = results.filter((result) => result.ok);

  return (
    <section className="project-source-file-uploader">
      <div
        className={dragActive ? "source-file-dropzone source-file-dropzone-active" : "source-file-dropzone"}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragActive(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <div>
          <p className="report-kicker">Upload Source Files</p>
          <h3>Import text context</h3>
          <p>
            Drop or choose source files. This pass supports .txt, .md, .json, .csv, and .log.
          </p>
          <small>Up to 5 files at once. 512 KB max each. Text is extracted locally in the browser.</small>
        </div>

        <button type="button" onClick={() => inputRef.current?.click()} disabled={isReading}>
          {isReading ? "Reading..." : "Choose Files"}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".txt,.md,.markdown,.json,.csv,.log,text/plain,text/markdown,application/json,text/csv"
          multiple
          onChange={(event) => {
            if (event.target.files?.length) {
              void handleFiles(event.target.files);
            }
          }}
        />
      </div>

      {results.length > 0 ? (
        <div className="source-file-results">
          <div className="source-file-results-header">
            <div>
              <p className="report-kicker">Extracted Files</p>
              <strong>
                {successfulResults.length} usable of {results.length}
              </strong>
            </div>

            {successfulResults.length > 1 && onUseAllExtractedSources ? (
              <button type="button" onClick={() => onUseAllExtractedSources(successfulResults)}>
                Save All Usable
              </button>
            ) : null}
          </div>

          <div className="source-file-result-list">
            {results.map((result) => (
              <article
                className={result.ok ? "source-file-result-card" : "source-file-result-card source-file-result-card-error"}
                key={`${result.filename}-${result.title}`}
              >
                <div>
                  <strong>{result.title}</strong>
                  <span>{result.filename}</span>
                  {result.ok ? (
                    <small>
                      {result.sourceType} · {result.body.length.toLocaleString()} chars
                      {result.tags.length ? ` · ${result.tags.join(", ")}` : ""}
                    </small>
                  ) : (
                    <small>{result.error}</small>
                  )}
                </div>

                {result.ok ? (
                  <button type="button" onClick={() => onUseExtractedSource(result)}>
                    Use Source
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
