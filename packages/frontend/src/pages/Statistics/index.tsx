import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api, StatResult, Member } from '../../api/client';
import { SessionSelector } from '../../components/data/SessionSelector';
import { MemberAutocomplete } from '../../components/data/MemberAutocomplete';

export default function StatisticsPage() {
  const [groupBy, setGroupBy] = useState<'bill' | 'decision' | 'member' | 'stage'>('bill');
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [house, setHouse] = useState<string>('');
  const [stats, setStats] = useState<StatResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const result = await api.getAmendmentStats({
          groupBy,
          sessionId,
          memberId: selectedMember?.id,
          house: house || undefined,
        });
        setStats(result);
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [groupBy, sessionId, selectedMember, house]);

  const totalCount = stats.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Amendment Statistics</h2>
        <p className="text-gray-600 mt-1">
          Visualize amendment data grouped by bill, decision, stage, or member.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Group By
            </label>
            <select
              value={groupBy}
              onChange={e => setGroupBy(e.target.value as typeof groupBy)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
            >
              <option value="bill">Bill</option>
              <option value="decision">Decision</option>
              <option value="stage">Stage Type</option>
              <option value="member">Member</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Session
            </label>
            <SessionSelector value={sessionId} onChange={setSessionId} />
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
              Filter by Member
            </label>
            <MemberAutocomplete
              selectedMember={selectedMember}
              onSelect={setSelectedMember}
              placeholder="Optional: filter by sponsor..."
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="text-sm text-gray-700">
          Total: <span className="font-bold text-lg">{totalCount.toLocaleString()}</span> amendments
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Amendments by {groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}
            </h3>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.slice(0, 15)}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis
                    dataKey="groupLabel"
                    type="category"
                    width={150}
                    tick={{ fontSize: 12 }}
                    tickFormatter={label =>
                      label.length > 25 ? label.slice(0, 25) + '...' : label
                    }
                  />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    fill="#111827"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table view */}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Detailed Breakdown
            </h3>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">
                      {groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}
                    </th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">
                      Count
                    </th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">
                      Percentage
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((stat, index) => (
                    <tr key={stat.groupKey} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {stat.groupLabel}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600 text-right">
                        {stat.count.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600 text-right">
                        {((stat.count / totalCount) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
