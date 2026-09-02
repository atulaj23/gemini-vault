import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getIntegrityLedger, verifyIntegrity, IntegrityLedgerEntry, VerificationResult } from '../lib/api';

export function IntegrityVaultPage() {
  const [ledger, setLedger] = useState<IntegrityLedgerEntry[]>([]);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getIntegrityLedger()
      .then(setLedger)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);
    try {
      const result = await verifyIntegrity();
      setVerification(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="page integrity-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">🔗 Integrity Vault</h1>
          <p className="page-subtitle">Cryptographic tamper-evidence for your journal</p>
        </div>
        <button className="btn btn-primary" onClick={handleVerify} disabled={verifying}>
          {verifying ? 'Verifying…' : '🔍 Verify Entire Journal'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Explainer */}
      <div className="explainer-card">
        <h2>How Integrity Works</h2>
        <p>
          Each finalized journal entry is cryptographically linked to the previous one using SHA-256
          hashing. The server controls the chain — clients cannot forge or manipulate it. If any stored
          content is changed after finalization, the verification process will detect the broken link.
        </p>
        <div className="explainer-steps">
          <div className="step">
            <div className="step-num">1</div>
            <div className="step-text">Entry content is canonicalized and hashed (SHA-256) → <strong>contentHash</strong></div>
          </div>
          <div className="step">
            <div className="step-num">2</div>
            <div className="step-text">Server combines: <code>previousHash + contentHash + uid + sequence + timestamp</code> → <strong>chainHash</strong></div>
          </div>
          <div className="step">
            <div className="step-num">3</div>
            <div className="step-text">The chainHash becomes the next entry's previousHash, forming an unbreakable chain</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="integrity-stats">
        <div className="integrity-stat-card">
          <div className="is-value">{ledger.length}</div>
          <div className="is-label">Finalized Entries</div>
        </div>
        <div className="integrity-stat-card">
          <div className="is-value">{verification?.entriesChecked ?? '—'}</div>
          <div className="is-label">Entries Verified</div>
        </div>
        <div className="integrity-stat-card">
          <div className={`is-value ${verification ? (verification.valid ? 'valid' : 'invalid') : ''}`}>
            {verification ? (verification.valid ? '✓' : '✗') : '—'}
          </div>
          <div className="is-label">Chain Status</div>
        </div>
      </div>

      {/* Verification Result / Receipt */}
      {verification && (
        <div className={`receipt-card ${verification.valid ? 'receipt-valid' : 'receipt-invalid'}`}>
          <div className="receipt-header">
            <div className="receipt-title">
              {verification.valid ? '✅ Tamper-Evident Verification Receipt' : '❌ Integrity Violation Detected'}
            </div>
            <div className="receipt-badge">{verification.valid ? 'CHAIN INTACT' : 'CHAIN BROKEN'}</div>
          </div>
          <div className="receipt-body">
            <div className="receipt-row">
              <span className="receipt-key">Verification Status</span>
              <span className={`receipt-value ${verification.valid ? 'text-green' : 'text-red'}`}>
                {verification.valid ? 'VALID — No tampering detected' : 'INVALID — Content modification detected'}
              </span>
            </div>
            <div className="receipt-row">
              <span className="receipt-key">Entries Checked</span>
              <span className="receipt-value">{verification.entriesChecked}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-key">Verified At</span>
              <span className="receipt-value">{new Date(verification.verifiedAt).toLocaleString()}</span>
            </div>
            {verification.latestChainHash && (
              <div className="receipt-row">
                <span className="receipt-key">Latest Chain Hash</span>
                <span className="receipt-value mono receipt-hash">{verification.latestChainHash}</span>
              </div>
            )}
            {!verification.valid && (
              <>
                <div className="receipt-row">
                  <span className="receipt-key">First Invalid Entry</span>
                  <span className="receipt-value text-red">{verification.firstInvalidEntry}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-key">Failure Reason</span>
                  <span className="receipt-value text-red">{verification.reason}</span>
                </div>
              </>
            )}
          </div>
          <div className="receipt-footer">
            Generated by Gemini Vault · Server-controlled cryptographic verification ·
            Powered by Google Cloud &amp; Firebase
          </div>
        </div>
      )}

      {/* Chain Visualization */}
      <div className="chain-section">
        <h2 className="section-title">Hash Chain</h2>
        {ledger.length === 0 ? (
          <div className="empty-state">
            <p>No finalized entries yet.</p>
            <Link to="/journal" className="btn btn-outline">Go to Journal Vault →</Link>
          </div>
        ) : (
          <div className="chain-visualization">
            <div className="chain-genesis">
              <div className="genesis-badge">GENESIS</div>
              <div className="genesis-label">Chain Start</div>
            </div>
            {ledger.map((entry, idx) => (
              <div key={entry.id} className="chain-item">
                <div className="chain-connector" />
                <div className={`chain-node ${verification ? (verification.valid || (verification.firstInvalidEntry && ledger.findIndex(e => e.id === verification.firstInvalidEntry) > idx) ? 'node-valid' : 'node-invalid') : ''}`}>
                  <div className="node-header">
                    <span className="node-seq">#{entry.sequenceNumber}</span>
                    <span className="node-date">{new Date(entry.serverTimestamp).toLocaleDateString()}</span>
                  </div>
                  <div className="node-hash">
                    <span className="hash-label">Chain Hash</span>
                    <span className="mono">{entry.chainHash.substring(0, 24)}…</span>
                  </div>
                  <div className="node-prev">
                    <span className="hash-label">← Previous</span>
                    <span className="mono">{entry.previousHash.substring(0, 16)}{entry.previousHash.length > 16 ? '…' : ''}</span>
                  </div>
                  <Link to={`/journal/${entry.entryId}`} className="node-link">View Entry →</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
