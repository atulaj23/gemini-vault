import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getJournalEntry, finalizeJournalEntry, JournalEntry, IntegrityLedgerEntry } from '../lib/api';

function tsToFull(ts: { _seconds: number }): string {
  return new Date(ts._seconds * 1000).toLocaleString('en-US', {
    dateStyle: 'long', timeStyle: 'short',
  });
}

export function JournalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [ledger, setLedger] = useState<IntegrityLedgerEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getJournalEntry(id)
      .then(setEntry)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleFinalize = async () => {
    if (!id || !entry) return;
    const confirmed = window.confirm(
      'Finalizing this entry will add it to the tamper-evident hash chain. ' +
      'The content cannot be modified after finalization. Continue?'
    );
    if (!confirmed) return;

    setFinalizing(true);
    setError(null);
    try {
      const result = await finalizeJournalEntry(id);
      setEntry(result.entry);
      setLedger(result.integrityLedger);
      setSuccess('Entry successfully finalized and added to the Integrity Vault!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Finalization failed');
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (!entry) return <div className="page"><div className="error-banner">Entry not found</div></div>;

  return (
    <div className="page journal-detail-page">
      <div className="page-header">
        <Link to="/journal" className="back-link">← Journal Vault</Link>
        <span className={`status-badge ${entry.status}`}>
          {entry.status === 'finalized' ? '🔒 Finalized' : '📝 Draft'}
        </span>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <h1 className="entry-title">{entry.title}</h1>
      <div className="entry-meta">
        <span>Created: {tsToFull(entry.createdAt)}</span>
        {entry.finalizedAt && <span>Finalized: {tsToFull(entry.finalizedAt)}</span>}
      </div>

      {entry.tags.length > 0 && (
        <div className="journal-tags">
          {entry.tags.map((t) => <span key={t} className="tag">{t}</span>)}
        </div>
      )}

      {entry.aiSummary && (
        <div className="ai-summary-card">
          <div className="summary-label">🤖 AI Summary</div>
          <p>{entry.aiSummary}</p>
        </div>
      )}

      <div className="entry-content">
        <div className="content-label">Journal Content</div>
        <div className="content-body">{entry.content}</div>
      </div>

      {/* Integrity Metadata */}
      {entry.status === 'finalized' && (entry.contentHash || ledger) && (
        <div className="integrity-card">
          <h2 className="integrity-card-title">🔗 Integrity Metadata</h2>
          <div className="hash-grid">
            {entry.contentHash && (
              <div className="hash-row">
                <span className="hash-key">Content Hash (SHA-256)</span>
                <span className="hash-value mono">{entry.contentHash}</span>
              </div>
            )}
            {(ledger ?? entry.chainHash) && (
              <div className="hash-row">
                <span className="hash-key">Chain Hash</span>
                <span className="hash-value mono">{ledger?.chainHash ?? entry.chainHash}</span>
              </div>
            )}
            {ledger?.previousHash && (
              <div className="hash-row">
                <span className="hash-key">Previous Hash</span>
                <span className="hash-value mono">{ledger.previousHash}</span>
              </div>
            )}
            {ledger?.sequenceNumber && (
              <div className="hash-row">
                <span className="hash-key">Sequence #</span>
                <span className="hash-value">{ledger.sequenceNumber}</span>
              </div>
            )}
            {ledger?.serverTimestamp && (
              <div className="hash-row">
                <span className="hash-key">Server Timestamp</span>
                <span className="hash-value">{new Date(ledger.serverTimestamp).toLocaleString()}</span>
              </div>
            )}
          </div>
          <div className="integrity-explanation">
            <strong>What does this mean?</strong> The content hash is a SHA-256 fingerprint of your
            entry's content. The chain hash links this entry to the previous one using the server timestamp
            and sequence number — making tampering detectable. If any byte of content changes, the hashes won't match.
          </div>
        </div>
      )}

      {entry.status === 'draft' && (
        <div className="finalize-section">
          <h2 className="finalize-title">Lock This Entry</h2>
          <p className="finalize-desc">
            Finalizing adds this entry to your tamper-evident Integrity Vault. A SHA-256 hash chain
            is created server-side. Content cannot be modified after finalization.
          </p>
          <button
            className="btn btn-primary btn-finalize"
            onClick={handleFinalize}
            disabled={finalizing}
          >
            {finalizing ? 'Finalizing…' : '🔒 Finalize & Add to Integrity Vault'}
          </button>
        </div>
      )}
    </div>
  );
}
