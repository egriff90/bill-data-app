import { Link } from 'react-router-dom';
import { Amendment } from '../../api/client';

interface AmendmentTableProps {
  amendments: Amendment[];
  loading?: boolean;
}

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

const DECISION_COLORS: Record<string, string> = {
  'Agreed': 'bg-green-100 text-green-800',
  'AgreedOnDivision': 'bg-green-100 text-green-800',
  'Disagreed': 'bg-red-100 text-red-800',
  'NegativedOnDivision': 'bg-red-100 text-red-800',
  'NoDecision': 'bg-blue-100 text-blue-800',
  'NotCalled': 'bg-gray-100 text-gray-600',
  'NotMoved': 'bg-yellow-100 text-yellow-800',
  'NotSelected': 'bg-gray-100 text-gray-600',
  'StoodPart': 'bg-green-100 text-green-800',
  'Withdrawn': 'bg-gray-100 text-gray-800',
  'WithdrawnBeforeDebate': 'bg-gray-100 text-gray-800',
};

function DecisionBadge({ decision }: { decision: string }) {
  return (
    <span className={`inline-block px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${DECISION_COLORS[decision] || 'bg-gray-100 text-gray-800'}`}>
      {DECISION_LABELS[decision] || decision}
    </span>
  );
}

export function AmendmentTable({ amendments, loading }: AmendmentTableProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (amendments.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No amendments found. Try adjusting your filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">dNum</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Bill</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Stage</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Decision</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Sponsors</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Summary</th>
          </tr>
        </thead>
        <tbody>
          {amendments.map(amendment => (
            <tr key={amendment.id} className="border-b hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-600">
                {amendment.dNum || '-'}
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900 max-w-xs truncate" title={amendment.bill.shortTitle}>
                  {amendment.bill.shortTitle}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="text-sm text-gray-600">{amendment.billStage.description}</div>
                <div className="text-xs text-gray-400">{amendment.billStage.house}</div>
              </td>
              <td className="px-4 py-3">
                <DecisionBadge decision={amendment.decision} />
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {amendment.sponsors.slice(0, 3).map((sponsor, i) => (
                    <Link
                      key={sponsor.id}
                      to={`/members/${sponsor.id}`}
                      className="text-sm text-gray-700 hover:underline"
                    >
                      {sponsor.displayName}
                      {i < Math.min(amendment.sponsors.length, 3) - 1 && ', '}
                    </Link>
                  ))}
                  {amendment.sponsors.length > 3 && (
                    <span className="text-sm text-gray-500">
                      +{amendment.sponsors.length - 3} more
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <div
                  className="text-sm text-gray-600 max-w-md truncate"
                  title={amendment.summaryText || ''}
                >
                  {amendment.summaryText || '-'}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
