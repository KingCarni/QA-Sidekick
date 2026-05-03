"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DeleteReportButtonProps = {
  reportId: string;
  redirectTo?: string;
};

export default function DeleteReportButton({ reportId, redirectTo }: DeleteReportButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    const confirmed = window.confirm("Delete this saved report? This cannot be undone.");
    if (!confirmed) return;

    setIsDeleting(true);
    setError("");

    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: "DELETE",
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Could not delete report.");
      }

      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
        return;
      }

      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete report.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <span className="delete-report-control">
      <button className="delete-report-button" disabled={isDeleting} onClick={handleDelete} type="button">
        {isDeleting ? "Deleting..." : "Delete"}
      </button>
      {error ? <small className="save-report-status-card save-report-status-card-error">{error}</small> : null}
    </span>
  );
}
