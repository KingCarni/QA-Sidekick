// src/components/credits/CreditActionButton.tsx
import { formatCreditCost, getCreditAction, type CreditActionId } from "@/lib/credits-config";

type CreditActionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  action: CreditActionId;
  children?: React.ReactNode;
};

export default function CreditActionButton({ action, children, className = "", ...props }: CreditActionButtonProps) {
  const actionInfo = getCreditAction(action);

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      title={`${actionInfo.label} costs ${formatCreditCost(action)}`}
    >
      <span>{children ?? actionInfo.label}</span>
      <span className="credit-button-cost">
        {formatCreditCost(action)}
      </span>
    </button>
  );
}
