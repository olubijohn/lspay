import PaystackPop from "@paystack/inline-js";

export const PAYSTACK_PUBLIC_KEY =
  (import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined) ?? "";

export const isPaystackConfigured = (key?: string) => {
  const finalKey = key || PAYSTACK_PUBLIC_KEY;
  return finalKey.trim().length > 0 && !finalKey.includes("xxx");
};

interface LaunchOptions {
  paystackPublicKey?: string;
  email: string;
  amountMajor: number;
  reference?: string;
  metadata?: Record<string, unknown>;
  onSuccess: (reference: string) => void;
  onCancel?: () => void;
  onError?: (message: string) => void;
}

export function launchPaystack({
  paystackPublicKey,
  email,
  amountMajor,
  reference,
  metadata,
  onSuccess,
  onCancel,
  onError,
}: LaunchOptions) {
  const finalKey = paystackPublicKey || PAYSTACK_PUBLIC_KEY;
  if (!isPaystackConfigured(finalKey)) {
    onError?.("Payment gateway is not configured for this school. Please contact school administrator.");
    return;
  }

  try {
    const popup = new PaystackPop();
    popup.newTransaction({
      key: finalKey,
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
