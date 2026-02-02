import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, SyncStatus } from '../../api/client';

const navItems = [
  { path: '/', label: 'Amendments' },
  { path: '/statistics', label: 'Statistics' },
  { path: '/bills', label: 'Bills' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    api.getSyncStatus().then(setSyncStatus).catch(console.error);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gray-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">UK Parliament Bill Amendments</h1>
              <p className="text-gray-300 text-sm">Query and analyze amendment data</p>
            </div>
            {syncStatus && (
              <div className="text-right text-sm">
                <div className="text-gray-300">
                  {syncStatus.stats.amendments.toLocaleString()} amendments
                </div>
                {(syncStatus.lastFullSync || syncStatus.lastIncrementalSync) && (
                  <div className="text-gray-400 text-xs">
                    Last sync:{' '}
                    {(() => {
                      const fullDate = syncStatus.lastFullSync ? new Date(syncStatus.lastFullSync) : null;
                      const incDate = syncStatus.lastIncrementalSync ? new Date(syncStatus.lastIncrementalSync) : null;
                      const lastDate = fullDate && incDate
                        ? (fullDate > incDate ? fullDate : incDate)
                        : fullDate || incDate;
                      return lastDate?.toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'GMT',
                        timeZoneName: 'short',
                      });
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
          <nav className="mt-4 flex gap-1">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2 transition-colors ${
                  location.pathname === item.path
                    ? 'bg-white text-gray-900 font-medium'
                    : 'text-gray-100 hover:bg-gray-800'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>

      <footer className="bg-gray-100 border-t py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-600">
          Contains Parliamentary information licensed under the{' '}
          <a
            href="https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-700 hover:underline"
          >
            Open Parliament Licence v3.0
          </a>
        </div>
      </footer>
    </div>
  );
}
