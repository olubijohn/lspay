import PaystackPop from "@paystack/inline-js";

export const PAYSTACK_PUBLIC_KEY =
  (import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined) ?? "";

export const isPaystackConfigured = () => PAYSTACK_PUBLIC_KEY.trim().length > 0;

interface LaunchOptions {
  email: string;
  amountMajor: number;
  reference?: string;
  metadata?: Record<string, unknown>;
  onSuccess: (reference: string) => void;
  onCancel?: () => void;
  onError?: (message: string) => void;
}

export function launchPaystack({
  email,
  amountMajor,
  reference,
  metadata,
  onSuccess,
  onCancel,
  onError,
}: LaunchOptions) {
  if (!isPaystackConfigured()) {
    onError?.("Payment gateway is not configured. Add VITE_PAYSTACK_PUBLIC_KEY to enable top-ups.");
    return;
  }

  try {
    const popup = new PaystackPop();
    popup.newTransaction({
      key: PAYSTACK_PUBLIC_KEY,
      email,
      amount: Math.round(amountMajor * 100),
      reference: reference ?? `LSPAY-${Date.now()}`,
      metadata,
      onSuccess: (transaction: { reference: string }) => {
        onSuccess(transaction.reference);
      },
      onCancel: () => {
        onCancel?.();
      },
      onError: (error: { message?: string }) => {
        onError?.(error?.message ?? "Payment could not be completed. Please try again.");
      },
    });
  } catch (e: any) {
    onError?.(e?.message ?? "Unable to start the payment gateway.");
  }
}
