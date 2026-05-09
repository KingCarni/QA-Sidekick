"use client";

export const CREDIT_BALANCE_UPDATED_EVENT = "qatalyst:credit-balance-updated";

export type CreditBalanceUpdatedDetail = {
  balance: number;
};

export function publishCreditBalanceUpdated(balance: number) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<CreditBalanceUpdatedDetail>(CREDIT_BALANCE_UPDATED_EVENT, {
      detail: { balance },
    })
  );
}

export function subscribeToCreditBalanceUpdated(callback: (balance: number) => void) {
  if (typeof window === "undefined") return () => {};

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<CreditBalanceUpdatedDetail>;
    const balance = customEvent.detail?.balance;

    if (typeof balance === "number" && Number.isFinite(balance)) {
      callback(balance);
    }
  };

  window.addEventListener(CREDIT_BALANCE_UPDATED_EVENT, handler);
  return () => window.removeEventListener(CREDIT_BALANCE_UPDATED_EVENT, handler);
}
