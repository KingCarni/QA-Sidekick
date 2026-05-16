"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import AppHeaderMenu from "@/components/AppHeaderMenu";
import AuthStatus from "@/components/AuthStatus";
import AutomationExportPanel from "@/components/AutomationExportPanel";
import BugEvidencePanel, {
  EMPTY_BUG_EVIDENCE,
  appendBugEvidenceToMarkdown,
  type BugEvidenceState,
} from "@/components/BugEvidencePanel";
import BugEvidencePreview from "@/components/BugEvidencePreview";
import CoverageScorePanel from "@/components/CoverageScorePanel";
import FeatureBuilderTool from "@/components/FeatureBuilderTool";
import QAtGuideCard from "@/components/QAtGuideCard";
import JiraCreateIssueButton from "@/components/JiraCreateIssueButton";
import RiskReviewPanel from "@/components/RiskReviewPanel";
import SaveBugToCollectionButton from "@/components/SaveBugToCollectionButton";
import SaveGeneratedOutputToSourceButton from "@/components/SaveGeneratedOutputToSourceButton";
import StackedProjectJiraControls from "@/components/StackedProjectJiraControls";
import HeaderProjectSourceControls from "@/components/HeaderProjectSourceControls";
import { publishCreditBalanceUpdated } from "@/lib/credit-balance-events";
import type { ActiveProjectContext } from "@/components/ProjectContextIndicator";
import type { SafeQAProject } from "@/components/ProjectSettingsPanel";
import TestCaseAutomationReadiness from "@/components/TestCaseAutomationReadiness";
import TestCaseCostConfirmModal from "@/components/TestCaseCostConfirmModal";
import TestCaseDisplayControls from "@/components/TestCaseDisplayControls";
import TestCaseQualityBadge from "@/components/TestCaseQualityBadge";
import TestRailSyncPanel from "@/components/TestRailSyncPanel";
import ToolToolbar, { type QatalystToolOption } from "@/components/ToolToolbar";
import { calculateTestCaseQuality, getTestCaseQualityCardClass } from "@/lib/test-case-quality";
import {
  buildProjectContextPayload,
  type ProjectContextPayload,
} from "@/lib/project-context-injection";

export default function BrokenRestoreGuard() {
  return null;
}
