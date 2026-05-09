// src/components/credits/CreditCostBadge.tsx
import { formatCreditCost, getCreditAction, type CreditActionId } from "@/lib/credits-config";

type CreditCostBadgeProps = {
  action: CreditActionId;
  className?: string;
  label?: string;
};

export default function CreditCostBadge({ action, className = "", label }: CreditCostBadgeProps) {
  const actionInfo = getCreditAction(action);

  return (
    <span
      className={`credit-cost-badge ${className}`.trim()}
      title={`${actionInfo.label}: ${formatCreditCost(action)}`}
    >
      {label ?? formatCreditCost(action)}
    </span>
  );
}
