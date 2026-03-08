export interface Brand {
  id: string;
  name: string;
  industry: string;
  targetAudience: string;
  brandVoice: string;
  logoUrl?: string;
  websiteUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrandCreateInput {
  name: string;
  industry: string;
  targetAudience: string;
  brandVoice: string;
  websiteUrl?: string;
}
