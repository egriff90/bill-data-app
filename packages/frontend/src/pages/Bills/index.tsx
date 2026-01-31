import { useState, useEffect } from 'react';
import { api, Bill } from '../../api/client';
import { SessionSelector } from '../../components/data/SessionSelector';

type BillStatus = 'all' | 'active' | 'acts' | 'withdrawn' | 'defeated';

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [status, setStatus] = useState<BillStatus>('active');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    const loadBills = async () => {
      setLoading(true);
      try {
        const result = await api.getBills({
          sessionId,
          status,
          skip: page * pageSize,
          take: pageSize,
        });
        setBills(result.items);
        setTotal(result.total);
      } catch (error) {
        console.error('Failed to load bills:', error);
      } finally {
        setLoading(false);
      }
    };
    loadBills();
  }, [sessionId, status, page]);

  useEffect(() => {
    setPage(0);
  }, [sessionId, status]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Bills and Acts</h2>
        <p className="text-gray-600 mt-1">
          Browse Bills and their amendment counts.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Session
            </label>
            <SessionSelector value={sessionId} onChange={setSessionId} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as BillStatus)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
            >
              <option value="all">All Bills</option>
              <option value="active">Active only</option>
              <option value="acts">Acts only</option>
              <option value="withdrawn">Withdrawn only</option>
              <option value="defeated">Defeated only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results header */}
      <div className="text-sm text-gray-600">
        {loading ? 'Loading...' : `Showing ${bills.length} of ${total.toLocaleString()} Bills`}
      </div>

      {/* Bills grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : bills.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No bills found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bills.map(bill => (
            <div
              key={bill.id}
              className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-gray-900 line-clamp-2" title={bill.shortTitle}>
                  {bill.shortTitle}
                </h3>
                <span
                  className={`ml-2 px-2 py-0.5 text-xs rounded-full whitespace-nowrap ${
                    bill.currentHouse === 'Commons'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {bill.currentHouse}
                </span>
              </div>

              <div className="text-sm text-gray-600 mb-3">
                Session: {bill.sessionName}
              </div>

              <div className="flex justify-between items-center pt-3 border-t">
                <div className="text-sm text-gray-500">
                  {bill.stageCount} stages
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-lg font-bold text-gray-900">
                    {bill.amendmentCount}
                  </span>
                  <span className="text-sm text-gray-500">amendments</span>
                </div>
              </div>

              {(bill.isWithdrawn || bill.isDefeated || bill.isAct || bill.isCarryOver) && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {bill.isCarryOver && (
                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                      Carry-over
                    </span>
                  )}
                  {bill.isAct && (
                    <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-800 rounded">
                      Act
                    </span>
                  )}
                  {bill.isWithdrawn && (
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-800 rounded">
                      Withdrawn
                    </span>
                  )}
                  {bill.isDefeated && (
                    <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded">
                      Defeated
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
