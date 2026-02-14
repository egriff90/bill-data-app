const API_BASE = '/api/v1';

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// Types
export interface Session {
  id: number;
  name: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  billCount: number;
}

export interface Bill {
  id: number;
  shortTitle: string;
  longTitle: string | null;
  sessionId: number;
  sessionName: string;
  introducedSessionId: number | null;
  isCarryOver: boolean;
  originatingHouse: string;
  currentHouse: string;
  isWithdrawn: boolean;
  isDefeated: boolean;
  isAct: boolean;
  lastUpdate: string;
  stageCount: number;
  amendmentCount: number;
}

export interface Member {
  id: number;
  name: string;
  displayName: string;
  party: string;
  partyColour: string | null;
  house: string;
  memberFrom: string;
  thumbnailUrl: string | null;
  isLead?: boolean;
  sortOrder?: number;
}

export interface Amendment {
  id: number;
  amendmentNumber: string | null;
  dNum: string | null;
  amendmentType: string;
  decision: string;
  decisionExplanation: string | null;
  summaryText: string | null;
  bill: { id: number; shortTitle: string };
  billStage: { id: number; description: string; house: string };
  sponsors: Member[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  take: number;
}

export interface StatResult {
  groupKey: string;
  groupLabel: string;
  count: number;
  subGroups?: StatResult[];
  metadata?: Record<string, string>;
}

export interface SyncStatus {
  lastFullSync: string | null;
  lastIncrementalSync: string | null;
  isRunning: boolean;
  currentTask: string | null;
  stats: {
    bills: number;
    amendments: number;
    members: number;
  };
}

// API functions
export const api = {
  // Sessions
  getSessions: () => fetchApi<Session[]>('/sessions'),

  // Bills
  getBills: (params?: {
    sessionId?: number;
    status?: 'all' | 'active' | 'acts' | 'withdrawn' | 'defeated';
    skip?: number;
    take?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.sessionId) query.set('sessionId', params.sessionId.toString());
    if (params?.status) query.set('status', params.status);
    if (params?.skip) query.set('skip', params.skip.toString());
    if (params?.take) query.set('take', params.take.toString());
    return fetchApi<PaginatedResponse<Bill>>(`/bills?${query}`);
  },

  getBill: (id: number) => fetchApi<Bill & { stages: any[] }>(`/bills/${id}`),

  // Amendments
  getAmendments: (params?: {
    memberId?: number;
    billId?: number;
    sessionId?: number;
    decision?: string;
    stage?: string;
    house?: string;
    skip?: number;
    take?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.memberId) query.set('memberId', params.memberId.toString());
    if (params?.billId) query.set('billId', params.billId.toString());
    if (params?.sessionId) query.set('sessionId', params.sessionId.toString());
    if (params?.decision) query.set('decision', params.decision);
    if (params?.stage) query.set('stage', params.stage);
    if (params?.house) query.set('house', params.house);
    if (params?.skip) query.set('skip', params.skip.toString());
    if (params?.take) query.set('take', params.take.toString());
    return fetchApi<PaginatedResponse<Amendment>>(`/amendments?${query}`);
  },

  getAmendmentStats: (params?: {
    groupBy: 'bill' | 'stage' | 'member' | 'decision';
    sessionId?: number;
    memberId?: number;
    house?: string;
  }) => {
    const query = new URLSearchParams();
    query.set('groupBy', params?.groupBy || 'bill');
    if (params?.sessionId) query.set('sessionId', params.sessionId.toString());
    if (params?.memberId) query.set('memberId', params.memberId.toString());
    if (params?.house) query.set('house', params.house);
    return fetchApi<StatResult[]>(`/amendments/stats?${query}`);
  },

  // Members
  searchMembers: (q: string, house?: string) => {
    const query = new URLSearchParams({ q });
    if (house) query.set('house', house);
    return fetchApi<Member[]>(`/members/search?${query}`);
  },

  getMember: (id: number) => fetchApi<Member & { stats: any; recentAmendments: any[] }>(`/members/${id}`),

  // Sync
  getSyncStatus: () => fetchApi<SyncStatus>('/sync/status'),
};
