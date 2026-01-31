import { useState, useEffect } from 'react';
import { api, Session } from '../../api/client';

interface SessionSelectorProps {
  value: number | undefined;
  onChange: (sessionId: number | undefined) => void;
  showAll?: boolean;
}

export function SessionSelector({ value, onChange, showAll = true }: SessionSelectorProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSessions()
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <select disabled className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-100">
        <option>Loading sessions...</option>
      </select>
    );
  }

  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value ? parseInt(e.target.value) : undefined)}
      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
    >
      {showAll && <option value="">All Sessions</option>}
      {sessions.map(session => (
        <option key={session.id} value={session.id}>
          {session.name}
          {session.isCurrent ? ' (Current)' : ''}
        </option>
      ))}
    </select>
  );
}
