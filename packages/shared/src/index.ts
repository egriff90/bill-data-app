// Shared types for the Bill Data App

// Parliament API response types
export interface ParliamentSession {
  id: number;
  name: string;
  startDate: string;
  endDate: string | null;
}

export interface ParliamentBill {
  billId: number;
  shortTitle: string;
  longTitle?: string;
  billTypeId: number;
  introducedSessionId: number;
  includedSessionIds: number[];
  currentHouse: string;
  originatingHouse: string;
  lastUpdate: string;
  billWithdrawn?: string | null;
  isDefeated: boolean;
  isAct: boolean;
  currentStage?: {
    id: number;
    stageId: number;
    sessionId: number;
    description: string;
    sortOrder: number;
    stageSittings?: Array<{
      billStageId: number;
      stageId: number;
    }>;
  };
}

export interface ParliamentBillStage {
  id: number;
  stageId: number;
  sessionId: number;
  description: string;
  sortOrder: number;
  house: string;
}

export interface ParliamentAmendment {
  amendmentId: number;
  amendmentType: string;
  lineNumber?: number;
  marshalledListText?: string;
  summaryText: string[];
  decision: string;
  decisionExplanation?: string;
  sponsors: ParliamentSponsor[];
}

export interface ParliamentSponsor {
  memberId: number;
  name: string;
  party: string;
  partyColour?: string;
  house: string;
  memberFrom: string;
  memberPhoto?: string;
  sortOrder: number;
}

export interface ParliamentMember {
  value: {
    id: number;
    nameListAs: string;
    nameDisplayAs: string;
    nameFullTitle: string;
    nameAddressAs: string;
    partyId: number;
    gender: string;
    thumbnailUrl: string;
    latestHouseMembership: {
      house: number;
      membershipFrom: string;
      membershipFromId: number;
      membershipStartDate: string;
    };
    latestParty: {
      id: number;
      name: string;
      abbreviation: string;
      backgroundColour: string;
      foregroundColour: string;
    };
  };
}

// API response wrappers
export interface PaginatedResponse<T> {
  items: T[];
  totalResults: number;
  itemsPerPage: number;
}

// Database entity types (matching Prisma schema)
export interface Session {
  id: number;
  name: string;
  startDate: Date;
  endDate: Date | null;
  isCurrent: boolean;
}

export interface Bill {
  id: number;
  shortTitle: string;
  longTitle: string | null;
  sessionId: number;
  introducedSessionId: number | null;
  originatingHouse: string;
  currentHouse: string;
  isWithdrawn: boolean;
  isDefeated: boolean;
  isAct: boolean;
  lastUpdate: Date;
}

export interface BillStage {
  id: number;
  billId: number;
  stageTypeId: number;
  description: string;
  house: string;
  sortOrder: number;
}

export interface Amendment {
  id: number;
  billStageId: number;
  amendmentNumber: string | null;
  amendmentType: string;
  decision: string;
  decisionExplanation: string | null;
  summaryText: string | null;
  marshalledListText: string | null;
}

export interface AmendmentSponsor {
  amendmentId: number;
  memberId: number;
  isLead: boolean;
  sortOrder: number;
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
}

// API query types
export interface AmendmentSearchParams {
  memberId?: number;
  billId?: number;
  sessionId?: number;
  decision?: string;
  skip?: number;
  take?: number;
}

export interface AmendmentStatsParams {
  groupBy: 'bill' | 'stage' | 'member' | 'decision';
  sessionId?: number;
  memberId?: number;
}

export interface MemberSearchParams {
  q: string;
  house?: 'Commons' | 'Lords';
  take?: number;
}

// API response types
export interface AmendmentWithDetails extends Amendment {
  bill: Pick<Bill, 'id' | 'shortTitle'>;
  billStage: Pick<BillStage, 'id' | 'description' | 'house'>;
  sponsors: Array<Member & { isLead: boolean; sortOrder: number }>;
}

export interface AmendmentStatResult {
  groupKey: string;
  groupLabel: string;
  count: number;
  subGroups?: AmendmentStatResult[];
}

export interface SyncStatus {
  lastFullSync: Date | null;
  lastIncrementalSync: Date | null;
  isRunning: boolean;
  currentTask?: string;
  progress?: {
    current: number;
    total: number;
  };
}
