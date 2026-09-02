import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listJournalEntries, JournalEntry } from '../lib/api';

function tsToDate(ts: { _seconds: number }): string {
  return new Date(ts._seconds * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'draft' | 'finalized'>('all');

  useEffect(() => {
    listJournalEntries()
      .then(setEntries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.status === filter);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Journal Vault</h1>
          <p className="page-subtitle">{entries.length} {entries.length === 1 ? 'entry' : 'entries'} in your vault</p>
        </div>
        <div className="filter-tabs">
          {(['all', 'draft', 'finalized'] as const).map((f) => (
            <button
              key={f}
              className={`filter-tab ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {filtered.length === 0 ? (
        <div className="empty-page">
          <div className="empty-icon">📔</div>
          <h2>No {filter !== 'all' ? filter : ''} entries yet</h2>
          <p>Save a conversation as a journal entry to get started.</p>
          <Link to="/conversations/new" className="btn btn-primary">Start a Conversation</Link>
        </div>
      ) : (
        <div className="journal-grid">
          {filtered.map((entry) => (
            <Link key={entry.id} to={`/journal/${entry.id}`} className="journal-card">
              <div className="journal-card-header">
                <span className={`status-badge ${entry.status}`}>
                  {entry.status === 'finalized' ? '🔒 Finalized' : '📝 Draft'}
                </span>
                <span className="journal-date">{tsToDate(entry.createdAt)}</span>
              </div>
              <h3 className="journal-title">{entry.title}</h3>
              {entry.aiSummary && (
                <p className="journal-summary">{entry.aiSummary}</p>
              )}
              {entry.tags.length > 0 && (
                <div className="journal-tags">
                  {entry.tags.map((t) => (
                    <span key={t} className="tag">{t}</span>
                  ))}
                </div>
              )}
              {entry.contentHash && (
                <div className="journal-hash">
                  <span className="hash-label">Hash:</span>
                  <span className="mono">{entry.contentHash.substring(0, 16)}…</span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
