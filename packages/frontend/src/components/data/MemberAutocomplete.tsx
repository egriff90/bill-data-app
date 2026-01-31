import { useState, useEffect, useRef } from 'react';
import { api, Member } from '../../api/client';

interface MemberAutocompleteProps {
  onSelect: (member: Member | null) => void;
  selectedMember: Member | null;
  placeholder?: string;
}

export function MemberAutocomplete({
  onSelect,
  selectedMember,
  placeholder = 'Search by member name...',
}: MemberAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Member[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const members = await api.searchMembers(query);
        setResults(members);
        setIsOpen(true);
      } catch (error) {
        console.error('Failed to search members:', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (member: Member) => {
    onSelect(member);
    setQuery('');
    setIsOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setQuery('');
  };

  if (selectedMember) {
    return (
      <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        {selectedMember.thumbnailUrl && (
          <img
            src={selectedMember.thumbnailUrl}
            alt={selectedMember.displayName}
            className="w-12 h-12 rounded-full object-cover"
          />
        )}
        <div className="flex-1">
          <div className="font-medium text-gray-900">{selectedMember.displayName}</div>
          <div className="text-sm text-gray-600">
            {selectedMember.party} - {selectedMember.memberFrom}
          </div>
          <div className="text-xs text-gray-500">{selectedMember.house}</div>
        </div>
        <button
          onClick={handleClear}
          className="px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded"
        >
          Clear
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => query.length >= 2 && setIsOpen(true)}
        placeholder={placeholder}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
      />
      {loading && (
        <div className="absolute right-3 top-2.5">
          <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {isOpen && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {results.map(member => (
            <button
              key={member.id}
              onClick={() => handleSelect(member)}
              className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left border-b last:border-b-0"
            >
              {member.thumbnailUrl ? (
                <img
                  src={member.thumbnailUrl}
                  alt={member.displayName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                  ?
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">{member.displayName}</div>
                <div className="text-sm text-gray-600 truncate">
                  {member.party} - {member.memberFrom}
                </div>
              </div>
              <div
                className="px-2 py-0.5 text-xs rounded"
                style={{
                  backgroundColor: member.partyColour || '#6b7280',
                  color: '#fff',
                }}
              >
                {member.house}
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute z-10 w-full mt-1 p-4 bg-white border border-gray-200 rounded-lg shadow-lg text-gray-500 text-center">
          No members found
        </div>
      )}
    </div>
  );
}
