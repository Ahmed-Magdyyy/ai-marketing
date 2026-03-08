export interface SocialProfile {
  id: string;
  brandId: string;
  platform: 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'tiktok';
  handle: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  status: 'active' | 'disconnected' | 'error';
  createdAt: string;
}

export interface SocialPost {
  id: string;
  profileId: string;
  content: string;
  mediaUrls?: string[];
  scheduledFor?: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  publishedAt?: string;
  metrics?: {
    likes: number;
    shares: number;
    comments: number;
    impressions: number;
  };
}
