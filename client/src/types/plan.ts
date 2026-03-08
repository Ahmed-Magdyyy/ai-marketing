export interface Plan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  maxBrands: number;
  maxSocialProfiles: number;
  aiUsageLimit: number;
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  plan: Plan;
}
