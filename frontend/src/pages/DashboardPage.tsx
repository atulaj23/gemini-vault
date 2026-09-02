import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  listConversations,
  listJournalEntries,
  verifyIntegrity,
  Conversation,
  JournalEntry,
  VerificationResult,
} from '../lib/api';

function tsToDate(ts: { _seconds: number }): string {
  return new Date(ts._seconds * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function DashboardPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listConversations(), listJournalEntries()])
      .then(([c, e]) => {
        setConversations(c);
        setEntries(e);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);
    try {
      const result = await verifyIntegrity();
      setVerification(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const finalizedEntries = entries.filter((e) => e.status === 'finalized');

  if (loading) {
    return <div className="page-loading"><div className="spinner" /></div>;
  }

  return (
    <div className="page dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user?.displayName?.split(' ')[0] ?? 'there'}</p>
        </div>
        <Link to="/conversations/new" className="btn btn-primary">+ New Conversation</Link>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Stats Row */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📔</div>
          <div className="stat-value">{entries.length}</div>
          <div className="stat-label">Journal Entries</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🔒</div>
          <div className="stat-value">{finalizedEntries.length}</div>
          <div className="stat-label">Finalized</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💬</div>
          <div className="stat-value">{conversations.length}</div>
          <div className="stat-label">Conversations</div>
        </div>
        <div className="stat-card integrity-stat">
          <div className="stat-icon">🔗</div>
          <div className="stat-value">{verification ? (verification.valid ? '✓' : '✗') : '—'}</div>
          <div className="stat-label">Chain Status</div>
        </div>
      </div>

      {/* Integrity Widget */}
      <div className="integrity-widget">
        <div className="widget-header">
          <h2 className="widget-title">🔗 Integrity Vault Status</h2>
          <button className="btn btn-outline" onClick={handleVerify} disabled={verifying}>
            {verifying ? 'Verifying…' : 'Verify Integrity'}
          </button>
        </div>

        {verification ? (
          <div className={`verification-result ${verification.valid ? 'valid' : 'invalid'}`}>
            <div className="vr-status">
              {verification.valid ? '✅ Chain Intact' : '❌ Chain Compromised'}
            </div>
            <div className="vr-details">
              <span>{verification.entriesChecked} entries checked</span>
              <span>Verified at {new Date(verification.verifiedAt).toLocaleString()}</span>
              {verification.latestChainHash && (
                <span className="mono">Latest: {verification.latestChainHash.substring(0, 20)}…</span>
              )}
              {!verification.valid && verification.firstInvalidEntry && (
                <span className="vr-error">First invalid: {verification.firstInvalidEntry} · {verification.reason}</span>
              )}
            </div>
          </div>
        ) : (
          <p className="widget-hint">
            Click "Verify Integrity" to cryptographically verify your entire journal chain.
          </p>
        )}
      </div>

      <div className="dashboard-grid">
        {/* Recent Conversations */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2 className="card-title">Recent Conversations</h2>
            <Link to="/conversations" className="card-link">View all →</Link>
          </div>
          {conversations.length === 0 ? (
            <div className="empty-state">
              <p>No conversations yet.</p>
              <Link to="/conversations/new" className="btn btn-sm btn-primary">Start one</Link>
            </div>
          ) : (
            <ul className="item-list">
              {conversations.slice(0, 5).map((c) => (
                <li key={c.id} className="item-row">
                  <Link to={`/conversations/${c.id}`} className="item-link">
                    <span className="item-title">{c.title}</span>
                    <span className="item-meta">{c.messageCount} messages · {tsToDate(c.updatedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Journal Entries */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2 className="card-title">Recent Journal Entries</h2>
            <Link to="/journal" className="card-link">View all →</Link>
          </div>
          {entries.length === 0 ? (
            <div className="empty-state">
              <p>No journal entries yet.</p>
            </div>
          ) : (
            <ul className="item-list">
              {entries.slice(0, 5).map((e) => (
                <li key={e.id} className="item-row">
                  <Link to={`/journal/${e.id}`} className="item-link">
                    <span className="item-title">{e.title}</span>
                    <span className="item-meta">
                      <span className={`status-badge ${e.status}`}>{e.status}</span>
                      {' · '}{tsToDate(e.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
