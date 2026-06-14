declare module "@paystack/inline-js" {
  interface NewTransactionOptions {
    key: string;
    email: string;
    amount: number;
    currency?: string;
    reference?: string;
    metadata?: Record<string, unknown>;
    onSuccess?: (transaction: { reference: string; status?: string; trans?: string }) => void;
    onLoad?: (response: unknown) => void;
    onCancel?: () => void;
    onError?: (error: { message?: string }) => void;
  }

  export default class PaystackPop {
    newTransaction(options: NewTransactionOptions): void;
  }
}
