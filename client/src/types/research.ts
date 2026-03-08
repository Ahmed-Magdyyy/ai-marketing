export interface ResearchTopic {
  id: string;
  brandId: string;
  query: string;
  status: 'pending' | 'completed' | 'failed';
  results?: ResearchResult[];
  createdAt: string;
}

export interface ResearchResult {
  id: string;
  title: string;
  summary: string;
  sourceUrl: string;
  relevanceScore: number;
  keyInsights: string[];
}
