import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { api } from '../../api/client';

const DECISION_COLORS: Record<string, string> = {
  'Agreed to': '#22c55e',
  'Negatived': '#ef4444',
  'Withdrawn': '#6b7280',
  'Not moved': '#f59e0b',
  'Not selected': '#94a3b8',
};

interface MemberDetail {
  id: number;
  name: string;
  displayName: string;
  party: string;
  partyColour: string | null;
  house: string;
  memberFrom: string;
  thumbnailUrl: string | null;
  stats: {
    totalAmendments: number;
    decisionBreakdown: Record<string, number>;
  };
  recentAmendments: Array<{
    id: number;
    decision: string;
    summaryText: string | null;
    bill: { id: number; shortTitle: string };
    stage: { id: number; description: string; house: string };
  }>;
}

export default function MemberPage() {
  const { id } = useParams<{ id: string }>();
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api.getMember(parseInt(id))
      .then(setMember)
      .catch(err => {
        console.error('Failed to load member:', err);
        setError('Failed to load member details');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error || 'Member not found'}</div>
        <Link to="/" className="text-gray-700 hover:underline">
          Back to Amendments
        </Link>
      </div>
    );
  }

  const decisionData = Object.entries(member.stats.decisionBreakdown).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="space-y-6">
      {/* Member header */}
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-start gap-6">
          {member.thumbnailUrl ? (
            <img
              src={member.thumbnailUrl}
              alt={member.displayName}
              className="w-24 h-24 rounded-full object-cover"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-3xl text-gray-500">
              ?
            </div>
          )}

          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">{member.displayName}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className="px-3 py-1 rounded-full text-white text-sm"
                style={{ backgroundColor: member.partyColour || '#6b7280' }}
              >
                {member.party}
              </span>
              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-sm">
                {member.house}
              </span>
              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-sm">
                {member.memberFrom}
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-3xl font-bold text-gray-700">
              {member.stats.totalAmendments}
            </div>
            <div className="text-sm text-gray-600">amendments sponsored</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Decision breakdown chart */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Decision Breakdown</h3>
          {decisionData.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={decisionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    {decisionData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={DECISION_COLORS[entry.name] || '#6b7280'}
                        opacity={activeIndex === null || activeIndex === index ? 1 : 0.3}
                        style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend
                    content={({ payload }) => (
                      <ul style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', padding: 0, margin: 0, listStyle: 'none' }}>
                        {payload?.map((entry, index) => (
                          <li
                            key={`legend-${index}`}
                            onMouseEnter={() => setActiveIndex(index)}
                            onMouseLeave={() => setActiveIndex(null)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              opacity: activeIndex === null || activeIndex === index ? 1 : 0.3,
                              transition: 'opacity 0.2s',
                              cursor: 'pointer', fontSize: 14,
                            }}
                          >
                            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', backgroundColor: entry.color }} />
                            {entry.value}
                          </li>
                        ))}
                      </ul>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No amendment data available
            </div>
          )}
        </div>

        {/* Decision table */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Decision Summary</h3>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">
                  Decision
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
              {decisionData.map(({ name, value }) => (
                <tr key={name} className="border-t">
                  <td className="px-4 py-2 text-sm">
                    <span
                      className="inline-block w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: DECISION_COLORS[name] || '#6b7280' }}
                    />
                    {name}
                  </td>
                  <td className="px-4 py-2 text-sm text-right">
                    {value.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-sm text-right">
                    {((value / member.stats.totalAmendments) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent amendments */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Amendments</h3>
        {member.recentAmendments.length > 0 ? (
          <div className="space-y-3">
            {member.recentAmendments.map(amendment => (
              <div
                key={amendment.id}
                className="p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-gray-900">
                      {amendment.bill.shortTitle}
                    </div>
                    <div className="text-sm text-gray-600">
                      {amendment.stage.description} - {amendment.stage.house}
                    </div>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded text-xs text-white"
                    style={{ backgroundColor: DECISION_COLORS[amendment.decision] || '#6b7280' }}
                  >
                    {amendment.decision}
                  </span>
                </div>
                {amendment.summaryText && (
                  <div className="mt-2 text-sm text-gray-600 line-clamp-2">
                    {amendment.summaryText}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No recent amendments
          </div>
        )}

        <div className="mt-4 text-center">
          <Link
            to={`/?memberId=${member.id}`}
            className="text-gray-700 hover:underline text-sm"
          >
            View all amendments by this member
          </Link>
        </div>
      </div>
    </div>
  );
}
