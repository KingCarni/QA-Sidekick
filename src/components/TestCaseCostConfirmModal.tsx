"use client";

type Props = {
  open: boolean;
  testCaseCount: number;
  cost: number;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function TestCaseCostConfirmModal({
  open,
  testCaseCount,
  cost,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="metered-cost-modal-backdrop" role="dialog" aria-modal="true">
      <div className="metered-cost-modal">
        <p className="report-kicker">Confirm credit usage</p>
        <h2>This run may create {testCaseCount} test cases.</h2>
        <p>
          Test Cases are priced at <strong>5 credits per 10 test cases</strong>.
        </p>
        <ul>
          <li>1-10 cases: 5 credits</li>
          <li>11-20 cases: 10 credits</li>
          <li>21-30 cases: 15 credits</li>
        </ul>
        <p className="metered-cost-total">
          Estimated cost: <strong>{cost} credits</strong>
        </p>
        <div className="metered-cost-modal-actions">
          <button type="button" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={loading}>
            {loading ? "Running..." : `Continue - ${cost} credits`}
          </button>
        </div>
      </div>
    </div>
  );
}
