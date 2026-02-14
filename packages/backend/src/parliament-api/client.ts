import PQueue from 'p-queue';
import type {
  ParliamentBill,
  ParliamentBillStage,
  ParliamentAmendment,
  ParliamentMember,
  ParliamentSession,
  PaginatedResponse,
} from '@bill-data-app/shared';

const BILLS_API_BASE = 'https://bills-api.parliament.uk/api/v1';
const MEMBERS_API_BASE = 'https://members-api.parliament.uk/api';

// Rate limiting: 5 requests per second
const queue = new PQueue({
  intervalCap: 5,
  interval: 1000,
  carryoverConcurrencyCount: true,
});

// Exponential backoff configuration
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry<T>(url: string, retries = 0): Promise<T> {
  try {
    const response = await fetch(url);

    if (response.status === 429) {
      if (retries >= MAX_RETRIES) {
        throw new Error(`Rate limited after ${MAX_RETRIES} retries: ${url}`);
      }
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, retries);
      console.log(`Rate limited, backing off for ${backoffMs}ms (retry ${retries + 1}/${MAX_RETRIES})`);
      await sleep(backoffMs);
      return fetchWithRetry<T>(url, retries + 1);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText} for ${url}`);
    }

    return await response.json() as T;
  } catch (error) {
    if (retries >= MAX_RETRIES) {
      throw error;
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      // Network error, retry with backoff
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, retries);
      console.log(`Network error, backing off for ${backoffMs}ms (retry ${retries + 1}/${MAX_RETRIES})`);
      await sleep(backoffMs);
      return fetchWithRetry<T>(url, retries + 1);
    }
    throw error;
  }
}

function queuedFetch<T>(url: string): Promise<T> {
  return queue.add(() => fetchWithRetry<T>(url), { throwOnTimeout: true }) as Promise<T>;
}

export class ParliamentApiClient {
  // Get all sessions
  async getSessions(): Promise<ParliamentSession[]> {
    // The Bills API doesn't have a dedicated sessions endpoint,
    // so we'll use known session IDs based on actual API data
    // Session 39 is the CURRENT session (59th Parliament, post-July 2024 election)
    // Sessions 40 and 41 don't exist yet in the API
    const sessions: ParliamentSession[] = [
      { id: 39, name: '2024-25', startDate: '2024-07-17', endDate: null },
      { id: 38, name: '2023-24', startDate: '2023-11-07', endDate: '2024-05-30' },
      { id: 37, name: '2022-23', startDate: '2022-05-10', endDate: '2023-10-26' },
    ];
    return sessions;
  }

  // Get bills for a session
  async getBillsForSession(sessionId: number, take = 400): Promise<ParliamentBill[]> {
    const url = `${BILLS_API_BASE}/Bills?Session=${sessionId}&Take=${take}`;
    const response = await queuedFetch<PaginatedResponse<ParliamentBill>>(url);
    return response.items;
  }

  // Get all stages for a bill
  async getBillStages(billId: number): Promise<ParliamentBillStage[]> {
    const url = `${BILLS_API_BASE}/Bills/${billId}/Stages`;
    const response = await queuedFetch<PaginatedResponse<ParliamentBillStage>>(url);
    return response.items;
  }

  // Get amendments for a specific bill stage
  async getAmendments(billId: number, stageId: number, take = 1000): Promise<ParliamentAmendment[]> {
    const url = `${BILLS_API_BASE}/Bills/${billId}/Stages/${stageId}/Amendments?Take=${take}`;
    const response = await queuedFetch<PaginatedResponse<ParliamentAmendment>>(url);
    return response.items;
  }

  // Get member details by ID
  async getMember(memberId: number): Promise<ParliamentMember | null> {
    try {
      const url = `${MEMBERS_API_BASE}/Members/${memberId}`;
      const response = await queuedFetch<ParliamentMember>(url);
      return response;
    } catch (error) {
      console.warn(`Failed to fetch member ${memberId}:`, error);
      return null;
    }
  }

  // Search members by name
  async searchMembers(query: string, take = 20): Promise<ParliamentMember[]> {
    const url = `${MEMBERS_API_BASE}/Members/Search?Name=${encodeURIComponent(query)}&Take=${take}`;
    const response = await queuedFetch<{ items: ParliamentMember[] }>(url);
    return response.items;
  }

  // Get queue statistics (for monitoring)
  getQueueStats() {
    return {
      size: queue.size,
      pending: queue.pending,
    };
  }

  // Wait for all pending requests to complete
  async drain(): Promise<void> {
    await queue.onIdle();
  }
}

// Singleton instance
export const parliamentApi = new ParliamentApiClient();
