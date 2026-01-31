import { useState, useEffect, useCallback } from 'react';
import { api, Amendment, Member, Bill, StatResult } from '../../api/client';
import { MemberAutocomplete } from '../../components/data/MemberAutocomplete';
import { SessionSelector } from '../../components/data/SessionSelector';
import { AmendmentTable } from '../../components/data/AmendmentTable';

// Decision labels for display
const DECISION_LABELS: Record<string, string> = {
  'Agreed': 'Agreed',
  'AgreedOnDivision': 'Agreed (Division)',
  'Disagreed': 'Disagreed',
  'NegativedOnDivision': 'Negatived (Division)',
  'NoDecision': 'No Decision',
  'NotCalled': 'Not Called',
  'NotMoved': 'Not Moved',
  'NotSelected': 'Not Selected',
  'StoodPart': 'Stood Part',
  'Withdrawn': 'Withdrawn',
  'WithdrawnBeforeDebate': 'Withdrawn Before Debate',
};

export default function AmendmentsPage() {
  const [amendments, setAmendments] = useState<Amendment[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Filters
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [billId, setBillId] = useState<number | undefined>();
  const [decision, setDecision] = useState<string>('');
  const [stage, setStage] = useState<string>('');
  const [house, setHouse] = useState<string>('');

  // Filter options
  const [decisions, setDecisions] = useState<StatResult[]>([]);
  const [stages, setStages] = useState<StatResult[]>([]);

  // Bill selector
  const [bills, setBills] = useState<Bill[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);

  // Load filter options on mount
  useEffect(() => {
    api.getAmendmentStats({ groupBy: 'decision' })
      .then(setDecisions)
      .catch(console.error);
    api.getAmendmentStats({ groupBy: 'stage' })
      .then(setStages)
      .catch(console.error);
  }, []);

  // Load bills when session changes
  useEffect(() => {
    // Clear bill selection when session changes
    setBillId(undefined);

    if (!sessionId) {
      setBills([]);
      return;
    }
    setLoadingBills(true);
    api.getBills({ sessionId, take: 500 })
      .then(res => setBills(res.items))
      .catch(console.error)
      .finally(() => setLoadingBills(false));
  }, [sessionId]);

  // Reset all filters
  const resetFilters = () => {
    setSelectedMember(null);
    setSessionId(undefined);
    setBillId(undefined);
    setDecision('');
    setStage('');
    setHouse('');
    setPage(0);
  };

  // Check if any filters are active
  const hasActiveFilters = selectedMember || sessionId || billId || decision || stage || house;

  // Load amendments
  const loadAmendments = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getAmendments({
        memberId: selectedMember?.id,
        sessionId,
        billId,
        decision: decision || undefined,
        stage: stage || undefined,
        house: house || undefined,
        skip: page * pageSize,
        take: pageSize,
      });
      setAmendments(result.items);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to load amendments:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedMember, sessionId, billId, decision, stage, house, page]);

  useEffect(() => {
    loadAmendments();
  }, [loadAmendments]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [selectedMember, sessionId, billId, decision, stage, house]);

  // Export to CSV
  const exportToCSV = async () => {
    try {
      const allResults = await api.getAmendments({
        memberId: selectedMember?.id,
        sessionId,
        billId,
        decision: decision || undefined,
        stage: stage || undefined,
        take: 10000,
      });

      const headers = ['Bill', 'Stage', 'House', 'Decision', 'Sponsors', 'Summary'];
      const rows = allResults.items.map(a => [
        a.bill.shortTitle,
        a.billStage.description,
        a.billStage.house,
        a.decision,
        a.sponsors.map(s => s.displayName).join('; '),
        a.summaryText || '',
      ]);

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `amendments-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Amendment Search</h2>
        <p className="text-gray-600 mt-1">
          Search and filter amendments by member, session, bill, or decision status.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Member (Sponsor)
            </label>
            <MemberAutocomplete
              selectedMember={selectedMember}
              onSelect={setSelectedMember}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Session
            </label>
            <SessionSelector value={sessionId} onChange={setSessionId} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bill
            </label>
            <select
              value={billId || ''}
              onChange={e => setBillId(e.target.value ? parseInt(e.target.value) : undefined)}
              disabled={!sessionId || loadingBills}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="">
                {!sessionId ? 'Select a session first' : loadingBills ? 'Loading bills...' : 'All Bills'}
              </option>
              {bills.map(bill => (
                <option key={bill.id} value={bill.id}>
                  {bill.shortTitle}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              House
            </label>
            <select
              value={house}
              onChange={e => setHouse(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
            >
              <option value="">Both Houses</option>
              <option value="Commons">Commons</option>
              <option value="Lords">Lords</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stage
            </label>
            <select
              value={stage}
              onChange={e => setStage(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
            >
              <option value="">All Stages</option>
              {stages.map(s => (
                <option key={s.groupKey} value={s.groupKey}>
                  {s.groupLabel} ({s.count.toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Decision
            </label>
            <select
              value={decision}
              onChange={e => setDecision(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
            >
              <option value="">All Decisions</option>
              {decisions.map(d => (
                <option key={d.groupKey} value={d.groupKey}>
                  {DECISION_LABELS[d.groupKey] || d.groupKey} ({d.count.toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Results header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {loading ? (
            'Loading...'
          ) : (
            <>
              Showing {amendments.length} of {total.toLocaleString()} amendments
            </>
          )}
        </div>
        <button
          onClick={exportToCSV}
          disabled={loading || total === 0}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Export CSV
        </button>
      </div>

      {/* Results table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <AmendmentTable amendments={amendments} loading={loading} />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-gray-600">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
