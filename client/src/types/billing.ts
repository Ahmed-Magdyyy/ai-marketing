export interface Invoice {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'void' | 'uncollectible';
  invoicePdf?: string;
  createdAt: string;
  paidAt?: string;
}

export interface PaymentMethod {
  id: string;
  type: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}
