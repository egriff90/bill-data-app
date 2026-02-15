import { useState, useEffect, useCallback } from 'react';
import { api, StageWithDate, Session } from '../../api/client';
import { SessionSelector } from '../../components/data/SessionSelector';

export default function StagesOverTimePage() {
  const [stages, setStages] = useState<StageWithDate[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalAmendments, setTotalAmendments] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Filters
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [house, setHouse] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [allSessions, setAllSessions] = useState(false);

  // Auto-select current session on mount
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  useEffect(() => {
    api.getSessions().then((sessions: Session[]) => {
      const current = sessions.find(s => s.isCurrent);
      if (current) {
        setSessionId(current.id);
      }
      setSessionsLoaded(true);
    }).catch(console.error);
  }, []);

  // Load stages
  const loadStages = useCallback(async () => {
    if (!allSessions && !sessionId) return;
    setLoading(true);
    try {
      const result = await api.getStagesWithAmendments({
        sessionId: allSessions ? undefined : sessionId,
        house: house || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        skip: page * pageSize,
        take: pageSize,
      });
      setStages(result.items);
      setTotal(result.total);
      setTotalAmendments(result.totalAmendments);
    } catch (error) {
      console.error('Failed to load stages:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId, house, fromDate, toDate, page, allSessions]);

  useEffect(() => {
    if (sessionsLoaded) {
      loadStages();
    }
  }, [loadStages, sessionsLoaded]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [sessionId, house, fromDate, toDate, allSessions]);

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Export to CSV
  const exportToCSV = async () => {
    if (!allSessions && !sessionId) return;
    try {
      const allResults = await api.getStagesWithAmendments({
        sessionId: allSessions ? undefined : sessionId,
        house: house || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        take: 100000,
      });

      const headers = ['Bill', 'Stage', 'House', 'Date', 'Amendment Count'];
      const rows = allResults.items.map(s => [
        s.billTitle,
        s.stageDescription,
        s.house,
        s.sittingDate ? new Date(s.sittingDate).toISOString().slice(0, 10) : '',
        s.amendmentCount.toString(),
      ]);

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `stages-over-time-${new Date().toISOString().slice(0, 10)}.csv`;
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
        <h2 className="text-2xl font-bold text-gray-900">Stages over time</h2>
        <p className="text-gray-600 mt-1">
          Calendar dates of amending stages (stages with 1+ amendments), showing when parliamentary activity occurs.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Session
            </label>
            <SessionSelector value={sessionId} onChange={setSessionId} showAll={false} disabled={allSessions} />
            <label className="flex items-center gap-2 mt-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={allSessions}
                onChange={e => setAllSessions(e.target.checked)}
                className="rounded border-gray-300"
              />
              All available sessions
            </label>
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
              From date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
            />
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
              {total === 0
                ? 'No amending stage sittings'
                : (<>
                    {`Showing ${(page * pageSize + 1).toLocaleString()}–${(page * pageSize + stages.length).toLocaleString()} of ${total.toLocaleString()} amending stage sittings`}
                    {` · Total amendments across matched stages: ${totalAmendments.toLocaleString()}`}
                    <br />
                    The count of amendments shown in the table is for the stage as a whole, not per sitting.
                  </>)
              }
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
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Bill
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stage
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                House
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sitting Date
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amendments
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : stages.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No amending stages found for this session.
                </td>
              </tr>
            ) : (
              stages.map((stage, index) => (
                <tr key={`${stage.billStageId}-${stage.sittingDate}-${index}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {stage.billTitle}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {stage.stageDescription}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {stage.house}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(stage.sittingDate)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                    {stage.amendmentCount.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
          <span className="px-4 py-2 text-sm text-gray-600 flex items-center gap-1">
            Page
            <input
              type="number"
              min={1}
              max={totalPages}
              value={page + 1}
              onChange={e => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val >= 1 && val <= totalPages) {
                  setPage(val - 1);
                }
              }}
              className="w-14 px-2 py-1 border border-gray-300 rounded text-center text-sm"
            />
            of {totalPages}
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
