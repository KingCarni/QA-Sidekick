"use client";

type TestCaseDisplayPagerProps = {
  totalCount: number;
  pageIndex: number;
  pageSize?: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onFirstPage: () => void;
  onLastPage: () => void;
};

export default function TestCaseDisplayControls({
  totalCount,
  pageIndex,
  pageSize = 10,
  onPreviousPage,
  onNextPage,
  onFirstPage,
  onLastPage,
}: TestCaseDisplayPagerProps) {
  if (totalCount <= pageSize) {
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePageIndex = Math.min(Math.max(pageIndex, 0), totalPages - 1);
  const firstVisible = safePageIndex * pageSize + 1;
  const lastVisible = Math.min(totalCount, (safePageIndex + 1) * pageSize);
  const hasPrevious = safePageIndex > 0;
  const hasNext = safePageIndex < totalPages - 1;

  return (
    <section className="test-case-display-controls test-case-display-pager">
      <div>
        <p className="report-kicker">Test Case Display</p>
        <strong>
          Showing {firstVisible}-{lastVisible} of {totalCount} test cases
        </strong>
        <span>
          Page {safePageIndex + 1} of {totalPages}. Exports, save, copy, and automation bundle still use the full generated suite.
        </span>
      </div>

      <div className="test-case-display-actions test-case-pager-actions">
        <button type="button" disabled={!hasPrevious} onClick={onFirstPage}>
          First
        </button>
        <button type="button" disabled={!hasPrevious} onClick={onPreviousPage}>
          Previous {pageSize}
        </button>
        <button type="button" disabled={!hasNext} onClick={onNextPage}>
          Next {Math.min(pageSize, totalCount - lastVisible)}
        </button>
        <button type="button" disabled={!hasNext} onClick={onLastPage}>
          Last
        </button>
      </div>
    </section>
  );
}
